"""
Building generation.

Turns EraSpecs into detailed, textured 3D building entities.  Each building
gets a procedurally-generated facade texture (windows, materials, grime) and a
rooftop detail appropriate to the era (water tank, antenna, AC unit, solar
panels, sky garden).
"""

from __future__ import annotations

import math
import random
from typing import List, Optional, Tuple

try:
    from ursina import Entity, Mesh, Texture, load_texture  # type: ignore
    from PIL import Image
    import io

    _HAS_URSINA = True
except Exception:  # pragma: no cover - headless import guard
    _HAS_URSINA = False

from .eras import EraSpec
from .textures import facade_texture


def _make_texture(pil_img) -> Optional[object]:
    """Convert a PIL image into an Ursina Texture (render mode only).

    Ursina's Texture() accepts a PIL Image directly (the most robust path),
    falling back to writing a temp PNG file if that fails.
    """
    if not _HAS_URSINA:
        return None
    try:
        from ursina import Texture
        return Texture(pil_img)
    except Exception:
        try:
            import tempfile, os
            from ursina import load_texture
            path = os.path.join(tempfile.gettempdir(), f"ctex_{id(pil_img)}.png")
            pil_img.save(path)
            return load_texture(path)
        except Exception:
            return None


class Building:
    """A single building block with a facade and rooftop detail."""

    def __init__(self, era: EraSpec, *, position: Tuple[float, float],
                 footprint: Tuple[float, float], floors: int, seed: int,
                 parent=None):
        self.era = era
        self.position = position
        self.footprint = footprint
        self.floors = floors
        self.height = floors * era.floor_height
        self.seed = seed
        self.entities: List[object] = []
        self._parent = parent
        if _HAS_URSINA:
            self._build()

    # ------------------------------------------------------------------
    def _build(self) -> None:
        from ursina import Entity, Mesh, Vec3, color
        from . import textures

        x, z = self.position
        w, d = self.footprint
        h = self.height

        # Facade texture -------------------------------------------------
        tex_img = facade_texture(self.era, floors=self.floors, seed=self.seed,
                                 width=256)
        tex = _make_texture(tex_img)

        # Main box
        body = Entity(model="cube", texture=tex,
                      position=(x, h / 2, z),
                      scale=(w, h, d),
                      parent=self._parent)
        self.entities.append(body)

        # We want the texture to tile per-floor; approximate by setting
        # texture_scale via the material if available.  Cube UVs are limited,
        # so we add explicit window emissive strips on the street-facing sides
        # for extra detail at night.
        self._add_rooftop(x, z, w, d, h)
        self._add_base(x, z, w, d)

    # ------------------------------------------------------------------
    def _add_rooftop(self, x, z, w, d, h) -> None:
        from ursina import Entity, color

        style = self.era.rooftop
        top_y = h + 0.2

        if style == "watertank":
            tank = Entity(model="cube",
                          position=(x + w * 0.2, top_y + 1.2, z - d * 0.2),
                          scale=(1.8, 2.4, 1.8), color=color.rgb(90, 70, 50),
                          parent=self._parent)
            leg1 = Entity(model="cube", position=(x + w * 0.2 - 0.8, top_y + 0.4, z - d * 0.2 - 0.8),
                          scale=(0.15, 1.0, 0.15), color=color.rgb(70, 60, 50), parent=self._parent)
            leg2 = Entity(model="cube", position=(x + w * 0.2 + 0.8, top_y + 0.4, z - d * 0.2 + 0.8),
                          scale=(0.15, 1.0, 0.15), color=color.rgb(70, 60, 50), parent=self._parent)
            self.entities += [tank, leg1, leg2]

        elif style == "antenna":
            mast = Entity(model="cube",
                          position=(x, top_y + 3.0, z),
                          scale=(0.12, 6.0, 0.12), color=color.rgb(60, 60, 65),
                          parent=self._parent)
            # cross arms
            for dy in (2.0, 4.0):
                arm = Entity(model="cube", position=(x, top_y + dy, z),
                             scale=(1.6, 0.08, 0.08), color=color.rgb(60, 60, 65),
                             parent=self._parent)
                self.entities.append(arm)
            tip = Entity(model="sphere", position=(x, top_y + 6.0, z),
                         scale=0.18, color=color.red, parent=self._parent)
            self.entities += [mast, tip]

        elif style == "ac":
            for i in range(3):
                ax = x + (i - 1) * (w / 3)
                unit = Entity(model="cube",
                              position=(ax, top_y + 0.4, z),
                              scale=(1.2, 0.8, 1.2),
                              color=color.rgb(120, 120, 125), parent=self._parent)
                self.entities.append(unit)

        elif style == "solar":
            # dark solar panel grid tilted toward sun heading
            panels = Entity(model="cube",
                            position=(x, top_y + 0.3, z),
                            scale=(w * 0.7, 0.1, d * 0.7),
                            color=color.rgb(30, 40, 80), parent=self._parent)
            grid_lines = []
            for i in range(1, 4):
                gx = x - w * 0.35 + i * (w * 0.7 / 4)
                line = Entity(model="cube", position=(gx, top_y + 0.36, z),
                              scale=(0.06, 0.02, d * 0.7),
                              color=color.rgb(20, 25, 50), parent=self._parent)
                self.entities.append(line)
            self.entities.append(panels)

        elif style == "garden":
            # green roof mound + planters
            base_slab = Entity(model="cube",
                               position=(x, top_y + 0.2, z),
                               scale=(w * 0.9, 0.4, d * 0.9),
                               color=color.rgb(50, 110, 60), parent=self._parent)
            for i in range(5):
                px = x + random.uniform(-w * 0.3, w * 0.3)
                pz = z + random.uniform(-d * 0.3, d * 0.3)
                shrub = Entity(model="sphere", position=(px, top_y + 0.7, pz),
                               scale=random.uniform(0.4, 0.9),
                               color=color.rgb(40 + random.randint(0, 30),
                                               120 + random.randint(0, 40), 50),
                               parent=self._parent)
                self.entities.append(shrub)
            self.entities.append(base_slab)

    # ------------------------------------------------------------------
    def _add_base(self, x, z, w, d) -> None:
        from ursina import Entity, color
        # shopfront / ground-floor band
        band = Entity(model="cube",
                      position=(x, 1.4, z),
                      scale=(w * 1.02, 2.8, d * 1.02),
                      color=color.rgb(40, 40, 45),
                      parent=self._parent)
        # awning for older eras
        if self.era.year <= 1985:
            awn = Entity(model="cube",
                         position=(x, 2.6, z + d / 2 + 0.3),
                         scale=(w * 0.7, 0.1, 0.8),
                         color=color.rgb(150, 60, 50),
                         parent=self._parent)
            self.entities.append(awn)
        self.entities.append(band)

    # ------------------------------------------------------------------
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


