# City Time Period Timelapse

Create a 3D scene of a city block. Emphasis on detail is very important.

The scene must have a timeline slider in the top, with the following options:
1945, 1965, 1985, 2005 and 2025

The point of the scene is to be able to select any of the 5 different years, and the scene will transform in front of your eyes to the time period selected from the slider.

Time period should affect all aspects of the city block. The buildings, the vehicles, the storefronts, advertisements, outfits of the pedestrians, everything.

This must be a polished high end scene with SFX, ability to navigate around and look at things, etc. Go all out.

## Getting Started

```bash
npm install      # install dependencies
npm run dev      # start the Vite dev server (hot reload)
npm run build    # type-check and build the production bundle into dist/
npm run preview  # serve the production build locally
```

## Controls

### Mouse

| Action | Effect |
| --- | --- |
| **Drag** | Orbit the camera around the city block. |
| **Scroll / Wheel** | Zoom in and out. |
| **Right-drag** | Pan the camera. |

### Keyboard

| Key | Effect |
| --- | --- |
| **V** | Toggle between **Orbit** and **First-Person Fly** camera modes. |
| **W A S D** | Move while in fly mode (forward / left / back / right). |
| **Esc** | Exit first-person fly mode and return to orbit. |
| **M** | Toggle ambient **audio** (procedural era-appropriate SFX) on / off. |
| **← / →** | Step backward / forward through the eras (1945 → 2025). |
| **Home / End** | Jump to the first (1945) or last (2025) era when the timeline thumb is focused. |

### Timeline

Click any year label (1945, 1965, 1985, 2005, 2025) or drag the glowing thumb
across the rail to travel to that era. While the slider thumb is focused, the
arrow and Home/End keys navigate between stops.

### On-Screen UI

- **View** button — toggles orbit ↔ first-person fly.
- **Audio** button — mutes / unmutes the ambient soundscape.
- **FPS** readout — live frame-rate counter (updates once per second).
