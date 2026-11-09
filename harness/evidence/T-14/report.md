# T-14 evidence: tokens, fonts, hero light presets (2026-10-31 00:10)

- `src/theme/tokens.js`: COLORS (5 roles + neutrals), TEAM_COLORS, FONTS, TYPE (56/32/24/16/12, floor 11), SPACE (8 px scale, insets, no-tap strip 40), RADII, HIT (48/8/64/48/40), MOTION, DESIGN_BOX 891x411 + designBoxTransform(), font helpers, withAlpha().
- `src/theme/fonts.js`: @fontsource/chakra-petch 600/700 and @fontsource/inter 500/600/700 bundled (npm, OFL); `loadGameFonts(800)` waits a bounded time before the first frame (main.js).
- `index.html`: page background and theme-color now arena black (`#05060a`), removing the light-blue flash at boot.
- `src/scenes/versus/versusHeroLayer.js`: LIGHT_PRESETS (match, menu) + setLightPreset(); per-actor PointLight rim (entry.rimColor / rimIntensity) and SpotLight (entry.spot / spotIntensity); entry.silhouette (white unlit material swap) and entry.dim (0..1 colour scale) for the kill frame and the result loser.
- P2 fighter: `versusAssets.resolvePlayer2CharacterKey`, `getCharacterKeyForPlayer(1)` uses it in PVP, preload includes it; `VersusGameScene.onEnter` reads payload.player2CharacterKey.
- `npx vitest run`: 20 files, 74 tests pass (new `tests/tokens.test.js`, 6 tests). `npm run build`: passes; woff2 subsets copied to dist/assets.
