# Agent Guide — Bullet Dodge Arena

Shared instructions for any coding agent (Claude Code, Codex, others).
Claude Code loads this file through `CLAUDE.md`.

## What this is
A 2D landscape arena shooter. HTML5 Canvas + plain JavaScript (ES modules),
built with Vite, wrapped for Android with Capacitor 7. No game engine, no TypeScript.

## Commands
| Task | Command |
|---|---|
| Install | `npm ci` |
| Dev server (http://localhost:5173) | `npm run dev` |
| Unit tests (Vitest) | `npm test` |
| Production build | `npm run build` |
| Sync web build to Android | `npm run build && npx cap sync android` |
| Android unit tests | `cd android && ./gradlew :app:testDebugUnitTest` |

CI (`.github/workflows/ci.yml`) runs all of these on Node 20 / Java 21.

## Read first
| File | Why |
|---|---|
| `docs/AGENT_STATE.md` | Current milestone, rules, verification gates. Source of truth for status. |
| `docs/ARCHITECTURE.md` | Module graph, scene lifecycle, patterns. |
| `docs/GAME_DESIGN.md` | Mechanics, controls, visuals. |
| `project overview/BUGS.md` | Known bugs with IDs. |
| `project overview/game pictures/` | Real playtest screenshots. They beat stale docs. |
| `DESIGN.md` | UI and visual rules for this game. |
| `project overview/developer_run.md` | Codex runbook: role, path scope, playtest plan. Codex reads it first. |

## Hard rules
- **Read-only:** `project overview/SAFETY_REVIEW.md` and `project overview/FINAL_BOSS.md`. Never edit them.
- **Do not touch generated output:** `dist/`, `android/app/src/main/assets/public/`, `node_modules/`.
  Regenerate them with the commands above.
- **Asset loading:** render a fallback until assets load. Never block the game loop on assets.
- **Scene contract:** `onEnter`, `onExit`, `update(dt, game)`, `render(ctx, alpha, game)`, `onResize`.
  Keep it.
- **Parallel agents:** one agent owns one file or folder at a time (see `docs/AGENT_ROLES.md`).
  When you split work across subagents, give each a disjoint set of files.
- **Secrets:** never read, print, or commit keystores, signing passwords, or env files.
  Release signing is the owner's job.
- **Git:** do not push, force-push, or merge to `main` unless the user asks. Work on a branch.

## Done means
1. `npm test` passes.
2. `npm run build` passes.
3. For gameplay or UI changes: run the game (`npm run dev`) and look at it in a
   landscape viewport. Compare with `project overview/game pictures/expectation.png`.
4. If you changed status or found a bug, update `docs/AGENT_STATE.md` or `project overview/BUGS.md`.

## Harness
This repo uses a file-based harness. Any agent or human can continue the work from these files.

| File | Role | Read when |
|---|---|---|
| `harness/PRD.md` | Goal, users, acceptance checks (A-xx) | Planning, verifying |
| `harness/TASKS.md` | Task graph: depends, owns, check | Picking or doing a task |
| `harness/PROGRESS.md` | Done, broken, next action | Start of every session |
| `harness/LEARNINGS.md` | `Kept` = approved rules. `Proposed` = not rules yet | Start of every task (Kept only) |
| `harness/evidence/T-xx/` | Proof per task | Verifying, reviewing |
| `docs/GAME_DESIGN.md` | Product definition (PRD source) | Planning |
| `docs/ARCHITECTURE.md` | Module graph, scene lifecycle | Before changing code structure |
| `DESIGN.md` | UI and visual rules | UI or visual work |
| `task.md`, `docs/BUILD_PHASES.md` | Historical build checklist | Context only |
| `docs/AGENT_STATE.md` | Milestone history before the harness | Context only |

### Loop (one task per run)
1. Read `PROGRESS.md` and the `Kept` section of `LEARNINGS.md`.
2. Take the next task whose dependencies are done. Mark it `doing`.
3. Change only the files the task owns.
4. Run the task's checks. Save the output in `harness/evidence/T-xx/`.
5. Pass: mark `done`, update `PROGRESS.md`. Fail: fix, at most 3 tries, then mark `blocked` and ask the owner.
6. A mistake worth remembering goes to `LEARNINGS.md` → `Proposed`, with evidence. Never to `Kept`.

### Rules
- "Done" means the checks passed and the evidence is saved. An agent's own claim is not proof.
- Only the owner moves a learning from `Proposed` to `Kept`.
- Precedence: owner's message > this file > `harness/LEARNINGS.md` (Kept) > skill and plugin defaults.
- Keep `PROGRESS.md` under 60 lines and `Kept` under 30 items. Move old items to `harness/archive.md`.
