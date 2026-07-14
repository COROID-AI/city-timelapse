import * as THREE from 'three';
import { getEraTextures, shadeColor } from './textures.js';
import { markFinishMaterial } from './transitions.js';

// Creates a single building for a given era. Returns a THREE.Group whose
// children all use transparent-capable materials so they can crossfade.
export function makeBuilding(era, eraIndex, spec) {
  const group = new THREE.Group();
  group.userData = { spec };
  const tex = getEraTextures(era, eraIndex);
  const { width, depth, floors, variant, style } = spec;
  const floorH = style === 'cyber' ? 2.0 : 2.6;
  const bodyH = floors * floorH;
  const wallSet = tex.wallSets[variant % tex.wallSets.length];

  // --- main body with window-textured walls ---
  const geo = new THREE.BoxGeometry(width, bodyH, depth);
  const map = wallSet.map.clone(); map.needsUpdate = true;
  const emissiveMap = wallSet.emissive.clone(); emissiveMap.needsUpdate = true;
  // tile horizontally based on width
  const tiles = Math.max(1, Math.round(width / 4));
  map.repeat.set(tiles, floors / 3);
  emissiveMap.repeat.set(tiles, floors / 3);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  emissiveMap.wrapS = emissiveMap.wrapT = THREE.RepeatWrapping;

  const bodyMat = new THREE.MeshStandardMaterial({
    map, emissiveMap,
    emissive: new THREE.Color(0xffffff).multiplyScalar(era.windowEmissive),
    emissiveIntensity: era.night ? 1.6 : 0.7,
    roughness: era.building.roughness,
    metalness: era.building.metalness,
    transparent: true
  });

  // storefront base material for bottom segment
  const storeMat = new THREE.MeshStandardMaterial({
    map: tex.storefront,
    emissiveMap: tex.storefront,
    emissive: new THREE.Color(0xffffff).multiplyScalar(0.8),
    emissiveIntensity: era.night ? 1.0 : 0.35,
    roughness: 0.6, metalness: 0.1, transparent: true
  });

  // 6-material array: +x, -x, +y (top), -y (bottom), +z, -z
  const roofMat = new THREE.MeshStandardMaterial({
    color: shadeColor(era.building.palette[variant % era.building.palette.length], -40),
    roughness: 0.95, metalness: 0.0, transparent: true
  });
  const matArr = [bodyMat, bodyMat, roofMat, roofMat, bodyMat, bodyMat];

  const body = new THREE.Mesh(geo, matArr);
  body.position.y = bodyH / 2;
  body.castShadow = true; body.receiveShadow = true;
  group.add(body);

  // storefront band (bottom 1 floor)
  const storeH = floorH * 1.1;
  const storeGeo = new THREE.BoxGeometry(width + 0.12, storeH, depth + 0.12);
  const smap = tex.storefront.clone(); smap.needsUpdate = true;
  smap.wrapS = smap.wrapT = THREE.RepeatWrapping;
  smap.repeat.set(tiles, 1);
  storeMat.map = smap;
  const storeEmap = tex.storefront.clone(); storeEmap.needsUpdate = true;
  storeEmap.wrapS = storeEmap.wrapT = THREE.RepeatWrapping; storeEmap.repeat.set(tiles, 1);
  storeMat.emissiveMap = storeEmap;
  const sArr = [storeMat, storeMat, roofMat, roofMat, storeMat, storeMat];
  const store = new THREE.Mesh(storeGeo, sArr);
  store.position.y = storeH / 2;
  store.castShadow = true; store.receiveShadow = true;
  group.add(store);

  // --- roof details ---
  addRoof(group, era, spec, width, depth, bodyH, roofMat, storeMat);

  // --- billboard / sign mounted on top or side ---
  addBillboard(group, era, spec, width, depth, bodyH);

  // collect materials for fade
  group.userData.materials = collectMaterials(group);
  return group;
}

function collectMaterials(obj) {
  const mats = new Set();
  obj.traverse((c) => {
    if (c.isMesh) {
      if (Array.isArray(c.material)) c.material.forEach((m) => mats.add(m));
      else mats.add(c.material);
    }
  });
  return [...mats];
}

