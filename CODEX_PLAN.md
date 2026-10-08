# Codex support: plan

## Context
press-to-fix works with Claude Code only. The app package and the receiver don't care which agent is on the other end: they speak HTTP and write `.fixmod/`. The Claude-specific part is the mod, which puts each report into the running session as a prompt, tracks status and draws the pane. Decision: **one repo for both agents, using the app-server route now.**

What Codex CLI 0.160.1 offers, checked locally:
- `plugin_hooks` is **removed**, so a plugin can't ship hooks. The Stop-hook approach is dropped.
- `daemon_auto_start` is **stable and on**: the TUI runs on the shared app-server daemon, and `codex app-server proxy` connects any process to it over stdio.
- app-server JSON-RPC (schema from `codex app-server generate-json-schema`):
  - `thread/loaded/list`: threads carry `cwd`, `status` and `recencyAt`.
  - `turn/start {threadId, input}`: input accepts `text` and `localImage`.
  - Notifications: `turn/started`, `turn/completed`, `item/started`, `item/completed`.
- `codex queue --thread <id> --message … -i <png>` queues a message for an existing session.
- Plugins bundle `skills` and `mcpServers` (`.mcp.json`; `cwd: "."` means the plugin root). The marketplace lives at `.agents/plugins/marketplace.json`.

## Approach
A Codex plugin in the **same `mod/` folder** as the Claude one, sharing the receiver and the prompt code:

```
mod/
  .claude-plugin/plugin.json      Claude: hooks module (register.tsx)
  .codex-plugin/plugin.json       Codex: skill + MCP server
  .mcp.json                       → node codex/bridge.mjs
  core/prompt.mjs (+ .d.mts)      shared: INSTRUCTIONS, promptFor, pressedLabel, isNativeRebuild
  codex/bridge.mjs                MCP server (stdio) that runs the receiver + app-server client
  skills/press-to-fix/SKILL.md    tells Codex what a [fix rN] prompt means
  server/                         receiver (unchanged)
.agents/plugins/marketplace.json  Codex marketplace → ./mod
```

The bridge is started by Codex with the session, the same way the Claude mod spawns the receiver:
1. Find this session's thread: `thread/loaded/list` through `codex app-server proxy`, choosing the thread whose `cwd` matches the project, most recent first.
2. Start the receiver in that `cwd`.
3. On a report: if the thread is idle, call `turn/start` with the prompt text plus a `localImage` of the screenshot. If it's busy, keep the report `queued` and start it when `turn/completed` arrives.
4. Track statuses from notifications:
   - our `turn/started` → `fixing`
   - a native-build `commandExecution` item → `rebuilding`
   - `fileChange` items → edited files
   - `turn/completed` → `stopped`, unless the receiver saw `/refreshed` or `/launched` first, which makes it `live`
   - statuses are written to `.fixmod/status.json`
5. Expose one MCP tool, `fix_queue`, which lists the requests and their statuses (stands in for the Claude pane).

## Steps
0. **Spike** *(verify before building)*: a throwaway MCP server inside a local plugin that logs its cwd, env and parent process, and checks it can list and subscribe to the TUI's thread through `codex app-server proxy`.
1. **Shared core**: move the prompt code to `mod/core/prompt.mjs` with types. The Claude mod imports it; its tests stay green.
2. **App-server client** `codex/appserver.mjs`: JSON-RPC over a child process (`codex app-server proxy`), with request/response, notifications and `initialize`. Tests run against a fake proxy script.
3. **Bridge** `codex/bridge.mjs`: minimal MCP server (initialize, tools/list, tools/call), receiver child process, report queue, status machine. Tests: report → `turn/start` with text and image; busy → queued, then started after completion; refresh → live; turn end without refresh → stopped; `fix_queue` lists statuses.
4. **Plugin files**: `.codex-plugin/plugin.json`, `.mcp.json`, `SKILL.md`, marketplace. Then `codex plugin marketplace add ./` locally.
5. **End-to-end**: Codex TUI in `example/`, a long press on a Brewline bug, and the pill goes `queued → fixing → live`.
6. **Docs**: README section "Using Codex", and `scripts/test.sh` gains the new tests.

## Progress
- [x] 0 spike. Findings:
  - The daemon socket `~/.codex/app-server-control/app-server-control.sock` speaks **WebSocket over a unix socket**. Plain JSON lines (and `app-server proxy` with them) get no answer, so the bridge has its own small dependency-free ws client.
  - `initialize` → `initialized` → `thread/loaded/list` returns ids; `thread/read` gives `cwd`, `status`, `recencyAt` and `originator`.
  - An MCP server is started in the project folder, its parent is the codex TUI, and it gets no thread id in env. So the thread is found by `cwd` + recency on the daemon.
  - **The TUI falls back to an embedded server (thread invisible to the daemon)** when started with `-c`/`--enable` overrides, or when the CLI's feature settings don't match the running daemon's. That happens on this machine: CLI 0.160.1 against daemon 0.161.0. The bridge must detect it and tell the user.
- [x] 1 shared core: `mod/core/prompt.mjs` (+ `.d.mts`); Claude mod imports it, 11/11 green
- [x] 2 app-server client: `codex/ws.mjs` (WebSocket over unix socket) + `codex/appserver.mjs`
- [x] 3 bridge: `codex/fixes.mjs` (7 tests) + `codex/bridge.mjs` (MCP server, receiver, `fix_queue`). Project folder read from parent Codex process (`lsof`), since plugin MCP servers start in the plugin folder
- [x] 4 plugin files: `.codex-plugin/plugin.json`, `codex/mcp.json`, `codex/skills/press-to-fix/SKILL.md`, `.agents/plugins/marketplace.json`. Kept out of `mod/` root: Claude auto-loads a root `.mcp.json`/`skills/`, which would start the bridge in Claude sessions too
- [ ] 5 e2e: verified up to delivery in embedded mode (bridge starts from plugin cache, receiver in project, report queued, `fix_queue` explains). Delivery into the TUI thread blocked: CLI 0.160.1 vs daemon 0.161.0 → TUI falls back to embedded
- [x] 6 docs: README "Using Codex (beta)"; scripts/test.sh runs codex tests

## Unresolved questions
- Need Codex CLI matching daemon (0.161) for e2e on this machine — user to update.
- ~~Several sessions in one folder~~ → most recent is fine (user)
