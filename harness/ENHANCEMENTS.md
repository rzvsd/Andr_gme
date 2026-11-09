# Enhancements — Blind Duel

Ideas that make the game deeper and worth coming back to. These are not tasks yet.
An item becomes a task in `TASKS.md` only when the owner says go.

## Why this list exists

Owner, 2026-11-09: "I like the idea, but it is too simple. Users would not get hooked."
Target player: teenagers who live on TikTok. They should stay, play and fight.

The core stays small: run, jump, 3 shots, nobody sees anybody. The research of 2026-11-09
found the precise cause of "too simple": a hidden fighter leaks position in only two ways
(firing and being hit), so most shots are guesses. Similar games use five or more "tells".
More tells turn a guess into a read.

| What hooks a player | The game on 2026-11-09 |
|---|---|
| Decisions inside a round | Few. Luck is high, so a win does not feel earned. |
| Rounds that differ | One arena, the same kit every round. |
| A reason to come back tomorrow | None. No unlocks, no goals. |
| Something to show a friend | Nothing to share. Live play is a black screen. |

Source: `reports/Blind Duel teen retention and rewards.md` and the notes in `research_notes/`.
Both folders are on the owner's PC only (excluded from git).

## Chosen direction: B "Tower" (owner, 2026-11-09)

The owner saw three mockups (A Maze, B Tower, C Peek) and chose B.
Mockups: https://claude.ai/artifact/MJuoNrYKtBaSBGaLF4astH (file `reports/blind-duel-directions.html`, on the owner's PC only).
Research: `reports/Blind Duel map and combat design.md`.

- B is: side view, an arena of several floors that is larger than one screen, a camera that
  follows your fighter, and a mini map at the top that marks each loud sound for a moment.
- The look does not change. The "Blackout Arena" look, the 3D fighters, the score pills and
  the SHOOT button stay as built. The mockup is a sketch of layout, not a new style.
- Each new part (mini map, locker, pickups, arena layout) gets a proper mockup on a real
  game screenshot before it is built.
- Known weak point: the research found no large phone game with a hiding system in side view,
  and it found that a small arena reads better whole than through a camera and a mini map.
  This is why the first task is a phone test (T-29).

B is planned as Phase 5 in `PRD.md` (checks A-27 to A-37) and `TASKS.md` (T-29 to T-39).

| Item below | Where it is now |
|---|---|
| E-01 Make the dark a skill | Planned: T-32 (tells), T-34 (lockers, reacting objects) |
| E-02 The reveal replay | Planned: T-38 (replay). Video export stays an idea. |
| E-03 to E-07 | Still ideas. Not planned. |
| New from the mockup | Tower arena T-30, T-31; mini map T-33; four pickups T-35; meeting rules T-37 |

## The list, in build order

Status: `idea` | `approved` | `task` (then it has a T-number) | `done` | `dropped`.
E-01 to E-05 need no server.

### E-01 Make the dark a skill
- status: idea (owner liked the direction, 2026-11-09)
- What: every action buys something and leaks something.
  - Running is fast and makes footsteps.
  - A jump ends in a landing thud.
  - A slow walk is silent and costs time.
  - Arena objects react when a fighter passes (a puddle, a loose plank, a hanging chain).
- Every sound has a visual twin: a coarse ripple at the source. Many people play muted,
  and a clip must read without audio.
- Each player sees a faint outline of their own fighter. The skill is reading the
  opponent, not counting your own steps.
- Why: each of the 3 shots becomes a real choice, because it also gives away the shooter.
- Precedents: Invisigun, Screencheat, Hunt: Showdown (sound traps), Fortnite (sound shown on screen).

### E-02 The reveal replay
- status: idea (owner liked the direction, 2026-11-09)
- What:
  - After every kill, the lights come on for 3 to 5 seconds and the round plays again
    with both fighters visible. The player can skip it.
  - A full replay button at the end of the match.
  - Export as a vertical video with the game name on it, through the Android share sheet.
- Why: it shows why the player died, it teaches the reading skill, and it is the clip.
  The research names this the highest-value feature per hour of work.
- Needs: a record of positions and shots per round (small; a round is short).
- Note: the name on the video matters more than a link. Viewers search by name later.

### E-03 Loser picks 1 of 3
- status: idea (first agreed 2026-10-30, not built)
- What: the player who lost the round picks one tool for the next round.
- Rule: tools change information, not power. Examples: a flare that lights both fighters,
  a decoy sound, one silent dash, a tracer round.
- Size: a pool of 6 to 9 tools, 3 offered each time. Every tool has a clear answer,
  so one developer can keep it balanced.
- Why: each match plays differently, and the losing player stays in the game.
- Precedent: ROUNDS.

### E-04 A win that counts
- status: idea (cosmetics spec exists in `docs/CUSTOMIZATION.md`, not built)
- What:
  - Trophies and rank tiers: a number that a win changes.
  - A free drop every few wins. It is earned by play and never sold.
  - Daily quests.
  - A "days played" counter that never resets.
  - Cosmetics where light exists in a dark arena: muzzle flash, hit reveal, kill effect,
    replay trail, profile card.
- Why: a reason to open the game tomorrow.
- Limit: trophies won against the bot mean little to friends. This item gets its full
  value only with E-07.

### E-05 More places to fight
- status: idea
- What: two or three more arenas, each with its own reacting objects from E-01.
  A daily duel against the bot with the same setup for every player that day.
- Why: variety, and one thing to compare with friends before online play exists.

### E-06 Measure if it works
- status: idea
- What: count how many players come back after 1, 7 and 28 days. Anonymous counts only.
- Why: the research has no numbers for a game like this, so our own numbers decide
  whether E-07 is worth building.
- Reference: a good Android game keeps about 25% on day 1 and 7% on day 7.

### E-07 Play with a friend online
- status: idea (changes the plan for T-23 to T-25)
- What, in this order:
  1. Friend duel by room code. No account needed first.
  2. Quick match. If nobody is found in 10 to 15 seconds, a bot fills the seat and is
     labelled as a bot.
  3. Preset emotes in place of chat. Block and report on every screen with another player.
- Technical rule: the server holds the truth. A phone receives the opponent's position
  only inside a reveal window, so a cheater has nothing to read.
- Why: 89% of teen players play with others. Friends are the reason they stay.
- Risk: small online games die from empty lobbies. This is why the friend code comes
  before quick match, and why the bot fills in.

## Rules for this list

- Reward return, never punish absence.
- Do not fix "too simple" with more content alone. E-05 comes after E-01 to E-03.
- Online play does not fix a dull match. If a match against the bot is not fun, a match
  against a stranger is not fun. Proposed order: E-01 to E-03 first, then online.
  The owner has not confirmed this order yet.

## Not building

Owner, 2026-11-09: avoid everything that needs legal work. So these stay out:

- Real money, prizes or anything a player can cash out.
- Paid random items (loot boxes, paid keys for free crates).
- Streaks that reset, countdown offers, more than one paid currency.
- Free text or voice chat with strangers.
- Hidden bots in ranked play.
- A battle pass. It needs new cosmetics every month, which one developer cannot sustain.

Parked for later, not decided: a shop that sells cosmetics at plain prices.

## The test before we commit

1. Build E-01 and E-02 against the bot only.
2. The owner plays 10 minutes on the phone.
3. The owner wants one more match: continue with E-03. If not: stop and rethink.

## Open question for the owner

Which part feels too simple when you play: the round itself, or having no reason to come back?
