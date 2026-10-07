import { spawn } from 'node:child_process'
import { chmodSync, existsSync, mkdtempSync, realpathSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { after, test } from 'node:test'
import assert from 'node:assert/strict'

const RECEIVER = new URL('../server/receiver.mjs', import.meta.url).pathname
const project = realpathSync(mkdtempSync(join(tmpdir(), 'fixmod-')))

// Stands in for `xcrun simctl io <udid> screenshot <path>`: writes a file at the path.
const simctl = join(project, 'simctl')
writeFileSync(simctl, '#!/bin/sh\nfor last; do :; done\nprintf png > "$last"\n')
chmodSync(simctl, 0o755)

// Stands in for Metro: maps bundle line N to a file named by the test.
const sources = new Map()
const metro = createServer((req, res) => {
  const chunks = []
  req.on('data', chunk => chunks.push(chunk))
  req.on('end', () => {
    const { stack } = JSON.parse(Buffer.concat(chunks).toString())
    const mapped = stack.map(frame => ({ ...frame, ...(sources.get(frame.lineNumber) ?? {}) }))
    res.end(JSON.stringify({ stack: mapped, codeFrame: null }))
  })
})
await new Promise(resolve => metro.listen(0, '127.0.0.1', resolve))
const bundle = `http://127.0.0.1:${metro.address().port}/index.bundle?platform=ios&dev=true`
after(() => metro.close())

let nextPort = 47570 + Math.floor(Math.random() * 1000)

/** A receiver in the test project, and its stdout events as they come. */
async function start(port = nextPort++) {
  const child = spawn('node', [RECEIVER], {
    cwd: project,
    env: { ...process.env, FIXMOD_PORT: String(port), FIXMOD_SIMCTL: simctl },
    stdio: ['ignore', 'pipe', 'inherit'],
  })
  const events = createInterface({ input: child.stdout })[Symbol.asyncIterator]()
  const next = async () => JSON.parse((await events.next()).value)
  after(() => child.kill())
  assert.deepEqual(await next(), { type: 'ready', port })

  const post = (path, body) =>
    fetch(`http://127.0.0.1:${port}${path}`, { method: 'POST', body: body && JSON.stringify(body) }).then(r => r.json())
  return { child, next, post, port }
}

/** A fiber's `_debugStack` as Hermes prints it, with the JSX call on bundle line `line`. */
const stack = line => `Error: react-stack-top-frame\n    at jsxDEV (${bundle}:1:1)\n    at Render (${bundle}:${line}:7)`

test('a report names the innermost element written in the project, its line and its components', async () => {
  sources.set(10, { file: `${project}/node_modules/react-native/Libraries/Text/Text.js`, lineNumber: 300, methodName: 'Text' })
  sources.set(20, { file: `${project}/src/AmountLabel.tsx`, lineNumber: 12, methodName: 'AmountLabel' })
  sources.set(30, { file: `${project}/src/TransactionRow.tsx`, lineNumber: 8, methodName: 'TransactionRow' })
  const { next, post } = await start()

  const answer = await post('/report', {
    comment: 'Income should be green',
    screen: 'Activity',
    touch: { x: 321, y: 686 },
    text: '+€4,650.00',
    chain: [
      { name: 'RCTText', owner: 'Text', stack: stack(10) },
      { name: 'Text', owner: 'AmountLabel', stack: stack(20) },
      { name: 'AmountLabel', owner: 'TransactionRow', stack: stack(30) },
    ],
  })
  const { report } = await next()

  assert.equal(answer.id, 'r1')
  assert.deepEqual(report, {
    id: 'r1',
    comment: 'Income should be green',
    screen: 'Activity',
    touch: { x: 321, y: 686 },
    mark: null,
    screenshot: `${project}/.fixmod/reports/r1.png`,
    pressed: { type: 'Text', text: '+€4,650.00' },
    source: { file: `${project}/src/AmountLabel.tsx`, line: 12, column: 7 },
    components: ['AmountLabel', 'TransactionRow'],
  })
  assert.ok(existsSync(join(project, '.fixmod/reports/r1.png')))
})

test('a React 18 fiber carries its own source, without Metro', async () => {
  const { next, post } = await start()

  await post('/report', {
    comment: 'Bold',
    mark: 'home.title',
    chain: [
      { name: 'RCTText', owner: 'Text', source: { fileName: `${project}/node_modules/react-native/Text.js`, lineNumber: 1 } },
      { name: 'Text', owner: 'Home', source: { fileName: `${project}/src/Home.tsx`, lineNumber: 4, columnNumber: 5 } },
    ],
  })
  const { report } = await next()

  assert.equal(report.mark, 'home.title')
  assert.deepEqual(report.source, { file: `${project}/src/Home.tsx`, line: 4, column: 5 })
  assert.deepEqual(report.components, ['Home'])
})

test('reports reach the mod in the order they were sent', async () => {
  const { next, post } = await start()

  await Promise.all(['first', 'second', 'third'].map(comment => post('/report', { comment })))
  const comments = [(await next()).report, (await next()).report, (await next()).report].map(r => [r.id, r.comment])

  assert.deepEqual(comments.map(([id]) => id), ['r1', 'r2', 'r3'])
})

test('a Fast Refresh or a launch tells the mod, and the app reads statuses back', async () => {
  const { next, post, port } = await start()
  await post('/report', { comment: 'Too dark' })
  await next()
  writeFileSync(join(project, '.fixmod/status.json'), JSON.stringify({ r1: 'fixing' }))

  const refreshed = await post('/refreshed')
  assert.deepEqual(await next(), { type: 'launched' })
  await post('/launched')
  assert.deepEqual(await next(), { type: 'launched' })
  const status = await fetch(`http://127.0.0.1:${port}/status?id=r1`).then(r => r.json())

  assert.equal(refreshed.id, 'r1')
  assert.equal(status.status, 'fixing')
})

test('a newer receiver takes the port over', async () => {
  const older = await start()
  const exited = new Promise(resolve => older.child.on('exit', resolve))

  await start(older.port)

  assert.deepEqual(await older.next(), { type: 'error', message: 'a newer session took over the reports' })
  await exited
})
