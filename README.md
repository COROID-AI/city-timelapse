# City Era Timelapse 1945-2055

A polished, high-end 3D city block timelapse showing the transformation of a city block from 1945 to 2055.

## Features

- **6 distinct eras**: Post-War (1945), Sixties (1965), Eighties (1985), Noughties (2005), Present (2025), Future (2055)
- **Detailed 3D city block** with era-appropriate buildings, vehicles, pedestrians, and street furniture
- **Timeline slider** at the top with smooth era transitions
- **Full navigation** with orbit controls (pan, zoom, rotate)
- **Spatial audio** with era-appropriate ambient sounds and SFX
- **Adaptive performance** with device-tier detection and dynamic quality adjustment
- **WebGL context loss recovery** for mobile robustness
- **Debounced transitions** to prevent jank on rapid slider changes
- **Optimized bundle** with code splitting and tree-shaking

## Technical Highlights

### Performance Management
- Device tier detection (high/medium/low) based on hardware concurrency, device memory, and touch support
- Dynamic LOD for vehicles and pedestrians
- Adaptive quality degradation under sustained low FPS
- Instance-based rendering for buildings and windows

### Audio System
- Procedural sound generation (no external audio file downloads)
- Autoplay unlock on first user gesture
- Ambient loops per era
- SFX for UI interactions and transitions

### WebGL Robustness
- Context loss detection and recovery
- Graceful resource disposal and re-initialization
- Fallback rendering paths

### Era Transitions
- Cosine-eased smooth interpolation between eras
- Debounced slider input (150ms)
- Queued transition handoff for rapid changes
- Interpolated lighting, fog, and building properties

## Getting Started

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

## Build

```bash
npm run build
```

## Controls

- **Mouse drag**: Rotate the view
- **Mouse wheel**: Zoom in/out
- **Right drag / Ctrl+drag**: Pan
- **Timeline slider**: Navigate between eras
- **Arrow keys**: Navigate between eras (left/right)
- **Home/End**: Jump to first/last era
