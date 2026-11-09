# T-16 evidence: match HUD and arena in direction A (2026-10-31)

Implemented by the `implement-direction-a` workflow; the first run was cut off by a usage limit
after the code was written, the resumed run verified it and the reviewers' 5 medium findings were
fixed (kill frame drawn under the HUD, kill path on the real shot line, shot line raised 9 world px).
Files: `versusRenderer.js`, `versusEffects.js`, `versusConfig.js`, `versusMatch.js`,
`versusProjectiles.js`, `VersusHUD.js`, `VersusGameScene.js`, tests `versusDarkArena.test.js`
(17) and `versusEffects.test.js`.

Screenshots (dev server):
- `match-idle-891x411.jpg`: stage light, two shafts, dust, vignette, slabs, HUD pills, mute button.
- `match-reveal-p1-fire.jpg`, `match-reveal-p2-fire.jpg`: reveal with rim light, floor spill,
  bullets with halos and trails.
- `match-kill-frame.jpg`: 140 ms kill freeze, dim arena, white victim silhouette, bullet path.
- `match-hud-after-kills.jpg`, `match-both-revealed-844x390.jpg`.

Headless check (`scratchpad/sim_respawn.mjs`, P2 holding fire at a standing P1 for 15 s): a kill
every 3.3 s (respawn 1.35 s + protection 1 s + 4 hits), time scale returns to 1 after each
freeze, stats and respawns correct. Hero layer additions used here: rimColor, silhouette, flash.
