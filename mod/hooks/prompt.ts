import type { FixReport, Incoming, Pressed } from '../types'

/** What a `[fix …]` prompt calls for; sent with the system prompt while the mod is loaded. */
export const INSTRUCTIONS = `# Fix requests from the running app

A prompt that ends with a line like

[fix r1] src/activity/AmountLabel.tsx:12 · Text "+€4,650.00" in <AmountLabel> in <TransactionRow> · .fixmod/reports/r1.png
[fix r2] home.quickActions.send · src/home/QuickActions.tsx:8 · Text "Send" in <QuickActions> · .fixmod/reports/r2.png
[fix r3] View in <CardList> · Cards screen · .fixmod/reports/r3.png

was sent from the React Native app running in the iOS simulator by the press-to-fix mod: someone long-pressed an element and typed the text above that line. The line holds the report's id and what is known about the element: the name of the <Fixable name="…"> around it when the app marks it; the file and line of the JSX that rendered it; the host element (Text, View, Image…) with its text; the app's own components around it, innermost first; the screen's name when no line is known; and a screenshot with the element outlined in red, or a red ring where the finger was.

When a prompt carries that line:
- Treat the text above it as the request. It may be a bug ("button is shifted") or a change ("make this green").
- With a file and line, start there: the cause is on that element, its style, or the component that renders it.
- Without one, find the innermost named component and search the sources for it and the text; text made from data (an amount, a date) is found through the component that formats it.
- Styles may live in a StyleSheet at the bottom of the file, a theme module, or a className; follow them to where the value is set.
- Make the smallest change that does what was asked. Do not refactor.
- Open the screenshot only when the text and the code leave the request unclear.
- A JavaScript or TypeScript change reaches the screen through Fast Refresh: do not rebuild or relaunch the app for it. Rebuild (npx expo run:ios or npx react-native run-ios) only when the change touches native code, native dependencies or app config.
- Answer in one or two sentences: what was wrong and what changed.`

/** The pressed host element in words, with the app's components around it. */
export function describePressed(pressed: Pressed, components: string[] = []) {
  let text = pressed.type
  if (pressed.text) text += ` ${JSON.stringify(pressed.text)}`
  for (const name of components.slice(0, 3)) text += ` in <${name}>`
  return text
}

/**
 * The prompt: the person's comment as they typed it, then one line of context.
 * `INSTRUCTIONS` tells the model what a message carrying a `[fix …]` line calls for.
 */
export function promptFor(incoming: Incoming, source: string | null) {
  const { comment, id, mark, pressed, components, screen, screenshot, touch } = incoming
  const context = [
    mark,
    source,
    pressed ? describePressed(pressed, components) : null,
    // A source line says where the element is; otherwise the screen's name helps find it.
    !source && screen ? `${screen} screen` : null,
    !mark && !pressed && touch ? `touch at ${Math.round(touch.x)},${Math.round(touch.y)}` : null,
    screenshot,
  ].filter((part): part is string => Boolean(part))

  return `${comment}\n\n[fix ${id}] ${context.join(' · ')}`
}

/** How the pane names what was pressed: the mark, else the pressed element, else the screen. */
export function pressedLabel({ mark, pressed, components, screen }: Pick<FixReport, 'mark' | 'pressed' | 'components' | 'screen'>) {
  if (mark) return mark
  if (pressed) return describePressed(pressed, components)
  return screen ? `${screen} screen` : 'unnamed element'
}

const NATIVE_BUILD = /\b(?:expo run:ios|react-native run-ios|pod install|xcodebuild)\b/

/**
 * Whether a tool call builds the app's native side, during which the pane shows the report as
 * rebuilding. A JavaScript change reaches the screen through Fast Refresh without one.
 */
export function isNativeRebuild(tool: string, command?: string) {
  if (/(?:^|_)build_run_sim$/.test(tool)) return true
  return tool === 'Bash' && command !== undefined && NATIVE_BUILD.test(command)
}
