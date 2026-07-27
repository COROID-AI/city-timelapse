"""
Era interpolation.

When the timeline slider is dragged between two defined years the scene must
*MORPH* rather than snap.  This module computes an intermediate EraSpec from a
floating-point "year" position and provides per-attribute easing.

Everything here is pure Python (numpy used only for vector colour ops) so it is
fully testable in a headless environment.
"""

from __future__ import annotations

import math
from dataclasses import replace
from typing import Tuple

from .eras import ERA_DATA, EraSpec, YEARS, RGB


# ---------------------------------------------------------------------------
# Easing
# ---------------------------------------------------------------------------
def smoothstep(t: float) -> float:
    """Hermite smoothstep, clamped to [0, 1]."""
    t = 0.0 if t < 0.0 else (1.0 if t > 1.0 else t)
    return t * t * (3.0 - 2.0 * t)


def ease_in_out_cubic(t: float) -> float:
    t = 0.0 if t < 0.0 else (1.0 if t > 1.0 else t)
    return 4.0 * t * t * t if t < 0.5 else 1.0 - ((-2.0 * t + 2.0) ** 3) / 2.0


# ---------------------------------------------------------------------------
# Colour blending
# ---------------------------------------------------------------------------
def _lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def lerp_rgb(a: RGB, b: RGB, t: float) -> RGB:
    t = smoothstep(t)
    return (
        int(round(_lerp(a[0], b[0], t))),
        int(round(_lerp(a[1], b[1], t))),
        int(round(_lerp(a[2], b[2], t))),
    )


# ---------------------------------------------------------------------------
# Pair resolution
# ---------------------------------------------------------------------------
def _resolve_segment(year_float: float) -> Tuple[EraSpec, EraSpec, float]:
    """Return (era_a, era_b, local_t) for a fractional year position.

    Years in ERA_DATA are ascending.  *year_float* may sit between two key
    years (an in-between morph), exactly on a key year, or beyond the range
    (clamped to the end eras).
    """
    if year_float <= YEARS[0]:
        return ERA_DATA[YEARS[0]], ERA_DATA[YEARS[0]], 0.0
    if year_float >= YEARS[-1]:
        return ERA_DATA[YEARS[-1]], ERA_DATA[YEARS[-1]], 0.0

    for i in range(len(YEARS) - 1):
        lo, hi = YEARS[i], YEARS[i + 1]
        if lo <= year_float <= hi:
            local_t = (year_float - lo) / (hi - lo)
            return ERA_DATA[lo], ERA_DATA[hi], local_t

    # Should be unreachable given the clamps above.
    last = YEARS[-1]
    return ERA_DATA[last], ERA_DATA[last], 0.0


# ---------------------------------------------------------------------------
# Discrete attribute blending
# ---------------------------------------------------------------------------
def _blend_discrete(a, b, t):
    """Snap discrete strings/tuples to the nearest era by local_t >= 0.5.

    For tuples-of-strings (material pools, palettes) we *concatenate* near the
    midpoint so the transition reads as a crossfade of assets rather than a
    hard swap, then collapses to the target side.
    """
    if isinstance(a, tuple) and a and isinstance(a[0], str):
        # crossfade window centred on t=0.5
        if t < 0.35:
            return a
        if t > 0.65:
            return b
        return a + b  # both pools active during the handoff
    if isinstance(a, str):
        return a if t < 0.5 else b
    if isinstance(a, bool):
        return a if t < 0.5 else b
    # numbers
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        # integer-valued attrs (counts, floors) snap to avoid fractional cars
        if isinstance(a, int) and isinstance(b, int):
            return a if t < 0.5 else b
        return _lerp(a, b, t)
    return b


def _blend_palette(a, b, t):
    """Blend a colour palette tuple by lerping matching indices."""
    n = max(len(a), len(b))
    out = []
    for i in range(n):
        ca = a[i % len(a)]
        cb = b[i % len(b)]
        out.append(lerp_rgb(ca, cb, t))
    return tuple(out)


# ---------------------------------------------------------------------------
# Master interpolator
# ---------------------------------------------------------------------------
_NUMERIC_FIELDS = {
    "fog_density", "sun_intensity", "sun_pitch", "sun_heading",
    "floors_min", "floors_max", "floor_height", "window_glow", "dirt",
    "tree_maturity", "road_cracks", "ambient_volume",
}

_RGB_FIELDS = {
    "sky_top", "sky_horizon", "fog_color", "sun_color", "ambient",
    "road_color", "sidewalk_color",
}

_PALETTE_FIELDS = {
    "facade_colors", "vehicle_palette", "ped_palette",
}


def blend_eras(year_float: float) -> EraSpec:
    """Build a synthetic EraSpec for an arbitrary fractional year.

    Discrete/categorical fields (materials, window_style, streetlight, signage,
    phone_booth, newsstand, vehicle_mode, ambient key) snap at the midpoint so
    we never render, e.g., half-gas-lamp half-hologram props.  Continuous
    numeric and colour fields crossfade smoothly.
    """
    a, b, t = _resolve_segment(year_float)

    if t <= 0.0:
        return a

    # Start from A and override field-by-field.
    data = {f.name: getattr(a, f.name) for f in EraSpec.__dataclass_fields__.values()}

    for name, val_a in data.items():
        val_b = getattr(b, name)
        if val_a == val_b:
            continue
        if name in _RGB_FIELDS:
            data[name] = lerp_rgb(val_a, val_b, t)
        elif name in _PALETTE_FIELDS:
            data[name] = _blend_palette(val_a, val_b, t)
        elif name in _NUMERIC_FIELDS:
            data[name] = _lerp(val_a, val_b, t)
        else:
            data[name] = _blend_discrete(val_a, val_b, t)

    # Keep the displayed year/name honest: label by nearest key era.
    nearest = YEARS[0]
    best = float("inf")
    for y in YEARS:
        d = abs(y - year_float)
        if d < best:
            best, nearest = d, y
    data["year"] = ERA_DATA[nearest].year
    data["name"] = ERA_DATA[nearest].name
    data["tagline"] = ERA_DATA[nearest].tagline
    data["description"] = ERA_DATA[nearest].description

    return EraSpec(**data)


def transition_progress(year_float: float) -> float:
    """0 at a key year, rising to ~1 mid-segment.  Used for whoosh SFX gain."""
    a, b, t = _resolve_segment(year_float)
    # bell-shaped: 0 at endpoints, ~1 at midpoint
    return math.sin(t * math.pi)
