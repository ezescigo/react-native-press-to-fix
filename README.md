# Press to Fix

**Long press anything in your React Native app in the iOS simulator, say what's wrong, and Claude Code fixes it.**

A React Native port of [FixKit](https://github.com/ostiums/fixkit) (MIT). Works with Expo (Expo Go and dev builds) and bare React Native.

1. **Long press** an element and type what's wrong.
2. **The report lands** in the Claude Code session already running in your project: the element, the file and line of its JSX, the components around it, a screenshot, your words.
3. **Claude fixes the code**, Fast Refresh puts it on screen, and a banner follows the fix: `queued → fixing → live`.

Press to Fix has two parts: the **press-to-fix mod** for Claude Code receives reports, and the **`react-native-press-to-fix`** package sends them from a development build. Production builds render your app untouched.

## Quick start

**You need**

- Claude Code 2.1.287+ and Node.js 18.2+
- Xcode and an iOS simulator (Press to Fix works in the simulator only)
- React Native 0.76+ (React 18 or 19), with or without Expo

### 1. Install the mod

```bash
claude plugin marketplace add ezescigo/react-native-press-to-fix
claude plugin install press-to-fix@press-to-fix
```

It runs its receiver on `127.0.0.1:4757` while the session is open (`FIXMOD_PORT` to change it).

### 2. Add the package

```bash
npm install --save-dev react-native-press-to-fix
```

### 3. Wrap the root

```tsx
import { FixHost } from 'react-native-press-to-fix'

export default function App() {
  return (
    <FixHost>
      <RootNavigator />
    </FixHost>
  )
}
```

### 4. Run it

1. Add `.fixmod/` to `.gitignore`. Reports are written there.
2. Let Claude open the screenshots without asking, in the project's Claude Code settings:

   ```json
   { "permissions": { "allow": ["Read(./.fixmod/**)"] } }
   ```

3. Start the app in the simulator (`npx expo start --ios`, or `npx react-native run-ios`) and `claude` in the project's root.
4. Long press an element, type what's wrong, press Return.

`/fix-queue` opens the Fix queue pane.

## Pointing at the right code

Nothing has to be marked. Press to Fix reads React's fibers under the finger and Metro maps them to source:

```
[fix r1] src/components/QuickActions.tsx:9 · Text "Send" in <QuickActions> in <HomeScreen> · .fixmod/reports/r1.png
```

- **The line is where the pressed element's JSX is written**, in your code, never inside `node_modules`: a press on a `<Text>` inside a library button names the line where you used the button.
- **Components** are yours, innermost first.

Wrap a view in `<Fixable>` to give it a name:

```tsx
<Fixable name="home.quickActions.send">
  <Pressable onPress={send}>
    <Text>Send</Text>
  </Pressable>
</Fixable>
```

```
[fix r2] home.quickActions.send · src/components/QuickActions.tsx:9 · Text "Send" in <QuickActions> · .fixmod/reports/r2.png
```

`useFixScreen('Home')` names the screen in every report sent while the calling component is mounted.

## How it works

```
app (FixHost) ──POST /report──▶ receiver (node, 127.0.0.1:4757) ──xcrun simctl io screenshot──▶ simulator
      ▲                               │ ──POST /symbolicate──▶ Metro
      │ POST /refreshed, GET /status  ▼ one JSON line per report
      └──────── .fixmod/status.json ◀── the mod: prompt, Fix queue pane, statuses
```

- **The long press** takes half a second. FixHost watches touches without claiming them, so buttons, lists and scroll views keep working; a drag cancels it.
- **The element** comes from the same hit test as React Native's element inspector. The app sends the fibers from the pressed view outward; React 19's `_debugStack` (or React 18's `_debugSource`) says where each was created, and the receiver asks Metro to map it to a file and line.
- **The screenshot** is taken by the receiver while the app outlines the element and hides the composer.
- **"Live"** means Fast Refresh applied an edit (or the app launched again after a native rebuild) while Claude worked on the report.
- **One session at a time.** A session started later takes port 4757 over.

## Try it on Pocket

`example/` is an Expo wallet with four seeded UI bugs, linked to the package in this repository:

```bash
npm install
./scripts/reset-demo.sh          # puts the bugs back and opens Pocket in the simulator
cd example && claude --plugin-dir ../mod
```

| Where | Long press | Say |
| --- | --- | --- |
| Home | the Send button | button is shifted |
| Home | the Top up button | corners don't match the others |
| Home or Cards | the card holder name | name is cut off |
| Home or Activity | the salary amount | income should be green, not expenses |

## Development

`scripts/test.sh` runs every check: plugin validation, the mod's and the receiver's tests, the package's tests and types, and the example's types.

## License

MIT, see [LICENSE](LICENSE).
