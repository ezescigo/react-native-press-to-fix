// JSON-RPC to the Codex app-server daemon that the Codex TUI runs on.
import { homedir } from 'node:os'
import { join } from 'node:path'

import { connectWebSocket } from './ws.mjs'

export const DAEMON_SOCKET = join(process.env.CODEX_HOME ?? join(homedir(), '.codex'), 'app-server-control', 'app-server-control.sock')

/**
 * Connects, initializes, and returns `call(method, params)` plus a notification hook.
 * `onNotification(method, params)` sees every notification the daemon sends this client.
 */
export async function connectAppServer({ socket = DAEMON_SOCKET, onNotification = () => {}, onClose = () => {} } = {}) {
  let next = 0
  const pending = new Map()

  const connection = await connectWebSocket(socket, {
    onMessage(text) {
      let message
      try {
        message = JSON.parse(text)
      } catch {
        return
      }
      if (message.id !== undefined && pending.has(message.id)) {
        const { resolve, reject } = pending.get(message.id)
        pending.delete(message.id)
        if (message.error) reject(new Error(`${message.error.message ?? 'app-server error'}`))
        else resolve(message.result)
      } else if (message.method && message.id === undefined) {
        onNotification(message.method, message.params ?? {})
      }
    },
    onClose(error) {
      for (const { reject } of pending.values()) reject(error ?? new Error('app-server closed'))
      pending.clear()
      onClose(error)
    },
  })

  const call = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++next
      pending.set(id, { resolve, reject })
      connection.send(JSON.stringify({ id, method, params }))
    })

  await call('initialize', { clientInfo: { name: 'press-to-fix', title: 'press-to-fix', version: '0.1.0' } })
  connection.send(JSON.stringify({ method: 'initialized' }))

  return { call, close: () => connection.close() }
}
