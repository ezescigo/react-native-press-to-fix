// The simulator's screen, saved as a PNG. FIXMOD_SIMCTL stands in for `xcrun` in tests.
import { execFile } from 'node:child_process'

export function screenshot(simulator, path) {
  const command = process.env.FIXMOD_SIMCTL ?? 'xcrun'
  return new Promise((resolve, reject) => {
    execFile(command, ['simctl', 'io', simulator || 'booted', 'screenshot', path], { timeout: 10_000 }, error =>
      error ? reject(error) : resolve(path),
    )
  })
}
