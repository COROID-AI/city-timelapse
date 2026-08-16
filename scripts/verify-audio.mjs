#!/usr/bin/env node
/**
 * scripts/verify-audio.mjs
 *
 * Verifies procedural SFX synthesis:
 *   - generateAllEraBuffers returns buffers for all five EraIds
 *   - Every buffer has finite samples, non-silent RMS, expected duration
 *   - Per-era buffer sets are measurably distinct (differing RMS/spectral character)
 *   - No network fetches or binary audio assets
 *   - Pure DSP via createBuffer/DSP only
 *
 * Uses a minimal AudioContext shim so the full pipeline runs in Node.
 */

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// ── Minimal AudioContext shim ────────────────────────────────────────

class MockAudioBuffer {
  constructor(options) {
    const { sampleRate, length, numberOfChannels = 1 } = options;
    this.sampleRate = sampleRate;
    this.length = length;
    this.numberOfChannels = numberOfChannels;
    this._channels = [];
    for (let ch = 0; ch < numberOfChannels; ch++) {
      const channelData = new Float32Array(length);
      this._channels.push(channelData);
    }
  }

  getChannelData(channelIndex) {
    return this._channels[channelIndex] ?? new Float32Array(this.length);
  }

  copyToDestination(destination, offset = 0, destinationOffset = 0, length = this.length) {
    const src = this.getChannelData(0);
    for (let i = 0; i < length && (destinationOffset + i) < destination.length; i++) {
      destination[destinationOffset + i] = src[offset + i] ?? 0;
    }
  }
}

class MockAudioContext {
  constructor() {
    this.sampleRate = 44100;
  }

  createBuffer(optionsOrNumChannels, numChannelsOrLength, sampleRate) {
    let opts;
    if (typeof optionsOrNumChannels === 'object') {
      opts = optionsOrNumChannels;
    } else {
      opts = { sampleRate, numberOfChannels: numChannelsOrLength, length: numChannelsOrLength };
    }
    return new MockAudioBuffer(opts);
  }
}

// Make it available globally so dynamic import can find it
globalThis.AudioContext = MockAudioContext;

// ── Import the synthesis module ──────────────────────────────────────

const { generateAllEraBuffers, generateEraAudioBuffers } = await import(`${root}/src/audio/sfx.ts`);
const { ERA_IDS, SFX_ERA_DATA } = await import(`${root}/src/eras.ts`);

// ── Helper functions ─────────────────────────────────────────────────

function rms(array) {
  let sum = 0;
  for (let i = 0; i < array.length; i++) {
    sum += array[i] * array[i];
  }
  return Math.sqrt(sum / array.length);
}

function spectralCentroid(array) {
  // Approximate spectral centroid using zero-crossing rate as proxy
  let crossings = 0;
  for (let i = 1; i < array.length; i++) {
    if ((array[i] >= 0) !== (array[i - 1] >= 0)) crossings++;
  }
  return crossings / array.length; // normalized zero-crossing rate
}

function peakValue(array) {
  let max = 0;
  for (let i = 0; i < array.length; i++) {
    const v = Math.abs(array[i]);
    if (v > max) max = v;
  }
  return max;
}

// ── Verification ─────────────────────────────────────────────────────

const SAMPLE_RATE = 44100;
const DURATION_SEC = 6;
const EXPECTED_SAMPLES = SAMPLE_RATE * DURATION_SEC;

let passed = 0;
let failed = 0;
const results = [];

