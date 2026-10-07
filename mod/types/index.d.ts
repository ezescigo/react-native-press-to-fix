export type FixStatus = 'queued' | 'fixing' | 'rebuilding' | 'live' | 'stopped'

/** The host element under the touch, as the app reads it from React. */
export type Pressed = {
  /** The host component: Text, View, Image, TextInput… */
  type: string
  /** The text it shows, its accessibility label or placeholder, when it has one. */
  text: string | null
}

/** A report as the receiver prints it, one JSON line each. */
export type Incoming = {
  id: string
  comment: string
  screen: string
  screenshot: string | null
  touch?: { x: number; y: number }
  /** The innermost `<Fixable name>` around the pressed element. */
  mark?: string | null
  pressed?: Pressed | null
  /** The app's own components around the pressed element, innermost first: QuickActions, HomeScreen. */
  components?: string[]
  /** Where the pressed element is written, symbolicated by the receiver. */
  source?: { file: string; line: number; column?: number } | null
}

export type FixReport = {
  id: string
  comment: string
  mark: string | null
  pressed: Pressed | null
  components: string[]
  /** `path:line` of the pressed element's JSX, relative to the project. */
  source: string | null
  screen: string
  screenshot: string | null
  status: FixStatus
  receivedAt: number
  finishedAt: number | null
  /** Names of the files Claude edited for this report. */
  edited: string[]
}

export type Receiver = {
  state: 'starting' | 'listening' | 'failed'
  detail: string
  /** Advice that stays in the pane. */
  notice?: string
}

declare module 'claude-code' {
  interface PluginState {
    'press-to-fix': { reports: FixReport[]; receiver: Receiver; now: number }
  }
}
