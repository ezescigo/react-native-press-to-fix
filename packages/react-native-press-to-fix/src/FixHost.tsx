import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Keyboard, StyleSheet, View } from 'react-native'
import type { GestureResponderEvent } from 'react-native'

import { Banners, type Tracked } from './Banner'
import { createClient, type FixStatus } from './client'
import { Composer, Highlight } from './Composer'
import { FixBoundary, describeFiber, fiberAt, type Inspection } from './inspect'
import { onFastRefresh } from './refresh'

const LONG_PRESS_MS = 500
const SLOP = 10
const POLL_MS = 1000
const DONE: ReadonlyArray<Tracked['status']> = ['live', 'stopped', 'unreachable']

const ScreenContext = createContext<(name: string) => void>(() => {})

/** Names the screen in every report sent while the calling component is mounted. */
export function useFixScreen(name: string) {
  const setScreen = useContext(ScreenContext)
  useEffect(() => setScreen(name), [name, setScreen])
}

type Props = {
  children: ReactNode
  /** The fixmod receiver. Defaults to http://127.0.0.1:4757. */
  url?: string
}

/**
 * Wrap the app's root in it. In a development build, a long press anywhere opens a composer
 * that sends what is wrong to the Claude Code session; in production it renders the children.
 */
export function FixHost({ children, url }: Props) {
  if (!__DEV__) return <>{children}</>
  return <DevHost url={url}>{children}</DevHost>
}

type Pressed = Inspection & { touch: { x: number; y: number } }
type Phase = { kind: 'idle' } | { kind: 'composing'; pressed: Pressed } | { kind: 'sending'; pressed: Pressed }

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

function DevHost({ children, url }: Props) {
  const client = useMemo(() => createClient(url), [url])
  const root = useRef<View>(null)
  const press = useRef<{ x: number; y: number; timer: ReturnType<typeof setTimeout> } | null>(null)
  const screen = useRef('')
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const [tracked, setTracked] = useState<Tracked[]>([])

  const track = useCallback((id: string, comment: string | null, status: Tracked['status']) => {
    // A launch or refresh names the report without its comment; keep the one already shown.
    setTracked(all => {
      const known = all.find(one => one.id === id)
      return [...all.filter(one => one.id !== id), { id, comment: comment ?? known?.comment ?? null, status }]
    })
  }, [])

  // A launch, or a Fast Refresh, tells the session the fix is on screen; the answer names the
  // report being fixed, which a relaunched app follows again.
  useEffect(() => {
    const announce = (answer: { id: string | null; status: FixStatus | null }) => {
      if (answer.id && answer.status && !DONE.includes(answer.status)) track(answer.id, null, answer.status)
    }
    client.launched().then(announce, () => {})
    return onFastRefresh(() => {
      client.refreshed().then(announce, () => {})
    })
  }, [client, track])

  const following = tracked.filter(one => !DONE.includes(one.status)).map(one => one.id).join(',')
  useEffect(() => {
    if (!following) return
    const timer = setInterval(() => {
      for (const id of following.split(',')) {
        client.status(id).then(
          ({ status }) => status && setTracked(all => all.map(one => (one.id === id ? { ...one, status } : one))),
          () => {},
        )
      }
    }, POLL_MS)
    return () => clearInterval(timer)
  }, [client, following])

  // Finished requests leave a few seconds after they finish.
  const finished = tracked.filter(one => DONE.includes(one.status)).map(one => one.id).join(',')
  useEffect(() => {
    if (!finished) return
    const timer = setTimeout(() => setTracked(all => all.filter(one => !finished.split(',').includes(one.id))), 4000)
    return () => clearTimeout(timer)
  }, [finished])

  const cancelPress = () => {
    if (press.current) clearTimeout(press.current.timer)
    press.current = null
  }

  const open = async (x: number, y: number) => {
    const found = await fiberAt(root.current, x, y).catch(() => null)
    const inspection = found ? { frame: found.frame, ...describeFiber(found.fiber) } : { frame: null, chain: [], mark: null, text: null }
    setPhase({ kind: 'composing', pressed: { ...inspection, touch: { x, y } } })
  }

  const onTouchStart = (event: GestureResponderEvent) => {
    cancelPress()
    if (phase.kind !== 'idle' || event.nativeEvent.touches.length > 1) return
    const { pageX: x, pageY: y } = event.nativeEvent
    press.current = { x, y, timer: setTimeout(() => void open(x, y), LONG_PRESS_MS) }
  }

  const onTouchMove = (event: GestureResponderEvent) => {
    const start = press.current
    if (!start) return
    const { pageX, pageY } = event.nativeEvent
    if (Math.abs(pageX - start.x) > SLOP || Math.abs(pageY - start.y) > SLOP) cancelPress()
  }

  const send = async (pressed: Pressed, comment: string) => {
    // The composer goes and the outline stays while the simulator's screen is captured.
    setPhase({ kind: 'sending', pressed })
    Keyboard.dismiss()
    await wait(350)
    const { frame, chain, mark, text, touch } = pressed
    try {
      const { id } = await client.report({ comment, screen: screen.current, touch, frame, mark, text, chain })
      track(id, comment, 'queued')
    } catch {
      track(`unreachable-${Date.now()}`, null, 'unreachable')
    }
    setPhase({ kind: 'idle' })
  }

  const setScreen = useCallback((name: string) => {
    screen.current = name
  }, [])

  return (
    <View
      ref={root}
      style={styles.root}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={cancelPress}
      onTouchCancel={cancelPress}
    >
      <ScreenContext.Provider value={setScreen}>
        <FixBoundary>{children}</FixBoundary>
      </ScreenContext.Provider>
      {phase.kind === 'composing' && (
        <Composer
          frame={phase.pressed.frame}
          touch={phase.pressed.touch}
          label={phase.pressed.mark ?? phase.pressed.text}
          onSend={comment => void send(phase.pressed, comment)}
          onCancel={() => setPhase({ kind: 'idle' })}
        />
      )}
      {phase.kind === 'sending' && <Highlight frame={phase.pressed.frame} touch={phase.pressed.touch} />}
      {phase.kind === 'idle' && <Banners tracked={tracked} />}
    </View>
  )
}

const styles = StyleSheet.create({ root: { flex: 1 } })
