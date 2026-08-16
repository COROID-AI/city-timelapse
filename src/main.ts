import * as THREE from 'three';
import { ERA_IDS, getEraSpec } from './eras.js';
import { mountTimeline, type TimelineConfig } from './ui/timeline.js';
import { TimelineController } from './scene/timelineController.js';
import { EraStage } from './scene/eraStage.js';
import { SkyRig, DEFAULT_ATMOSPHERE, EARLY_ATMOSPHERE } from './scene/sky.js';

// ── Minimal boot: clear + render one frame ──────────────────────────
const canvas = document.getElementById('webgl') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x0a0a1a);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);
camera.position.set(0, 5, 10);
camera.lookAt(0, 0, 0);

scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(5, 10, 7);
scene.add(dirLight);

// A simple ground plane to prove rendering works
const groundGeo = new THREE.PlaneGeometry(40, 40);
const groundMat = new THREE.MeshStandardMaterial({ color: 0x222233 });
scene.add(new THREE.Mesh(groundGeo, groundMat));

// Log era contract availability
console.log('City Timelapse — eras available:', ERA_IDS);
ERA_IDS.forEach((id) => console.log(`  ${getEraSpec(id).label}`));

// ── Sky Rig (sky dome + sun/hemi/ambient lights + fog) ─────────────
const skyRig = new SkyRig(scene, DEFAULT_ATMOSPHERE, EARLY_ATMOSPHERE);

// ── Era Stage (manages per-era content mounting/disposal) ───────────
const eraStage = new EraStage(scene);

// ── Timeline Controller (orchestrates staged transitions) ───────────
let currentEraId = '1945' as const;

const timelineController = new TimelineController({
  onEraChange: (eraId: string, year: number) => {
    console.log(`[TimelineController] Era transition → ${eraId} (${year})`);
    // Fire audio crossfade hook here when SFX mixer is available
  },
  totalDurationMs: 2500, // ~2.5s total transition
});
timelineController.bind(eraStage, skyRig);

// ── Mount Timeline UI ──────────────────────────────────────────────
const timelineConfig: TimelineConfig = {
  scrubMode: false,
  onEraChange: (eraId: string, _year: number) => {
    // Forward timeline selection to the orchestrator
    timelineController.requestEraChange(eraId as typeof currentEraId);
  },
};
mountTimeline(timelineConfig);

// Render a single frame
renderer.render(scene, camera);

// Handle resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
