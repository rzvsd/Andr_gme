---
description: Run one harness task through planner, builder and reviewer, then report.
argument-hint: "[task id, e.g. T-29]"
---

Run the task `$ARGUMENTS` through the workflow below. Plan it, build it, review it independently,
and report once. If the argument is empty, take the next ready task from `harness/TASKS.md`
(every task in `depends` is `done`) and say which one you took.

<inputs>
- project_goal: the task's title, `proves` line and the A-xx checks it proves (`harness/PRD.md`).
- context: `AGENTS.md`, `harness/PROGRESS.md`, the `Kept` learnings, `DESIGN.md` for screen work.
- deliverables: the task's `check` line, with proof saved in `harness/evidence/<task>/`.
</inputs>

Use three agents: `planner`, `builder` and `reviewer`. Run them in order as one workflow.
You are the lead: you start each agent, pass the files, and decide nothing they should decide.

## Before you start
1. Read `harness/PROGRESS.md`. Confirm the branch is `main_2` and the working tree is clean.
2. Stop and ask the owner if the task needs something only the owner can give: a pick from mockups,
   a phone test, an account, a signing key. Do the parts that do not need it first.
3. Mark the task `doing` in `harness/TASKS.md`.

## Workflow
1. **Plan.** Start `planner` with the task id. It writes `harness/evidence/<task>/plan.md`.
   If it returns open points that belong to the owner, stop and ask. Otherwise continue.
2. **Build.** Start `builder` with the plan path. It changes only the files the task owns.
3. **Review.** Start `reviewer` with the task id and the plan path. It writes `review.md`.
4. **Iterate if needed.** If `passed` is false, send the `revision_plan` to `builder`, then run
   `reviewer` again. At most 2 revision rounds. After that, mark the task `blocked` and report.

Run one agent at a time (this PC has little RAM). Do not start a second task in the same run.
Do not change the goal of the task.

## After the review passes
- Check the result yourself where you can: run `npm test` and `npm run build`, and for screen work
  look at the game at 891x411. A reviewer's pass is a report, not proof.
- Mark the task `done` in `harness/TASKS.md` with the date and the evidence path, set the A-xx
  status in `harness/PRD.md`, and update `harness/PROGRESS.md` (next action = the next ready task).
- Commit to `main_2` and push. Never merge into `main`.

## Report to the owner
Short and plain, not JSON:
- what was built, in two or three sentences;
- the review result: checks passed, checks not verified, rounds needed;
- what the owner must do or decide next (for example a phone test);
- one status line: `<task> done | blocked · next: <task>`.
