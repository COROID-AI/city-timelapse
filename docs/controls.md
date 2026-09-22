# Controls — City Time Period Timelapse

Everything you can do on the block, what each control does, and which one wins
when two of them disagree. The shortcut rows below are generated from the same
table the running application binds (`src/interaction/shortcuts.ts`), so this
document and the code cannot drift apart: a check in `tests/unit/navigation.test.ts`
fails if a row is missing here.

## Getting around

The block is a 120 m city square at the origin; every era re-dresses it in place.
Two camera modes share one camera, and switching between them keeps your framing.

| Mode | What it is | How to drive it |
| ---- | ---------- | --------------- |
| **Orbit** | Circle the block and look at it. The camera keeps a look-at point inside the block and swings around it. | Drag to orbit, right-drag or Shift-drag to pan, wheel to zoom, `+`/`-` (or Page Up/Down) to dolly. |
| **Street** | Walk and look around at eye level. | Drag to turn the head, `W`/`A`/`S`/`D` (or arrows with Shift) to walk, wheel or `+`/`-` to move forward and back. |

Press `M` to flip between the modes, or use the **Orbit (O)** and **Street (C)**
chips in the Camera panel. Hold `Shift` while steering to move about two and a
half times faster, and press `R` to return to the opening viewpoint.

Arrow keys orbit in Orbit mode and turn your head in Street mode. They also own
the timeline when the slider has focus, so the timeline's own keys are listed
under *Moving through time* below.

## Viewpoints

Five named framings, each resolved from the block's real geometry — the corner
anchors, a parking bay, a shopfront bay, a rooftop prop anchor and the measured
extent of everything the composition publishes to inspect. Nothing here is a
hard-coded camera position, so a viewpoint follows the block when it changes.

| Key | Viewpoint | Where it puts you |
| --- | --------- | ----------------- |
| `1` | Street corner | Across the intersection, looking back at the corner of the block. |
| `2` | Curb-level crossing | Kerb height on the far side of the carriageway, looking along the crossing. |
| `3` | Storefront close-up | Eight metres back from a shopfront, at eye height. |
| `4` | Rooftop | Above the parapet of a parcel, looking along the roofline. |
| `5` | Aerial establishing shot | A high three-quarter view framed from the block's measured extent. |

You can also click any chip in the **Viewpoints** panel. A viewpoint change is a
smooth, eased move; picking another viewpoint mid-move simply retargets it. The
camera's *other* mode sub-state is kept, so flipping between Orbit and Street
after a viewpoint change never loses your place.

## Cinematic tour

**Start tour (T)** hands the camera to the autopilot. It walks the block's own
sidewalk loop and pauses in front of points of interest the composition
publishes — shopfronts, parked cars, street furniture — naming each pause in the
Tour panel. The loop is closed, so the tour keeps circling until you stop it.

**Any input stops the tour**: press a key, click, touch or scroll, and the tour
ends and the camera returns, with an eased move, to exactly the framing you had
before you started it. The `T` key is the one exception — it toggles the tour off
deliberately rather than being treated as a stray input.

## Inspecting an object

**Click any object** — a building, a shopfront, a sign, an advertisement, a
vehicle, a street prop or a focus anchor — to zoom to it and open an info card
naming the object's category, the layer that owns it and the era you are looking
at, with the period's own vocabulary for that kind of thing (a 1945 shopfront is
described with 1945 storefront types).

A click is a press-and-release that does not drag: move more than a few pixels and
the gesture orbits the camera instead of inspecting.

While a card is open:

- press `Esc`, click the card's **Close** button, or click empty sky to release
  the focus — the camera eases back to the framing you had before you focused;
- focus another object directly by clicking it; the card follows the new target.

Focusing an object does not change the year you are looking at.

## Moving through time

The timeline is pinned to the top of the screen. Click a year, drag the track, or
use the keys below. Every layer, the ambience and the inspection surface rebuild
for the year you pick, and your camera is left exactly where it was.

