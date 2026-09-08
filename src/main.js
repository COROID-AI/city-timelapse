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

// Fixed AI body colors.
const AI_COLORS = [0xff3355, 0xffb020, 0x7cff5a, 0xd8e2ff];

export function main() {
  const canvas = document.getElementById('view');

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
  scene.add(new THREE.HemisphereLight(0x8899ff, 0x0a0a12, 0.55));
  scene.add(new THREE.AmbientLight(0x1a22ff, 0.25));
  const moon = new THREE.DirectionalLight(0xaaccff, 0.5);
  moon.position.set(-30, 60, 20);
  scene.add(moon);

  // Wet reflective ground (mirror plane under translucent asphalt).
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

  // Nitrous + FX.
  const nitro = new NitrousSystem(CONFIG);
  const trail = createParticleTrail(80);
  scene.add(trail);
  const speedLines = createSpeedLines(scene, 44);

  // Race controller shared by player + AI.
  const race = new RaceController(CONFIG);
  race.registerRacer('player');

  // AI drivers.
  const ai = [];
  for (let i = 0; i < CONFIG.race.aiCount; i++) {
    const car = new CarPhysics();
    const mesh = createCarMesh(AI_COLORS[i % AI_COLORS.length]);
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

  // Chase camera.
  const chase = new ChaseCamera(camera, playerCar);
  chase.teleport();

  // Post processing.
  const postfx = new PostFX(renderer, scene, camera);

  // HUD + input.
  const hud = new HUD();
  const keyboard = new KeyboardState().attach(window);
  window.__LAPS__ = CONFIG.race.laps;

  // Speed-line streak geometry (static, rotating group).
  const linePos = speedLines.geo.attributes.position.array;
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
  speedLines.geo.attributes.position.needsUpdate = true;

  // State timing.
  let countdown = CONFIG.race.countdown;
  let phase = 'countdown';
  let last = performance.now();
  let acc = 0;
  let frame = 0;
  let speedLinesT = 0;
  const clock = new THREE.Clock();
  const FIXED_DT = 1 / 120;

  function restart() {
    race.reset();
    playerCar.teleport(startP.x, startP.z, track.headingAt(0));
    syncCarMesh(playerMesh, playerCar);
    nitro.reset();
    chase.teleport();
    postfx.setSpeedBlur(0);
    for (const a of ai) {
      a.driver.placeAtStart();
      syncCarMesh(a.mesh, a.car);
    }
    countdown = CONFIG.race.countdown;
    phase = 'countdown';
    frame = 0;
    speedLinesT = 0;
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
      const show = Math.max(1, Math.ceil(countdown));
      hud.showCountdown(show);
      if (countdown <= 0) {
        phase = 'racing';
        hud.hideCountdown();
        race.reset();
        playerCar.teleport(startP.x, startP.z, track.headingAt(0));
      }
    }

    const boosting = nitro.boosting;

    if (phase === 'racing' || phase === 'finished') {
      race.tick(dt);

      // Player physics.
      playerCar.update(dt, {
        throttle: controls.throttle,
        brake: controls.brake,
        handbrake: controls.handbrake,
        steer: (controls.right ? 1 : 0) - (controls.left ? 1 : 0),
        nitroRequested: controls.nitro,
        boostMult: boosting ? CONFIG.nitrous.boostAccelMult : 1,
      });
      syncCarMesh(playerMesh, playerCar);

      // Nitrous charge from drift slip, then consume/decay.
      nitro.addSlip(dt, playerCar.lateralSlip);
      nitro.update(dt, controls.nitro);
      const playerFrac = track.routeFracFor(playerCar.position);

      // AI.
      for (const a of ai) {
        a.driver.update(dt, playerFrac, frame);
        syncCarMesh(a.mesh, a.car);
      }

      // Soft bounds: clamp player to track width.
      clampToTrack(playerCar, track);

      frame++;

      // Race progress (throttled to reduce churn).
      if ((frame & 3) === 0) {
        const res = race.updateProgress('player', playerFrac);
        if (res.finished) {
          phase = 'finished';
          finish();
        }
      }

      // FX scaled by speed.
      const speed01 = speedNorm();
      postfx.setSpeedBlur(speed01 * (boosting ? 1.2 : 1));
      updateSpeedLines(speed01, boosting, dt);
      updateTrail(boosting, dt);

      // Exhaust flames.
      const flameGroup = playerMesh.getObjectByName('exhaust');
      if (flameGroup) {
        flameGroup.visible = boosting;
        if (boosting) flameGroup.scale.setScalar(0.85 + 0.3 * Math.random());
      }
    }

    // Chase camera always active.
    chase.update(dt, { boosting, speed01: speedNorm() });

    // Neon flicker.
    const time = clock.getElapsedTime();
    for (const n of track.neons) flickerNeon(n, time);

    // HUD.
    if (phase !== 'finished') {
      const playerRacer = race.racers.get('player');
      hud.update({
        speed: playerCar.speed,
        nitroFraction: nitro.fraction,
        boosting,
        drifting: playerCar.isDrifting,
        lap: playerRacer.laps,
        totalLaps: CONFIG.race.laps,
        lapTime:
          playerRacer.laps > 0
            ? playerRacer.lapTimes[playerRacer.lapTimes.length - 1] ?? 0
            : race.totalElapsed,
        totalTime: race.totalElapsed,
        standings: race.standings(),
      });
    }
  }

  function speedNorm() {
    return Math.max(0, Math.min(1, Math.abs(playerCar.speed) / playerCar.topSpeed));
  }

  function finish() {
    const standing = race.standings();
    const finals = {};
    for (const r of race.racers.values()) {
      finals[r.id] = r.totalTime || r.lapTimes[r.lapTimes.length - 1] || 0;
    }
    const p = race.racers.get('player');
    hud.showFinish(standing, finals, p ? p.totalTime || race.totalElapsed : 0);
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
      car.position.x += (targetX - car.position.x) * 0.35;
      car.position.z += (targetZ - car.position.z) * 0.35;
      car.speed *= 0.985;
    }
  }

  function updateSpeedLines(speed01, boosting, dt) {
    speedLinesT += dt;
    const active = boosting || speed01 > 0.86;
    speedLines.mat.opacity = active ? 0.4 * (boosting ? 0.5 : speed01) : 0;
    speedLines.group.visible = active;
    if (active) speedLines.group.rotation.y += dt * (0.5 + speed01 * 2);
  }

  function updateTrail(active, dt) {
    trail.visible = active;
    if (!active || !frame) return;
    const pos = trail.geometry.attributes.position.array;
    const cursor = trail.userData.cursor;
    const bx = playerCar.position.x - Math.sin(playerCar.heading) * 2.6;
    const bz = playerCar.position.z - Math.cos(playerCar.heading) * 2.6;
    pos[cursor * 3] = bx;
    pos[cursor * 3 + 1] = 0.4;
    pos[cursor * 3 + 2] = bz;
    trail.userData.cursor = (cursor + 1) % trail.userData.count;
    trail.geometry.attributes.position.needsUpdate = true;
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

if (typeof window !== 'undefined' && document.getElementById('view')) {
  main();
}