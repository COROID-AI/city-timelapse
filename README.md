# City Era Timelapse 1945-2055

An interactive 3D scene showcasing architectural evolution through 6 distinct eras from 1945 to 2055.

## Features

- **Timeline Slider**: Navigate through 6 eras (1945, 1965, 1985, 2005, 2025, 2055) positioned at the top
- **Era-Appropriate Architecture**: 
  - 1945: Brick buildings
  - 1965: Modernist structures
  - 1985: Glass/steel facades
  - 2005: Mixed-use developments
  - 2025: Sustainable/green buildings
  - 2055: Futuristic translucent structures

- **Era-Appropriate Vehicles**:
  - 1945: Classic cars
  - 1965: Muscle cars
  - 1985: Boxy 80s cars
  - 2005: SUVs
  - 2025: Electric vehicles
  - 2055: Flying vehicles

- **Era-Appropriate Storefronts**: Vintage to holographic signage
- **Era-Appropriate Pedestrian Outfits**: Distinct color palettes per era
- **Orbit Controls**: 3D navigation with bounded movement
- **Visual Effects**: Emissive materials for glow effects, CSS-based post-processing
- **Audio**: Ambient sound effects per era
- **Responsive**: Works on desktop and mobile
- **Error Handling**: Loading states and WebGL error boundaries
- **Performance**: Optimized with memoization

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Controls

- Click/drag to orbit camera
- Scroll to zoom (bounded)
- Click era markers to transition through time

## Tech Stack

- React 18
- @react-three/fiber (React Three Fiber)
- @react-three/drei
- Three.js
- Zustand (state management)
- Vite