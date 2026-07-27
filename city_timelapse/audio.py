"""
Procedural audio / SFX generation.

Ambient soundscapes and one-shot transition effects are synthesised at runtime
with numpy and written to in-memory WAV buffers, so the project ships with no
binary audio assets and every soundscape reflects the currently-selected era.

This module is headless-safe (no Ursina import).  The scene layer wraps the
returned wave bytes into Ursina Audio objects.
"""

from __future__ import annotations

import io
import math
import random
import wave
from typing import Dict

import numpy as np

from .eras import EraSpec


SR = 22050  # sample rate


# ---------------------------------------------------------------------------
# Low-level synth helpers
# ---------------------------------------------------------------------------
def _to_int16(samples: np.ndarray) -> np.ndarray:
    samples = np.clip(samples, -1.0, 1.0)
    return (samples * 32767.0).astype(np.int16)


def _wav_bytes(samples: np.ndarray, sample_rate: int = SR) -> bytes:
    """Mono int16 samples -> WAV bytes."""
    if samples.ndim == 2:
        samples = samples.mean(axis=1)
    data = _to_int16(samples)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sample_rate)
        w.writeframes(data.tobytes())
    return buf.getvalue()


def _stereo_wav_bytes(left: np.ndarray, right: np.ndarray, sample_rate: int = SR) -> bytes:
    li = _to_int16(left)
    ri = _to_int16(right)
    stereo = np.empty(len(li) + len(ri), dtype=np.int16)
    stereo[0::2] = li
    stereo[1::2] = ri
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(sample_rate)
        w.writeframes(stereo.tobytes())
    return buf.getvalue()


def _adsr(n: int, attack: float, decay: float, sustain: float, release: float) -> np.ndarray:
    a = int(n * attack); d = int(n * decay); r = int(n * release)
    s = max(0, n - a - d - r)
    env = np.concatenate([
        np.linspace(0, 1, max(1, a)),
        np.linspace(1, sustain, max(1, d)),
        np.full(max(1, s), sustain),
        np.linspace(sustain, 0, max(1, r)),
    ])
    if len(env) < n:
        env = np.pad(env, (0, n - len(env)))
    return env[:n]


def _noise(n: int, rng: np.random.Generator) -> np.ndarray:
    return rng.standard_normal(n)


def _pink_noise(n: int, rng: np.random.Generator) -> np.ndarray:
    """Approximate pink noise via filtered white noise."""
    white = rng.standard_normal(n)
    # simple 1-pole low-pass cascade for pink-ish spectrum
    out = np.zeros(n)
    b0 = b1 = b2 = b3 = b4 = b5 = b6 = 0.0
    for i in range(n):
        w = white[i]
        b0 = 0.99886 * b0 + w * 0.0555179
        b1 = 0.99332 * b1 + w * 0.0750759
        b2 = 0.96900 * b2 + w * 0.1538520
        b3 = 0.86650 * b3 + w * 0.3104856
        b4 = 0.55000 * b4 + w * 0.5329522
        b5 = -0.7616 * b5 - w * 0.0168980
        out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11
        b6 = w * 0.115926
    return out


# ---------------------------------------------------------------------------
# Ambient soundscapes (seamless loops)
# ---------------------------------------------------------------------------
def _ambient_1945(duration: float = 6.0) -> np.ndarray:
    rng = np.random.default_rng(1945)
    n = int(SR * duration)
    t = np.arange(n) / SR
    base = 0.12 * _pink_noise(n, rng)
    # distant tram bell every ~3s
    bell = np.zeros(n)
    for start in (0.5, 3.4):
        idx = int(start * SR)
        seg = min(int(0.8 * SR), n - idx)
        tt = np.arange(seg) / SR
        tone = np.sin(2 * np.pi * 523 * tt) * np.exp(-4 * tt) * 0.25
        bell[idx:idx + seg] += tone
    # occasional car horn (low tubular)
    horn = np.zeros(n)
    for start in (2.1,):
        idx = int(start * SR)
        seg = min(int(0.6 * SR), n - idx)
        tt = np.arange(seg) / SR
        tone = (np.sin(2 * np.pi * 180 * tt) + 0.5 * np.sin(2 * np.pi * 270 * tt)) * 0.18
        horn[idx:idx + seg] += tone * (np.minimum(1.0, tt * 10))
    return base + bell + horn


def _ambient_1965(duration: float = 6.0) -> np.ndarray:
    rng = np.random.default_rng(1965)
    n = int(SR * duration)
    base = 0.14 * _pink_noise(n, rng)
    # engine rumble
    t = np.arange(n) / SR
    rumble = 0.08 * np.sin(2 * np.pi * 55 * t) * (0.7 + 0.3 * np.sin(2 * np.pi * 0.7 * t))
    # radio muzak stab
    muzak = np.zeros(n)
    idx = int(1.5 * SR)
    seg = min(int(2.0 * SR), n - idx)
    tt = np.arange(seg) / SR
    notes = [392, 440, 523]
    for i, f in enumerate(notes):
        o = int(i * 0.4 * SR)
        if o < seg:
            sl = slice(o, seg)
            muzak[idx + o:idx + seg] += 0.05 * np.sin(2 * np.pi * f * tt[:seg - o]) * np.exp(-1.5 * tt[:seg - o])
    return base + rumble + muzak


