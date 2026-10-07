// Receives fix reports from a React Native app's debug build and hands them to the fixmod
// mod: one JSON line on stdout per event. Started by the mod with $.process.spawn and killed
// with it. One receiver owns the port at a time: a newer one asks the older one to leave.
// No dependencies: screenshots come from `xcrun simctl`, source lines from Metro.
import { createServer } from 'node:http'
import { mkdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

import { screenshot } from './screenshot.mjs'
import { locate } from './source.mjs'

const PORT = Number(process.env.FIXMOD_PORT ?? 4757)
const cwd = process.cwd()
const dir = join(cwd, '.fixmod')
const reportsDir = join(dir, 'reports')
const statusFile = join(dir, 'status.json')
// Tells this run's report ids apart from an earlier run's.
const run = Date.now().toString(36)
let count = 0

const emit = event => process.stdout.write(JSON.stringify(event) + '\n')
const ACTIVE = new Set(['queued', 'fixing', 'rebuilding'])

/**
 * The screenshot, while the app keeps the pressed element outlined: the app waits for the
 * answer before it takes the outline down. Null when the simulator can't be read.
 */
async function capture(id, simulator) {
  const path = join('.fixmod', 'reports', `${id}.png`)
  try {
    await screenshot(simulator, join(cwd, path))
    return path
  } catch (error) {
    process.stderr.write(`screenshot: ${error.message}\n`)
    return null
  }
}

/** What the prompt says about the pressed element, from the fibers the app found under it. */
async function describe(report) {
  try {
    const { type, source, components } = await locate(report.chain ?? [], cwd)
    return { pressed: type ? { type, text: report.text ?? null } : null, source, components }
  } catch (error) {
    process.stderr.write(`locate: ${error.message}\n`)
    return { pressed: null, source: null, components: [] }
  }
}

// Reports reach the mod in the order they arrived, each once its own lookup is done.
let delivered = Promise.resolve()

// The session that started this receiver is gone when its pipe breaks or the
// process is handed to launchd. Without this the receiver would keep the port
// and swallow every report meant for the next session.
const parent = process.ppid
process.stdout.on('error', () => process.exit(0))
setInterval(() => {
  if (process.ppid !== parent) process.exit(0)
}, 1000).unref()

// The mod writes every status change to this file; the app polls it through us.
const statuses = () => {
  try {
    return JSON.parse(readFileSync(statusFile, 'utf8'))
  } catch {
    return {}
  }
}

const reply = (res, code, body) => {
  res.writeHead(code, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`)

  if (req.method === 'GET' && url.pathname === '/status') {
    const id = url.searchParams.get('id')
    return reply(res, 200, { run, id, status: id ? (statuses()[id] ?? 'queued') : null })
  }

  // The app launched, or Fast Refresh applied an edit: during a fix that means the fix is on
  // screen. The answer is the report Claude is working on, else the newest one.
  if (req.method === 'POST' && (url.pathname === '/launched' || url.pathname === '/refreshed')) {
    emit({ type: 'launched' })
    const all = statuses()
    const id = Object.keys(all).find(key => ACTIVE.has(all[key])) ?? (count > 0 ? `r${count}` : null)
    return reply(res, 200, { run, id, status: id ? (all[id] ?? 'queued') : null })
  }

  if (req.method === 'POST' && url.pathname === '/report') {
    const chunks = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => {
      let report
      try {
        report = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      } catch (error) {
        return reply(res, 400, { error: String(error) })
      }
      const id = `r${++count}`
      const shot = capture(id, report.simulator)
      const described = describe(report)
      void shot.then(() => reply(res, 200, { id }))
      delivered = delivered.then(async () => {
        const { comment, screen = '', touch, mark = null } = report
        emit({
          type: 'report',
          report: { id, comment, screen, touch, mark, screenshot: await shot, ...(await described) },
        })
      })
    })
    return
  }

  // A newer session's receiver asks for the port.
  if (req.method === 'POST' && url.pathname === '/shutdown') {
    reply(res, 200, { run })
    emit({ type: 'error', message: 'a newer session took over the reports' })
    server.close(() => process.exit(0))
    server.closeAllConnections()
    return
  }

  reply(res, 404, { error: 'not found' })
})

// The port is taken by an earlier receiver: one left behind by a closed session, or the
// one a reload of the mod is replacing. Ask it to leave, then try again.
let attempts = 0
server.on('error', error => {
  if (error.code === 'EADDRINUSE' && ++attempts <= 10) {
    fetch(`http://127.0.0.1:${PORT}/shutdown`, { method: 'POST' })
      .catch(() => {})
      .finally(() => setTimeout(() => server.listen(PORT, '127.0.0.1'), 300))
    return
  }
  emit({ type: 'error', message: error.code === 'EADDRINUSE' ? `port ${PORT} is in use` : String(error) })
  process.exit(1)
})

server.listen(PORT, '127.0.0.1', () => {
  // Only the receiver that holds the port may clear the previous run's files.
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(reportsDir, { recursive: true })
  emit({ type: 'ready', port: PORT })
})
