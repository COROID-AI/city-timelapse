# City Time Period Timelapse

Create a 3D scene of a city block. Emphasis on detail is very important.

The scene must have a timeline slider in the top, with the following options:
1945, 1965, 1985, 2005, 2025 and 2055

The point of the scene is to be able to select any of the 5 different years, and the scene will transform in front of your eyes to the time period selected from the slider.

Time period should affect all aspects of the city block. The buildings, the vehicles, the storefronts, advertisements, outfits of the pedestrians, everything.

This must be a polished high end scene with SFX, ability to navigate around and look at things, etc. Go all out.

---

# Classic Super Mario Browser Game

## Overview

A classic Super Mario Bros–inspired platformer that runs entirely in the
browser on a single HTML5 `<canvas>` element. The game is built from scratch
with vanilla JavaScript — **no game engine, no third-party runtime libraries,
and absolutely zero image assets**. Every pixel of art (Mario, Goombas, Koopas,
shells, mushrooms, question blocks, bricks, coin pops, scenery, the HUD font,
units and the castle) is drawn directly with the Canvas 2D API via `fillRect`
call-based pixel sprites.

The game features:

- A fixed-timestep `requestAnimationFrame` game loop (~60 fps simulation,
  one render per animation frame).
- Classic Mario physics: gravity, run acceleration, inertia, skid/reverse, and
  variable-height jumps.
- Tile-based collision against a World 1-1–inspired level: ground, pipes,
  bricks, question blocks, staircases, gaps, a flagpole and a castle.
- Enemy mechanics: stompable Goombas, Koopas that shell up, and kicking shells.
- Item and block mechanics: mushroom power-ups, coin blocks, multi-coin
  bricks, brick-breaking when Super, coin pops, brick fragments and score
  popups.
- Full game flow: title screen → play → dying/respawn → flag completion
  ("COURSE CLEAR!") → game over, all driven by a dedicated game-state machine.
- A classic HUD: score, coins, world, time, and lives in a 5×7 pixel font.
- Crisp 3× pixelated scaling (256×240 logical canvas rendered at 768×720 CSS
  pixels with `image-rendering: pixelated`).

## Controls

| Action | Keys |
| ------------- | --------------------------------------------------------------- |
| Move left / right | ArrowLeft / ArrowRight or **A** / **D** |
| Jump | Space, ArrowUp, **Z**, or **W** (hold for a higher jump) |
| Run | Shift (either) or **X** |
| Down | ArrowDown or **S** |
| Start / confirm | Enter |

Press **Enter** on the title screen to start. **Enter** also restarts the
game from the *Course Clear!* and *Game Over* screens.

## Run

The game is a static site — no build step and no server-side logic. Serve the
repository root with any static server and open the page in a modern browser
(Chrome, Firefox, Edge, Safari):

```sh
python3 -m http.server 8124
# then open http://localhost:8124/
```

The page loads `index.html`, which pulls in `src/main.js` as an ES module and
bootstraps the game on `#game-canvas`.

## Test

The verification suite covers the full engine, systems, entities, and
composition. Run everything from the repository root:

```sh
npm test                    # full jest suite (loops, input, renderer, sprites, tilemap,
                            # levels, physics, collision, camera, HUD, items, particles,
                            # player, enemies, entity manager, game composition)
node scripts/audit-no-image-assets.js   # fails if any png/jpg/jpeg/gif/webp/bmp/ico
                                        # exists in the repo, or if package.json declares
                                        # any runtime dependency
node scripts/verify-composition.js      # headless end-to-end run: boots the integrated
                                        # createGame with a stub canvas and injected rAF
                                        # pump, drives TITLE → PLAYING → LEVEL_COMPLETE
```

## Architecture

The codebase is organized into small, single-responsibility ES modules under
`src/`, each with a matching test file under `tests/`.

```text
src/
  main.js      Browser entry point: bootstraps createGame on #game-canvas.
  game/
    game.js        Composition root: wires state, loop, input, camera, tilemap,
                   entities, physics, rendering, HUD and overlays into one handle.
    gameState.js   Game-state machine (TITLE → PLAYING → DYING → LEVEL_COMPLETE /
                   GAME_OVER), stats HUD contract, timer, flag/finish flow.
  core/
    constants.js   Shared constants incl. PHYSICS tuning (integrate, inertia, jump).
    loop.js        Fixed-timestep rAF loop with a catch-up budget and injected
                   requestFrame for tests.
    input.js       Semantic keyboard mapping (arrows/WASD, Space/Z jump, Shift/X run,
                   Enter start) with edge detection; the game keys.
    camera.js      Classic forward-scrolling camera.
  world/
    tilemap.js     Tile grid, tile codes and bump offsets.
  levels/
    level1.js      World 1-1 inspired 212×15 ASCII level, scenery and spawn data.
  physics/
    body.js        Position/velocity body with gravity, friction and jump impulses.
  collision/
    tileCollision.js  Tile collision resolver (terrain, bricks, ?-block head hits).
  entities/
    player.js      Mario: small/super states, inertia/skid, variable jump, damage,
                   death animation, flagpole slide, movement feel.
    goomba.js / koopa.js / mushroom.js / coinPop.js   World entities.
    entityManager.js  Registry + gameplay interactions (stomp, shells, brick breaks,
                   pipe/flip enemies, score/coin hooks).
  fx/
    particles.js   Brick fragments and score popups.
  render/
    pixelArt.js    Core fillRect-based pixel drawing helpers.
    sprites/       Every sprite drawn by hand as pixel data (0 image files).
  ui/
    hud.js         In-game score/coins/world/time/lives panel.
    pixelFont.js   5×7 pixel font for HUD and screen overlays.
```

Everything is downloaded as one dependency-free static page: the game itself
has **zero runtime dependencies** (verified by
`scripts/audit-no-image-assets.js`) and ships **zero image files**.

See `scripts/verify-composition.js` for a headless end-to-end session that
proves the composed game boots and reaches **LEVEL_COMPLETE** through real
loop frames.
