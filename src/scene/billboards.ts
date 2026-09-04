// Billboard module — era-specific advertisement boards with procedural
// text canvases. Copy changes per era and emissive glow matches the mood.

import * as THREE from 'three';
import type { EraId } from '../eras';
import type { AppState } from '../state';
import type { SceneModule } from './module';
import { getMood } from '../mood';
import { makeTextTexture } from './textures';

const ERA_AD_COPY: Record<EraId, string[]> = {
  '1945': ['WAR BONDS', 'VICTORY GARDEN', 'COCA-COLA 5\u00A2'],
  '1965': ['DRIVE-IN TONIGHT', 'FREE PARKING', 'PASTEL PALACE'],
  '1985': ['VIDEO ARCADE', 'NEW! WALKMAN', 'SAVE 25%'],
  '2005': ['iPOD', 'BROADBAND IS HERE', 'GLOBAL FIBER'],
  '2025': ['NEXUS AI', 'MARS COLONY', 'E-SCOOTERS 24/7'],
};

interface Billboard {
  mesh: THREE.Mesh;
  mat: THREE.MeshStandardMaterial;
  glow: THREE.MeshBasicMaterial;
  disposedTextures: THREE.Texture[];
}

export class BillboardsModule implements SceneModule {
  readonly name = 'billboards';
  readonly group: THREE.Group = new THREE.Group();

  private boards: Billboard[] = [];
  private lastMoodT = Number.NaN;

  constructor() {
    const frameGeo = new THREE.BoxGeometry(6, 0.5, 0.5);
    const frameMat = new THREE.MeshStandardMaterial({ color: '#1a1a20', roughness: 0.6 });
    const panelGeo = new THREE.PlaneGeometry(5.4, 3.0);
    const legGeo = new THREE.CylinderGeometry(0.15, 0.2, 5.2, 8);

    const positions: Array<[number, number, number]> = [
      [34, 0, -42],
      [-36, 0, 38],
      [36, 0, 30],
    ];

    for (const [x, y, z] of positions) {
      const frame = new THREE.Mesh(frameGeo, frameMat);
      frame.position.set(x, y + 6.2, z);
      this.group.add(frame);

      const glow = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5 });
      const mat = new THREE.MeshStandardMaterial({
        color: '#cccccc',
        roughness: 0.4,
        emissive: '#111111',
        emissiveIntensity: 0.5,
      });
      const panel = new THREE.Mesh(panelGeo, mat);
      panel.position.set(x, y + 5.2, z);
      panel.rotation.y = x > 0 ? -Math.PI / 2 : Math.PI / 2;
      this.group.add(panel);
      // glow disc behind panel
      const glowDisc = new THREE.Mesh(panelGeo, glow);
      glowDisc.position.copy(panel.position);
      glowDisc.position.y -= 0.4;
      glowDisc.rotation.copy(panel.rotation);
      this.group.add(glowDisc);

      const leg = new THREE.Mesh(legGeo, frameMat);
      leg.position.set(x, y + 2.6, z);
      this.group.add(leg);

      this.boards.push({ mesh: panel, mat, glow, disposedTextures: [] });
    }

    frameGeo.dispose();
    panelGeo.dispose();
    legGeo.dispose();
    frameMat.dispose();
  }

  setEra(era: EraId): void {
    const mood = getMood(era);
    const copies = ERA_AD_COPY[era];
    this.boards.forEach((b, i) => {
      b.disposedTextures.forEach((t) => t.dispose());
      b.disposedTextures.length = 0;
      const text = copies[i % copies.length];
      const tex = makeTextTexture(
        [{ text, fontSize: 90, color: mood.posterFg, bold: true }],
        mood.posterBg,
        512,
        256,
      );
      b.mat.map = tex;
      b.mat.color.set(mood.posterBg);
      b.mat.emissive.set(mood.posterAccent);
      b.mat.emissiveIntensity = 0.8;
      b.mat.needsUpdate = true;
      b.glow.color.set(mood.posterAccent);
      b.glow.opacity = 0.35 + mood.sky.neonWash * 0.5;
      b.disposedTextures.push(tex);
    });
  }

  update(_dt: number, state: AppState): void {
    const ft = state.eraFloat;
    if (ft === this.lastMoodT) return;
    this.lastMoodT = ft;
    const mood = getMood(state.era);
    for (const b of this.boards) {
      b.glow.color.set(mood.posterAccent);
      b.glow.opacity = 0.3 + mood.sky.neonWash * 0.55;
    }
  }

  dispose(): void {
    this.boards.forEach((b) => {
      b.mesh.geometry.dispose();
      b.mat.dispose();
      b.glow.dispose();
      b.disposedTextures.forEach((t) => t.dispose());
    });
  }
}