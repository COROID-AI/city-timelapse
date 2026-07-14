import * as THREE from 'three';
import { getEra } from './eras.js';
import { makeBuilding } from './buildings.js';
import { makeVehicleMover } from './vehicles.js';
import { makeWalker } from './pedestrians.js';
import { makeLamp, makeTrafficLight, makeBench, makeTree } from './streetFurniture.js';
import { makeEnvironment } from './environment.js';

function randInt(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }

function collectMaterialsFrom(group, set) {
  group.traverse(function (c) {
    if (c.isMesh) {
      if (Array.isArray(c.material)) c.material.forEach(function (m) { set.add(m); });
      else set.add(c.material);
    }
  });
}

// A single fully-built scene for one era.
export function makeCityBlock(eraIndex) {
  const era = getEra(eraIndex);
  const root = new THREE.Group();
  root.name = 'CityBlock_' + era.year;
  const allMaterials = new Set();
  const movers = [];

  function register(obj) {
    root.add(obj);
    collectMaterialsFrom(obj, allMaterials);
  }

  // --- environment ---
  const env = makeEnvironment(era);
  register(env);

  // --- buildings in 4 quadrants ---
  const quadrants = [
    { cx: 30, cz: 30 }, { cx: -30, cz: 30 }, { cx: 30, cz: -30 }, { cx: -30, cz: -30 }
  ];
  let variantCounter = 0;
  for (let qi = 0; qi < quadrants.length; qi++) {
    const q = quadrants[qi];
    const footprints = layoutQuadrant(q, era);
    for (let bi = 0; bi < footprints.length; bi++) {
      const fp = footprints[bi];
      const variant = (variantCounter + bi) % 3;
      const floors = randInt(era.building.floorsMin, era.building.floorsMax);
      const spec = {
        width: fp.w, depth: fp.d, floors: floors, variant: variant,
        style: era.building.style, accent: era.building.accent[variant]
      };
      const b = makeBuilding(era, eraIndex, spec);
      b.position.set(fp.x, 0, fp.z);
      b.rotation.y = fp.rot || 0;
      b.traverse(function (c) { if (c.isMesh) c.castShadow = true; });
      register(b);
      variantCounter++;
    }
  }

  // --- vehicles on the two roads ---
  const lanes = [
    { axis: 'x', lane: 2.8, dir: 1, min: -100, max: 100 },
    { axis: 'x', lane: -2.8, dir: -1, min: -100, max: 100 },
    { axis: 'z', lane: 2.8, dir: -1, min: -100, max: 100 },
    { axis: 'z', lane: -2.8, dir: 1, min: -100, max: 100 }
  ];
  const vehPerLane = era.vehicle.type === 'hover' ? 2 : 3;
  for (let li = 0; li < lanes.length; li++) {
    const lane = lanes[li];
    for (let i = 0; i < vehPerLane; i++) {
      const v = makeVehicleMover(era, li * 3 + i, lane);
      const span = lane.max - lane.min;
      const basePos = lane.axis === 'x' ? v.position.x : v.position.z;
      const t0 = (i / vehPerLane) * span + basePos;
      const wrapped = ((t0 % span) + span) % span + lane.min;
      if (lane.axis === 'x') v.position.x = wrapped;
      else v.position.z = wrapped;
      register(v);
      movers.push(v);
    }
  }

  // --- pedestrians on sidewalks ---
  for (let qi = 0; qi < quadrants.length; qi++) {
    const q = quadrants[qi];
    const paths = [
      { axis: 'x', lane: q.cz - 22 * Math.sign(q.cz), dir: 1, min: q.cx - 20, max: q.cx + 20 },
      { axis: 'x', lane: q.cz - 18 * Math.sign(q.cz), dir: -1, min: q.cx - 20, max: q.cx + 20 },
      { axis: 'z', lane: q.cx - 22 * Math.sign(q.cx), dir: 1, min: q.cz - 20, max: q.cz + 20 },
      { axis: 'z', lane: q.cx - 18 * Math.sign(q.cx), dir: -1, min: q.cz - 20, max: q.cz + 20 }
    ];
    for (let pi = 0; pi < paths.length; pi++) {
      const path = paths[pi];
      for (let i = 0; i < 2; i++) {
        const p = makeWalker(era, qi * 4 + pi * 2 + i, path);
        register(p);
        movers.push(p);
      }
    }
  }

  // --- street furniture: lamps along roads ---
  for (let i = -60; i <= 60; i += 20) {
    const lampA = makeLamp(era); lampA.position.set(i, 0, 6.5); register(lampA);
    const lampB = makeLamp(era); lampB.position.set(i, 0, -6.5); register(lampB);
    const lampC = makeLamp(era); lampC.position.set(6.5, 0, i); register(lampC);
    const lampD = makeLamp(era); lampD.position.set(-6.5, 0, i); register(lampD);
  }
  // traffic lights at intersection
  const tlPositions = [[7, 7], [-7, 7], [7, -7], [-7, -7]];
  for (let t = 0; t < tlPositions.length; t++) {
    const tl = makeTrafficLight(era);
    tl.position.set(tlPositions[t][0], 0, tlPositions[t][1]);
    register(tl);
  }
  // benches + trees in quadrants
  for (let qi = 0; qi < quadrants.length; qi++) {
    const q = quadrants[qi];
    const bench = makeBench(era);
    bench.position.set(q.cx - 10, 0.2, q.cz - 10);
    bench.rotation.y = Math.PI / 4;
    register(bench);
    const tree = makeTree(era);
    tree.position.set(q.cx + 10, 0.2, q.cz - 10);
    register(tree);
    const tree2 = makeTree(era);
    tree2.position.set(q.cx - 10, 0.2, q.cz + 10);
    register(tree2);
  }

  root.userData.movers = movers;
  root.userData.allMaterials = Array.from(allMaterials);
  root.userData.eraIndex = eraIndex;
  root.userData.era = era;
  return root;
}

function layoutQuadrant(q, era) {
  const out = [];
  const spacing = 18;
  const isBrick = era.building.style === 'brick';
  const baseW = isBrick ? 8 : 11;
  const baseD = isBrick ? 7 : 10;
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 2; c++) {
      const ox = (c - 0.5) * spacing;
      const oz = (r - 0.5) * spacing;
      const w = baseW + Math.random() * 3;
      const d = baseD + Math.random() * 3;
      out.push({ x: q.cx + ox, z: q.cz + oz, w: w, d: d, rot: 0 });
    }
  }
  return out;
}
