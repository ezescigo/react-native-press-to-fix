type Refresh = { performReactRefresh?: () => unknown }

const listeners = new Set<() => void>()
let wrapped = false

/**
 * Calls `listener` after every Fast Refresh: an edit is on screen. Metro looks the refresh
 * runtime up on the global at each update, so wrapping its method once is enough.
 * Returns the unsubscribe function.
 */
export function onFastRefresh(listener: () => void) {
  listeners.add(listener)
  if (!wrapped) {
    const global = globalThis as Record<string, unknown> & { __METRO_GLOBAL_PREFIX__?: string }
    const refresh = global[`${global.__METRO_GLOBAL_PREFIX__ ?? ''}__ReactRefresh`] as Refresh | undefined
    if (refresh?.performReactRefresh) {
      const perform = refresh.performReactRefresh.bind(refresh)
      refresh.performReactRefresh = () => {
        const result = perform()
        listeners.forEach(call => call())
        return result
      }
      wrapped = true
    }
  }
  return () => {
    listeners.delete(listener)
  }
}
