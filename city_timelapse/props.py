"""
Dynamic actors: vehicles, pedestrians, and street props.

These animate every frame to give the block life.  Vehicles loop along the
roads (ground era) or along sky-lanes (flying era); pedestrians walk the
sidewalks; streetlights, trees, benches and signage are placed procedurally.
"""

from __future__ import annotations

import math
import random
from typing import List, Tuple

try:
    from ursina import Entity, color  # type: ignore
    _HAS_URSINA = True
except Exception:  # pragma: no cover
    _HAS_URSINA = False

from .eras import EraSpec, RGB


def _c(rgb: RGB):
    """ursina color from an 0-255 RGB tuple."""
    if not _HAS_URSINA:
        return None
    return color.rgb(*rgb)


# ---------------------------------------------------------------------------
# Vehicles
# ---------------------------------------------------------------------------
class Vehicle:
    """A looping ground car or flying pod."""

    def __init__(self, era: EraSpec, *, lane: int, phase: float,
                 parent=None):
        self.era = era
        self.lane = lane
        self.phase = phase
        self.parent = parent
        self.entities: List[object] = []
        self.flying = era.vehicle_mode == "flying"
        self.speed = 6.0 if not self.flying else 9.0
        self.palette = era.vehicle_palette
        self.body_color = self.palette[lane % len(self.palette)]
        if _HAS_URSINA:
            self._build()

    def _build(self) -> None:
        if self.flying:
            self._build_pod()
        else:
            self._build_car()

    def _build_car(self) -> None:
        from ursina import Entity, color
        body = Entity(model="cube", position=(0, 0, 0),
                      scale=(2.0, 0.7, 1.0), color=_c(self.body_color),
                      parent=self.parent)
        cabin = Entity(model="cube", position=(0, 0.55, 0),
                       scale=(1.1, 0.5, 0.9),
                       color=_c((max(0, self.body_color[0] - 30),
                                 max(0, self.body_color[1] - 30),
                                 max(0, self.body_color[2] - 30))),
                       parent=self.parent)
        # wheels
        wheels = []
        for wx in (-0.7, 0.7):
            for wz in (-0.5, 0.5):
                w = Entity(model="cube", position=(wx, -0.45, wz),
                           scale=(0.3, 0.3, 0.18), color=color.rgb(20, 20, 20),
                           parent=self.parent)
                wheels.append(w)
        # headlight glow markers (used at dusk)
        hl = Entity(model="cube", position=(1.0, -0.1, 0.3),
                    scale=(0.1, 0.1, 0.1), color=color.rgb(255, 240, 200),
                    parent=self.parent)
        hl2 = Entity(model="cube", position=(1.0, -0.1, -0.3),
                     scale=(0.1, 0.1, 0.1), color=color.rgb(255, 240, 200),
                     parent=self.parent)
        # container to move them together
        self.pivot = Entity(parent=self.parent)
        for e in [body, cabin, *wheels, hl, hl2]:
            e.parent = self.pivot
        self.entities = [self.pivot]

    def _build_pod(self) -> None:
        from ursina import Entity, color
        pivot = Entity(parent=self.parent)
        hull = Entity(model="sphere", position=(0, 0, 0), scale=(0.9, 0.5, 0.9),
                      color=_c(self.body_color), parent=pivot)
        # glow ring underneath
        ring = Entity(model="cube", position=(0, -0.35, 0),
                      scale=(1.4, 0.08, 1.4),
                      color=color.rgb(120, 220, 255), parent=pivot)
        self.pivot = pivot
        self.entities = [pivot]

    def update(self, t: float, block_radius: float) -> None:
        if not _HAS_URSINA:
            return
        # loop around the block perimeter on a given lane offset
        offset = self.lane * 1.8
        R = block_radius + 2.5 + offset
        ang = self.phase + t * self.speed / R
        x = math.cos(ang) * R
        z = math.sin(ang) * R
        y = 0.6 if not self.flying else 6.0 + self.lane * 2.0
        self.pivot.position = (x, y, z)
        # face direction of travel
        heading = -math.degrees(ang) - 90
        self.pivot.rotation_y = heading


class VehicleSystem:
    def __init__(self, era: EraSpec, *, parent=None):
        self.era = era
        self.parent = parent
        self.vehicles: List[Vehicle] = []
        rng = random.Random(era.year * 17 + 3)
        for i in range(era.vehicle_count):
            v = Vehicle(era, lane=i % 3, phase=rng.random() * math.tau,
                        parent=parent)
            self.vehicles.append(v)

    def update(self, t: float, block_radius: float) -> None:
        for v in self.vehicles:
            v.update(t, block_radius)

    def destroy(self) -> None:
        try:
            from ursina import destroy
        except Exception:
            destroy = lambda *a, **k: None
        for v in self.vehicles:
            for e in v.entities:
                try:
                    destroy(e)
                except Exception:
                    pass
        self.vehicles.clear()


