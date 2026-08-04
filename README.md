# City Time Period Timelapse

Create a 3D scene of a city block. Emphasis on detail is very important.

The scene must have a timeline slider in the top, with the following options:
1945, 1965, 1985, 2005, 2025 and 2055

The point of the scene is to be able to select any of the 5 different years, and the scene will transform in front of your eyes to the time period selected from the slider.

Time period should affect all aspects of the city block. The buildings, the vehicles, the storefronts, advertisements, outfits of the pedestrians, everything.

This must be a polished high end scene with SFX, ability to navigate around and look at things, etc. Go all out.

## Running

```sh
npm install   # install dependencies
npm run dev   # start the Vite dev server
npm run build # type-check and build for production (emits dist/)
npm run preview # preview the production build
npm test      # run the Vitest test suite
```

## Controls

First-person exploration with Pointer Lock:

- Click the canvas to lock the pointer and look around with the mouse
- `W` / `A` / `S` / `D` (or arrow keys) walk through the streets; movement is
  collision-aware against the building bounding boxes and stays on the ground
- `Shift` sprints, `Space` jumps
- `R` toggles between walk mode and the OrbitControls fallback view (drag to
  rotate, scroll to zoom), so the city stays viewable even when the browser
  blocks Pointer Lock

An on-screen prompt in the top-left shows the active controls at all times.