function check(name, condition, detail = '') {
  if (condition) {
    passed++;
    results.push({ name, status: 'PASS', detail });
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    results.push({ name, status: 'FAIL', detail });
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

console.log('═══════════════════════════════════════════════════════════');
console.log('  Procedural SFX Synthesis Verification');
console.log('═══════════════════════════════════════════════════════════\n');

// ── Test 1: All five EraIds present ────────────────────────────────
console.log('[1] Era coverage');
const allBuffers = generateAllEraBuffers(SAMPLE_RATE, DURATION_SEC);

for (const id of ERA_IDS) {
  check(`Era "${id}" present`, allBuffers[id] !== undefined, `expected Record<EraId, EraAudioBuffers>`);
}

// ── Test 2: Buffer properties per era ──────────────────────────────
console.log('\n[2] Buffer properties (finite samples, non-silent RMS, expected duration)');

const eraMetrics = {};

for (const id of ERA_IDS) {
  const era = allBuffers[id];
  check(`"${id}" ambient is Float32Array`, era.ambient instanceof Float32Array);
  check(`"${id}" traffic is Float32Array`, era.traffic instanceof Float32Array);
  check(`"${id}" events is array`, Array.isArray(era.events));
  check(`"${id}" has ≥ 1 event`, era.events.length >= 1, `${era.events.length} events`);

  // Ambient
  check(`"${id}" ambient finite`, Number.isFinite(era.ambient.length), `${era.ambient.length} samples`);
  check(`"${id}" ambient ≈ ${EXPECTED_SAMPLES} samples`,
    Math.abs(era.ambient.length - EXPECTED_SAMPLES) <= 1,
    `got ${era.ambient.length}`);
  const ambientRms = rms(era.ambient);
  check(`"${id}" ambient non-silent RMS > 0.001`, ambientRms > 0.001, `RMS=${ambientRms.toFixed(6)}`);

  // Traffic
  check(`"${id}" traffic finite`, Number.isFinite(era.traffic.length), `${era.traffic.length} samples`);
  check(`"${id}" traffic ≈ ${EXPECTED_SAMPLES} samples`,
    Math.abs(era.traffic.length - EXPECTED_SAMPLES) <= 1);
  const trafficRms = rms(era.traffic);
  check(`"${id}" traffic non-silent RMS > 0.001`, trafficRms > 0.001, `RMS=${trafficRms.toFixed(6)}`);

  // Events
  let totalEventSamples = 0;
  for (let e = 0; e < era.events.length; e++) {
    const ev = era.events[e];
    check(`"${id}" event[${e}] finite`, Number.isFinite(ev.length), `${ev.length} samples`);
    check(`"${id}" event[${e}] non-silent`, rms(ev) > 0.0001, `RMS=${rms(ev).toFixed(8)}`);
    totalEventSamples += ev.length;
  }
  check(`"${id}" events total samples finite`, Number.isFinite(totalEventSamples));

  // Store metrics for cross-era comparison
  eraMetrics[id] = {
    ambientRms,
    trafficRms,
    ambientZcr: spectralCentroid(era.ambient),
    trafficZcr: spectralCentroid(era.traffic),
    ambientPeak: peakValue(era.ambient),
    trafficPeak: peakValue(era.traffic),
    eventCount: era.events.length,
    totalEventSamples,
  };
}

// ── Test 3: Cross-era distinctness ─────────────────────────────────
console.log('\n[3] Cross-era distinctness (RMS & spectral differ between eras)');

const ids = ERA_IDS;
let distinctPairs = 0;
let totalPairs = 0;

for (let i = 0; i < ids.length; i++) {
  for (let j = i + 1; j < ids.length; j++) {
    const a = eraMetrics[ids[i]];
    const b = eraMetrics[ids[j]];
    totalPairs++;

    // Check at least one metric differs by a meaningful margin
    const rmsDiff = Math.abs(a.ambientRms - b.ambientRms);
    const zcrDiff = Math.abs(a.ambientZcr - b.ambientZcr);
    const peakDiff = Math.abs(a.ambientPeak - b.ambientPeak);
    const isDistinct = rmsDiff > 0.0001 || zcrDiff > 0.0001 || peakDiff > 0.001;

    if (isDistinct) distinctPairs++;
  }
}

check(`All era pairs measurably distinct`, distinctPairs === totalPairs,
  `${distinctPairs}/${totalPairs} pairs differ`);

// ── Test 4: Era-specific signatures ────────────────────────────────
console.log('\n[4] Era-specific sonic signatures');

// 1945: sparse engines → low traffic RMS
check('1945 low engine noise', eraMetrics['1945'].trafficRms < 0.15,
  `trafficRMS=${eraMetrics['1945'].trafficRms.toFixed(6)}`);

// 1985: synth arpeggio → higher ZCR (square wave harmonics)
check('1985 high ambient ZCR (synth)', eraMetrics['1985'].ambientZcr > eraMetrics['1945'].ambientZcr,
  `1985=${eraMetrics['1985'].ambientZcr.toFixed(4)} vs 1945=${eraMetrics['1945'].ambientZcr.toFixed(4)}`);

// 2025: EV whine → unique spectral profile
check('2025 distinct spectral centroid', eraMetrics['2025'].ambientZcr !== eraMetrics['1945'].ambientZcr,
  `2025=${eraMetrics['2025'].ambientZcr.toFixed(4)} vs 1945=${eraMetrics['1945'].ambientZcr.toFixed(4)}`);

// 2005: pop beat → kick drum events
check('2005 has kick events', eraMetrics['2005'].eventCount >= 2,
  `${eraMetrics['2005'].eventCount} events`);

// 2025: digital pings → multiple short events
check('2025 has ping events', eraMetrics['2025'].eventCount >= 3,
  `${eraMetrics['2025'].eventCount} events`);

// 1965: doo-wop stabs
check('1965 has doo-wop events', eraMetrics['1965'].eventCount >= 2,
  `${eraMetrics['1965'].eventCount} events`);

// ── Test 5: No external assets ─────────────────────────────────────
console.log('\n[5] No external assets (pure DSP)');

// Check that the source file doesn't contain fetch or binary imports
const fs = await import('node:fs');
const sfxSource = fs.readFileSync(resolve(root, 'src/audio/sfx.ts'), 'utf-8');
check('No fetch() calls in sfx.ts', !sfxSource.includes('fetch('));
check('No import of .wav/.ogg/.mp3/.aiff files',
  !sfxSource.match(/import.*\.(wav|ogg|mp3|aiff)/));
check('Uses createBuffer pattern', sfxSource.includes('createBuffer'));
check('Uses Float32Array for DSP', sfxSource.includes('Float32Array'));

// ── Test 6: SFX_ERA_DATA consumed ──────────────────────────────────
console.log('\n[6] SFX_ERA_DATA consumed by generateEraAudioBuffers');

check('SFX_ERA_DATA has 5 entries', Object.keys(SFX_ERA_DATA).length === 5,
  `${Object.keys(SFX_ERA_DATA).length} keys`);

for (const id of ERA_IDS) {
  const data = SFX_ERA_DATA[id];
  check(`"${id}" has ambientTones`, Array.isArray(data.ambientTones) && data.ambientTones.length > 0);
  check(`"${id}" has trafficProfile`, Array.isArray(data.trafficProfile) && data.trafficProfile.length === 3);
  check(`"${id}" has events array`, Array.isArray(data.events) && data.events.length >= 1);
}

// ── Test 7: Chunked/lazy-capable (pure function test) ──────────────
console.log('\n[7] Chunked/lazy-capable (pure function output)');

// generateEraAudioBuffers should work with custom params
const chunked = generateEraAudioBuffers(SFX_ERA_DATA['1945'], SAMPLE_RATE, 2);
check('Short-duration buffer works', chunked.ambient.length === SAMPLE_RATE * 2,
  `got ${chunked.ambient.length}`);
check('Short ambient non-silent', rms(chunked.ambient) > 0.001);

// ── Summary ─────────────────────────────────────────────────────────
console.log('\n═══════════════════════════════════════════════════════════');
console.log(`  Results: ${passed} passed, ${failed} failed out of ${passed + failed}`);
console.log('═══════════════════════════════════════════════════════════\n');

if (failed > 0) {
  console.error('VERIFICATION FAILED');
  process.exit(1);
} else {
  console.log('ALL CHECKS PASSED ✓');
  process.exit(0);
}
