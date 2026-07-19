# City Era Timelapse 1945-2055

A polished high-end 3D scene showcasing the evolution of a city block across 70 years, from post-war 1945 to futuristic 2055.

## Features

### Timeline Slider
- Interactive slider at the top of the screen with year options: 1945, 1965, 1985, 2005, 2025, 2055
- Smooth transitions between eras with interpolated transforms, materials, and visibility changes

### Era-Specific Features

#### Architecture
- **1945**: Art Deco buildings with geometric patterns and warm stone colors
- **1965**: Brutalist concrete structures with raw, imposing forms
- **1985**: Modern buildings with clean lines and glass facades
- **2005**: Contemporary glass towers with reflective surfaces
- **2025**: Mixed modern glass and automated structures
- **2055**: Eco-futuristic buildings with green walls and solar panels

#### Vehicles
- **1945**: Classic cars in vintage colors
- **1965**: Muscle cars with bold designs
- **1985**: Sedans from the 80s era
- **2005**: Modern sedans
- **2025**: Electric vehicles with charging indicators
- **2055**: Hover vehicles with energy field effects

#### Pedestrians
- Period-appropriate clothing styles for each era
- Walking and idle animations
- Futuristic pedestrians with holographic effects (2055)

#### Advertisements
- **1945**: Vintage neon signage with incandescent bulbs
- **1965-1985**: Neon signs with glow effects
- **2005-2025**: LED billboards and digital displays
- **2055**: Holographic 3D displays with particle effects

#### Storefronts
- Evolution from mom-and-pop shops to malls to automated retail
- Interactive displays and touch screens

### Technical Features
- Orbit controls with bounds and smooth damping
- Post-processing effects (tone mapping, color grading)
- Ambient soundscapes with era-appropriate tones
- Performance optimized with instanced geometries
- Responsive UI for desktop and mobile
- Loading states and error boundaries for WebGL
- Weather and atmospheric effects

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm run test
```

## Tech Stack
- React 18 with TypeScript
- Three.js via React Three Fiber
- Material UI for UI components
- Howler.js for audio
- Vite for bundling

## Controls
- **Drag**: Orbit around the scene
- **Scroll**: Zoom in/out
- **Slider**: Change time period