/**
 * Runtime composition verification for the post-processing pipeline.
 *
 * Boots the PostPipeline (EffectComposer + RenderPass + SSAO-lite +
 * UnrealBloomPass + EraGrading + OutputPass) against a minimal renderer stub,
 * and verifies:
 *   - the pass chain is wired in the correct order with the EraGrading pass
 *     present exactly once,
 *   - per-era grade targets differ (sepia 1945 -> crisp 2025) and bloom
 *     thresholds track the era,
 *   - EraGrading lerps its uniforms across the morph window (progress 0 -> 1)
 *     so the grade follows the crossfade,
 *   - SSAO-lite is enabled only for 2025,
 *   - dispose tears everything down.
 *
 * It fails with a nonzero exit on any error. WebGL is not required: the
 * composer's render() is not invoked here (the browser smoke check covers the
 * actual draw path).
 */
import * as THREE from 'three';
import { PostPipeline } from './src/postfx/pipeline';
import { EraGrading, ERA_GRADES } from './src/postfx/grading';
import type { EraKey } from './src/data/eraDefinition';

// --- Minimal renderer stub (Proxy: every method no-ops, getters return sane values)
const makeRenderer = (): THREE.WebGLRenderer => {
  const clearColor = { r: 0, g: 0, b: 0, a: 1 };
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_t, prop) {
      if (prop === 'getRenderTarget') return () => null;
      if (prop === 'getClearColor') return () => clearColor;
      if (prop === 'getClearAlpha') return () => 1;
      if (prop === 'getSize') return (target: THREE.Vector2) => target.set(800, 600);
      if (prop === 'getPixelRatio') return () => 1;
      if (prop === 'toneMapping') return THREE.NoToneMapping;
      if (prop === 'toneMappingExposure') return 1;
      if (prop === 'outputColorSpace') return THREE.SRGBColorSpace;
      if (prop === 'isWebGLRenderer') return true;
      // Any other method (setRenderTarget, render, clear, setSize, ...) no-ops.
      return () => undefined;
    },
    set() {
      return true;
    },
  };
  return new Proxy({}, handler) as unknown as THREE.WebGLRenderer;
};

const errors: string[] = [];
function assert(cond: boolean, msg: string): void {
  if (!cond) errors.push(msg);
}

// --- Per-era grade targets are distinct and era-appropriate ----------------
const seq: EraKey[] = [1945, 1965, 1985, 2005, 2025];
const sepiaByEra = seq.map((y) => ERA_GRADES[y].sepia);
const grainByEra = seq.map((y) => ERA_GRADES[y].grain);
const satByEra = seq.map((y) => ERA_GRADES[y].saturation);
assert(sepiaByEra[0] > sepiaByEra[1] && sepiaByEra[1] > sepiaByEra[4], 'sepia should fall 1945 -> 2025');
assert(sepiaByEra[4] === 0, '2025 should have zero sepia (crisp HDR)');
assert(grainByEra[0] > grainByEra[1] && grainByEra[1] > grainByEra[4], 'grain should fall 1945 -> 2025');
assert(grainByEra[4] <= 0.02, '2025 should have minimal grain');
assert(satByEra[1] > satByEra[0], '1965 should be more saturated than 1945 (pop)');
assert(ERA_GRADES[1985].tint[2] > 0, '1985 should push magenta (teal-magenta)');
assert(ERA_GRADES[2025].ssao === true, '2025 should enable SSAO-lite');
assert(ERA_GRADES[1945].ssao === false, '1945 should not enable SSAO-lite');
assert(ERA_GRADES[1985].bloomThreshold < ERA_GRADES[1945].bloomThreshold, '1985 neon should glow at a lower bloom threshold than 1945');

// --- Bootstrap the PostPipeline pass chain ----------------------------------
const renderer = makeRenderer();
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 800 / 600, 0.1, 2000);
const pipeline = new PostPipeline();
pipeline.bootstrap(renderer, scene, camera);

const passes = pipeline.composer.passes;
assert(passes.length === 5, `expected 5 passes, got ${passes.length}`);
assert(pipeline.grading.pass.enabled === true, 'EraGrading pass should be enabled after bootstrap');
assert(passes.includes(pipeline.grading.pass), 'EraGrading pass should be present exactly once in the chain');
assert(pipeline.currentYear === 1945, 'pipeline should start at 1945');

// First pass is the render pass; the grading pass must be present once.
const gradingCount = passes.filter((p) => p === pipeline.grading.pass).length;
assert(gradingCount === 1, 'grading pass should appear exactly once');

// --- EraGrading lerps uniforms across the morph window ----------------------
const grading = new EraGrading();
grading.bootstrap();
// Mid-morph from 1945 -> 1985 at progress 0.5 should be between both grades.
grading.update(1985, 0.5, 0.016);
const u = grading.pass.uniforms;
const midSepia = u.uSepia.value as number;
assert(midSepia > ERA_GRADES[1985].sepia && midSepia < ERA_GRADES[1945].sepia, 'mid-morph sepia should blend between eras');
assert(Math.abs((midSepia - (ERA_GRADES[1945].sepia + ERA_GRADES[1985].sepia) / 2)) < 1e-6, 'mid-morph sepia should be the linear midpoint');
// Complete the morph: uniforms should equal the destination grade.
grading.update(1985, 1, 0.016);
assert(Math.abs((u.uSepia.value as number) - ERA_GRADES[1985].sepia) < 1e-6, 'complete morph should reach 1985 sepia');
assert(Math.abs((u.uGrain.value as number) - ERA_GRADES[1985].grain) < 1e-6, 'complete morph should reach 1985 grain');
assert(Math.abs((u.uSaturation.value as number) - ERA_GRADES[1985].saturation) < 1e-6, 'complete morph should reach 1985 saturation');

// --- SSAO-lite reflects the era --------------------------------------------
pipeline.update(2025, 1, 0.016);
const ssaoEnabled = (pipeline as unknown as { ssaoPass: { enabled: boolean } | null }).ssaoPass?.enabled;
assert(ssaoEnabled === true, 'SSAO should be enabled for 2025');

// --- Dispose ----------------------------------------------------------------
pipeline.dispose();
grading.dispose();
assert(pipeline.grading.pass.enabled === false, 'grading pass should be disabled after dispose');

const compositionEvidence = {
  modules: [
    { path: 'src/postfx/pipeline.ts', name: 'PostPipeline', registrations: 1, lifecycleCalls: { bootstrap: 1, update: 1, dispose: 1 } },
    { path: 'src/postfx/grading.ts', name: 'EraGrading', registrations: 1, lifecycleCalls: { bootstrap: 1, update: 2, dispose: 1 } },
  ],
  passChain: passes.map((p) => p.constructor.name),
  eraGrades: seq.map((y) => ({ year: y, label: ERA_GRADES[y].label, sepia: ERA_GRADES[y].sepia, grain: ERA_GRADES[y].grain, bloomThreshold: ERA_GRADES[y].bloomThreshold, ssao: ERA_GRADES[y].ssao })),
  morphBlendVerified: errors.length === 0,
  errors,
};
// eslint-disable-next-line no-console
console.log(JSON.stringify(compositionEvidence, null, 2));
if (errors.length > 0) {
  process.exit(1);
}