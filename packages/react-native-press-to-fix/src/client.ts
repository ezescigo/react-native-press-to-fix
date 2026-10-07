import type { ChainLink, Frame } from './inspect'

export type FixStatus = 'queued' | 'fixing' | 'rebuilding' | 'live' | 'stopped'

export type ReportBody = {
  comment: string
  screen: string
  touch: { x: number; y: number }
  frame: Frame | null
  mark: string | null
  text: string | null
  chain: ChainLink[]
}

type Answer = { run: string; id: string | null; status: FixStatus | null }

export const DEFAULT_URL = 'http://127.0.0.1:4757'

/** Talks to the fixmod receiver that the Claude Code session runs. */
export function createClient(url = DEFAULT_URL) {
  const call = async <T>(path: string, init?: RequestInit, timeout = 5000): Promise<T> => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)
    try {
      const response = await fetch(`${url}${path}`, { ...init, signal: controller.signal })
      if (!response.ok) throw new Error(`fixmod receiver answered ${response.status}`)
      return (await response.json()) as T
    } finally {
      clearTimeout(timer)
    }
  }
  const post = <T>(path: string, body?: unknown, timeout?: number) =>
    call<T>(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) }, timeout)

  return {
    // The receiver answers once the screenshot is taken, which can take a few seconds.
    report: (body: ReportBody) => post<{ id: string }>('/report', body, 20_000),
    status: (id: string) => call<Answer>(`/status?id=${encodeURIComponent(id)}`),
    launched: () => post<Answer>('/launched'),
    refreshed: () => post<Answer>('/refreshed'),
  }
}

export type Client = ReturnType<typeof createClient>
