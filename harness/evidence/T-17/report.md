# T-17 evidence: result screen (2026-10-31)

Implemented by the `implement-direction-a` workflow (7 medium findings fixed: slabs under the
fighters, MOTION-sourced beat, loser lit). File: `src/scenes/GameOverScene.js`,
`tests/resultLayout.test.js` (16 tests). `VersusGameScene` and `versusMatch` now pass
`playerCharacterKey`, `player2CharacterKey` and `botCharacterKey` so the right rigs show.

Screenshot `result-p2wins-844x390.jpg`: halves in team colours with the tilted seam, "PUDD WINS"
in blue right-aligned, score 1 - 5, three stat tiles (KILLS 1 : 5, DODGED 0 : 0, TIME 6:04),
winner spotlit, loser dimmed, REMATCH primary, MENU secondary.
