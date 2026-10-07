// The Codex side of press-to-fix: each report becomes a turn on the Codex session running in
// this project, and the session's notifications move the report along
// queued → fixing → rebuilding → live (or stopped), as the Claude Code mod does with its hooks.
import { basename } from 'node:path'

import { isNativeRebuild, promptFor } from '../core/prompt.mjs'

const NO_SESSION =
  'No Codex session in this folder is on the shared app-server. Start `codex` here without -c/--enable overrides, ' +
  'and keep the Codex CLI on the same version as the daemon (`codex app-server daemon version`).'

/**
 * @param {{
 *   rpc: { call(method: string, params?: object): Promise<any> },
 *   cwd: string,
 *   writeStatuses: (statuses: Record<string, string>) => void,
 * }} options
 */
export function createFixes({ rpc, cwd, writeStatuses }) {
  /** @type {Map<string, { id: string, comment: string, prompt: string, screenshot: string | null, status: string, turnId: string | null, edited: string[] }>} */
  const reports = new Map()
  const waiting = []
  let thread = null
  let busy = false
  let current = null
  let starting = false
  let notice = ''

  const publish = () => writeStatuses(Object.fromEntries([...reports.values()].map(one => [one.id, one.status])))
  const set = (report, status) => {
    report.status = status
    publish()
  }

  /** This project's Codex thread: the most recent one the daemon has loaded in this folder. */
  async function findThread() {
    if (thread) return thread
    const { data = [] } = await rpc.call('thread/loaded/list', {})
    const threads = []
    for (const id of data) {
      const { thread: one } = await rpc.call('thread/read', { threadId: id, includeTurns: false })
      if (one?.cwd === cwd) threads.push(one)
    }
    const found = threads.sort((a, b) => (b.recencyAt ?? 0) - (a.recencyAt ?? 0))[0]
    if (!found) {
      notice = NO_SESSION
      return null
    }
    // Attaching sends this client the thread's notifications, as it does for the TUI.
    await rpc.call('thread/resume', { threadId: found.id, excludeTurns: true }).catch(() => {})
    thread = found.id
    busy = found.status?.type === 'active'
    notice = ''
    return thread
  }

  /** Starts the next waiting report when Codex is free. */
  async function pump() {
    if (busy || current || starting || waiting.length === 0) return
    starting = true
    try {
      const threadId = await findThread()
      if (!threadId) return
      const report = reports.get(waiting.shift())
      current = report
      const input = [{ type: 'text', text: report.prompt, text_elements: [] }]
      if (report.screenshot) input.push({ type: 'localImage', path: report.screenshot })
      const { turn } = await rpc.call('turn/start', { threadId, input })
      report.turnId ??= turn?.id ?? null
      busy = true
      set(report, 'fixing')
    } catch (error) {
      notice = `Codex refused the report: ${error.message}`
      if (current) {
        waiting.unshift(current.id)
        current = null
      }
    } finally {
      starting = false
    }
  }

  return {
    /** Attaches to this project's thread, so Codex's own turns are known before a report comes. */
    start: () => findThread().catch(error => (notice = `Codex app-server: ${error.message}`)),

    /** A report from the receiver. */
    async accept(incoming) {
      const { file, line } = incoming.source ?? {}
      const source = file && line ? `${file}:${line}` : null
      reports.set(incoming.id, {
        id: incoming.id,
        comment: incoming.comment,
        prompt: promptFor(incoming, source),
        screenshot: incoming.screenshot ?? null,
        status: 'queued',
        turnId: null,
        edited: [],
      })
      waiting.push(incoming.id)
      publish()
      await pump()
    },

    /** The app refreshed or launched while Codex works on a report: the fix is on screen. */
    launched() {
      if (current) set(current, 'live')
    },

    /** A notification from the app-server. */
    notification(method, params) {
      if (!thread || params.threadId !== thread) return
      const ours = current && (params.turnId ?? params.turn?.id) === current.turnId

      if (method === 'turn/started') {
        busy = true
        // The start can be announced before turn/start answers with its id.
        if (current && current.turnId === null) current.turnId = params.turn?.id ?? null
      } else if (method === 'turn/completed') {
        busy = false
        if (ours) {
          const finished = current
          current = null
          set(finished, params.turn?.status === 'completed' && finished.status === 'live' ? 'live' : 'stopped')
        }
        void pump()
      } else if (ours && method === 'item/started' && params.item?.type === 'commandExecution') {
        if (isNativeRebuild('Bash', params.item.command)) set(current, 'rebuilding')
      } else if (ours && method === 'item/completed' && params.item?.type === 'fileChange') {
        for (const change of params.item.changes ?? []) {
          const name = basename(change.path)
          if (!current.edited.includes(name)) current.edited.push(name)
        }
        publish()
      }
    },

    /** Every report and where it stands, newest last. */
    list: () => [...reports.values()].map(({ prompt, ...rest }) => rest),
    notice: () => notice,
    retry: () => pump(),
  }
}
