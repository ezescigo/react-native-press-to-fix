import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { Pressable, Text, View } from 'react-native'

import { FixHost, Fixable, useFixScreen } from '../src'
import { fiberAt } from '../src/inspect'

// The renderer's hit test needs the native view tree; the test points it at an element instead.
jest.mock('../src/inspect', () => ({ ...jest.requireActual('../src/inspect'), fiberAt: jest.fn() }))

/** A receiver the test drives: it records what the app sends and answers with `status`. */
function receiver({ reachable = true } = {}) {
  const sent: Record<string, any>[] = []
  let status = 'queued'
  globalThis.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    if (!reachable) throw new TypeError('Network request failed')
    const path = new URL(url).pathname
    const body = init?.body ? JSON.parse(String(init.body)) : null
    if (path === '/report') sent.push(body)
    // Like the receiver: /status answers for the report asked about, /launched and /refreshed for the newest.
    const id = path === '/status' || sent.length > 0 ? 'r1' : null
    const answer = path === '/report' ? { id: 'r1' } : { run: 'x', id, status: id ? status : null }
    return { ok: true, json: async () => answer } as Response
  }) as jest.Mock
  return { sent, setStatus: (next: string) => (status = next) }
}

const onSend = jest.fn()

// Metro's Fast Refresh runtime, which applies an edit to the running app.
const refresh = { performReactRefresh: () => {} }
;(globalThis as any).__ReactRefresh = refresh

function Home() {
  useFixScreen('Home')
  return (
    <View>
      <Text>Balance</Text>
      <Fixable name="home.send">
        <Pressable onPress={onSend}>
          <Text>Send</Text>
        </Pressable>
      </Fixable>
    </View>
  )
}

async function renderApp() {
  await render(
    <FixHost>
      <Home />
    </FixHost>,
  )
}

const touch = (x: number, y: number) => ({ nativeEvent: { pageX: x, pageY: y, touches: [{}] } })

/** Holds a finger on the element with `text`, which the hit test reports with `frame`. */
async function longPress(text: string, ms = 500) {
  const element = screen.getByText(text)
  jest.mocked(fiberAt).mockResolvedValue({
    fiber: (element as any).unstable_fiber,
    frame: { left: 20, top: 300, width: 80, height: 30 },
  })
  await fireEvent(element, 'touchStart', touch(40, 310))
  await act(async () => {
    jest.advanceTimersByTime(ms)
  })
  return element
}

async function type(comment: string) {
  const input = screen.getByLabelText("What's wrong?")
  await fireEvent.changeText(input, comment)
  await fireEvent(input, 'submitEditing')
  await act(async () => {
    jest.advanceTimersByTime(400)
  })
}

beforeEach(() => {
  jest.useFakeTimers()
  onSend.mockClear()
})

afterEach(() => {
  jest.useRealTimers()
})

test('a long press opens the composer on the pressed element, named by its mark', async () => {
  receiver()
  await renderApp()

  await longPress('Send')

  expect(screen.getByLabelText("What's wrong?")).toBeOnTheScreen()
  expect(screen.getByText('home.send')).toBeOnTheScreen()
})

test('a sent report carries the comment, the mark, the text, the screen and the fibers', async () => {
  const { sent } = receiver()
  await renderApp()

  await longPress('Send')
  await type('Button is shifted')

  expect(sent).toHaveLength(1)
  expect(sent[0]).toMatchObject({
    comment: 'Button is shifted',
    mark: 'home.send',
    text: 'Send',
    screen: 'Home',
    touch: { x: 40, y: 310 },
    frame: { left: 20, top: 300, width: 80, height: 30 },
  })
  expect(sent[0].chain.map((link: { name: string }) => link.name)).toEqual(expect.arrayContaining(['Text', 'Home']))
  expect(screen.queryByLabelText("What's wrong?")).not.toBeOnTheScreen()
})

test('the banner follows the report until it is live', async () => {
  const { setStatus } = receiver()
  await renderApp()
  await longPress('Send')
  await type('Button is shifted')

  expect(screen.getByText('r1 queued · Button is shifted')).toBeOnTheScreen()

  setStatus('fixing')
  await act(async () => {
    jest.advanceTimersByTime(1000)
  })
  expect(screen.getByText('r1 fixing · Button is shifted')).toBeOnTheScreen()

  setStatus('live')
  await act(async () => {
    jest.advanceTimersByTime(1000)
  })
  expect(screen.getByText('r1 live · Button is shifted')).toBeOnTheScreen()

  await act(async () => {
    jest.advanceTimersByTime(4000)
  })
  expect(screen.queryByText(/r1 live/)).not.toBeOnTheScreen()
})

test('Return sends everything typed, even keystrokes not yet rendered', async () => {
  const { sent } = receiver()
  await renderApp()

  await longPress('Send')
  const input = screen.getByLabelText("What's wrong?")
  await fireEvent.changeText(input, 'Send button i')
  await fireEvent(input, 'submitEditing', { nativeEvent: { text: 'Send button is shifted' } })
  await act(async () => {
    jest.advanceTimersByTime(400)
  })

  expect(sent[0].comment).toBe('Send button is shifted')
})

test('a Fast Refresh during the fix keeps the banner on the comment', async () => {
  const { setStatus } = receiver()
  await renderApp()
  await longPress('Send')
  await type('Button is shifted')

  setStatus('fixing')
  await act(async () => {
    refresh.performReactRefresh()
  })

  expect(screen.getByText('r1 fixing · Button is shifted')).toBeOnTheScreen()
})

test('an empty comment sends nothing', async () => {
  const { sent } = receiver()
  await renderApp()

  await longPress('Send')
  await type('   ')

  expect(sent).toHaveLength(0)
  expect(screen.queryByLabelText("What's wrong?")).not.toBeOnTheScreen()
})

test('a tap does not open the composer, and the app still gets the press', async () => {
  receiver()
  await renderApp()

  const element = await longPress('Send', 200)
  await fireEvent(element, 'touchEnd', touch(40, 310))
  await fireEvent.press(element)
  await act(async () => {
    jest.advanceTimersByTime(1000)
  })

  expect(screen.queryByLabelText("What's wrong?")).not.toBeOnTheScreen()
  expect(onSend).toHaveBeenCalled()
})

test('a drag, such as a scroll, does not open the composer', async () => {
  receiver()
  await renderApp()

  const element = screen.getByText('Balance')
  await fireEvent(element, 'touchStart', touch(40, 310))
  await fireEvent(element, 'touchMove', touch(40, 360))
  await act(async () => {
    jest.advanceTimersByTime(1000)
  })

  expect(screen.queryByLabelText("What's wrong?")).not.toBeOnTheScreen()
})

test('without a Claude Code session, the banner says so', async () => {
  receiver({ reachable: false })
  await renderApp()

  await longPress('Balance')
  await type('Too small')

  expect(screen.getByText('Claude Code is not listening: run claude in the project')).toBeOnTheScreen()
})

test('a production build renders the app alone', async () => {
  const dev = (globalThis as any).__DEV__
  ;(globalThis as any).__DEV__ = false
  try {
    receiver()
    await renderApp()

    await longPress('Send')

    expect(screen.getByText('Send')).toBeOnTheScreen()
    expect(screen.queryByLabelText("What's wrong?")).not.toBeOnTheScreen()
  } finally {
    ;(globalThis as any).__DEV__ = dev
  }
})
