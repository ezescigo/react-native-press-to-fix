# FixMod — fixkit for React Native

## Context
[ostiums/fixkit](https://github.com/ostiums/fixkit): long press element in iOS sim app → type complaint → report lands in running Claude Code session → Claude fixes → banner `queued → fixing → rebuilding → live`. Two parts: Claude Code **mod** (`mod/hooks/register.tsx`, `mod/hooks/prompt.ts`, `mod/server/receiver.mjs` on 127.0.0.1:4747) + **Swift package** in app.
Goal: same for React Native. Decisions: iOS simulator only; Expo + bare RN; pure JS (no native module); source location auto from React fibers; monorepo in `/Users/ezequiel/Documents/fixmod`.

RN advantages: sim loopback reaches 127.0.0.1 directly; Fast Refresh means most fixes go live without rebuild.

## Layout
```
.claude-plugin/marketplace.json
mod/                       Claude Code plugin (port of fixkit mod)
  .claude-plugin/plugin.json
  hooks/hooks.json, register.tsx, prompt.ts
  server/receiver.mjs, screenshot.mjs, symbolicate.mjs
  types/index.d.ts
  tests/
packages/react-native-press-to-fix/   npm package (TS)
  src/FixHost.tsx, Composer.tsx, Banner.tsx, Fixable.tsx, inspect.ts, client.ts, refresh.ts, index.ts
  tests/
example/                   Expo demo app w/ seeded UI bugs (git tag demo-start)
scripts/test.sh, reset-demo.sh
PLAN.md                    copy of this plan, updated per step
```

## Progress
- [x] 0 scaffold
- [x] 1 mod ported (prompt tests pass; status tests need CC ≥2.1.287 — `prompt.compose` missing in 2.1.285)
- [x] 2 receiver (5 node tests pass). Port 4757 (avoid fixkit clash). Source via fiber chain + Metro /symbolicate (origin read from stack URLs). Screen auto-detect dropped: component chain covers it
- [x] 3 RN package (8 RNTL tests pass, tsc clean). Composer placed on half away from element instead of slide-up. Fast Refresh via wrapped `__ReactRefresh.performReactRefresh`
- [x] 4 example app (Pocket, 4 seeded bugs). E2E in sim via Expo Go: long press → composer → report w/ `QuickActions.tsx:9`, components, outlined screenshot; Fast Refresh → `/refreshed` → banner
- [x] 5 README
- [x] Bugs found in e2e (fixed, tests green): (a) Return sends stale comment — keystrokes not yet in state; (b) refresh/launch announce wipes banner comment
- [x] Renamed to react-native-press-to-fix (npm pkg, plugin `press-to-fix`); repo github.com/ezescigo/react-native-press-to-fix, tag demo-start

## Steps

0. Copy plan → `./PLAN.md`; `git init`; workspace root `package.json` (npm workspaces).

1. **Mod** — port fixkit mod near-verbatim (MIT, credit in README).
   - `register.tsx`: keep atoms, `patch`/`accept`/`listen`, pane render, `/fix-queue` command, `turn.complete` logic. Rename plugin key `fixmod`, dir `.fixmod/`.
   - Status flow: `queued → fixing → live` (Fast Refresh) or `→ rebuilding → live` when Bash runs `expo run:ios` / `react-native run-ios` / `pod install` (replace `isBuildAndRun` w/ `isNativeRebuild(tool, command)`).
   - `prompt.ts`: new `INSTRUCTIONS` for RN: `[fix r1] Button "Send" · <QuickActions> in <HomeScreen> · src/home/QuickActions.tsx:8 · .fixmod/reports/r1.png`. Tell Claude: start at file:line; else search component name + text; smallest change; JS edits hot-reload (no rebuild); rebuild only on native changes.
   - `promptFor`/`pressedLabel`: describe `{ text, componentStack, source, mark }` instead of AX/UIKit fields.

2. **Receiver** (`receiver.mjs`, no deps) — keep port takeover, ppid watchdog, `/status`, `/shutdown`, ordered delivery. Changes:
   - `/report`: screenshot via `xcrun simctl io <udid|booted> screenshot` (app shows red outline on element, waits for reply, then removes outline → outline in shot, composer not).
   - Symbolicate raw owner-stack frames by POST to Metro `http://127.0.0.1:${metroPort}/symbolicate` → first frame in project (not node_modules) = `file:line`.
   - `/refreshed`: app reports Fast Refresh applied → emit `{type:'launched'}` (reuse mod's live path); `/launched` on cold start.
   - Drop AXe.

3. **RN package** `react-native-press-to-fix`
   - `<FixHost>` wraps root (`__DEV__` only; prod returns children). Detects long press (500ms, <10px move) via `onTouchStart/Move/End` on wrapper View — observes without claiming responder, so app gestures keep working.
   - `inspect.ts`: at touch point use RN's `getInspectorDataForViewAtPoint` (version shim for path: `Libraries/Inspector/…` vs `src/private/inspector/…`) → hierarchy names, frame, props, text; owner `_debugStack` (React 19) or `_debugSource` (React 18) → raw frames/source. Innermost `<Fixable name>` ancestor wins.
   - `<Fixable name>` / `fixable(name)`: optional mark → exact name in report.
   - `Composer.tsx`: absolute overlay, TextInput, Return sends; slide up when keyboard hides element.
   - `client.ts`: POST `/report` `{comment, touch, frame, text, componentStack, frames, source?, mark?, screen, simulator}`; poll `/status?id=` every 1s → `Banner`.
   - `refresh.ts`: wrap `global.__ReactRefresh.performReactRefresh` → POST `/refreshed` (spike; fallback: mark live on turn complete w/ edits).
   - `useFixScreen(name)` names screen; auto from React Navigation state if present.
   - Host URL: `http://127.0.0.1:4747`, overridable prop.

4. **Example app** (Expo, TS): wallet-ish 3 screens, 4 one-line seeded bugs (shifted button, mismatched radius, truncated text, wrong colour). `scripts/reset-demo.sh` restores tag `demo-start`, boots sim, `npx expo run:ios`.

5. **README**: quick start (install plugin, `npm i -D react-native-press-to-fix`, wrap root, `.fixmod/` in .gitignore, `Read(./.fixmod/**)` permission), how it works diagram.

## Tests (behavioral only)
- Mod: port fixkit `prompt.test.ts`, `status.test.ts` → prompt line formats per case (marked, source only, text only, touch only); status transitions incl. Fast Refresh live, native rebuild, stopped.
- Receiver (node:test): POST /report → JSON line emitted in order, screenshot file written (simctl stubbed via env `FIXMOD_SIMCTL`), symbolicate picks first project frame (Metro stubbed), port takeover.
- Package (@testing-library/react-native + jest): long press opens composer; short press/drag doesn't; Return posts report w/ comment + mark name; banner follows polled status; prod (`__DEV__=false`) renders children only.

## Verification
1. `scripts/test.sh` green.
2. `claude --plugin-dir ./mod` in `example/`; run app in iOS sim; long press seeded bug → report in session w/ file:line, screenshot outlined; Claude edits → Fast Refresh → banner `live`; pane shows queue.

## Unresolved questions
- Name ok? `fixmod` / `react-native-press-to-fix`?
- Min RN/React version? (proposal RN 0.76+, React 18/19)
- Expo Go support required, or dev builds ok?
- Publish to npm / marketplace now or later?
- Port 4747 clashes w/ fixkit if both installed — use 4757?
