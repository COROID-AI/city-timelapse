# City Time Period Timelapse

Create a 3D scene of a city block. Emphasis on detail is very important.

The scene must have a timeline slider in the top, with the following options:
1945, 1965, 1985, 2005, 2025 and 2055

The point of the scene is to be able to select any of the 6 different years,
and the scene will transform in front of your eyes to the time period selected
from the slider.

Time period should affect all aspects of the city block. The buildings, the
vehicles, the storefronts, advertisements, outfits of the pedestrians,
everything.

This must be a polished high end scene with SFX, ability to navigate around and
look at things, etc. Go all out.

## Stack

- [Vite](https://vite.dev/) (dev server + build) with TypeScript
- [Three.js](https://threejs.org/) for the 3D scene
- [Vitest](https://vitest.dev/) (with happy-dom) for unit tests
- [Playwright](https://playwright.dev/) for end-to-end browser tests

This repo is currently at the scaffold stage: a placeholder page with the era
timeline UI. The Three.js scene, era transitions, procedural audio and free
navigation land in the next milestone.

## Getting started

```bash
npm install
```

## Commands

| Command            | Description                                        |
| ------------------ | -------------------------------------------------- |
| `npm run dev`      | Start the Vite dev server with HMR                 |
| `npm run build`    | Type-check (`tsc`) then build for production        |
| `npm run preview`  | Serve the production build locally                  |
| `npm test`         | Run unit tests with Vitest (single run)             |
| `npm run test:watch` | Run unit tests in watch mode                     |
| `npm run e2e`      | Run Playwright end-to-end tests                     |

## Development

```bash
npm run dev
```

Then open the printed URL (default http://localhost:5173). The page shows the
placeholder shell with the era timeline.

## Production build

```bash
npm run build
npm run preview
```

## Tests

Unit tests run in a happy-dom environment:

```bash
npm test
```

End-to-end tests need a browser binary for Chromium:

```bash
npx playwright install chromium
npm run e2e
```

The Playwright config builds the app and serves it via `vite preview` on port
4173 before running the specs in `e2e/`.