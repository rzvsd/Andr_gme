# T-10 verification report — Rewrite GAME_DESIGN.md; update DESIGN.md and README (proves A-10, docs half)

| Check | How run | Result | Evidence |
|---|---|---|---|
| A-10 / 1a versus-only ("Human vs Bot", "Human vs Human") | grep -in on docs/GAME_DESIGN.md | pass (lines 14, 66, 93) | harness/evidence/T-10/game-design-check.log |
| A-10 / 1b dark arena ("0.3 s", "0.5 s", "black") | grep on docs/GAME_DESIGN.md | pass (27-28, 39; 18, 35, 99-100) | harness/evidence/T-10/game-design-check.log |
| A-10 / 1c no falling ("cannot fall" or "Invisible walls") | grep on docs/GAME_DESIGN.md | pass via "Invisible walls" (line 46); "cannot fall" only misses because the sentence wraps across lines 46-47 ("cannot / fall. There is no death line.") | harness/evidence/T-10/game-design-check.log |
| A-10 / 1d bot duel and local PVP | grep -in bot/pvp/one phone | pass: line 14 "1 (Human vs Bot) or 2 on one phone (Human vs Human)", section 3.5 Bot, line 93 match mode | harness/evidence/T-10/game-design-check.log |
| A-10 / 1e touch controls ("drag", "swipe", "tap") | grep -in on docs/GAME_DESIGN.md | pass (lines 84-86, 90) | harness/evidence/T-10/game-design-check.log |
| A-10 / 1f old wave content removed | grep -in "wave"; grep -in "Grunt\|Sniper\|Boss\|Double Jump" | pass: only line 4 (retirement note) matches "wave"; enemy/double-jump grep returns nothing | harness/evidence/T-10/game-design-check.log |
| A-10 / 2 numbers vs code: bullet 760, kills 5, reveal 0.3/0.5, bridges 150..570 and 870..1290 | grep doc + versusConfig.js + versusArena.js; arithmetic | pass: BULLET_SPEED=760, VERSUS_KILLS_TO_WIN=5, REVEAL_ON_FIRE_SECONDS=0.3, REVEAL_ON_HIT_SECONDS=0.5; 150+420=570, 1440-150-420=870, 1440-150=1290 (VERSUS_PANEL_WORLD_WIDTH 720*2=1440) | harness/evidence/T-10/numbers-check.log |
| A-10 / 3 DESIGN.md dark-arena rules | grep -in "ARENA_BLACK\|outline\|black" | pass (lines 15, 17, 21) | harness/evidence/T-10/other-docs-check.log |
| A-10 / 3 README Game Concept: dark arena + docs/GAME_DESIGN.md | awk section dump + grep | pass: "pitch-black arena" and "Full rules: `docs/GAME_DESIGN.md`" (line 29); note literal word "dark" absent | harness/evidence/T-10/other-docs-check.log |
| A-10 / 3 AGENT_STATE.md first lines point to harness/PROGRESS.md | head -n 12 + grep; file exists | pass (line 3; harness/PROGRESS.md present) | harness/evidence/T-10/other-docs-check.log |
| A-10 / 4 npm run build | npm run build | pass (61 modules, built in 11.65s, exit 0) | harness/evidence/T-10/npm-build.log |
