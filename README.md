# City Timelapse 1945-2055

A 3D interactive city block visualization showing urban evolution across 6 eras from 1945 to 2055.

## Features

### Timeline Slider
- Top-positioned slider with 6 era options: 1945, 1965, 1985, 2005, 2025, 2055
- Era labels: Post-War, Modernist, Commercial, Tech Boom, Contemporary, Future
- Click era buttons or use slider to navigate

### 3D Scene
- **Buildings**: Era-appropriate architectural styles
  - 1945: Pre-war brick buildings with grid windows
  - 1965: Modernist curtain-wall glass towers
  - 1985: Commercial strip malls with neon signs
  - 2005: Contemporary mixed-use buildings
  - 2025: Contemporary with green roofs and smart glass
  - 2055: Futuristic towers with holographic displays and solar panels

- **Vehicles**: Period-appropriate transportation
  - 1945: Vintage sedans and coupes
  - 1965: Classic muscle cars
  - 1985: SUVs and trucks
  - 2005: Modern sedans and SUVs
  - 2025: Electric vehicles
  - 2055: Hover cars, pods, and futuristic vehicles

- **Pedestrians**: Era-appropriate clothing styles
  - 1940s: Business suits, dresses, work attire
  - 1960s: Mod dresses, hippie styles
  - 1980s: Yuppie power suits, punk styles
  - 2000s: Casual wear, athletic wear
  - 2020s: Modern styles, smart accessories
  - 2050s: Futuristic, cyborg, android styles

- **Storefronts**: Period-appropriate advertising
  - 1945: Newspaper stands, diners
  - 1965: Record shops, boutiques
  - 1985: Electronics stores, neon signs
  - 2005: Tech stores, digital displays
  - 2025: Smart shops, delivery points
  - 2055: Holographic shops, teleport hubs

### Controls
- **Orbit Controls**: Left-click drag to rotate, scroll to zoom, right-click drag to pan
- **Keyboard accessible**: Era slider works with keyboard navigation
- **Touch support**: Works on mobile devices with touch gestures

### Visual Effects
- Bloom post-processing for polished look
- Era-appropriate sky colors
- Fog effects for atmospheric depth
- Shadows and lighting

### Error Handling
- WebGL error boundaries
- Loading states
- Responsive error messages

## Development

```bash
npm install
npm run dev
```

Open http://localhost:3000 in your browser.

## Build

```bash
npm run build
npm run preview
```

## Testing

```bash
npm run test
```