# ---------------------------------------------------------------------------
# Pedestrians
# ---------------------------------------------------------------------------
class Pedestrian:
    def __init__(self, era: EraSpec, *, seed: int, parent=None):
        self.era = era
        self.parent = parent
        self.entities: List[object] = []
        self.speed = random.uniform(0.8, 1.4)
        self.phase = random.random() * math.tau
        outfit = era.ped_palette[seed % len(era.ped_palette)]
        rng = random.Random(seed * 31 + era.year)
        self.cx = rng.uniform(-18, 18)
        self.cz = rng.uniform(-18, 18)
        self.axis_x = rng.random() < 0.5
        self.dir = rng.choice([-1, 1])
        if _HAS_URSINA:
            from ursina import Entity, color
            self.pivot = Entity(parent=self.parent)
            torso = Entity(model="cube", position=(0, 1.1, 0),
                           scale=(0.35, 0.7, 0.2), color=_c(outfit),
                           parent=self.pivot)
            head = Entity(model="sphere", position=(0, 1.7, 0),
                          scale=0.22, color=color.rgb(210, 180, 150),
                          parent=self.pivot)
            leg_l = Entity(model="cube", position=(-0.1, 0.35, 0),
                           scale=(0.12, 0.7, 0.12),
                           color=color.rgb(40, 40, 50), parent=self.pivot)
            leg_r = Entity(model="cube", position=(0.1, 0.35, 0),
                           scale=(0.12, 0.7, 0.12),
                           color=color.rgb(40, 40, 50), parent=self.pivot)
            self.leg_l = leg_l
            self.leg_r = leg_r
            self.entities = [self.pivot]

    def update(self, t: float) -> None:
        if not _HAS_URSINA:
            return
        dist = self.dir * self.speed * t
        if self.axis_x:
            x = ((self.cx + dist + 22) % 44) - 22
            z = self.cz
            heading = 90 if self.dir > 0 else -90
        else:
            x = self.cx
            z = ((self.cz + dist + 22) % 44) - 22
            heading = 0 if self.dir > 0 else 180
        self.pivot.position = (x, 0, z)
        self.pivot.rotation_y = heading
        # leg swing
        swing = math.sin(t * 6 + self.phase) * 20
        self.leg_l.rotation_x = swing
        self.leg_r.rotation_x = -swing


class PedestrianSystem:
    def __init__(self, era: EraSpec, *, parent=None):
        self.era = era
        self.parent = parent
        self.peds: List[Pedestrian] = []
        for i in range(era.ped_count):
            self.peds.append(Pedestrian(era, seed=i, parent=parent))

    def update(self, t: float) -> None:
        for p in self.peds:
            p.update(t)

    def destroy(self) -> None:
        try:
            from ursina import destroy
        except Exception:
            destroy = lambda *a, **k: None
        for p in self.peds:
            for e in p.entities:
                try:
                    destroy(e)
                except Exception:
                    pass
        self.peds.clear()


