/**
 * Street props module.
 * Creates era-specific street furniture: lamp posts, hydrants, benches,
 * trees, traffic lights, and road markings.
 */
import * as THREE from 'three';
import type { EraId } from '../eras';
import type { AppState } from '../state';

interface PropSpec {
  /** Lamp post type */
  lampType: 'gas' | 'cobra' | 'sodium' | 'led' | 'holographic';
  /** Lamp color */
  lampColor: THREE.Color;
  /** Lamp intensity */
  lampIntensity: number;
  /** Bench color */
  benchColor: THREE.Color;
  /** Tree type */
  treeType: 'oak' | 'maple' | 'palm' | 'modern';
  /** Tree color */
  treeColor: THREE.Color;
  /** Traffic light style */
  trafficLight: 'vintage' | 'modern' | 'digital';
  /** Road color */
  roadColor: THREE.Color;
  /** Sidewalk color */
  sidewalkColor: THREE.Color;
}

const PROP_SPECS: Record<EraId, PropSpec> = {
  '1945': {
    lampType: 'gas',
    lampColor: new THREE.Color(0xffddaa),
    lampIntensity: 0.5,
    benchColor: new THREE.Color(0x8b4513),
    treeType: 'oak',
    treeColor: new THREE.Color(0x228b22),
    trafficLight: 'vintage',
    roadColor: new THREE.Color(0x555555),
    sidewalkColor: new THREE.Color(0xaaaaaa),
  },
  '1965': {
    lampType: 'cobra',
    lampColor: new THREE.Color(0xffffaa),
    lampIntensity: 0.6,
    benchColor: new THREE.Color(0x8b4513),
    treeType: 'maple',
    treeColor: new THREE.Color(0x228b22),
    trafficLight: 'modern',
    roadColor: new THREE.Color(0x666666),
    sidewalkColor: new THREE.Color(0xbbbbbb),
  },
  '1985': {
    lampType: 'sodium',
    lampColor: new THREE.Color(0xffaa33),
    lampIntensity: 0.8,
    benchColor: new THREE.Color(0x444444),
    treeType: 'maple',
    treeColor: new THREE.Color(0x228b22),
    trafficLight: 'modern',
    roadColor: new THREE.Color(0x444444),
    sidewalkColor: new THREE.Color(0x999999),
  },
  '2005': {
    lampType: 'led',
    lampColor: new THREE.Color(0x00aaff),
    lampIntensity: 0.9,
    benchColor: new THREE.Color(0x333333),
    treeType: 'modern',
    treeColor: new THREE.Color(0x228b22),
    trafficLight: 'digital',
    roadColor: new THREE.Color(0x333333),
    sidewalkColor: new THREE.Color(0x888888),
  },
  '2025': {
    lampType: 'led',
    lampColor: new THREE.Color(0x00ffaa),
    lampIntensity: 1.0,
    benchColor: new THREE.Color(0x222222),
    treeType: 'modern',
    treeColor: new THREE.Color(0x228b22),
    trafficLight: 'digital',
    roadColor: new THREE.Color(0x222222),
    sidewalkColor: new THREE.Color(0x777777),
  },
  '2055': {
    lampType: 'holographic',
    lampColor: new THREE.Color(0x00ffff),
    lampIntensity: 1.2,
    benchColor: new THREE.Color(0x0a2a3a),
    treeType: 'modern',
    treeColor: new THREE.Color(0x00ffaa),
    trafficLight: 'digital',
    roadColor: new THREE.Color(0x0a1a2a),
    sidewalkColor: new THREE.Color(0x1a2a4a),
  },
};

interface PropInstance {
  mesh: THREE.Group;
  type: 'lamp' | 'bench' | 'hydrant' | 'tree' | 'traffic_light';
  position: THREE.Vector3;
}

export class PropsModule {
  group: THREE.Group;
  private scene: THREE.Scene;
  private props: PropInstance[] = [];
  private roadMesh!: THREE.Mesh;
  private sidewalkMeshes: THREE.Mesh[] = [];

