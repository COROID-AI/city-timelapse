# City Era Timelapse 3D

A polished 3D city block scene with a timeline slider that transitions through 6 eras (1945–2055).

## Features

- **Timeline slider** at the top with 6 era options: 1945, 1965, 1985, 2005, 2025, 2055
- **Detailed 3D city block** with procedurally generated buildings, each with window grids, roof antennas, and signs
- **Era-specific aesthetics**: building heights, colors, neon lighting, car styles, and pedestrian outfits change per era
- **Navigation**: Orbit controls (mouse drag to rotate, scroll to zoom, right-drag to pan) + WASD movement when clicked
- **Sound effects**: Synthesized ambient SFX via Web Audio API (wind, traffic, engine hum) that adapt per era
- **Environmental details**: grass textures, sidewalks, roads with lane markings, street lamps, billboards, trees, and animated pedestrians
- **Atmospheric effects**: era-specific sky colors, fog, and floating dust particles
- **Animated elements**: walking pedestrians, rotating vehicle wheels, gently bobbing vehicles

## How to Run

```bash
npm run dev
# or
node server.js
```

Then open `http://localhost:4173` in your browser.

## Project Structure

```
public/
  index.html       - Main scene (HTML + CSS + JS, all inline)
  three.min.js     - Three.js UMD build (converted from three.cjs)
  favicon.ico
server.js          - Simple Node.js HTTP server
convert-three-umd.mjs - Converts three.cjs to browser-compatible UMD
```

## Controls

- **Mouse drag**: Rotate camera around the scene
- **Scroll**: Zoom in/out
- **Right drag**: Pan
- **Click scene + WASD**: First-person movement mode
- **Timeline slider**: Drag to change eras
