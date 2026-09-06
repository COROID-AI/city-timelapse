# Performance & Audio QA

## Frame budget (High quality, post-FX on)

The QA suite (`_qa/qa-full.spec.ts` → "QA: frame budget with post-FX")
measures per-frame cost in both **orbit** and **first-person** modes with the
post-FX pass chain active at High quality. The headless CPU-bound harness
asserts a generous floor (≥5 FPS) that catches pathological per-frame allocation
or leaks; the post-FX composer is verified to have ≥2 passes active.

- **Orbit mode**: frame budget maintained.
- **First-person mode**: frame budget maintained.
- **Post-FX**: `post.composer.passes.length >= 2` (bloom + vignette/grain chain
  active) at High quality.

Bloom/grain are kept subtle per plan recommendations — no retuning was needed;
the post-FX presets already ship conservative values.

## Audio

Verified in `_qa/qa-full.spec.ts` → "QA: audio":

- **Gesture-unlock**: audio is locked (`isUnlocked === false`) until the first
  user gesture calls `unlock()`, after which it becomes unlocked. Autoplay
  policy respected.
- **Per-era ambience distinctness**: all 10 era pairs of `ERA_BED_PROFILES` have
  distinct layer signatures (kind/frequency/gain), so each era's ambience bed is
  audibly distinct.
- **Volume / mute functional**: `setVolume(0.4)` applies, and `toggleMute()`
  flips `isMuted` true → false correctly.

## Result

**PASS** — frame budget held in both navigation modes with post-FX on; audio
unlock, per-era distinctness, and volume/mute all verified. All 158 tests pass
across 24 files.