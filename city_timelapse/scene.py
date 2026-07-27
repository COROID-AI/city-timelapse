"""
The main 3D scene and application.

Wires together the era data, interpolation, procedural textures/audio, and
geometry generators into a navigable Ursina scene with a timeline slider.

CityScene subclasses Entity so Ursina calls its update()/input() automatically.

Controls
--------
Mouse drag / Arrows + Mouse  : orbit / look around (EditorCamera)
WASD                         : move
Scroll                       : zoom
1-6                          : jump to an era
SPACE                        : toggle auto-cycle
M                            : toggle ambient music
F1                           : toggle debug overlay
ESC                          : quit
"""

from __future__ import annotations

import math
import os
from typing import List, Optional

from .eras import ERA_DATA, YEARS, EraSpec
from .interpolation import blend_eras
from .audio import AmbientBank, transition_whoosh_bytes, click_sfx_bytes


BLOCK_RADIUS = 22.0


# ---------------------------------------------------------------------------
# Audio helpers — Ursina's Audio loads WAV files by name from the asset
# folder, so we write generated WAV bytes there and reference by name.
# ---------------------------------------------------------------------------
def _ensure_audio_on_disk(name: str, data: bytes) -> str:
    """Write WAV bytes into the Ursina asset folder; return the bare name."""
    try:
        from ursina import application
        folder = application.asset_folder
    except Exception:
        folder = os.getcwd()
    path = os.path.join(str(folder), name + ".wav")
    try:
        with open(path, "wb") as f:
            f.write(data)
    except Exception:
        pass
    return name


def _play_sound(data: bytes, name: str, *, loop: bool = False,
                volume: float = 1.0, autoplay: bool = True) -> Optional[object]:
    try:
        from ursina import Audio
        nm = _ensure_audio_on_disk(name, data)
        a = Audio(sound_file_name=nm, autoplay=autoplay, auto_destroy=False)
        a.loop = loop
        a.volume = volume
        return a
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Era geometry builder — constructs/tears down all per-era geometry
# ---------------------------------------------------------------------------
class CitySceneBuilder:
    def __init__(self, parent):
        self.parent = parent
        self.buildings: List[object] = []
        self.vehicles = None
        self.pedestrians = None
        self.props = None

    def build(self, era: EraSpec, block_radius: float):
        from .buildings import generate_block
        from .props import VehicleSystem, PedestrianSystem, StreetProps
        self.buildings = generate_block(era, block_radius=block_radius,
                                        parent=self.parent)
        self.vehicles = VehicleSystem(era, parent=self.parent)
        self.pedestrians = PedestrianSystem(era, parent=self.parent)
        self.props = StreetProps(era, block_radius=block_radius,
                                 parent=self.parent)

    def update_actors(self, t: float, block_radius: float):
        if self.vehicles:
            self.vehicles.update(t, block_radius)
        if self.pedestrians:
            self.pedestrians.update(t)

    def destroy(self):
        if self.buildings:
            for b in self.buildings:
                b.destroy()
        if self.vehicles:
            self.vehicles.destroy()
        if self.pedestrians:
            self.pedestrians.destroy()
        if self.props:
            self.props.destroy()
        self.buildings.clear()


# ---------------------------------------------------------------------------
# Main scene controller (Entity subclass → update/input auto-called)
# ---------------------------------------------------------------------------
def create_scene() -> "CityScene":
    """Create the CityScene Entity after Ursina has booted."""
    return CityScene()


