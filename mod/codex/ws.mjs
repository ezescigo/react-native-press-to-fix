// A minimal WebSocket client over a unix socket, which is how Codex's app-server daemon
// listens. No dependencies: text frames out (masked, as clients must), text and continuation
// frames in, pings answered.
import { randomBytes } from 'node:crypto'
import net from 'node:net'

const TEXT = 0x1
const CLOSE = 0x8
const PING = 0x9
const PONG = 0xa

function frame(opcode, data) {
  const length = data.length
  const head =
    length < 126
      ? Buffer.from([0x80 | opcode, 0x80 | length])
      : length < 65536
        ? Buffer.from([0x80 | opcode, 0x80 | 126, length >> 8, length & 0xff])
        : Buffer.concat([Buffer.from([0x80 | opcode, 0x80 | 127]), bigEndian64(length)])
  const mask = randomBytes(4)
  const body = Buffer.alloc(length)
  for (let i = 0; i < length; i++) body[i] = data[i] ^ mask[i & 3]
  return Buffer.concat([head, mask, body])
}

function bigEndian64(n) {
  const out = Buffer.alloc(8)
  out.writeBigUInt64BE(BigInt(n))
  return out
}

/** Opens `path`, upgrades to WebSocket, and calls `onMessage` with each text message. */
export function connectWebSocket(path, { onMessage, onClose = () => {} }) {
  return new Promise((resolve, reject) => {
    const socket = net.connect(path)
    let buffered = Buffer.alloc(0)
    let upgraded = false
    let fragments = []

    const send = (opcode, data) => socket.write(frame(opcode, data))
    const connection = {
      send: text => send(TEXT, Buffer.from(text)),
      close: () => socket.end(),
    }

    socket.on('connect', () => {
      const key = randomBytes(16).toString('base64')
      socket.write(
        `GET / HTTP/1.1\r\nHost: localhost\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n` +
          `Sec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`,
      )
    })
    socket.on('error', error => (upgraded ? onClose(error) : reject(error)))
    socket.on('close', () => upgraded && onClose(null))
    socket.on('data', chunk => {
      buffered = Buffer.concat([buffered, chunk])
      if (!upgraded) {
        const end = buffered.indexOf('\r\n\r\n')
        if (end === -1) return
        const status = buffered.subarray(0, end).toString().split('\r\n')[0]
        if (!/ 101 /.test(status)) return reject(new Error(`app-server refused the upgrade: ${status}`))
        buffered = buffered.subarray(end + 4)
        upgraded = true
        resolve(connection)
      }
      for (;;) {
        if (buffered.length < 2) return
        const final = (buffered[0] & 0x80) !== 0
        const opcode = buffered[0] & 0x0f
        let length = buffered[1] & 0x7f
        let offset = 2
        if (length === 126) {
          if (buffered.length < 4) return
          length = buffered.readUInt16BE(2)
          offset = 4
        } else if (length === 127) {
          if (buffered.length < 10) return
          length = Number(buffered.readBigUInt64BE(2))
          offset = 10
        }
        if (buffered.length < offset + length) return
        const payload = buffered.subarray(offset, offset + length)
        buffered = buffered.subarray(offset + length)

        if (opcode === PING) send(PONG, payload)
        else if (opcode === CLOSE) socket.end()
        else if (opcode === TEXT || opcode === 0) {
          fragments.push(payload)
          if (final) {
            onMessage(Buffer.concat(fragments).toString('utf8'))
            fragments = []
          }
        }
      }
    })
  })
}