| Key | What it does |
| --- | ------------ |
| `Tab` | Move focus into the timeline slider (a visible ring shows where the focus is). |
| Arrow keys, Home, End | Step one era older or newer, or jump to the ends — while the slider has focus. |
| Enter / Space | Commit the focused year and finish its transition immediately. |
| `[` / `]` | Step one era older / newer from anywhere on the page. |

## Keyboard shortcuts

These bindings belong to the exploration layer. Keys the camera already owns —
arrows, `W`/`A`/`S`/`D`, `+`/`-`, Page Up/Down, `M`, `R` and Shift — are not
repeated here; no key is bound twice anywhere in the application.

| Key | Action |
| --- | ------ |
| O | Switch to the orbit camera (circle and look at the block). |
| C | Switch to the street camera (walk and look around at eye level). |
| 1 | Go to the street-corner viewpoint. |
| 2 | Go to the curb-level crossing viewpoint. |
| 3 | Go to the storefront close-up viewpoint. |
| 4 | Go to the rooftop viewpoint. |
| 5 | Go to the aerial establishing shot. |
| T | Start or stop the cinematic tour of the block. |
| Esc | Release the focused object (or stop the tour) and return the camera. |
| [ | Step one era older. |
| ] | Step one era newer. |
| Q | Cycle High → Medium → Low; choosing by hand stops automatic quality. |
| N | Mute or restore the soundscape (Enable sound is still the first step). |

Shortcuts are ignored while you are typing in a form control, and while `Ctrl`,
`Cmd` or `Alt` is held, so browser and overlay shortcuts keep working.

## Sound

Nothing plays until you ask. **Enable sound** unlocks the audio engine for this
visit — browsers block audio until a real gesture — and starts the period's
ambience and sirens. **Mute** (or `N`) silences the block without losing your
soundscape choice; pressing **Enable sound** again also clears the mute.

## Quality

Three tiers — **High**, **Medium** and **Low** — each fixing a density, an effect
chain and a frame budget (High and Medium aim at 60 fps, Low at 30 fps).

**Manual override takes precedence.** Clicking a tier in the Quality panel (or
pressing `Q`) records your choice and marks it manual: the adaptive controller
then *suspends* and leaves the tier exactly where you put it. The status line
reads "manual choice" while that is true. Choose **Back to automatic** to hand
quality back; the controller resumes from the tier you left it at.

**Automatic quality** measures the rolling average frame time against the current
tier's budget:

- it drops **one tier at a time** once the average is above the budget — plus the
  shared measurement tolerance — for a sustained run of over-budget frames;
- it climbs back **one tier at a time** only after a much longer run of frames
  that sit comfortably *under* the budget, so a single good frame cannot raise it;
- a short cooldown separates two changes, which keeps the tier from oscillating
  when the block sits right on the budget line;
- each change shows a brief, non-blocking notice explaining the old tier, the new
  tier and the measured frame time. The notice never covers the scene and never
  takes focus.

Changing the tier rebuilds the scene in place: nothing is remounted and your
camera, the year and any open card are untouched.

## Reduced motion

The scene follows your operating system's *reduce motion* setting by default and
you can overrule it with **Follow system**, **Reduce motion** or **Full motion**
in the Motion panel. When reduced motion is active:

- era changes swap immediately instead of morphing;
- the overlay's own transitions are dropped.

Manual camera moves — viewpoints, inspection focus and the tour — still animate,
because they are moves you asked for; press `Esc` or click to stop the tour at
any moment if you would rather not watch it.

## Pointer and touch

- **Drag** orbits (Orbit mode) or turns your head (Street mode).
- **Right-drag** or **Shift-drag** pans the look-at point.
- **Wheel** zooms in Orbit mode and walks in Street mode.
- **Two-finger pinch** zooms, and two-finger drag pans, on touch screens.
- **Click / tap** an object to inspect it when you are not dragging.
- The right-click menu is suppressed over the canvas so the gestures stay
  available.
