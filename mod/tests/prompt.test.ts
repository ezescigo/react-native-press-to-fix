import { expect, test } from 'claude-code/testing'

import { describePressed, isNativeRebuild, pressedLabel, promptFor } from '../core/prompt.mjs'

test('an unmarked element is named by its text, its components and its source line', () => {
  const prompt = promptFor(
    {
      id: 'r1',
      comment: 'Income should be green',
      screen: 'Activity',
      screenshot: '.fixmod/reports/r1.png',
      touch: { x: 321, y: 686 },
      pressed: { type: 'Text', text: '+€4,650.00' },
      components: ['AmountLabel', 'TransactionRow', 'ActivityScreen'],
    },
    'src/activity/AmountLabel.tsx:12',
  )

  expect(prompt).toBe(
    'Income should be green\n\n' +
      '[fix r1] src/activity/AmountLabel.tsx:12 · Text "+€4,650.00" in <AmountLabel> in <TransactionRow> in <ActivityScreen> · .fixmod/reports/r1.png',
  )
})

test('a marked element leads with its name', () => {
  const prompt = promptFor(
    {
      id: 'r2',
      comment: 'This button is out of line',
      screen: 'Home',
      screenshot: '.fixmod/reports/r2.png',
      mark: 'home.quickActions.send',
      pressed: { type: 'Text', text: 'Send' },
      components: ['QuickActions'],
    },
    'src/home/QuickActions.tsx:8',
  )

  expect(prompt).toBe(
    'This button is out of line\n\n' +
      '[fix r2] home.quickActions.send · src/home/QuickActions.tsx:8 · Text "Send" in <QuickActions> · .fixmod/reports/r2.png',
  )
})

test('without a source line, the screen helps find the element', () => {
  const prompt = promptFor(
    {
      id: 'r3',
      comment: 'Too much padding',
      screen: 'Cards',
      screenshot: null,
      pressed: { type: 'View', text: null },
      components: ['CardList'],
    },
    null,
  )

  expect(prompt).toBe('Too much padding\n\n[fix r3] View in <CardList> · Cards screen')
})

test('only the three nearest components are named', () => {
  expect(describePressed({ type: 'Text', text: 'Hi' }, ['A', 'B', 'C', 'D'])).toBe('Text "Hi" in <A> in <B> in <C>')
})

test('with nothing known, the touch point stands in', () => {
  const prompt = promptFor(
    { id: 'r4', comment: 'Too dark', screen: '', screenshot: null, touch: { x: 120.4, y: 339.6 } },
    null,
  )

  expect(prompt).toBe('Too dark\n\n[fix r4] touch at 120,340')
})

test('the pane names a marked element, else what was pressed, else the screen', () => {
  const pressed = { type: 'Text', text: 'Send' }
  expect(pressedLabel({ mark: 'home.send', pressed, components: [], screen: 'Home' })).toBe('home.send')
  expect(pressedLabel({ mark: null, pressed, components: ['QuickActions'], screen: 'Home' })).toBe('Text "Send" in <QuickActions>')
  expect(pressedLabel({ mark: null, pressed: null, components: [], screen: 'Home' })).toBe('Home screen')
  expect(pressedLabel({ mark: null, pressed: null, components: [], screen: '' })).toBe('unnamed element')
})

test('a native build shows as rebuilding; a JavaScript edit does not', () => {
  expect(isNativeRebuild('Bash', 'npx expo run:ios')).toBe(true)
  expect(isNativeRebuild('Bash', 'cd app && npx react-native run-ios --simulator "iPhone 17"')).toBe(true)
  expect(isNativeRebuild('Bash', 'cd ios && pod install')).toBe(true)
  expect(isNativeRebuild('mcp__XcodeBuildMCP__build_run_sim')).toBe(true)
  expect(isNativeRebuild('Bash', 'npx tsc --noEmit')).toBe(false)
  expect(isNativeRebuild('Edit')).toBe(false)
})
