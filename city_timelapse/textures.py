"""
Procedural texture generation.

All textures (facades, roads, sidewalks, props, UI) are generated at runtime
from EraSpecs using Pillow + numpy, so the project ships with zero binary
assets and every surface reflects the currently-selected era.

This module is headless-safe (no Ursina import) and is exercised by the unit
tests.  The scene layer converts the returned PIL images into Ursina textures.
"""

from __future__ import annotations

import io
import math
import random
from typing import Tuple

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

from .eras import EraSpec, RGB


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _to_unit(rgb: RGB):
    return (rgb[0] / 255.0, rgb[1] / 255.0, rgb[2] / 255.0)


def _jitter(rgb: RGB, amt: int, rng: random.Random) -> RGB:
    return (
        max(0, min(255, rgb[0] + rng.randint(-amt, amt))),
        max(0, min(255, rgb[1] + rng.randint(-amt, amt))),
        max(0, min(255, rgb[2] + rng.randint(-amt, amt))),
    )


def _add_noise(arr: np.ndarray, strength: float, rng: np.random.Generator) -> np.ndarray:
    noise = rng.normal(0.0, 255.0 * strength, arr.shape[:2])
    noise = noise[:, :, None]
    return np.clip(arr + noise, 0, 255).astype(np.uint8)


def _grime_overlay(img: Image.Image, dirt: float, rng: random.Random) -> Image.Image:
    """Dark speckled grime proportional to *dirt* (0-1)."""
    if dirt <= 0.02:
        return img
    w, h = img.size
    arr = np.array(img).astype(np.float32)
    # base streaks
    gen = np.random.default_rng(rng.randint(0, 2**31 - 1))
    streak = gen.random((h, w))
    # vertical streaks (dribble from above)
    col = gen.random((1, w))
    streak = 0.5 * streak + 0.5 * np.repeat(col, h, axis=0)
    mask = (streak > (1.0 - 0.6 * dirt)).astype(np.float32)[:, :, None]
    darken = 60.0 * dirt
    arr -= mask * darken
    # speckle
    speckle = gen.random((h, w))
    mask2 = (speckle > (1.0 - 0.2 * dirt)).astype(np.float32)[:, :, None]
    arr -= mask2 * 40.0 * dirt
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))


