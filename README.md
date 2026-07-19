# City Era Timelapse

A 3D interactive city block scene showcasing urban evolution from 1945 to 2055.

## Features

- **6 Era Timeline**: 1945, 1965, 1985, 2005, 2025, 2055
- **Smooth Animated Transitions**: Cross-fade between eras with smooth animations
- **Navigation Controls**: Orbit, pan, and zoom with bounds and reset capability
- **Era-Appropriate Assets**:
  - Buildings: Brick → Modernist → Glass → Contemporary → Green → Bio-integrated
  - Vehicles: Classic cars → Muscle cars → 80s boxy → Modern cars → Electric → Hover pods
  - Pedestrians: Vintage → Retro → Punk → Casual → Tech → Futuristic
  - Storefronts: Traditional → Neon → Digital → LED → Smart → Hologram
- **Accessibility**:
  - Keyboard navigation (arrow keys, 1-6 for eras, R for reset)
  - Reduced motion support via `prefers-reduced-motion`
  - DOM-based controls outside canvas
  - Screen reader labels and ARIA attributes
- **Performance Optimizations**:
  - `frameloop="demand"` for render efficiency
  - Device pixel ratio capping (max 2x)
  - Instanced meshes for repeated elements
  - Performance throttling in Canvas

## Controls

- **Mouse**: Click and drag to orbit, scroll to zoom, right-drag to pan
- **Keyboard**:
  - `←` / `→`: Navigate between eras
  - `1` - `6`: Jump to specific era (1945-2055)
  - `R`: Reset camera view
  - `Home` / `End`: Jump to first/last era

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