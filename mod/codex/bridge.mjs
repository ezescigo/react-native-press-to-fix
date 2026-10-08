// press-to-fix for Codex: an MCP server that Codex starts with the session. It runs the same
// receiver as the Claude Code mod, turns each report into a turn on this project's Codex
// thread through the app-server daemon, and offers a `fix_queue` tool listing the requests.
// No dependencies.
import { execFileSync, spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'

import { INSTRUCTIONS, pressedLabel } from '../core/prompt.mjs'
import { connectAppServer } from './appserver.mjs'
import { createFixes } from './fixes.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const log = text => process.stderr.write(`press-to-fix: ${text}\n`)

/**
 * The project folder. Codex starts plugin MCP servers in the plugin's own folder, so the
 * project is read from the Codex process that started this one.
 */
function projectFolder() {
  if (process.env.FIXMOD_PROJECT) return process.env.FIXMOD_PROJECT
  try {
    const out = execFileSync('lsof', ['-a', '-p', String(process.ppid), '-d', 'cwd', '-Fn'], { encoding: 'utf8' })
    const line = out.split('\n').find(row => row.startsWith('n'))
    if (line) return line.slice(1)
  } catch {}
  return process.cwd()
}

const cwd = projectFolder()
const statusFile = join(cwd, '.fixmod', 'status.json')
let receiverState = 'starting'
let receiverNotice = ''
const pressed = new Map()

// The app-server connection, replaced when the daemon restarts.
let server = null
const rpc = {
  call: (method, params) => (server ? server.call(method, params) : Promise.reject(new Error('not connected to the Codex app-server'))),
}

const fixes = createFixes({
  rpc,
  cwd,
  writeStatuses(statuses) {
    try {
      mkdirSync(dirname(statusFile), { recursive: true })
      writeFileSync(statusFile, JSON.stringify(statuses))
    } catch (error) {
      log(`status: ${error.message}`)
    }
  },
})

async function connect() {
  try {
    server = await connectAppServer({
      onNotification: (method, params) => fixes.notification(method, params),
      onClose: () => {
        server = null
      },
    })
    await fixes.start()
  } catch (error) {
    server = null
    log(`app-server: ${error.message}`)
  }
}

// The receiver, as the Claude Code mod runs it: one JSON line per event on its stdout.
const receiver = spawn('node', [join(here, '..', 'server', 'receiver.mjs')], { cwd, stdio: ['ignore', 'pipe', 'inherit'] })
createInterface({ input: receiver.stdout }).on('line', line => {
  let event
  try {
    event = JSON.parse(line)
  } catch {
    return
  }
  if (event.type === 'ready') receiverState = `listening on 127.0.0.1:${event.port}`
  else if (event.type === 'error') receiverState = `failed: ${event.message}`
  else if (event.type === 'notice') receiverNotice = event.message
  else if (event.type === 'launched') fixes.launched()
  else if (event.type === 'report') {
    pressed.set(event.report.id, pressedLabel({ mark: null, pressed: null, components: [], ...event.report }))
    void fixes.accept(event.report)
  }
})
receiver.on('exit', code => (receiverState = `stopped (${code})`))

void connect()
// Reconnects after a daemon restart, and starts reports that waited for a session.
setInterval(() => {
  if (!server) void connect()
  else void fixes.retry()
}, 3000).unref()

function queueText() {
  const lines = [`press-to-fix receiver: ${receiverState}`, `project: ${cwd}`]
  const notice = fixes.notice() || receiverNotice
  if (notice) lines.push(notice)
  const all = fixes.list()
  if (all.length === 0) lines.push('No fix requests yet. Long press an element in the app, type what is wrong and press Return.')
  for (const one of all) {
    lines.push(`${one.id} ${one.status}: "${one.comment}" · ${pressed.get(one.id) ?? ''}${one.edited.length ? ` · edited ${one.edited.join(', ')}` : ''}`)
  }
  return lines.join('\n')
}

// MCP over stdio: newline-delimited JSON-RPC.
const TOOL = {
  name: 'fix_queue',
  description: 'List the fix requests sent from the React Native app in the iOS simulator, with their status.',
  inputSchema: { type: 'object', properties: {} },
}

const reply = (id, result) => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n')
const fail = (id, message) => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32601, message } }) + '\n')

createInterface({ input: process.stdin })
  .on('line', line => {
    let message
    try {
      message = JSON.parse(line)
    } catch {
      return
    }
    const { id, method, params } = message
    if (id === undefined) return
    if (method === 'initialize') {
      reply(id, {
        protocolVersion: params?.protocolVersion ?? '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: { name: 'press-to-fix', version: '0.1.1' },
        instructions: INSTRUCTIONS,
      })
    } else if (method === 'tools/list') reply(id, { tools: [TOOL] })
    else if (method === 'tools/call' && params?.name === TOOL.name) reply(id, { content: [{ type: 'text', text: queueText() }] })
    else if (method === 'ping') reply(id, {})
    else fail(id, `unknown method ${method}`)
  })
  // The session is over.
  .on('close', () => {
    receiver.kill()
    process.exit(0)
  })
