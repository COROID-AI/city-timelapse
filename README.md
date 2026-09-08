# Neon Street Racer

A Three.js nighttime neon street racing game with a third-person chase camera.
Drive a neon car around a wet, reflective city circuit at night, drifting to
charge nitrous, and race four AI opponents across a three-lap timed race.

## Overview

- **Third-person chase camera** that smoothly follows behind the player car,
  widening its field of view with speed and giving an extra wide-angle kick
  while nitrous is active, plus subtle camera shake.
- **Wet, reflective streets** built from a `three.js` `Reflector` mirror plane
  beneath a translucent asphalt overlay so neon signs and street lights visibly
  reflect off the road.
- **Neon city at night**: dark sky + fog, emissive neon signs on buildings,
  glowing barrier strips, street lights and emissive building windows (all
  generated at runtime via canvas — no external assets or CDN dependency).
- **Motion blur** (`AfterimagePass`) whose strength scales with your speed, and
  an **UnrealBloomPass** pass for the neon glow, composed through an
  `EffectComposer`.

## Controls

| Key            | Action                                   |
| -------------- | ---------------------------------------- |
| `↑ / ↓`        | Accelerate / brake or reverse            |
| `← / →`        | Steer left / right                       |
| `Space`        | Handbrake — drift (charges nitrous)      |
| `Shift` or `X` | Activate nitrous (wide-angle boost)      |
| `R`            | Restart the race (after finishing)       |

## Mechanics

- **Drifting** builds your nitrous meter. Slide with `Space` (or corner hard at
  speed) to charge the gauge shown in the HUD.
- **Nitrous** gives a big speed boost with a wide-angle camera kick and
  blue-purple exhaust flames plus a particle trail. It consumes charge while
  active and runs out if you don't drift again.
- **Race format**: 3 laps. Live standings for all 5 racers (you + 4 AI) update
  every frame, ordered by lap then track progress. A countdown precedes the
  start; a finish overlay shows final standings and lap times.
- AI opponents drive autonomously around the circuit, pace themselves into
  corners, and rubber-band to keep the race close.
- You collide softly with the road bounds instead of leaving the track.

## Commands

| Command               | Description                             |
| --------------------- | --------------------------------------- |
| `npm run dev`         | Start the Vite dev server               |
| `npm test`            | Run headless unit tests (`node --test`) |
| `npm run build`       | Build the production bundle to `dist/`  |
| `npm run preview`     | Preview the production build locally    |
| `npm run check`       | Run tests then build                    |

Unit tests cover nitrous charge/consume/activation, checkpoint-guarded 3-lap
race timing, live standings ordering, arrow-key input mapping, and AI pacing.

## Tech

- [three.js](https://threejs.org/) `^0.170.0` (bundled — no CDN runtime
  dependency)
- [Vite](https://vitejs.dev/) `^5.4.0`
- ES modules, `node:test` runner