class CityScene:
    """Top-level scene controller.

    Created inside :func:`main` after the Ursina app has booted.  Installs
    global ``update`` / ``input`` hooks on ``__main__`` (Ursina's canonical
    extension point) so every frame and key-press is routed here.
    """

    def __init__(self) -> None:
        from ursina import (Entity, camera, window, color,
                            EditorCamera, Sky, DirectionalLight,
                            AmbientLight, application)
        import __main__

        self.color = color

        # --- State -------------------------------------------------------
        self.year_float = float(YEARS[0])
        self.target_year = float(YEARS[0])
        self.auto_cycle = False
        self.auto_timer = 0.0
        self.elapsed = 0.0
        self._last_rebuild_year: int = -1
        self.music_on = True

        # --- Audio bank --------------------------------------------------
        self.ambient_bank = AmbientBank()
        self.current_ambient = None

        # --- World root (parent of all era geometry) ---------------------
        self.world = Entity()

        # --- Sky / lights ------------------------------------------------
        self.sky_entity = Sky()
        self.sun = DirectionalLight()
        self.ambient_light = AmbientLight()

        # --- Ground (created once; textures updated per era) ------------
        self._setup_ground()

        # --- Camera ------------------------------------------------------
        self.editor_cam = EditorCamera(move_speed=10, rotate_speed=200,
                                       zoom_speed=1.5)
        camera.position = (38, 30, 38)
        camera.rotation_x = 35
        camera.rotation_y = 45
        camera.fov = 60

        # --- UI ----------------------------------------------------------
        self._setup_ui()

        # --- Geometry builder --------------------------------------------
        self.builder = CitySceneBuilder(self.world)

        # --- Install global update/input hooks on __main__ ---------------
        __main__.update = self._update_hook
        __main__.input = self._input_hook

        # --- Build initial era -------------------------------------------
        era = self._current_era()
        self.builder.build(era, BLOCK_RADIUS)
        self._apply_atmosphere(era)
        self._update_labels(era)
        self._last_rebuild_year = era.year
        self._start_ambient(era)
        self._play_whoosh()

    # ==================================================================
    # Era resolution
    # ==================================================================
    def _current_era(self) -> EraSpec:
        return blend_eras(self.year_float)

    def _nearest_key_year(self) -> int:
        return min(YEARS, key=lambda y: abs(y - self.year_float))

    # ==================================================================
    # Ground
    # ==================================================================
    def _setup_ground(self) -> None:
        from ursina import Entity, color
        from .textures import road_texture, sidewalk_texture
        from .buildings import _make_texture

        era = self._current_era()
        self.ground = Entity(model="plane",
                             texture=_make_texture(road_texture(era)),
                             scale=(140, 1, 140), y=0,
                             color=color.rgb(255, 255, 255))
        self.sidewalk = Entity(model="plane",
                               texture=_make_texture(sidewalk_texture(era)),
                               scale=(BLOCK_RADIUS * 2.6, 1,
                                      BLOCK_RADIUS * 2.6),
                               y=0.05, color=color.rgb(255, 255, 255))

    def _update_ground_textures(self, era: EraSpec) -> None:
        from .textures import road_texture, sidewalk_texture
        from .buildings import _make_texture
        try:
            self.ground.texture = _make_texture(road_texture(era))
            self.sidewalk.texture = _make_texture(sidewalk_texture(era))
        except Exception:
            pass

    # ==================================================================
    # Atmosphere (sky, sun, fog)
    # ==================================================================
    def _apply_atmosphere(self, era: EraSpec) -> None:
        from ursina import scene as ursina_scene, color, window

        self.sky_entity.color = color.rgb(*era.sky_horizon)
        window.color = color.rgb(*era.sky_horizon)

        pitch = math.radians(era.sun_pitch)
        heading = math.radians(era.sun_heading)
        sx = math.cos(pitch) * math.cos(heading)
        sy = math.sin(pitch)
        sz = math.cos(pitch) * math.sin(heading)
        self.sun.look_at((sx, sy, sz))
        self.sun.color = color.rgb(era.sun_color[0] / 255,
                                   era.sun_color[1] / 255,
                                   era.sun_color[2] / 255)
        self.sun.intensity = era.sun_intensity
        self.ambient_light.color = color.rgb(era.ambient[0] / 255,
                                             era.ambient[1] / 255,
                                             era.ambient[2] / 255)

        ursina_scene.fog_color = color.rgb(era.fog_color[0] / 255,
                                           era.fog_color[1] / 255,
                                           era.fog_color[2] / 255)
        ursina_scene.fog_density = era.fog_density

    # ==================================================================
    # UI
    # ==================================================================
    def _setup_ui(self) -> None:
        from ursina import (Text, Button, Slider, camera, color, Entity)

        # Year + era name (top centre)
        self.year_label = Text(text="1945", parent=camera.ui,
                               position=(0, 0.46), scale=2.6,
                               origin=(0, 0), color=color.rgb(255, 255, 255))
        self.name_label = Text(text="Post-War Recovery", parent=camera.ui,
                               position=(0, 0.37), scale=1.3,
                               origin=(0, 0), color=color.rgb(220, 220, 230))
        self.tagline_label = Text(text="", parent=camera.ui,
                                  position=(0, 0.32), scale=0.8,
                                  origin=(0, 0),
                                  color=color.rgb(180, 190, 200))

        # Timeline slider (top)
        self.slider = Slider(min=YEARS[0], max=YEARS[-1],
                             default=YEARS[0], dynamic=True,
                             position=(-0.4, 0.27),
                             bar_color=color.rgb(50, 55, 70))
        self.slider.on_value_changed = self._on_slider_changed

        # Era tick buttons under the slider
        self.tick_buttons: List[object] = []
        span = YEARS[-1] - YEARS[0]
        for y in YEARS:
            frac = (y - YEARS[0]) / span
            bx = -0.36 + frac * 0.72
            b = Button(text=str(y), parent=camera.ui,
                       position=(bx, 0.205), scale=(0.08, 0.045),
                       color=color.rgb(40, 45, 60),
                       text_color=color.rgb(220, 220, 230))
            b.on_click = (lambda yy=y: self._jump_to_year(float(yy)))
            self.tick_buttons.append(b)

        # Description panel (bottom-left)
        self.desc_bg = Entity(parent=camera.ui, model="quad",
                              position=(-0.18, -0.40), scale=(0.92, 0.22),
                              color=color.rgba(15, 18, 25, 200))
        self.desc_label = Text(text="", parent=camera.ui,
                               position=(-0.62, -0.33),
                               scale=0.72, origin=(-0.5, 0.5),
                               color=color.rgb(190, 195, 205))

        # Help text (bottom-right)
        Text(text=("WASD move  •  Drag orbit  •  Scroll zoom  •  "
                   "1-6 eras  •  SPACE cycle  •  M music  •  ESC quit"),
             parent=camera.ui, position=(0.78, -0.46),
             scale=0.55, origin=(0.5, 0.5), color=color.rgb(150, 155, 165))

        self.cycle_label = Text(text="", parent=camera.ui,
                                position=(0.78, 0.46), scale=0.7,
                                origin=(0.5, 0.5),
                                color=color.rgb(120, 220, 150))

    # ==================================================================
    # UI callbacks
    # ==================================================================
    def _on_slider_changed(self) -> None:
        try:
            self.target_year = float(self.slider.value)
        except Exception:
            pass

    def _jump_to_year(self, year: float) -> None:
        self.target_year = year
        try:
            self.slider.value = year
        except Exception:
            pass
        self._play_click()

    def _update_labels(self, era: EraSpec) -> None:
        self.year_label.text = str(era.year)
        self.name_label.text = era.name
        self.tagline_label.text = era.tagline
        self.desc_label.text = era.description

    # ==================================================================
    # Audio
    # ==================================================================
    def _start_ambient(self, era: EraSpec) -> None:
        if not self.music_on:
            return
        try:
            if self.current_ambient is not None:
                self.current_ambient.stop()
                self.current_ambient.destroy()
        except Exception:
            pass
        key = era.ambient_key
        data = self.ambient_bank.get(era)
        self.current_ambient = _play_sound(
            data, f"ambient_{key}", loop=True,
            volume=era.ambient_volume)

    def _play_click(self) -> None:
        _play_sound(click_sfx_bytes(), "ct_click", loop=False, volume=0.35)

    def _play_whoosh(self) -> None:
        _play_sound(transition_whoosh_bytes(), "ct_whoosh",
                    loop=False, volume=0.5)

    # ==================================================================
    # Per-frame update (installed as __main__.update)
    # ==================================================================
    def _update_hook(self) -> None:
        from ursina import time
        dt = time.dt
        self.elapsed += dt

        # Smoothly approach the target year
        diff = self.target_year - self.year_float
        if abs(diff) > 0.01:
            self.year_float += diff * min(1.0, dt * 5.0)

        # Rebuild when we cross into a new era key
        nearest = self._nearest_key_year()
        if nearest != self._last_rebuild_year:
            self._rebuild_era(nearest)

        # Live atmosphere morph while dragging within a segment
        era = self._current_era()
        self._apply_atmosphere(era)
        self._update_labels(era)

        # Animate actors
        self.builder.update_actors(self.elapsed, BLOCK_RADIUS)

        # Auto-cycle
        if self.auto_cycle:
            self.auto_timer += dt
            if self.auto_timer > 4.5:
                self.auto_timer = 0.0
                idx = YEARS.index(self._nearest_key_year())
                nxt = YEARS[(idx + 1) % len(YEARS)]
                self._jump_to_year(float(nxt))

        # Keep slider thumb in sync when year changes programmatically
        try:
            if abs(self.slider.value - self.year_float) > 0.1:
                self.slider.value = self.year_float
        except Exception:
            pass

    def _rebuild_era(self, nearest_year: int) -> None:
        self.builder.destroy()
        era = blend_eras(self.year_float)
        self.builder.build(era, BLOCK_RADIUS)
        self._update_ground_textures(era)
        self._start_ambient(ERA_DATA[nearest_year])
        self._play_whoosh()
        self._last_rebuild_year = nearest_year

    # ==================================================================
    # Input (installed as __main__.input)
    # ==================================================================
    def _input_hook(self, key: str) -> None:
        from ursina import application

        if key == "escape":
            application.quit()
            return

        # Number keys 1-6 jump to eras
        if key.isdigit():
            idx = int(key) - 1
            if 0 <= idx < len(YEARS):
                self._jump_to_year(float(YEARS[idx]))
            return

        if key == "space":
            self.auto_cycle = not self.auto_cycle
            self.cycle_label.text = "▶ AUTO-CYCLE" if self.auto_cycle else ""
            self._play_click()
            return

        if key == "m":
            self.music_on = not self.music_on
            if self.music_on:
                self._start_ambient(self._current_era())
            elif self.current_ambient is not None:
                try:
                    self.current_ambient.stop()
                except Exception:
                    pass
            return

        if key == "f1":
            application.debug = not getattr(application, "debug", False)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
def main() -> None:
    from ursina import Ursina, window, color

    app = Ursina(title="City Era Timelapse 1945-2055",
                 borderless=False, fullscreen=False, show_ursina_splash=False)
    window.size = (1280, 800)
    window.fps_counter.enabled = True
    window.color = color.rgb(60, 70, 80)

    CityScene()
    app.run()


if __name__ == "__main__":
    main()
