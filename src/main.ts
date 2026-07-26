import './style.css';
import { ACESFilmicToneMapping, Color, PCFShadowMap, PerspectiveCamera, Scene, SRGBColorSpace, Timer, WebGLRenderer } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { NAV_BOUNDS } from './constants.js';
import { createBillboards } from './ads/BillboardModule.js';
import { createBuildings, createDefaultLots } from './buildings/BuildingGenerator.js';
import { ERA_LABELS, type EraKey } from './eras/eraConfig.js';
import { createTransitionManager } from './eras/TransitionManager.js';
import { applyNavigationBounds } from './navigation.js';
import { createPostProcessing } from './postprocessing.js';
import { createTimeline } from './timeline.js';
import { createBlock } from './world/BlockLayout.js';
import { createStorefrontModule } from './storefronts/StorefrontModule.js';
import { createCyclistSystem } from './agents/CyclistSystem.js';
import { createDogSystem } from './agents/DogSystem.js';
import { createGround, createLighting } from './world.js';

/**
 * Update the HUD era label (`#era-label`) to the readable label for `era`,
 * sourced from the era config so the HUD never drifts from the single source of
 * truth.
 */
function updateHudEraLabel(era: EraKey): void {
  const eraLabelEl = document.getElementById('era-label');
  if (eraLabelEl) {
    eraLabelEl.textContent = ERA_LABELS[era];
  }
}

/**
 * Application entry point.
 *
 * Wires together the WebGL renderer, an HDR camera/navigation rig, a
 * delta-driven render loop, the bloom post-processing pipeline, the lighting +
 * placeholder ground, and the era timeline / HUD shell. Downstream tasks build
 * the era-specific block content on top of this foundation.
 */
