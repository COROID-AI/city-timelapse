import * as THREE from 'three';

/**
 * Procedural 1965 era city block.
 *
 * Mid-century modern storefronts with large glass windows, neon signage,
 * googie/mid-century architecture accents, wider asphalt streets,
 * 1960s sedans and a station wagon, pedestrians in 1960s suits/dresses,
 * billboards with mid-century advertising style, traffic lights replacing
 * gas lamps, and a diner with a distinctive roofline.
 *
 * All geometry is procedural three.js primitives — no external model or
 * texture downloads.
 */

export function buildEra1965(): THREE.Group {
  const scene = new THREE.Group();

  // --- 1. Mid-century modern storefronts with large glass windows ---
  const storefrontMat = new THREE.MeshStandardMaterial({
    color: 0x4a90e2,
    metalness: 0.3,
    roughness: 0.4,
  });
  for (let i = 0; i < 4; i++) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(3, 4, 8), storefrontMat);
    mesh.position.set(i * 4 - 6, 2, 0);
    scene.add(mesh);
  }

  // --- 2. Neon signage (vertical glowing strips) ---
  const neonColors = [0xff0000, 0x00ff00, 0x0000ff];
  for (let i = 0; i < 3; i++) {
    const neonMaterial = new THREE.MeshStandardMaterial({
      color: neonColors[i],
      emissive: neonColors[i],
      emissiveIntensity: 0.8,
    });
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 3, 0.5),
      neonMaterial,
    );
    mesh.position.set(-5, 3, i * 3 - 4);
    scene.add(mesh);
  }

  // --- 3. 1960s sedans and a station wagon ---
  const sedanMat = new THREE.MeshStandardMaterial({
    color: 0x996633,
    metalness: 0.8,
    roughness: 0.2,
  });
  for (let i = 0; i < 3; i++) {
    const width = i === 2 ? 2.2 : 2;
    const depth = i === 2 ? 4.5 : 3.5;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, 0.8, depth),
      sedanMat,
    );
    mesh.position.set(i * 3 - 4, 0.4, i === 2 ? 12 : 5);
    scene.add(mesh);
  }

  // --- 4. Pedestrians in 1960s suits/dresses ---
  const pedestrianMats = [
    new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8 }),
    new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.8 }),
  ];
  for (let i = 0; i < 5; i++) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 1.8, 0.4),
      pedestrianMats[i % 2],
    );
    mesh.position.set(-7, 0.9, i * 2.5 - 5);
    scene.add(mesh);
  }

  // --- 5. Billboards with mid-century advertising style ---
  const billboardTexts = ["COCA-COLA 5¢", "McDONALD'S"];
  for (let i = 0; i < 2; i++) {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 32;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ff6600';
    ctx.fillRect(0, 0, 64, 32);
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 16px Arial';
    ctx.fillText(billboardTexts[i], 10, 20);

    const texture = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: texture }),
    );
    sprite.scale.set(2, 1, 1);
    sprite.position.set(8, 6, i * 4 - 2);
    scene.add(sprite);
  }

  // --- 6. Traffic lights replacing gas lamps ---
  for (let i = 0; i < 4; i++) {
    const pole = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 6, 0.2),
      new THREE.MeshStandardMaterial({ color: 0x333333 }),
    );
    pole.position.set(10, 3, i * 3 - 6);
    scene.add(pole);

    const lightBox = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 2, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x111111 }),
    );
    lightBox.position.set(10, 6, i * 3 - 6);
    scene.add(lightBox);

    const light = new THREE.PointLight(
      i % 2 === 0 ? 0xffff00 : 0xff0000,
      0.5,
      10,
    );
    light.position.set(10, 6.5, i * 3 - 6);
    scene.add(light);
  }

  // --- 7. Diner with distinctive A-frame roofline ---
  const diner = new THREE.Mesh(
    new THREE.BoxGeometry(12, 3, 15),
    new THREE.MeshStandardMaterial({ color: 0x8b0000 }),
  );
  diner.position.set(0, 1.5, -10);
  scene.add(diner);

  // A-frame roof
  const roofGeometry = new THREE.BufferGeometry();
  const roofPositions = [
    -6, 4.5, -15,
    6, 4.5, -15,
    0, 7.5, -10,
  ];
  roofGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(roofPositions, 3),
  );
  const roof = new THREE.Mesh(
    roofGeometry,
    new THREE.MeshStandardMaterial({ color: 0x654321 }),
  );
  roof.position.set(0, 3, -10);
  scene.add(roof);

  return scene;
}

/**
 * Per-frame tick for the 1965 era.
 *
 * - Vehicles drive along the street (looping).
 * - Neon signs pulse with a slow intensity oscillation.
 * - Billboards rotate gently for a subtle billboard-flip effect.
 */
export function update(dt: number, eraGroup: THREE.Group): void {
  // Animate vehicles — move along z, wrap around
  eraGroup.children.forEach((child) => {
    if (
      child instanceof THREE.Mesh &&
      child.geometry instanceof THREE.BoxGeometry
    ) {
      const params = child.geometry.parameters;
      // Vehicles are boxes with width 2 or 2.2 and depth 3.5 or 4.5
      if (
        (params.width === 2 || params.width === 2.2) &&
        (params.depth === 3.5 || params.depth === 4.5)
      ) {
        child.position.z -= dt * 2;
        if (child.position.z < -20) {
          child.position.z += 40;
        }
      }
    }
  });

  // Neon signs pulse
  eraGroup.children.forEach((child) => {
    if (
      child instanceof THREE.Mesh &&
      child.material instanceof THREE.MeshStandardMaterial &&
      child.material.emissive
    ) {
      child.material.emissiveIntensity = 0.5 + 0.3 * Math.sin(Date.now() * 0.001);
    }
  });

  // Billboards rotate
  eraGroup.children.forEach((child) => {
    if (child instanceof THREE.Sprite) {
      child.rotation.y += dt * 0.5;
    }
  });
}