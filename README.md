# City Era Timelapse 1945-2055

A 3D interactive city block visualization showing architectural evolution through 6 eras.

## Features

- **Timeline Slider**: Navigate through years 1945, 1965, 1985, 2005, 2025, and 2055
- **Era-Specific Architecture**:
  - 1945: Post-war brick buildings
  - 1965: Mid-century modern design
  - 1985: Concrete brutalist structures
  - 2005: Glass modern buildings
  - 2025: Contemporary sustainable architecture
  - 2055: Futuristic smart-glass designs
- **Period Vehicles**: Classic cars to flying vehicles
- **Era-Appropriate Pedestrians**: Clothing styles matching each time period
- **Storefronts & Advertisements**: Themed for each era
- **Post-Processing Effects**: Bloom, SMAA, and chromatic aberration
- **Ambient Audio**: Era-specific soundscapes
- **Orbit Controls**: Mouse/touch navigation
- **Responsive Design**: Works on desktop and mobile

## Tech Stack

- React + TypeScript + Vite
- Three.js via @react-three/fiber
- @react-three/drei for utilities
- @react-spring/three for animations
- @react-three/postprocessing for visual effects

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Usage

Click on any year in the timeline slider at the top to smoothly transition the entire scene through time. Use mouse/touch to orbit around the city block and examine the details.