def _ambient_1985(duration: float = 6.0) -> np.ndarray:
    rng = np.random.default_rng(1985)
    n = int(SR * duration)
    t = np.arange(n) / SR
    # heavier traffic
    base = 0.18 * _pink_noise(n, rng)
    rumble = 0.1 * np.sin(2 * np.pi * 48 * t)
    # synth pop arpeggio
    arp = np.zeros(n)
    freqs = [220, 277, 330, 440]
    step = int(0.25 * SR)
    for i in range(0, n - step, step):
        f = freqs[(i // step) % len(freqs)]
        tt = np.arange(step) / SR
        arp[i:i + step] += 0.04 * np.sin(2 * np.pi * f * tt) * np.exp(-3 * tt) * 0.6
    # electronic beep
    return base + rumble + arp


def _ambient_2005(duration: float = 6.0) -> np.ndarray:
    rng = np.random.default_rng(2005)
    n = int(SR * duration)
    base = 0.13 * _pink_noise(n, rng)
    t = np.arange(n) / SR
    # modem/early-digital blips
    blips = np.zeros(n)
    rng2 = np.random.default_rng(7)
    for _ in range(12):
        start = rng2.integers(0, n - int(0.05 * SR))
        seg = int(0.04 * SR)
        f = rng2.choice([1200, 1800, 2400])
        tt = np.arange(seg) / SR
        blips[start:start + seg] += 0.06 * np.sin(2 * np.pi * f * tt) * np.exp(-30 * tt)
    # gentle tyre hiss
    hiss = 0.05 * np.sin(2 * np.pi * 120 * t)
    return base + blips + hiss


def _ambient_2025(duration: float = 6.0) -> np.ndarray:
    rng = np.random.default_rng(2025)
    n = int(SR * duration)
    base = 0.1 * _pink_noise(n, rng)
    t = np.arange(n) / SR
    # electric car whine
    whine = 0.05 * np.sin(2 * np.pi * (800 + 200 * np.sin(2 * np.pi * 0.3 * t)) * t)
    # notification chimes
    chimes = np.zeros(n)
    for start in (1.2, 3.8):
        idx = int(start * SR)
        seg = min(int(0.3 * SR), n - idx)
        tt = np.arange(seg) / SR
        chimes[idx:idx + seg] += 0.08 * np.sin(2 * np.pi * 1760 * tt) * np.exp(-8 * tt)
    return base + whine + chimes


def _ambient_2055(duration: float = 6.0) -> np.ndarray:
    rng = np.random.default_rng(2055)
    n = int(SR * duration)
    base = 0.07 * _pink_noise(n, rng)
    t = np.arange(n) / SR
    # ethereal pad
    pad = 0.06 * (np.sin(2 * np.pi * 330 * t) + 0.6 * np.sin(2 * np.pi * 495 * t)
                  + 0.4 * np.sin(2 * np.pi * 660 * t))
    # whoosh of flying pod
    whoosh = np.zeros(n)
    idx = int(2.0 * SR)
    seg = min(int(1.2 * SR), n - idx)
    tt = np.arange(seg) / SR
    swept = np.sin(2 * np.pi * (400 + 600 * tt / 1.2) * tt)
    whoosh[idx:idx + seg] += 0.05 * swept * np.sin(np.pi * tt / 1.2)
    return base + pad + whoosh


_AMBIENT_BUILDERS = {
    "1945": _ambient_1945,
    "1965": _ambient_1965,
    "1985": _ambient_1985,
    "2005": _ambient_2005,
    "2025": _ambient_2025,
    "2055": _ambient_2055,
}


# ---------------------------------------------------------------------------
# One-shot transition whoosh (morph between eras)
# ---------------------------------------------------------------------------
def transition_whoosh(duration: float = 1.2) -> np.ndarray:
    rng = np.random.default_rng(42)
    n = int(SR * duration)
    t = np.arange(n) / SR
    # upward then downward sweep
    freq = 200 + 1800 * np.sin(np.pi * t / duration)
    sweep = np.sin(2 * np.pi * np.cumsum(freq) / SR)
    noise = _noise(n, rng)
    # band-ish via moving average
    kernel = np.ones(32) / 32
    filtered = np.convolve(noise, kernel, mode="same")
    env = np.sin(np.pi * t / duration) ** 2
    return (0.25 * sweep + 0.18 * filtered) * env


def click_sfx() -> np.ndarray:
    """Short UI tick for slider/buttons."""
    rng = np.random.default_rng(1)
    n = int(SR * 0.08)
    t = np.arange(n) / SR
    env = np.exp(-40 * t)
    return (0.5 * np.sin(2 * np.pi * 1200 * t) + 0.2 * _noise(n, rng)) * env


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
def ambient_loop_bytes(era: EraSpec, duration: float = 6.0) -> bytes:
    key = era.ambient_key
    builder = _AMBIENT_BUILDERS.get(key, _ambient_2025)
    samples = builder(duration)
    # gentle fade for seamless loop
    fade = int(SR * 0.3)
    samples[:fade] *= np.linspace(0, 1, fade)
    samples[-fade:] *= np.linspace(1, 0, fade)
    vol = era.ambient_volume
    return _wav_bytes(samples * vol)


def transition_whoosh_bytes(duration: float = 1.2) -> bytes:
    return _wav_bytes(transition_whoosh(duration))


def click_sfx_bytes() -> bytes:
    return _wav_bytes(click_sfx())


# Cache of built ambients keyed by era name (rebuilt only when needed).
class AmbientBank:
    """Lazily-built, cached ambient loops for every era."""

    def __init__(self) -> None:
        self._cache: Dict[str, bytes] = {}

    def get(self, era: EraSpec) -> bytes:
        key = era.ambient_key
        if key not in self._cache:
            self._cache[key] = ambient_loop_bytes(era)
        return self._cache[key]

    def keys(self):
        return list(self._cache.keys())
