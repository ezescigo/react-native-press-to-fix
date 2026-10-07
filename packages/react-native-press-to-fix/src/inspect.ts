import type { ReactNode } from 'react'

/** A box in window coordinates. */
export type Frame = { left: number; top: number; width: number; height: number }

/** One fiber around the pressed view, as the receiver turns it into a source line. */
export type ChainLink = {
  name: string
  /** The component whose render created this element. */
  owner: string | null
  /** React 19: the stack of the JSX call, in bundle coordinates. */
  stack?: string
  /** React 18: where Babel says the JSX is. */
  source?: { fileName: string; lineNumber: number; columnNumber?: number }
}

export type Inspection = {
  frame: Frame | null
  chain: ChainLink[]
  mark: string | null
  text: string | null
}

// The parts of a fiber read here. Fibers are React's internals, present in development builds.
export type Fiber = {
  type: unknown
  return: Fiber | null
  child: Fiber | null
  sibling: Fiber | null
  memoizedProps: Record<string, unknown> | null
  _debugOwner?: { type?: unknown; name?: string } | null
  _debugStack?: { stack?: string } | null
  _debugSource?: ChainLink['source'] | null
}

/** Marks the element whose code should change, so reports name it exactly. Renders its children. */
export function Fixable({ children }: { name: string; children: ReactNode }) {
  return children
}

/** Where FixHost's own tree begins: fibers above it are not the app's. */
export function FixBoundary({ children }: { children: ReactNode }) {
  return children
}

function nameOf(type: unknown): string | null {
  if (typeof type === 'string') return type
  if (type === null || (typeof type !== 'function' && typeof type !== 'object')) return null
  const named = type as { displayName?: string; name?: string; render?: unknown; type?: unknown }
  if (named.displayName) return named.displayName
  if (typeof type === 'function') return named.name || null
  // forwardRef and memo wrap the component that has the name.
  return nameOf(named.render ?? named.type)
}

function ownerName(fiber: Fiber) {
  const owner = fiber._debugOwner
  if (!owner) return null
  return owner.name ?? nameOf(owner.type)
}

const MAX_TEXT = 80

/** The text a view shows: its own and its children's strings, else its accessibility label. */
function textOf(fiber: Fiber): string | null {
  const parts: string[] = []
  const visit = (node: Fiber | null, depth: number) => {
    for (let at = node; at && depth < 20; at = at.sibling) {
      const children = at.memoizedProps?.children
      if (typeof at.memoizedProps === 'string') parts.push(at.memoizedProps)
      else if (typeof children === 'string' || typeof children === 'number') parts.push(String(children))
      else visit(at.child, depth + 1)
      if (parts.join('').length > MAX_TEXT) return
    }
  }
  const own = fiber.memoizedProps?.children
  if (typeof own === 'string' || typeof own === 'number') parts.push(String(own))
  else visit(fiber.child, 0)

  const text = parts.join('').trim()
  if (text) return text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT - 1)}…` : text
  const props = fiber.memoizedProps ?? {}
  const label = props.accessibilityLabel ?? props['aria-label'] ?? props.placeholder
  return typeof label === 'string' && label ? label : null
}

/**
 * What the app knows about a pressed host view: the fibers from it outward to FixHost, the
 * innermost `<Fixable>` around it and the text it shows.
 */
export function describeFiber(host: Fiber): Omit<Inspection, 'frame'> {
  const chain: ChainLink[] = []
  let mark: string | null = null

  for (let fiber: Fiber | null = host; fiber; fiber = fiber.return) {
    if (fiber.type === FixBoundary) break
    if (fiber.type === Fixable && mark === null) mark = String(fiber.memoizedProps?.name ?? '')
    const name = nameOf(fiber.type)
    const stack = fiber._debugStack?.stack
    const source = fiber._debugSource ?? undefined
    if (!name || (!stack && !source) || chain.length >= 40) continue
    chain.push({ name, owner: ownerName(fiber), ...(source ? { source } : { stack }) })
  }

  return { chain, mark, text: textOf(host) }
}

type ViewData = { closestInstance?: unknown; frame: Frame; hierarchy: unknown[] }
type Renderer = {
  rendererConfig?: {
    getInspectorDataForViewAtPoint?: (view: unknown, x: number, y: number, callback: (data: ViewData) => void) => void
  }
}

/**
 * The host fiber under a point in `root` and its frame, through the renderer React DevTools
 * sees: the same lookup as React Native's element inspector.
 */
export function fiberAt(root: unknown, x: number, y: number): Promise<{ fiber: Fiber; frame: Frame } | null> {
  const hook = (globalThis as { __REACT_DEVTOOLS_GLOBAL_HOOK__?: { renderers?: Map<number, Renderer> } })
    .__REACT_DEVTOOLS_GLOBAL_HOOK__
  const renderers = [...(hook?.renderers?.values() ?? [])]

  return new Promise(resolve => {
    let pending = 0
    for (const renderer of renderers) {
      const lookup = renderer.rendererConfig?.getInspectorDataForViewAtPoint
      if (!lookup) continue
      pending++
      lookup(root, x, y, data => {
        pending--
        if (data?.closestInstance && data.hierarchy.length > 0) {
          resolve({ fiber: data.closestInstance as Fiber, frame: data.frame })
        } else if (pending === 0) resolve(null)
      })
    }
    if (pending === 0) resolve(null)
    setTimeout(() => resolve(null), 1000)
  })
}
