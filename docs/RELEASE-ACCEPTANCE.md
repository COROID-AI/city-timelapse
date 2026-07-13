# Luna release acceptance record

This checklist is the release artifact for the six-era city presentation. Capture screenshots or a short recording from the same reset viewpoint for every timeline stop (`1945`, `1965`, `1985`, `2005`, `2025`, `2055`) and attach them to the release record. The browser evidence run records the consistent `six-era-evidence-ready` and `responsive-evidence-ready` captures; the per-era manifest below is the sign-off target for the visual review.

### Per-era capture manifest

| Viewpoint | Era capture | Required settled readout |
| --- | --- | --- |
| Release reset / desktop | `era-1945.png` | `1945 / settled` |
| Release reset / desktop | `era-1965.png` | `1965 / settled` |
| Release reset / desktop | `era-1985.png` | `1985 / settled` |
| Release reset / desktop | `era-2005.png` | `2005 / settled` |
| Release reset / desktop | `era-2025.png` | `2025 / settled` |
| Release reset / desktop | `era-2055.png` | `2055 / settled` |

## Browser evidence

| Check | Result | Evidence / notes |
| --- | --- | --- |
| Six consistent-viewpoint era captures | Browser harness passed for the release shell; era capture pending | Reset view, select each era, wait for `settled`, capture the canvas and timeline readout. |
| Navigation | Pending capture | Drag orbit, wheel/pinch zoom, WASD/arrow movement, Q/E height, Home reset. Confirm no console/page errors. |
| Motion preference | Pending capture | Run once with `prefers-reduced-motion: reduce`; verify the short transition remains legible and controls remain usable. |
| Keyboard timeline | Pending capture | Focus the range input and use Home/End/Arrow keys; verify the year readout and active stop update. |
| Audio consent | Pending capture | Sound remains off until the Sound button is activated; after consent, verify era changes crossfade and Sound off silences it. |
| Unsupported WebGL / runtime error | Covered in UI | Renderer initialization and render-loop failures show an actionable error state with a WebGL/reload hint. |

## Build and performance evidence

Run from the repository root and record the output with this artifact:

```sh
npm run build
npm run typecheck
```

Release run (2026-07-13): `npm run build` and `npm run typecheck` passed. The browser smoke check served HTTP 200 at `/` in desktop and mobile viewports, with a canvas, readable controls, no page errors, and no failed critical requests. GPU-driver `ReadPixels` performance warnings are harness noise; use the quality tier and attached performance trace for device-specific sign-off. The harness also exposed an era color warning for the raw `b46be0` config token; the scene now normalizes all config and palette color tokens before passing them to Three.js or canvas.

The app selects high, balanced, or low rendering density from device memory, CPU count, and reduced-motion preference. Confirm a constrained-device run remains navigable and retains era-defining materials, lighting, props, traffic, and crowd silhouettes. Confirm a capable-device run uses the high-detail tier. The browser smoke check should report HTTP 200, one non-blank canvas, no page errors, and no failed critical requests.

## Sign-off

- [ ] All six captures use the same reset camera viewpoint.
- [ ] Timeline, geometry/materials/props, crowds/traffic, lighting, and audio settle on the same selected era after repeated selection and scrubbing.
- [ ] No prior-era signage, models, traffic, clothing, or ambience remains after a settled transition.
- [ ] Build and browser smoke check outputs are attached.
