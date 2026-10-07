import { test } from 'node:test'
import assert from 'node:assert/strict'

import { createFixes } from '../fixes.mjs'

/**
 * A Codex app-server the test drives: threads it knows, the turns it was asked to start,
 * and a way to send the notifications Codex would.
 */
function codex({ threads = [{ id: 't-app', cwd: '/app', status: { type: 'idle' }, recencyAt: 2 }] } = {}) {
  const started = []
  let turns = 0
  let notify = () => {}
  const rpc = {
    async call(method, params) {
      if (method === 'thread/loaded/list') return { data: threads.map(t => t.id) }
      if (method === 'thread/read') return { thread: threads.find(t => t.id === params.threadId) }
      if (method === 'thread/resume') return {}
      if (method === 'turn/start') {
        started.push(params)
        return { turn: { id: `turn-${++turns}`, status: 'inProgress', items: [] } }
      }
      throw new Error(`unexpected ${method}`)
    },
  }
  return {
    rpc,
    started,
    connect: on => (notify = on),
    send: (method, params) => notify(method, { threadId: 't-app', ...params }),
  }
}

function world(options) {
  const server = codex(options)
  const statuses = []
  const fixes = createFixes({
    rpc: server.rpc,
    cwd: '/app',
    writeStatuses: all => statuses.push(all),
  })
  server.connect((method, params) => fixes.notification(method, params))
  return { server, statuses, fixes }
}

const settle = () => new Promise(resolve => setImmediate(resolve))

const report = (id, extra = {}) => ({
  id,
  comment: 'Prices should show cents',
  screen: 'Menu',
  screenshot: `/app/.fixmod/reports/${id}.png`,
  pressed: { type: 'Text', text: '$4.5' },
  components: ['DrinkRow'],
  source: { file: '/app/src/DrinkRow.tsx', line: 15 },
  ...extra,
})

test("a report starts a turn on this project's thread, with the prompt and the screenshot", async () => {
  const { server, statuses, fixes } = world({
    threads: [
      { id: 't-other', cwd: '/elsewhere', status: { type: 'idle' }, recencyAt: 9 },
      { id: 't-old', cwd: '/app', status: { type: 'idle' }, recencyAt: 1 },
      { id: 't-app', cwd: '/app', status: { type: 'idle' }, recencyAt: 2 },
    ],
  })

  await fixes.accept(report('r1'))
  await settle()

  assert.equal(server.started.length, 1)
  assert.equal(server.started[0].threadId, 't-app')
  assert.deepEqual(server.started[0].input, [
    {
      type: 'text',
      text: 'Prices should show cents\n\n[fix r1] /app/src/DrinkRow.tsx:15 · Text "$4.5" in <DrinkRow> · /app/.fixmod/reports/r1.png',
      text_elements: [],
    },
    { type: 'localImage', path: '/app/.fixmod/reports/r1.png' },
  ])
  assert.deepEqual(statuses.map(all => all.r1), ['queued', 'fixing'])
})

test('while Codex is busy, a report waits and starts when the turn ends', async () => {
  const { server, statuses, fixes } = world()
  await fixes.start()
  server.send('turn/started', { turn: { id: 'user-turn', status: 'inProgress' } })

  await fixes.accept(report('r1'))
  await settle()
  assert.equal(server.started.length, 0)
  assert.equal(statuses.at(-1).r1, 'queued')

  server.send('turn/completed', { turn: { id: 'user-turn', status: 'completed' } })
  await settle()

  assert.equal(server.started.length, 1)
  assert.equal(statuses.at(-1).r1, 'fixing')
})

test('reports are worked through one at a time, in order', async () => {
  const { server, fixes } = world()

  await fixes.accept(report('r1'))
  await fixes.accept(report('r2', { comment: 'Second' }))
  await settle()
  assert.equal(server.started.length, 1)

  server.send('turn/completed', { turn: { id: 'turn-1', status: 'completed' } })
  await settle()

  assert.equal(server.started.length, 2)
  assert.match(server.started[1].input[0].text, /^Second/)
})

test('a Fast Refresh during the fix makes it live, and a finished turn keeps it live', async () => {
  const { server, statuses, fixes } = world()
  await fixes.accept(report('r1'))
  await settle()

  server.send('item/completed', { turnId: 'turn-1', item: { type: 'fileChange', changes: [{ path: '/app/src/menu.ts' }] } })
  fixes.launched()
  server.send('turn/completed', { turn: { id: 'turn-1', status: 'completed' } })
  await settle()

  assert.deepEqual(statuses.map(all => all.r1), ['queued', 'fixing', 'fixing', 'live', 'live'])
  assert.deepEqual(fixes.list()[0].edited, ['menu.ts'])
})

test('a native build shows as rebuilding', async () => {
  const { server, statuses, fixes } = world()
  await fixes.accept(report('r1'))
  await settle()

  server.send('item/started', { turnId: 'turn-1', item: { type: 'commandExecution', command: 'npx expo run:ios' } })

  assert.equal(statuses.at(-1).r1, 'rebuilding')
})

test('a turn that ends without the app refreshing is not on screen', async () => {
  const { server, statuses, fixes } = world()
  await fixes.accept(report('r1'))
  await settle()

  server.send('turn/completed', { turn: { id: 'turn-1', status: 'completed' } })
  await settle()

  assert.equal(statuses.at(-1).r1, 'stopped')
})

test('without a Codex session in this folder, the report waits and says why', async () => {
  const { server, statuses, fixes } = world({ threads: [{ id: 't-other', cwd: '/elsewhere', status: { type: 'idle' }, recencyAt: 1 }] })

  await fixes.accept(report('r1'))
  await settle()

  assert.equal(server.started.length, 0)
  assert.equal(statuses.at(-1).r1, 'queued')
  assert.match(fixes.notice(), /no Codex session/i)
})