  // Shared geometries
  private cylinderGeometry: THREE.CylinderGeometry;
  private boxGeometry: THREE.BoxGeometry;
  private sphereGeometry: THREE.SphereGeometry;
  private coneGeometry: THREE.ConeGeometry;
  private planeGeometry: THREE.PlaneGeometry;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    // Shared geometries
    this.cylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, 16);
    this.boxGeometry = new THREE.BoxGeometry(1, 1, 1);
    this.sphereGeometry = new THREE.SphereGeometry(1, 16, 16);
    this.coneGeometry = new THREE.ConeGeometry(1, 2, 16);
    this.planeGeometry = new THREE.PlaneGeometry(1, 1);

    this.generateRoads();
    this.generateProps();
    this.setEra('1945');
  }

  private generateRoads(): void {
    // Main road (cross shape)
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x555555 });
    const roadGeometry = new THREE.PlaneGeometry(40, 6);
    this.roadMesh = new THREE.Mesh(roadGeometry, roadMat);
    this.roadMesh.rotation.x = -Math.PI / 2;
    this.roadMesh.receiveShadow = true;
    this.group.add(this.roadMesh);

    // Cross road
    const road2 = new THREE.Mesh(roadGeometry, roadMat);
    road2.rotation.x = -Math.PI / 2;
    road2.rotation.z = Math.PI / 2;
    road2.receiveShadow = true;
    this.group.add(road2);

    // Sidewalks
    for (let i = 0; i < 4; i++) {
      const sidewalk = new THREE.Mesh(
        new THREE.PlaneGeometry(40, 5),
        new THREE.MeshStandardMaterial({ color: 0xaaaaaa })
      );
      sidewalk.rotation.x = -Math.PI / 2;
      sidewalk.position.set(0, 0.01, i < 2 ? (i === 0 ? -8 : 8) : 0);
      if (i >= 2) {
        sidewalk.rotation.z = Math.PI / 2;
        sidewalk.position.set(i === 2 ? -8 : 8, 0.01, 0);
      }
      sidewalk.receiveShadow = true;
      this.group.add(sidewalk);
      this.sidewalkMeshes.push(sidewalk);
    }
  }

  private generateProps(): void {
    const positions = [
      // Lamp posts at corners
      { x: -18, z: -18, type: 'lamp' as const },
      { x: 18, z: -18, type: 'lamp' as const },
      { x: -18, z: 18, type: 'lamp' as const },
      { x: 18, z: 18, type: 'lamp' as const },
      // Benches along sidewalks
      { x: -10, z: -6, type: 'bench' as const },
      { x: 10, z: 6, type: 'bench' as const },
      { x: -6, z: 10, type: 'bench' as const },
      { x: 6, z: -10, type: 'bench' as const },
      // Hydrants
      { x: -5, z: -5, type: 'hydrant' as const },
      { x: 5, z: 5, type: 'hydrant' as const },
      { x: -5, z: 5, type: 'hydrant' as const },
      { x: 5, z: -5, type: 'hydrant' as const },
      // Trees in center plaza
      { x: -8, z: 0, type: 'tree' as const },
      { x: 8, z: 0, type: 'tree' as const },
      { x: 0, z: -8, type: 'tree' as const },
      { x: 0, z: 8, type: 'tree' as const },
      // Traffic lights
      { x: -20, z: 0, type: 'traffic_light' as const },
      { x: 20, z: 0, type: 'traffic_light' as const },
      { x: 0, z: -20, type: 'traffic_light' as const },
      { x: 0, z: 20, type: 'traffic_light' as const },
    ];

    for (const pos of positions) {
      const prop = this.createProp(pos.type, '1945');
      prop.mesh.position.set(pos.x, 0, pos.z);
      this.group.add(prop.mesh);
      this.props.push({
        mesh: prop.mesh,
        type: pos.type,
        position: new THREE.Vector3(pos.x, 0, pos.z),
      });
    }
  }

  private createProp(type: string, era: EraId): { mesh: THREE.Group } {
    const spec = PROP_SPECS[era];
    const group = new THREE.Group();

    switch (type) {
      case 'lamp': {
        const poleMat = new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.8 });
        const pole = new THREE.Mesh(this.cylinderGeometry, poleMat);
        pole.scale.set(0.3, 4, 0.3);
        pole.position.y = 2;
        group.add(pole);

        const lampMat = new THREE.MeshStandardMaterial({
          color: spec.lampColor,
          emissive: spec.lampColor,
          emissiveIntensity: spec.lampIntensity,
        });
        const lamp = new THREE.Mesh(this.sphereGeometry, lampMat);
        lamp.scale.set(0.5, 0.5, 0.5);
        lamp.position.y = 4;
        group.add(lamp);

        // Gas lamp mantle (1945)
        if (spec.lampType === 'gas') {
          const mantle = new THREE.Mesh(this.sphereGeometry, new THREE.MeshStandardMaterial({
            color: 0xffddaa,
            emissive: 0xffddaa,
            emissiveIntensity: 0.8,
            transparent: true,
            opacity: 0.7,
          }));
          mantle.scale.set(0.3, 0.3, 0.3);
          mantle.position.y = 3.8;
          group.add(mantle);
        }
        break;
      }
      case 'bench': {
        const benchMat = new THREE.MeshStandardMaterial({ color: spec.benchColor });
        const seat = new THREE.Mesh(this.boxGeometry, benchMat);
        seat.scale.set(2, 0.3, 0.5);
        seat.position.y = 0.5;
        group.add(seat);

        const back = new THREE.Mesh(this.boxGeometry, benchMat);
        back.scale.set(2, 0.8, 0.2);
        back.position.y = 1.1;
        group.add(back);
        break;
      }
      case 'hydrant': {
        const hydrantMat = new THREE.MeshStandardMaterial({ color: 0xcc0000 });
        const body = new THREE.Mesh(this.cylinderGeometry, hydrantMat);
        body.scale.set(0.5, 1, 0.5);
        body.position.y = 0.5;
        group.add(body);

        const cap = new THREE.Mesh(this.cylinderGeometry, hydrantMat);
        cap.scale.set(0.7, 0.2, 0.7);
        cap.position.y = 1.1;
        group.add(cap);
        break;
      }
      case 'tree': {
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
        const trunk = new THREE.Mesh(this.cylinderGeometry, trunkMat);
        trunk.scale.set(0.5, 2, 0.5);
        trunk.position.y = 1;
        group.add(trunk);

        const leafMat = new THREE.MeshStandardMaterial({ color: spec.treeColor });
        const leaves = new THREE.Mesh(this.coneGeometry, leafMat);
        leaves.scale.set(2, 3, 2);
        leaves.position.y = 2.5;
        group.add(leaves);
        break;
      }
      case 'traffic_light': {
        const poleMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
        const pole = new THREE.Mesh(this.cylinderGeometry, poleMat);
        pole.scale.set(0.2, 5, 0.2);
        pole.position.y = 2.5;
        group.add(pole);

        const boxMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
        const box = new THREE.Mesh(this.boxGeometry, boxMat);
        box.scale.set(0.5, 1.5, 0.3);
        box.position.y = 5;
        group.add(box);

        // Lights
        const redLight = new THREE.Mesh(this.sphereGeometry, new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000 }));
        redLight.scale.set(0.15, 0.15, 0.15);
        redLight.position.y = 5.4;
        group.add(redLight);

        const yellowLight = new THREE.Mesh(this.sphereGeometry, new THREE.MeshStandardMaterial({ color: 0xffff00, emissive: 0xffff00 }));
        yellowLight.scale.set(0.15, 0.15, 0.15);
        yellowLight.position.y = 5.1;
        group.add(yellowLight);

        const greenLight = new THREE.Mesh(this.sphereGeometry, new THREE.MeshStandardMaterial({ color: 0x00ff00, emissive: 0x00ff00 }));
        greenLight.scale.set(0.15, 0.15, 0.15);
        greenLight.position.y = 4.8;
        group.add(greenLight);
        break;
      }
    }

    return { mesh: group };
  }

  setEra(era: EraId): void {
    this.applyEra(era);
  }

  updateTransition(targetEra: EraId, t: number, fromEra: EraId): void {
    const fromSpec = PROP_SPECS[fromEra];
    const toSpec = PROP_SPECS[targetEra];

    // Update road color
    const roadColor = fromSpec.roadColor.clone().lerp(toSpec.roadColor, t);
    const roadMat = this.roadMesh.material as THREE.MeshStandardMaterial;
    roadMat.color.copy(roadColor);

    // Update sidewalk colors
    const sidewalkColor = fromSpec.sidewalkColor.clone().lerp(toSpec.sidewalkColor, t);
    for (const sidewalk of this.sidewalkMeshes) {
      const mat = sidewalk.material as THREE.MeshStandardMaterial;
      mat.color.copy(sidewalkColor);
    }

    // Update lamp colors
    const lampColor = fromSpec.lampColor.clone().lerp(toSpec.lampColor, t);
    const lampIntensity = THREE.MathUtils.lerp(fromSpec.lampIntensity, toSpec.lampIntensity, t);

    for (const prop of this.props) {
      if (prop.type === 'lamp') {
        prop.mesh.traverse(child => {
          if (child instanceof THREE.Mesh) {
            const mat = child.material as THREE.MeshStandardMaterial;
            if (mat.emissive) {
              mat.color.copy(lampColor);
              mat.emissive.copy(lampColor);
              mat.emissiveIntensity = lampIntensity;
            }
          }
        });
      }
    }
  }

  private applyEra(era: EraId): void {
    const spec = PROP_SPECS[era];

    // Update road
    const roadMat = this.roadMesh.material as THREE.MeshStandardMaterial;
    roadMat.color.copy(spec.roadColor);

    // Update sidewalks
    const sidewalkColor = spec.sidewalkColor;
    for (const sidewalk of this.sidewalkMeshes) {
      const mat = sidewalk.material as THREE.MeshStandardMaterial;
      mat.color.copy(sidewalkColor);
    }

    // Update lamp colors
    for (const prop of this.props) {
      if (prop.type === 'lamp') {
        prop.mesh.traverse(child => {
          if (child instanceof THREE.Mesh) {
            const mat = child.material as THREE.MeshStandardMaterial;
            if (mat.emissive) {
              mat.color.copy(spec.lampColor);
              mat.emissive.copy(spec.lampColor);
              mat.emissiveIntensity = spec.lampIntensity;
            }
          }
        });
      }
    }
  }

  update(_dt: number, _state: AppState): void {
    // Traffic light cycling
    const time = Date.now() * 0.001;
    for (const prop of this.props) {
      if (prop.type === 'traffic_light') {
        const lights = prop.mesh.children.filter(c => c instanceof THREE.Mesh && c.scale.x === 0.15);
        if (lights.length === 3) {
          const phase = Math.floor(time % 6);
          const red = lights[0] as THREE.Mesh;
          const yellow = lights[1] as THREE.Mesh;
          const green = lights[2] as THREE.Mesh;

          const redMat = red.material as THREE.MeshStandardMaterial;
          const yellowMat = yellow.material as THREE.MeshStandardMaterial;
          const greenMat = green.material as THREE.MeshStandardMaterial;

          if (phase < 3) {
            redMat.emissive.setHex(0xff0000);
            yellowMat.emissive.setHex(0x300);
            greenMat.emissive.setHex(0x000);
          } else if (phase < 4) {
            redMat.emissive.setHex(0x300);
            yellowMat.emissive.setHex(0xffff00);
            greenMat.emissive.setHex(0x000);
          } else {
            redMat.emissive.setHex(0x300);
            yellowMat.emissive.setHex(0x300);
            greenMat.emissive.setHex(0x00ff00);
          }
        }
      }
    }
  }

  dispose(): void {
    this.cylinderGeometry.dispose();
    this.boxGeometry.dispose();
    this.sphereGeometry.dispose();
    this.coneGeometry.dispose();
    this.planeGeometry.dispose();
    this.group.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
    this.scene.remove(this.group);
  }
}
