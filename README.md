# City Era Timelapse 1945–2055

A high-detail, navigable **3D city block** that **morphs through six eras of
urban history** (1945 → 2055), driven by a timeline slider.  Every texture,
building, vehicle, pedestrian, street prop, soundscape and SFX is **generated
procedurally at runtime** — the project ships with **zero binary assets**.

Built entirely in **Python** with the [Ursina](https://www.ursinaengine.org/)
3D engine (Panda3D under the hood).

---

## Quick start

```bash
# 1. Install dependencies (Python 3.11+)
pip install -r requirements.txt

# 2. Launch
python run_city.py        # or:  python -m city_timelapse
```

A window opens on a 1945 post-war block.  Drag the **timeline slider** at the
top, or click the **year buttons** (1945–2055), and watch the entire city
morph: buildings grow taller and change materials, vehicles evolve from sedans
to flying pods, streetlights go from gas to holographic, the sky and fog shift,
and the ambient soundscape changes.

---

## Eras

| Year | Era | Highlights |
|------|-----|------------|
| **1945** | Post-War Recovery | Brick tenements, sash windows, water tanks, gas lamps, black sedans |
| **1965** | Mid-Century Boom | Ribbon windows, cobra-head lamps, neon signs, pastel cars |
| **1985** | Eighties Excess | Mirrored glass towers, AC rooftops, neon nights, smoggy haze |
| **2005** | Digital Dawn | Blue-glass towers, solar roofs, LED billboards, SUVs & hybrids |
| **2025** | Smart Present | Smart-glass facades, electric vehicles, drones, holographic ads |
| **2055** | Eco-Future | Vertical forests, bioluminescent skin, flying pods, sky gardens |

---

## Controls

| Input | Action |
|-------|--------|
| **Mouse drag** | Orbit / look around |
| **WASD** | Move |
| **Scroll** | Zoom |
| **Timeline slider** | Morph between years |
| **1–6** | Jump to a specific era |
| **Space** | Toggle auto-cycle through eras |
| **M** | Toggle ambient music |
| **F1** | Toggle debug overlay |
| **Esc** | Quit |

---

## Architecture

```
city_timelapse/
├── eras.py            Pure-data EraSpec definitions (6 eras, headless-safe)
├── interpolation.py   Smooth morphing between eras (colours, counts, materials)
├── textures.py        Procedural facade / road / sign / sky textures (Pillow)
├── audio.py           Procedural ambient soundscapes & SFX (numpy → WAV)
├── buildings.py       Per-era building geometry + rooftops + block layout
├── props.py           Vehicles, pedestrians, streetlights, trees, signage
├── scene.py           Ursina scene, camera, UI timeline, lighting, fog
├── __main__.py        `python -m city_timelapse` entry point
└── __init__.py
run_city.py            Convenience launcher
test_city.py           Headless unit tests (33 tests)
requirements.txt
```

### Design principles

1. **Zero binary assets.** All textures, models are composed from Ursina
   primitives (cube/sphere/plane), and all audio is synthesised with numpy —
   nothing to download or manage.
2. **Data-driven.** A single `EraSpec` dataclass per year drives every visual
   and auditory aspect, making it trivial to add or tune eras.
3. **Smooth morphing.** Dragging the slider crossfades colours, fog, sky and
   lighting continuously, while discrete props (lamps, signage, vehicle mode)
   swap at segment midpoints for a natural handoff.
4. **Headless-testable core.** The data, interpolation, texture and audio
   layers have no display dependency and are fully covered by unit tests.

---

## Testing

```bash
python test_city.py          # or:  python -m pytest test_city.py -v
```

33 headless tests cover era-data integrity, interpolation math, texture
generation, audio synthesis, and module imports.

---

## Requirements

- Python 3.11+
- ursina 6.1.2 (last release supporting Python 3.11)
- numpy, pillow

> **Note:** Ursina requires a display (OpenGL).  It runs on any desktop with
> a GPU; it will not run in a headless server environment.
