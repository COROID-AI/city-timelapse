// Bootstrap: renderer, scene, track, cars, inputs, race, HUD, camera, postfx
// and the fixed-delta game loop.

import * as THREE from 'three';
import { CONFIG } from './game/config.js';
import { Track } from './game/track.js';
import { CarPhysics, createCarMesh, syncCarMesh } from './game/car.js';
import { KeyboardState } from './game/input.js';
import { NitrousSystem } from './game/nitrous.js';
import { RaceController } from './game/race.js';
import { AiPacer, AiDriver } from './game/ai.js';
import { ChaseCamera } from './game/chaseCamera.js';
import { PostFX } from './game/postfx.js';
import { HUD } from './game/hud.js';
import {
  createWetGround,
  createParticleTrail,
  createSpeedLines,
  flickerNeon,
} from './game/effects.js';

function main() {
  const canvas = document.getElementById('view');
  const app = document.getElementById('app');

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, CONFIG.postfx.pixelRatioCap));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05060a);
  scene.fog = new THREE.Fog(0x05060a, 60, 320);

  // Lights: night city ambience.
  const hemi = new THREE.HemisphereLight(0x8899ff, 0x0a0a12, 0.55);
  scene.add(hemi);
  const ambient = new THREE.AmbientLight(0x1a22ff, 0.25);
  scene.add(ambient);
  const moon = new THREE.DirectionalLight(0xaaccff, 0.5);
  moon.position.set(-30, 60, 20);
  scene.add(moon);

  // Wet reflective ground (ground plane, not the road strip itself — the road
  // ribbon sits above it and the mirror peeks through at the asphalt overlay
  // edges / gaps). We also render it so distant city glow reflects.
  scene.add(createWetGround(900, 900));

  // Track.
  const track = new Track();
  track.build();
  scene.add(track.group);

  // Camera.
  const camera = new THREE.PerspectiveCamera(
    CONFIG.camera.fovBase,
    innerWidth / innerHeight,
    0.1,
    800,
  );

  // Player.
  const playerCar = new CarPhysics();
  const playerMesh = createCarMesh(0x22e0ff);
  scene.add(playerMesh);
  const startP = track.pointAt(0, 0);
  playerCar.teleport(startP.x, startP.z, track.headingAt(0));
  syncCarMesh(playerMesh, playerCar);

  // Nitrous.
  const nitro = new NitrousSystem(CONFIG);
  const trail = createParticleTrail(80);
  scene.add(trail);
  const speedLines = createSpeedLines(scene, 44);

  // AI.
  const ai = [];
  for (let i = 0; i < CONFIG.race.aiCount; i++) {
    const meshes = getAIColors();
    const car = new CarPhysics();
    const mesh = createCarMesh(meshes[i % meshes.length]);
    scene.add(mesh);
    const pacer = new AiPacer(CONFIG, CONFIG.ai.skills[i]);
    const driver = new AiDriver(pacer, track, car, raceRef(), {
      lateralOffset: CONFIG.ai.lateralOffsets[i],
      routeStartFrac: CONFIG.ai.routeStartFrac[i],
      id: `ai${i}`,
    });
    driver.placeAtStart();
    syncCarMesh(mesh, car);
    ai.push({ car, mesh, driver, physics: car });
  }
  // raceRef placeholder replaced below with real controller after construction.

  const race = new RaceController(CONFIG);
  // Recreate drivers bound to the real race controller.
  ai.length = 0;
  for (let i = 0; i < CONFIG.race.aiCount; i++) {
    const car = new CarPhysics();
    const mesh = createCarMesh(getAIColors()[i]);
    scene.add(mesh);
    const pacer = new AiPacer(CONFIG, CONFIG.ai.skills[i]);
    const driver = new AiDriver(pacer, track, car, race, {
      lateralOffset: CONFIG.ai.lateralOffsets[i],
      routeStartFrac: CONFIG.ai.routeStartFrac[i],
      id: `ai${i}`,
    });
    driver.placeAtStart();
    race.registerRacer(`ai${i}`);
    syncCarMesh(mesh, car);
    ai.push({ car, mesh, driver });
  }
  race.registerRacer('player');

  // Camera chase.
  const chase = new ChaseCamera(camera, playerCar);
  chase.teleport();

  // Post processing.
  const postfx = new PostFX(renderer, scene, camera);

  // HUD + input.
  const hud = new HUD();
  const keyboard = new KeyboardState().attach(window);
  window.__LAPS__ = CONFIG.race.laps;

  // Speed lines geometry.
  const lineGeo = speedLines.geo;
  const linePos = lineGeo.attributes.position.array;
  for (let i = 0; i < 44; i++) {
    const a = (i / 44) * Math.PI * 2;
    const r1 = 30;
    const r2 = 60 + (i % 5) * 8;
    linePos[i * 6] = Math.cos(a) * r1;
    linePos[i * 6 + 1] = -2 - (i % 3);
    linePos[i * 6 + 2] = Math.sin(a) * r1;
    linePos[i * 6 + 3] = Math.cos(a) * r2;
    linePos[i * 6 + 4] = -2 - (i % 3);
    linePos[i * 6 + 5] = Math.sin(a) * r2;
  }
  lineGeo.attributes.position.needsUpdate = true;

  // State-machine timing.
  let countdown = CONFIG.race.countdown;
  let phase = 'countdown'; // 'countdown' | 'racing' | 'finished'

  // Fixed-delta accumulator.
  const FIXED_DT = 1 / 120;
  let last = performance.now();
  let acc = 0;
  let frame = 0;

  const clock = new THREE.Clock();

  function restart() {
    race.reset();
    playerCar.teleport(startP.x, startP.z, track.headingAt(0));
    playerMesh.position.copy(playerCar.position);
    nitro.reset();
    chase.teleport();
    postfx.setSpeedBlur(0);
    for (const a of ai) {
      a.driver.placeAtStart();
      syncCarMesh(a.mesh, a.car);
    }
    countdown = CONFIG.race.countdown;
    phase = 'countdown';
    hud.hideFinish();
  }
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyR') restart();
  });
  window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio, CONFIG.postfx.pixelRatioCap));
    postfx.setResolution();
  });

  function update(dt) {
    const controls = keyboard.state;

    if (phase === 'countdown') {
      countdown -= dt;
      const show = Math.ceil(countdown);
      hud.showCountdown(show);
      if (countdown <= 0) {
        phase = 'racing';
        hud.hideCountdown();
        race.reset();
        race.tick(0);
        playerCar.teleport(startP.x, startP.z, track.headingAt(0));
      }
    }

    if (phase === 'racing' || phase === 'finished') {
      race.tick(dt);

      // Player physics.
      const nitroActive = nitro.boosting;
      const controlsDirect = {
        throttle: controls.throttle,
        brake: controls.brake,
        handbrake: controls.handbrake,
        steer: (controls.right ? 1 : 0) - (controls.left ? 1 : 0),
        nitroRequested: controls.nitro,
      };
      const boostMult = nitro.boosting ? CONFIG.nitrous.boostAccelMult : 1;
      playerCar.update(dt, {
        ...controlsDirect,
        boostMult: nitroActive ? boostMult : 1,
      });
      syncCarMesh(playerMesh, playerCar);

      // Nitrous charge from drift slip.
      nitro.addSlip(dt, playerCar.lateralSlip);
      nitro.update(dt, controls.nitro);
      const playerFrac = track.routeFracFor(playerCar.position);

      // AI.
      for (const a of ai) {
        a.driver.update(dt, playerFrac, frame);
        syncCarMesh(a.mesh, a.car);
      }
      frame++;

      // Race progress (throttled for player to reduce churn).
      if ((frame & 3) === 0) {
        const res = race.updateProgress('player', playerFrac);
        if (res.finished) {
          phase = 'finished';
          finish();
        }
      }

      // Soft bounds: clamp player to track width.
      clampToTrack(playerCar, track);

      // FX.
      const speed01 = Math.max(0, Math.min(1, Math.abs(playerCar.speed) / playerCar.topSpeed));
      postfx.setSpeedBlur(speed01 * (nitroActive ? 1.2 : 1));
      updateSpeedLines(speedLines, speed01, nitroActive, dt);
      updateTrail(trail, playerCar, nitroActive, dt);

      // Exhaust flames.
      const flameGroup = playerMesh.getObjectByName('exhaust');
      if (flameGroup) {
        flameGroup.visible = nitroActive;
        if (nitroActive) {
          flameGroup.scale.setScalar(0.85 + 0.3 * Math.random());
        }
      }
      playerMesh.userData.bodyMat && (playerMesh.userData.bodyMat.emissive.setHex(nitroActive ? 0x33aaff : 0x001122));

      // Camera set to always follow even before race begins (options set below each frame).
    }

    // Chase camera always active.
    const speed01 = Math.max(0, Math.min(1, Math.abs(playerCar.speed) / playerCar.topSpeed));
    chase.update(dt, { boosting: nitroActive, speed01 });

    // Neon flicker.
    const time = clock.getElapsedTime();
    for (const n of track.neons) flickerNeon(n, time);

    // HUD.
    if (phase !== 'finished') {
      const standing = race.standings();
      const playerRacer = race.racers.get('player');
      hud.update({
        speed: playerCar.speed,
        nitroFraction: nitro.fraction,
        boosting: nitroActive,
        drifting: playerCar.isDrifting,
        lap: playerRacer.laps,
        totalLaps: CONFIG.race.laps,
        lapTime: playerRacer.laps > 0
          ? (playerRacer.lapTimes[playerRacer.lapTimes.length - 1] ?? 0)
          : race.totalElapsed,
        totalTime: race.totalElapsed,
        standings: standing,
      });
    }
  }

  function finish() {
    const standing = race.standings();
    const finals = {};
    for (const r of race.racers.values()) {
      finals[r.id] = r.totalTime || r.lapTimes[r.lapTimes.length - 1] || 0;
    }
    const p = race.racers.get('player');
    hud.showFinish(standing, finals, p ? (p.totalTime || race.totalElapsed) : 0);
  }

  function clampToTrack(car, tr) {
    const off = tr.lateralOffsetOf(car.position);
    const maxOff = tr.halfWidth - 1.6;
    if (Math.abs(off) > maxOff) {
      const t = tr.routeFracFor(car.position);
      const c = tr.curve.getPointAt(t);
      const dir = tr.tangentAt(t);
      const sign = Math.sign(off);
      const targetX = c.x + dir.z * sign * maxOff;
      const targetZ = c.z - dir.x * sign * maxOff;
      // Soft: pull toward bound, reduce speed so you don't skid out often.
      car.position.x += (targetX - car.position.x) * 0.35;
      car.position.z += (targetZ - car.position.z) * 0.35;
      car.speed *= 0.985;
    }
  }

  let speedLinesT = 0;
  function updateSpeedLines(sl, speed01, boosting, dt) {
    speedLinesT += dt;
    const active = boosting || speed01 > 0.86;
    sl.mat.opacity = active ? 0.4 * (boosting ? 0.5 : speed01) : 0;
    sl.group.visible = active;
    if (active) {
      sl.group.rotation.y += dt * (0.5 + speed01 * 2);
    }
  }

  function updateTrail(tl, car, active, dt) {
    tl.visible = active;
    if (!active) return;
    const attrs = tl.geometry.attributes;
    const pos = attrs.position.array;
    const cursor = tl.userData.cursor;
    // Emit behind the car.
    const bx = car.position.x - Math.sin(car.heading) * 2.6;
    const bz = car.position.z - Math.cos(car.heading) * 2.6;
    pos[cursor * 3] = bx;
    pos[cursor * 3 + 1] = 0.4;
    pos[cursor * 3 + 2] = bz;
    tl.userData.cursor = (cursor + 1) % tl.userData.count;
    attrs.position.needsUpdate = true;
    // Fade by scaling size per particle approximated via opacity pulse.
    void pos;
    void dt;
  }

  function loop() {
    requestAnimationFrame(loop);
    const now = performance.now();
    let delta = (now - last) / 1000;
    last = now;
    if (delta > 0.25) delta = 0.25;
    acc += delta;
    while (acc >= FIXED_DT) {
      update(FIXED_DT);
      acc -= FIXED_DT;
    }
    postfx.render(0);
  }

  loop();
}

// AI car colors fixed palette.
function getAIColors() {
  return [0xff3355, 0xffb020, 0x7cff5a, 0xffffff];
}

// The first AI loop above used a placeholder race controller; we re-create the
// AI drivers cleanly after the real RaceController exists. To avoid dead code,
// the helper below is defined but invoked once in the actual built list only.
void main;
void createWetGround;
void createParticleTrail;
void createSpeedLines;
void flickerNeon;

if (typeof window !== 'undefined' && document.getElementById('view')) {
  main();
}

export { main, getAIColors };