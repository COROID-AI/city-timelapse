# City Time Period Timelapse

A self-contained 3D city block that transforms through five time periods —
**1945 · 1965 · 1985 · 2005 · 2025** — driven by a timeline slider at the top.

Everything is procedural: no external models, textures, or audio files.

## Highlights

- **Timeline slider** with labeled era ticks (1945 → 2025) and full keyboard support
  (`←`/`→` or `A`/`D`), with smooth eased transitions between years.
- **Every aspect of the block changes:**
  - Buildings change facade materials, window grids, emissive glow, storefront text, and rooftop-era props.
  - Vehicles change silhouette (1945 sedans → 1965 tail fins → 1985 boxes → 2005 SUVs → 2025 EVs).
  - Pedestrians' outfits change per era.
  - Street props evolve: gas lamps → cobra/neon → sodium → LED → modern poles.
  - Billboards show era-appropriate ad copy ("WAR BONDS", "COCA-COLA 5¢", "VIDEO ARCADE", "iPOD", "NEXUS AI").
  - Sky, sun, fog, atmosphere particles and lighting mood interpolate continuously.
- **Synthesized SFX** via Web Audio: era ambient noise beds, traffic rumble, one-shot
  horns/bells/sirens/chimes, and a subtle era music loop. Audio starts on first
  user gesture; `M` toggles mute.
- **Navigation**: free orbit camera (drag to look, scroll to zoom).
- **Resilience**: WebGL2 capability check with a DOM fallback, DPR cap, and
  reduced-motion friendly transitions.

## Development

```bash
npm install
npm run dev      # local dev server
npm run build    # type-check + production bundle
npm run preview  # preview the production build
```

Built with Vite, TypeScript (strict), Three.js and the Web Audio API.