# City Era Timelapse (1945–2055)

A polished, high-end 3D city block timelapse built with React Three Fiber, Three.js, Tailwind CSS, and Zustand. Drag the timeline slider to transform the entire city block across six eras — buildings, vehicles, storefronts, advertisements, pedestrian outfits, lighting, and SFX all change in real time.

## Features

- **Timeline slider** at the top with six era options: **1945, 1965, 1985, 2005, 2025, 2055**
- **Smooth era transitions** — colors, building heights, window glow, road wetness, vehicle density/speed, and pedestrian density all interpolate between eras
- **Full 3D navigation** — orbit, pan, and zoom with mouse/touch via `OrbitControls`
- **Detailed city block** — procedurally generated buildings with window textures, neon trim, billboards, roads, sidewalks, animated vehicles, and pedestrians
- **Era-specific SFX** — procedural traffic soundscape (streetcar → muscle → synth → modern → EV → futurist) with UI click feedback, armed on first interaction
- **Post-processing** — bloom effects for neon and window glow
- **Dynamic sky & fog** — `Sky` + `Fog` that shift with each era's palette
- **Reduced motion support** — skip animations for accessibility
- **Responsive HUD** — timeline slider, SFX toggle, reduced motion toggle, and navigation hints
- **Loading screen** — animated progress indicator
- **Error boundary** — graceful fallback if WebGL fails

## Tech Stack

- **React 18** + **TypeScript**
- **React Three Fiber** + **Three.js** for 3D rendering
- **@react-three/drei** for helpers (OrbitControls, Sky, PerspectiveCamera)
- **@react-three/postprocessing** for bloom effects
- **Zustand** for state management
- **Tailwind CSS** for UI styling
- **Vitest** + **@testing-library/react** for testing
- **ESLint** (flat config) for code quality

## Getting Started

```bash
# Install dependencies
npm install

# Start the dev server
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Run linter
npm run lint
```

Open `http://localhost:5173` in your browser.

## Controls

- **Drag** on the canvas to orbit around the city block
- **Scroll** to zoom in and out
- **Timeline slider** — drag or click era buttons to change the time period
- **SFX toggle** — enable/disable sound effects
- **Reduced motion** — skip transition animations

## Project Structure

```
src/
├── app/
│   ├── App.tsx              # Main app component with Canvas, lights, atmosphere
│   ├── eras.config.ts       # Era definitions and palettes (1945-2055)
│   ├── store.ts             # Zustand store for app state
│   ├── types.ts             # TypeScript types
│   └── __tests__/           # Era config and store tests
├── components/
│   ├── HUD.tsx              # Heads-up display wrapper
│   ├── TimelineSlider.tsx   # Timeline slider with range input + era buttons
│   ├── LoadingScreen.tsx    # Animated loading indicator
│   ├── SFXController.tsx    # SFX lifecycle manager
│   ├── ErrorBoundary.tsx    # React error boundary
│   └── __tests__/           # Component tests
├── scene/
│   ├── CityBlock.tsx        # Main 3D scene: buildings, vehicles, pedestrians, billboards
│   └── useReduceMotion.ts   # Reduced motion hook
├── lib/
│   ├── audio.ts             # Procedural SFX controller (Web Audio API)
│   ├── eraInterpolation.ts  # Era config interpolation for smooth transitions
│   └── __tests__/           # Interpolation tests
├── styles/
│   └── global.css           # Tailwind CSS entry point
└── main.tsx                 # React entry point
```

## Era Details

| Era | Year | Traffic SFX | Key Visuals |
|-----|------|-------------|-------------|
| 1945 | 1945 | Streetcar | Muted colors, modest buildings, vintage vehicles |
| 1965 | 1965 | Muscle | Warmer tones, classic cars, growing neon |
| 1985 | 1985 | Synth | Vibrant neon, cyberpunk palette, busy streets |
| 2005 | 2005 | Modern | Sleek glass buildings, digital billboards |
| 2025 | 2025 | EV | Clean aesthetics, green accents, quiet streets |
| 2055 | 2055 | Futurist | Holographic billboards, flying vehicles, purple skies |

## License

This is a creative coding project. Feel free to explore and modify.
