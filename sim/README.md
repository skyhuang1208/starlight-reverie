# Starlight Reverie · Simulation & Tuning Suite

All simulation scripts use relative `../js/...` paths and can be opened directly in any browser (or run headlessly in Chrome).

## Files

- [`visual_sim.html`](./visual_sim.html) — **Live Visual Simulation Window:** Watch the combat AI fight any Mid-Boss or Final Boss across all 5 stages with any hero at `1x / 2x / 4x` speed, live HP/projectile telemetry, auto-looping, and an optional 150-fight batch runner.
- [`sim_boss_montecarlo.html`](./sim_boss_montecarlo.html) — **Boss & AI Suite:** Mini-boss adjacent-plain / aerial-bar chase jump tests (`delivery_scooter`, `corgi_skater`, `cat_thrower`), high-bar anti-camping checks across all 5 Human Bosses, 150-fight Human Boss Monte Carlo, and 27-fight Mid/Creature Boss Monte Carlo.
- [`sim_terrain_audit.html`](./sim_terrain_audit.html) — **Terrain & Traversal Suite:** Verifies platform heights (`<= 46px` upward steps), arch clearances, middle-of-platform enemy placement across all 5 stages, and physics traversal.
- [`sim_features.html`](./sim_features.html) — **Feature & Balance Unit Suite:** Verifies game version, skill/ult cooldowns, puddle slow physics, `"Woof!"` / `"Meow!"` sound waves, `"召喚!"` boss callouts, feedback submission, and silent play counting.