# ---------------------------------------------------------------------------
# Static street props (placed once per era)
# ---------------------------------------------------------------------------
class StreetProps:
    """Streetlights, trees, benches, signage, phone booths, newsstands."""

    def __init__(self, era: EraSpec, *, block_radius: float = 22.0, parent=None):
        self.era = era
        self.parent = parent
        self.entities: List[object] = []
        if _HAS_URSINA:
            self._place(block_radius)

    def _place(self, R: float) -> None:
        from ursina import Entity, color
        era = self.era
        rng = random.Random(era.year * 5)

        # Streetlights at intervals around the block
        n_lights = 16
        for i in range(n_lights):
            ang = (i / n_lights) * math.tau
            lx = math.cos(ang) * (R + 5.5)
            lz = math.sin(ang) * (R + 5.5)
            self._streetlight(lx, lz, ang)

        # Trees along the inner sidewalk
        n_trees = max(2, int(10 * era.tree_maturity))
        for i in range(n_trees):
            ang = (i / max(1, n_trees)) * math.tau + 0.3
            tx = math.cos(ang) * (R + 1.5)
            tz = math.sin(ang) * (R + 1.5)
            self._tree(tx, tz, era.tree_maturity, rng)

        # Benches
        for i in range(4):
            ang = i * (math.tau / 4) + 0.7
            bx = math.cos(ang) * (R + 1.0)
            bz = math.sin(ang) * (R + 1.0)
            self._bench(bx, bz, ang)

        # Signage on building-facing poles
        if era.signage in ("neon", "led", "holo"):
            for i in range(4):
                ang = i * (math.tau / 4) + 1.1
                sx = math.cos(ang) * (R - 3)
                sz = math.sin(ang) * (R - 3)
                self._sign(sx, sz, era)

        if era.phone_booth:
            self._phone_booth(R - 2, 6.0)
        if era.newsstand:
            self._newsstand(-(R - 2), 6.0)

    def _streetlight(self, x, z, ang) -> None:
        from ursina import Entity, color
        era = self.era
        pole = Entity(model="cube", position=(x, 3.0, z),
                      scale=(0.15, 6.0, 0.15), color=color.rgb(50, 50, 55),
                      parent=self.parent)
        arm = Entity(model="cube", position=(x, 5.8, z + 0.4),
                     scale=(0.1, 0.1, 0.8), color=color.rgb(50, 50, 55),
                     parent=self.parent)
        if era.streetlight == "gas":
            lc = color.rgb(255, 200, 120)
            ls = 0.4
        elif era.streetlight == "cobra":
            lc = color.rgb(255, 230, 180)
            ls = 0.45
        elif era.streetlight == "led":
            lc = color.rgb(220, 235, 255)
            ls = 0.5
        else:  # holo
            lc = color.rgb(120, 220, 255)
            ls = 0.6
        lamp = Entity(model="sphere", position=(x, 5.7, z + 0.8),
                      scale=ls, color=lc, parent=self.parent)
        self.light_color = lc
        self.entities += [pole, arm, lamp]

    def _tree(self, x, z, maturity, rng) -> None:
        from ursina import Entity, color
        trunk_h = 1.5 + maturity * 3.0
        trunk = Entity(model="cube", position=(x, trunk_h / 2, z),
                       scale=(0.25, trunk_h, 0.25), color=color.rgb(80, 55, 35),
                       parent=self.parent)
        canopy_r = 0.5 + maturity * 1.6
        canopy = Entity(model="sphere", position=(x, trunk_h + canopy_r * 0.6, z),
                        scale=canopy_r,
                        color=color.rgb(40 + rng.randint(0, 25),
                                        110 + rng.randint(0, 50), 45),
                        parent=self.parent)
        self.entities += [trunk, canopy]

    def _bench(self, x, z, ang) -> None:
        from ursina import Entity, color
        seat = Entity(model="cube", position=(x, 0.5, z),
                      scale=(1.6, 0.1, 0.5), color=color.rgb(90, 60, 40),
                      parent=self.parent)
        back = Entity(model="cube", position=(x, 0.8, z - 0.2),
                      scale=(1.6, 0.5, 0.1), color=color.rgb(80, 55, 35),
                      parent=self.parent)
        self.entities += [seat, back]

    def _sign(self, x, z, era) -> None:
        from ursina import Entity, color
        from .textures import signage_texture, pil_to_bytes
        from .buildings import _make_texture
        import io
        tex_img = signage_texture(era, seed=int(abs(x * 13 + z * 7)), lit=True)
        tex = _make_texture(tex_img)
        bright = era.signage == "neon"
        c = color.rgb(255, 255, 255)
        panel = Entity(model="cube", texture=tex,
                       position=(x, 6.0, z), scale=(2.0, 2.0, 0.15),
                       color=c, parent=self.parent)
        pole = Entity(model="cube", position=(x, 3.0, z),
                      scale=(0.1, 6.0, 0.1), color=color.rgb(40, 40, 45),
                      parent=self.parent)
        self.entities += [panel, pole]

    def _phone_booth(self, x, z) -> None:
        from ursina import Entity, color
        booth = Entity(model="cube", position=(x, 1.3, z),
                       scale=(1.0, 2.6, 1.0), color=color.rgb(30, 60, 120),
                       parent=self.parent)
        self.entities.append(booth)

    def _newsstand(self, x, z) -> None:
        from ursina import Entity, color
        stand = Entity(model="cube", position=(x, 1.1, z),
                       scale=(2.0, 2.2, 1.2), color=color.rgb(120, 90, 50),
                       parent=self.parent)
        roof = Entity(model="cube", position=(x, 2.4, z),
                      scale=(2.2, 0.15, 1.4), color=color.rgb(150, 40, 40),
                      parent=self.parent)
        self.entities += [stand, roof]

    def destroy(self) -> None:
        try:
            from ursina import destroy
        except Exception:
            destroy = lambda *a, **k: None
        for e in self.entities:
            try:
                destroy(e)
            except Exception:
                pass
        self.entities.clear()