# ---------------------------------------------------------------------------
# Block layout
# ---------------------------------------------------------------------------
def generate_block(era: EraSpec, *, block_radius: float = 22.0,
                   parent=None) -> List[Building]:
    """Lay out buildings around a rectangular city block perimeter.

    Returns a list of Building instances positioned on four street frontages
    with a central plaza/courtyard.
    """
    rng = random.Random(era.year * 13 + 7)
    buildings: List[Building] = []

    # Four sides of the block.  Each side is divided into lots.
    half = block_radius
    sides = [
        # (center x, center z, length axis, depth)
        (0, -half, 'x', block_radius * 2),  # south frontage
        (0, half, 'x', block_radius * 2),   # north frontage
        (-half, 0, 'z', block_radius * 2),  # west
        (half, 0, 'z', block_radius * 2),   # east
    ]

    seed_counter = era.year
    for cx, cz, axis, length in sides:
        # divide frontage into 3-4 lots
        n_lots = rng.randint(3, 4)
        lot_w = length / n_lots
        for i in range(n_lots):
            if rng.random() < 0.12 and era.year <= 1965:
                # empty lot (post-war cleared space)
                continue
            lot_center_offset = (i - (n_lots - 1) / 2) * lot_w
            if axis == 'x':
                bx = cx + lot_center_offset
                bz = cz
            else:
                bx = cx
                bz = cz + lot_center_offset

            fw = lot_w * rng.uniform(0.78, 0.92)
            fd = rng.uniform(7.0, 11.0)
            floors = rng.randint(era.floors_min, era.floors_max)
            seed_counter += 1
            b = Building(era, position=(bx, bz), footprint=(fw, fd),
                         floors=floors, seed=seed_counter, parent=parent)
            buildings.append(b)

    return buildings
