# Codex support: plan

## Context
press-to-fix works with Claude Code only. The app package and the receiver don't care which agent is on the other end: they speak HTTP and write `.fixmod/`. The Claude-specific part is `mod/`, which puts each report into the running session as a prompt, tracks status and draws the pane. Codex needs its own adapter.

What Codex CLI 0.161 offers (sources: learn.chatgpt.com/docs/hooks, /docs/app-server, /docs/plugins, /docs/extend/mcp):
- **Hooks**, in the same format as Claude's: SessionStart, UserPromptSubmit, Pre/PostToolUse, Stop and others. They're `command` handlers with JSON on stdin and a 600s default timeout. A **Stop** hook returning `{"decision":"block","reason":"…"}` turns `reason` into the next user prompt. SessionStart and UserPromptSubmit can add `additionalContext`.
- **Plugins**: `.codex-plugin/plugin.json` can bundle hooks, skills and MCP servers.
- **app-server** (JSON-RPC): `thread/loaded/list`, `turn/start {threadId, input}` (input accepts `localImage`), `turn/steer`, and notifications for turns and items. The TUI attaches to a shared `codex app-server daemon` (experimental).
- **MCP** tools can't push prompts. Default tool timeout is 60s.

## Approach
**Phase 1: Stop-hook adapter (works with the plain `codex` TUI).** A Codex plugin whose Stop hook long-polls the receiver for the next report and returns it as the continuation prompt. It's stable, documented and mirrors the Claude flow.

**Phase 2 (optional): app-server adapter.** It delivers reports while Codex is idle, attaches screenshots as real images and gets richer status. It depends on the experimental daemon.

## Steps

0. **Split core from the Claude adapter.**
   - Move `prompt.ts` (INSTRUCTIONS, `promptFor`, `pressedLabel`, `isNativeRebuild`) to `core/` as plain TS with no `claude-code` imports.
   - Move the status machine (`queued → fixing → rebuilding → live/stopped`) into `core/status.ts` as pure functions.
   - `mod/` imports core. All existing tests stay green.

1. **Receiver: queue API for pull-based agents.**
   - `GET /next?wait=570` long-polls and answers with the next undelivered report and its prompt text, or 204 on timeout.
   - `POST /status {id, status}` lets an adapter that can't write `status.json` itself report progress. The receiver writes the file.
   - Tests (node:test): queued report delivered once, in order; long-poll returns on arrival; 204 on timeout; status persisted and visible via `GET /status`.

2. **Codex plugin** `codex/` (`.codex-plugin/plugin.json` + `hooks/hooks.json`, Node scripts, no deps):
   - `SessionStart`: start the receiver detached, with a pid file that a newer session reuses or replaces. Return `additionalContext` = INSTRUCTIONS adapted for Codex (screenshots via `view_image`).
   - `Stop`: if a report is current, mark it `stopped` or keep `live`, the same rule as Claude's `turn.complete`. Then long-poll `/next`. On a report, mark it `fixing` and return `{"decision":"block","reason": prompt}`. On timeout, return nothing and the turn ends normally.
   - `PostToolUse`: shell commands matching `isNativeRebuild` → `rebuilding`; file edits recorded for the status.
   - `/refreshed` and `/launched` from the app → `live`, handled in the receiver. It already emits `launched`; with no mod listening, the receiver applies it to the current report.
   - Tests: drive the hook scripts with stdin JSON fixtures against a real receiver. A report arrives → Stop blocks with the prompt; no report → Stop exits within the wait; refresh during a fix → status `live`.

3. **Docs.** Add a README section "Using Codex" covering install (`/plugins` → local path or marketplace), the trade-off that Codex picks reports up when its turn ends (while it waits, press Esc to type your own prompt), and that the screenshot is referenced by path.

4. **Phase 2 spike: app-server.**
   - The receiver connects to the daemon socket, finds the user's thread (`thread/loaded/list`, the most recent in this cwd), and sends `turn/start` with `[{type:"text"}, {type:"localImage", path}]` when idle, or `turn/steer` when busy.
   - Status comes from `turn/started`, `turn/completed` and `fileChange` items.
   - Behind `FIXMOD_AGENT=codex-app-server`. Keep it only if the daemon is stable.

## Verification
- `scripts/test.sh` gains `node --test core/ codex/tests/`.
- Manually: `codex` in `example/` with the plugin, long press a Brewline bug, then check the pill goes `queued → fixing → live` and the fix lands.

## Unresolved questions
- Is it OK for the Stop hook to keep Codex busy while waiting? The alternative is delivering only between turns.
- Use one plugin repo for both agents, or publish the Codex plugin separately?
- Phase 2 relies on the experimental daemon. Build it now or wait for it to be stable?
- Should the receiver mark `live` itself, so the Claude mod logic moves there too?