function bootstrap(): void {
  const canvas = document.getElementById('scene');
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('Root canvas #scene not found in the DOM');
  }

  // ---- Renderer (antialias, sRGB output, HDR tone mapping) -----------------
  const renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;

  // ---- Scene + camera ------------------------------------------------------
  const scene = new Scene();
  // Explicit background guarantees a visible, non-transparent canvas rather than
  // relying on CSS bleed-through; the era config drives this on init + change.
  scene.background = new Color(0x05070d);

  const camera = new PerspectiveCamera(
    55,
    window.innerWidth / window.innerHeight,
    0.1,
    1000,
  );
  camera.position.set(60, 45, 70);
  camera.lookAt(0, 0, 0);

  // ---- Lighting + placeholder ground --------------------------------------
  const { ambient, sun } = createLighting();
  scene.add(ambient, sun);
  scene.add(createGround());

  // ---- Navigation rig (orbit / pan / zoom with framing bounds) -------------
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 8, 0);
  controls.minDistance = NAV_BOUNDS.minDistance;
  controls.maxDistance = NAV_BOUNDS.maxDistance;
  controls.maxPolarAngle = NAV_BOUNDS.maxPolarAngle;
  controls.update();

  // ---- Post-processing (EffectComposer + bloom) ---------------------------
  const { composer } = createPostProcessing(renderer, scene, camera);

  // ---- Era transition engine + buildings ----------------------------------
  const INITIAL_ERA: EraKey = '1945';
  const transitionManager = createTransitionManager(INITIAL_ERA);

  // Parametric era-detailed buildings placed on BlockLayout lots. Each building
  // morphs / scales / re-skins per era via the TransitionManager — never
  // rebuilding the scene graph. A storefront slot is reserved on each building.
  const buildings = createBuildings(createDefaultLots());
  scene.add(buildings.group);
  transitionManager.registerDomain('buildings', buildings.applyEra);

  // ---- City block: lots, road network, lanes, parking, signals -------------
  // The block emits a consumable RoadNetwork (for later vehicle/pedestrian
  // tasks) plus its visual geometry, and registers an era domain so road
  // markings, surface, and signal brightness cross-fade between eras.
  const block = createBlock(INITIAL_ERA);
  scene.add(block.group);
  transitionManager.registerDomain('block', block.applyEra);

  // ---- Ground-floor storefronts -------------------------------------------
  // Fills reserved ground-floor slots with era-appropriate shops and exterior
  // signs (painted → neon → backlit → LED → holographic). Signs use canvas
  // textures and emissive materials so the bloom pipeline makes neon/LED/
  // holographic signage glow. Registered with TransitionManager so storefronts
  // transform style, signage, and lighting on era change.
  const storefronts = createStorefrontModule();
  scene.add(storefronts.group);
  transitionManager.registerDomain('storefronts', storefronts.applyEra);

  // ---- Era-specific billboards / advertisements ---------------------------
  // Placed wall-mounted, freestanding, and rooftop — coordinated against the
  // building lots and storefront signage slots so they never overlap windows,
  // entrances, or storefronts. Ad content + medium (painted → printed → LED →
  // holographic) is read from EraConfig.ads and transforms per era via the
  // TransitionManager. LED / holographic ads use emissive materials (glowing
  // via the active bloom pass) and cycle canvas frames for motion.
  const billboards = createBillboards(createDefaultLots(), buildings.storefrontSlots, INITIAL_ERA);
  scene.add(billboards.group);
  transitionManager.registerDomain('ads', billboards.applyEra);

  // ---- Cyclists / two-wheelers on cycle lanes -----------------------------
  // Era-correct bikes, e-bikes, e-scooters, and hover-boards travel the shared
  // RoadNetwork cycle lanes. Conveyances are parametric geometry baked into a
  // single vertex-colored BufferGeometry per variant and driven by InstancedMesh
  // (capped population). They obey the traffic signal where a cycle lane crosses
  // the driving conflict zone. Registered with TransitionManager so the model
  // cross-fades per era without a scene rebuild.
  const cyclists = createCyclistSystem(block.network, block.controller, INITIAL_ERA);
  scene.add(cyclists.group);
  transitionManager.registerDomain('cyclists', cyclists.applyEra);

  // ---- Dogs on sidewalks ---------------------------------------------------
  // Era-neutral dogs walk/trot the shared sidewalk lanes and cross at marked
  // crosswalks (respecting the signal). Simple quadruped trot gait is animated
  // via per-gait-phase InstancedMeshes; a leashed subset ties to a walking owner
  // with an instanced leash. Registered with TransitionManager (era-neutral
  // model; the domain is driven each transition frame and keeps population
  // rhythm aligned to the destination era).
  const dogs = createDogSystem(block.network, block.controller, INITIAL_ERA);
  scene.add(dogs.group);
  transitionManager.registerDomain('dogs', dogs.applyEra);

  // ---- Timeline + HUD ------------------------------------------------------
  const timeline = createTimeline();
  // Selecting an era on the top slider drives a cross-fade transition and
  // updates the HUD era label.
  timeline.onChange((era) => {
    transitionManager.setActiveEra(era);
    updateHudEraLabel(era);
  });
  // Snap the HUD label and button state to the initial era on load.
  timeline.setActive(INITIAL_ERA);
  updateHudEraLabel(INITIAL_ERA);
  // Era transforms are now wired — make the timeline interactive.
  timeline.enable();

  // ---- Resize handling -----------------------------------------------------
  window.addEventListener('resize', () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    composer.setSize(width, height);
  });

  // ---- Delta-driven render loop -------------------------------------------
  const timer = new Timer();
  timer.connect(document);
  function render(): void {
    timer.update();
    const delta = timer.getDelta();
    // Advance any in-flight era cross-fade by the frame delta. The manager
    // mutates registered domain objects only — never rebuilds the scene graph.
    transitionManager.update(delta * 1000);
    // Step the traffic-light controllers (phases red/yellow/green).
    block.update(delta * 1000);
    // Advance cyclists and dogs along the shared cycle/walk lanes.
    cyclists.update(delta * 1000);
    dogs.update(delta * 1000);
    // Cycle LED / holographic billboard frames for motion while settled.
    billboards.update(delta * 1000);
    controls.update();
    applyNavigationBounds(controls);
    composer.render(delta);
    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
}

bootstrap();