function addRoof(group, era, spec, width, depth, bodyH, roofMat, storeMat) {
  const roofType = era.building.roof;
  const accent = era.building.accent[spec.variant % era.building.accent.length];
  const top = bodyH;

  if (roofType === 'pitched') {
    // brick/wood pitched roof (1945)
    const peak = new THREE.Mesh(
      new THREE.CylinderGeometry(width * 0.62, width * 0.7, 0.1, 3),
      new THREE.MeshStandardMaterial({ color: '#5a3a26', roughness: 0.95, transparent: true })
    );
    // triangular gable
    const tri = new THREE.Mesh(
      new THREE.BoxGeometry(width, 1.4, depth * 0.7),
      new THREE.MeshStandardMaterial({ color: shadeColor(era.building.palette[0], -20), roughness: 0.9, transparent: true })
    );
    tri.position.y = top + 0.7;
    tri.castShadow = true; group.add(tri);
    // chimney
    const chim = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 1.6, 0.7),
      new THREE.MeshStandardMaterial({ color: '#6a4632', roughness: 0.95, transparent: true })
    );
    chim.position.set(width * 0.3, top + 0.8, depth * 0.25);
    chim.castShadow = true; group.add(chim);
  } else if (roofType === 'flat') {
    // flat parapet (1965, 2005)
    const parapet = new THREE.Mesh(
      new THREE.BoxGeometry(width + 0.2, 0.5, depth + 0.2),
      roofMat
    );
    parapet.position.y = top + 0.25; group.add(parapet);
    // HVAC box
    const hvac = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.3, 0.9, depth * 0.3),
      new THREE.MeshStandardMaterial({ color: '#888', roughness: 0.7, transparent: true })
    );
    hvac.position.set(-width * 0.2, top + 0.95, depth * 0.1);
    hvac.castShadow = true; group.add(hvac);
  } else if (roofType === 'antenna') {
    // antenna / mast (1985)
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.1, 6, 6),
      new THREE.MeshStandardMaterial({ color: '#444', roughness: 0.5, metalness: 0.6, transparent: true })
    );
    mast.position.set(0, top + 3, 0); group.add(mast);
    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 8, 8),
      new THREE.MeshStandardMaterial({ color: '#ff2bd6', emissive: '#ff2bd6', emissiveIntensity: 3, transparent: true })
    );
    beacon.position.set(0, top + 6.1, 0); group.add(beacon);
    // satellite dish
    const dish = new THREE.Mesh(
      new THREE.SphereGeometry(0.9, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2.5),
      new THREE.MeshStandardMaterial({ color: '#aaaaaa', roughness: 0.4, metalness: 0.5, side: THREE.DoubleSide, transparent: true })
    );
    dish.rotation.x = Math.PI * 0.2;
    dish.position.set(width * 0.25, top + 0.6, -depth * 0.2);
    group.add(dish);
  } else if (roofType === 'green') {
    // green roof + solar (2025)
    const green = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.92, 0.3, depth * 0.92),
      new THREE.MeshStandardMaterial({ color: '#3a6a3a', roughness: 0.9, transparent: true })
    );
    green.position.y = top + 0.15; group.add(green);
    const solar = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.5, 0.08, depth * 0.5),
      new THREE.MeshStandardMaterial({ color: '#1a2a4a', emissive: '#2a4a7a', emissiveIntensity: 0.3, roughness: 0.2, metalness: 0.8, transparent: true })
    );
    solar.rotation.z = -0.3; solar.position.set(width * 0.1, top + 0.5, 0);
    group.add(solar);
    const solar2 = solar.clone();
    solar2.position.set(-width * 0.1, top + 0.5, depth * 0.15); group.add(solar2);
  } else if (roofType === 'cyber') {
    // glowing ring + spire (2055)
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(width * 0.35, 0.06, 8, 24),
      new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 4, transparent: true })
    );
    ring.rotation.x = Math.PI / 2; ring.position.y = top + 1.2; group.add(ring);
    const spire = new THREE.Mesh(
      new THREE.ConeGeometry(0.4, 4, 5),
      new THREE.MeshStandardMaterial({ color: '#0a0c14', emissive: accent, emissiveIntensity: 1.2, transparent: true })
    );
    spire.position.y = top + 3; group.add(spire);
    // cooling fin
    const fin = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.6, 2, 0.2),
      new THREE.MeshStandardMaterial({ color: '#141826', emissive: accent, emissiveIntensity: 0.6, transparent: true })
    );
    fin.position.set(0, top + 1.5, depth * 0.5); group.add(fin);
  }
}

function addBillboard(group, era, spec, width, depth, bodyH) {
  const style = era.billboard.style;
  const accent = era.building.accent[spec.variant % era.building.accent.length];
  const accent2 = era.building.accent[(spec.variant + 1) % era.building.accent.length];
  // only some buildings get roof billboards
  if (spec.variant === 0 || spec.variant === 2) {
    const bbW = width * 0.7;
    const bbH = 2.2;
    let mat;
    if (style === 'painted') {
      mat = new THREE.MeshStandardMaterial({ color: '#d8c4a0', emissive: '#3a2a18', emissiveIntensity: 0.2, roughness: 0.9, transparent: true });
    } else if (style === 'neon') {
      mat = new THREE.MeshStandardMaterial({ color: '#101018', emissive: accent, emissiveIntensity: 3, roughness: 0.4, transparent: true });
    } else if (style === 'led') {
      mat = new THREE.MeshStandardMaterial({ color: '#0a0a10', emissive: accent, emissiveIntensity: 2.4, roughness: 0.3, transparent: true });
    } else { // holographic
      mat = new THREE.MeshStandardMaterial({ color: '#0a0a14', emissive: accent, emissiveIntensity: 4, transparent: true, opacity: 0.85 });
      markFinishMaterial(mat, 0.85);
    }
    const bb = new THREE.Mesh(new THREE.BoxGeometry(bbW, bbH, 0.25), mat);
    bb.position.set(0, bodyH + 1.5, depth * 0.5);
    bb.castShadow = true; group.add(bb);
    // frame posts
    const postMat = new THREE.MeshStandardMaterial({ color: '#444', roughness: 0.6, transparent: true });
    [-1, 1].forEach((s) => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.5, 0.18), postMat);
      post.position.set(s * bbW * 0.4, bodyH + 0.75, depth * 0.5); group.add(post);
    });
  }
}