# ---------------------------------------------------------------------------
# Facade textures
# ---------------------------------------------------------------------------
def facade_texture(
    era: EraSpec,
    floors: int,
    *,
    seed: int,
    width: int = 256,
) -> Image.Image:
    """Build a per-building facade texture with windows, materials & grime.

    The texture is tileable vertically (one column of windows per floor) and
    maps onto a plane scaled to (floor_height * floors) tall.
    """
    rng = random.Random(seed)
    win_style = era.window_style
    cols = 4
    tile_h = 32
    height = tile_h * max(1, floors)
    img = Image.new("RGB", (width, height), (0, 0, 0))
    d = ImageDraw.Draw(img)

    base = rng.choice(era.facade_colors)
    mat = rng.choice(era.facade_materials)

    # base wall colour with subtle vertical banding
    wall = np.full((height, width, 3), base, dtype=np.float32)
    gen = np.random.default_rng(seed)
    band = np.sin(np.linspace(0, math.pi * floors, height)) * 8
    wall += band[:, None, None]
    wall = _add_noise(wall, 0.015, gen)
    img = Image.fromarray(wall.astype(np.uint8))
    d = ImageDraw.Draw(img)

    lit_color = (255, 214, 130) if era.year < 2000 else (200, 225, 255)

    for f in range(floors):
        y0 = height - (f + 1) * tile_h
        y1 = height - f * tile_h
        for c in range(cols):
            x0 = c * (width // cols)
            x1 = (c + 1) * (width // cols)
            cx0, cy0 = x0 + 5, y0 + 6
            cx1, cy1 = x1 - 5, y1 - 6

            # window frame colour
            frame = (20, 22, 26) if win_style != "bio" else (40, 60, 50)

            if win_style == "sash":
                d.rectangle([cx0, cy0, cx1, cy1], fill=(35, 40, 48))
                # sash bar
                d.rectangle([cx0, (cy0 + cy1) // 2 - 1, cx1, (cy0 + cy1) // 2 + 1], fill=frame)
                # mullions
                d.rectangle([(cx0 + cx1) // 2 - 1, cy0, (cx0 + cx1) // 2 + 1, cy1], fill=frame)
            elif win_style == "ribbon":
                d.rectangle([cx0, cy0, cx1, cy1], fill=(40, 50, 64))
                d.rectangle([cx0, cy0, cx1, cy0 + 2], fill=frame)
                d.rectangle([cx0, cy1 - 2, cx1, cy1], fill=frame)
            elif win_style == "curtain":
                glass = _jitter((70, 110, 150), 18, rng) if mat != "concrete" else (90, 96, 100)
                d.rectangle([cx0, cy0, cx1, cy1], fill=glass)
                # faint reflection streak
                d.line([cx0 + 3, cy0 + 3, cx0 + 9, cy1 - 3], fill=(180, 200, 220))
            elif win_style == "smart":
                glass = _jitter((60, 120, 140), 14, rng)
                d.rectangle([cx0, cy0, cx1, cy1], fill=glass)
                # smart-grid
                for gx in range(cx0 + 6, cx1, 6):
                    d.line([gx, cy0 + 2, gx, cy1 - 2], fill=(30, 50, 60))
            elif win_style == "bio":
                glass = _jitter((60, 150, 110), 16, rng)
                d.rectangle([cx0, cy0, cx1, cy1], fill=glass)
                # foliage drips
                for _ in range(3):
                    fx = rng.randint(cx0 + 2, cx1 - 2)
                    d.ellipse([fx - 2, cy0 + rng.randint(0, 4), fx + 2, cy0 + rng.randint(6, 12)],
                              fill=(40, 110, 60))

            # lit window?
            if rng.random() < era.window_glow and f < floors - 1:
                d.rectangle([cx0 + 2, cy0 + 2, cx1 - 2, cy1 - 2], fill=lit_color)

    img = _grime_overlay(img, era.dirt, rng)
    return img


# ---------------------------------------------------------------------------
# Ground textures
# ---------------------------------------------------------------------------
def road_texture(era: EraSpec, seed: int = 1, size: int = 512) -> Image.Image:
    rng = random.Random(seed + era.year)
    arr = np.full((size, size, 3), era.road_color, dtype=np.float32)
    gen = np.random.default_rng(seed + era.year)
    arr = _add_noise(arr, 0.02, gen)
    # cracks
    if era.road_cracks > 0.05:
        img = Image.fromarray(arr.astype(np.uint8))
        d = ImageDraw.Draw(img)
        n_cracks = int(40 * era.road_cracks)
        for _ in range(n_cracks):
            x = rng.randint(0, size)
            y = rng.randint(0, size)
            pts = [(x, y)]
            for _ in range(4):
                x = max(0, min(size, x + rng.randint(-30, 30)))
                y = max(0, min(size, y + rng.randint(-30, 30)))
                pts.append((x, y))
            d.line(pts, fill=(max(0, era.road_color[0] - 28),
                              max(0, era.road_color[1] - 28),
                              max(0, era.road_color[2] - 28)), width=2)
        # centre lane markings (worn)
        if era.year >= 1965:
            wear = 1.0 - era.road_cracks
            for y in range(0, size, 64):
                if rng.random() < wear + 0.2:
                    d.rectangle([size // 2 - 3, y, size // 2 + 3, y + 36],
                                fill=(210, 210, 180))
        return img
    return Image.fromarray(arr.astype(np.uint8))


def sidewalk_texture(era: EraSpec, seed: int = 2, size: int = 256) -> Image.Image:
    rng = random.Random(seed + era.year)
    img = Image.new("RGB", (size, size), era.sidewalk_color)
    d = ImageDraw.Draw(img)
    # paving slabs
    slab = 64
    for x in range(0, size, slab):
        for y in range(0, size, slab):
            c = _jitter(era.sidewalk_color, 10, rng)
            d.rectangle([x + 1, y + 1, x + slab - 1, y + slab - 1], fill=c)
    # grime
    arr = np.array(img).astype(np.float32)
    gen = np.random.default_rng(seed + era.year)
    arr = _add_noise(arr, 0.01, gen)
    img = Image.fromarray(arr.astype(np.uint8))
    img = _grime_overlay(img, era.dirt * 0.5, rng)
    return img


# ---------------------------------------------------------------------------
# Signage / advert textures
# ---------------------------------------------------------------------------
_SIGN_WORDS = {
    1945: ["DINER", "CIGARS", "MILK", "TAILOR", "ROOMS", "BANK"],
    1965: ["MOTEL", "GASOLINE", "DRIVE-IN", "MUSIC", "AUTO", "CAFÉ"],
    1985: ["ARCADE", "RECORDS", "CLUB", "VIDEO", "PIZZA", "NEON"],
    2005: ["DOT COM", "WIFI", "CAFÉ", "MOBILE", "DIGITAL", "GLOBAL"],
    2025: ["STREAM", "E-COM", "DELIVERY", "CO-WORK", "AI", "CLOUD"],
    2055: ["NEXUS", "GENESIS", "ECO", "HUB", "QUANTUM", "ÆON"],
}


def signage_texture(era: EraSpec, *, seed: int, lit: bool = False, size: int = 256) -> Image.Image:
    rng = random.Random(seed + era.year * 7)
    words = _SIGN_WORDS.get(era.year, _SIGN_WORDS[2025])
    word = rng.choice(words)

    if era.signage == "painted":
        img = Image.new("RGB", (size, size), _jitter(era.facade_colors[0], 20, rng))
        d = ImageDraw.Draw(img)
        d.text((size // 2, size // 2), word, fill=(230, 220, 190), anchor="mm")
        return _grime_overlay(img, era.dirt * 0.4, rng)

    if era.signage == "neon":
        bg = (10, 8, 18)
        img = Image.new("RGB", (size, size), bg)
        d = ImageDraw.Draw(img)
        neon = rng.choice([(255, 60, 120), (60, 220, 255), (255, 230, 60), (120, 255, 120)])
        if lit:
            # glow
            for r, alpha in [(10, 60), (6, 120), (3, 200)]:
                d.text((size // 2, size // 2), word, fill=neon, anchor="mm",
                       stroke_width=r, stroke_fill=neon)
        d.text((size // 2, size // 2), word, fill=(255, 255, 255), anchor="mm")
        return img

    # led / holo
    bg = (4, 6, 12) if era.signage == "led" else (6, 12, 18)
    img = Image.new("RGB", (size, size), bg)
    d = ImageDraw.Draw(img)
    accent = rng.choice([(60, 200, 255), (120, 255, 200), (255, 200, 120), (200, 120, 255)])
    if lit:
        d.rectangle([4, 4, size - 4, size - 4], outline=accent, width=3)
    d.text((size // 2, size // 2 - 24), word, fill=accent, anchor="mm")
    d.text((size // 2, size // 2 + 24), str(era.year), fill=(180, 200, 220), anchor="mm")
    return img


# ---------------------------------------------------------------------------
# Sky / billboard gradient (used as a fallback sky dome tint)
# ---------------------------------------------------------------------------
def sky_gradient(era: EraSpec, width: int = 16, height: int = 256) -> Image.Image:
    """Vertical gradient texture from horizon to zenith."""
    top = np.array(era.sky_top, dtype=np.float32)
    hor = np.array(era.sky_horizon, dtype=np.float32)
    t = np.linspace(0.0, 1.0, height)[:, None] ** 0.8
    grad = (hor[None, None, :] * (1 - t[:, :, None]) + top[None, None, :] * t[:, :, None])
    grad = np.broadcast_to(grad, (height, width, 3)).copy()
    return Image.fromarray(grad.astype(np.uint8))


def pil_to_bytes(img: Image.Image, fmt: str = "PNG") -> bytes:
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    return buf.getvalue()
