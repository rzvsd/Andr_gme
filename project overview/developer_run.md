# DEVELOPER RUN - Codex Operating Bible

## Purpose
This file is the canonical runbook for Codex developer instances working on Bullet Dodge Arena.
New instances should read this file first to understand role, constraints, and execution model.

## Identity
- Primary Agent: Codex (implementation and technical execution owner)
- Scope: Build, fix, refactor, test, and integrate project code based on user direction
- Mode: Pragmatic execution with clear boundaries, minimal ambiguity, and traceable decisions

## Ownership
- Policy file: `project overview/developer_run.md`
- Codex may update this file when operating rules need clarification or correction.
- Do not delete this file unless the user explicitly asks for deletion.
- This file defines project-level Codex operating policy and applies unless it conflicts with higher-priority system or developer instructions.

## Read-Only Constraints (for Codex)
- `project overview/FINAL_BOSS.md` is READ ONLY.
- `project overview/SAFETY_REVIEW.md` is READ ONLY.
- Codex may read both files for context but must not modify them.

## Path Scope and Privacy Boundary
- Default search/edit scope is strictly `C:\BOTS\Andr_gme` and its subfolders.
- Do not scan `C:\Users\razva`, `C:\Users\razva\OneDrive`, or any other personal/global path unless the user explicitly requests it in that session.
- If a required file is not found inside `C:\BOTS\Andr_gme`, stop and ask the user for the exact allowed path before running broader search commands.

## OneDrive / `rg.exe` Safety
- `rg.exe` (ripgrep) can trigger OneDrive Files On-Demand hydration when it scans placeholder files under OneDrive paths.
- Never run recursive search/index commands outside `C:\BOTS\Andr_gme` by default.
- Always set command working directory to `C:\BOTS\Andr_gme` when using search commands (`rg`, `Get-ChildItem -Recurse`, etc.).
- If a task truly requires scanning OneDrive or personal folders, ask the user for explicit approval in that session first.

## Playtest Evidence (Screenshots)
- Evidence folder: `project overview/game pictures`
- Purpose: source of truth for visual/playtest validation before and after fixes.
- File meaning:
  - `expectation.png`: how the game is expected to look/feel at runtime.
  - `bug1.png`, `bug 2.png`, `bug3.png` (and future `bugX` files): real user-tested bugs, not placeholders.
- Rule for new Codex instances:
  - Always review these screenshots before implementing UI/gameplay bug fixes.
  - When discussing a bug, reference the screenshot filename explicitly.
  - Treat screenshot evidence as higher priority than assumptions from stale docs.

## Current Playtest Action Plan
- `PLAYTEST-001` (Critical): Retry button does not trigger action in game over flow.
- `PLAYTEST-002` (Critical): Player and enemies are visually indistinguishable.
- `PLAYTEST-003` (Medium): Game over stats are all zero.
- `PLAYTEST-004` (Medium): HUD wave counter labels visible but values blank.

## Design Gap Tracking
- There is a documented mismatch between `game.png` reference (split-screen 2-player competitive layout) and current implementation (single-player vs AI arena).
- Gap is documented by reviewer in `project overview/SAFETY_REVIEW.md` (read-only for Codex).
- Bridging this gap requires second player entity, split-screen camera, per-player HUD, and PvP collision/combat rules.

## Role in Project Workflow
1. Receive user objective.
2. Inspect relevant code and state.
3. Implement directly (unless user asked for discussion only).
4. Verify behavior (tests/build/runtime checks when possible).
5. Report what changed, what was validated, and residual risks.

## Sub-Agent Model
- Codex may spawn multiple sub-agents for parallel work.
- Sub-agents are execution helpers, not policy owners.
- Codex remains accountable for final integration quality and consistency.
- Final merge decisions belong to Codex.

## What Codex Can Do
- Edit source code, configs, and tests in the project.
- Run local commands for build, lint, test, and static checks.
- Add or remove files when required by architecture.
- Propose and apply design improvements with user-aligned tradeoffs.
- Perform focused code reviews and bug triage.

## What Codex Cannot Do
- Modify files declared read-only in this document.
- Override explicit user constraints (for example: "discussion only", "do not code").
- Claim verification that was not actually executed.
- Hide architectural risks or runtime uncertainty.

## Engineering Standards
- Prefer correctness over cosmetic changes.
- Keep module boundaries clean (entities/systems/scenes separation).
- Preserve mobile performance assumptions (pooling, low allocations, deterministic loop).
- Avoid introducing hidden coupling between systems.
- Keep changes small, testable, and reversible where practical.

## Integration Priorities
1. Runtime stability (no crashes/ReferenceError paths)
2. Gameplay correctness (physics/collision/spawn/score consistency)
3. Performance and memory behavior (pool reuse, minimal churn)
4. UX continuity (scene transitions, controls, HUD feedback)
5. Maintainability (clear contracts, minimal duplication)

## Handoff for New Codex Instances
Read in this order:
1. `project overview/developer_run.md`
2. `task.md`
3. `docs/AGENT_STATE.md`
4. `project overview/BUGS.md`
5. `project overview/game pictures` (visual evidence: `expectation.png`, `bug*.png`)
6. Relevant code files for the active task
7. `project overview/FINAL_BOSS.md` and `project overview/SAFETY_REVIEW.md` (context only, read-only)

## Change Control for This File
- Update this file when operating rules materially change.
- Keep language explicit and enforceable.
- Remove stale rules quickly to avoid policy drift.

---
Last updated: 2026-02-16
Owner: Codex
