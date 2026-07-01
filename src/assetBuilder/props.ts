import * as THREE from 'three';
import { EraProp } from '../eras/types';

export interface BuiltProp {
  group: THREE.Group;
  dispose: () => void;
}

export function makeProp(prop: EraProp): BuiltProp {
  const group = new THREE.Group();
  const disposables: { dispose: () => void }[] = [];

  switch (prop.kind) {
    case 'lamp_wood':
    case 'lamp_steel': {
      const mat = new THREE.MeshStandardMaterial({ color: prop.color, roughness: 0.8 });
      disposables.push(mat);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 5, 8), mat);
      pole.position.y = 2.5;
      group.add(pole);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 0.1), mat);
      arm.position.set(0.6, 4.9, 0);
      group.add(arm);
      const lampMat = new THREE.MeshStandardMaterial({
        color: '#fff0c0',
        emissive: '#ffd070',
        emissiveIntensity: 1.2,
        toneMapped: false,
      });
      disposables.push(lampMat);
      const lampHead = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), lampMat);
      lampHead.position.set(1.1, 4.85, 0);
      group.add(lampHead);
      const geoDispose = () => {
        pole.geometry.dispose();
        arm.geometry.dispose();
        lampHead.geometry.dispose();
      };
      return { group, dispose: () => { disposables.forEach((d) => d.dispose()); geoDispose(); } };
    }
    case 'newsbox': {
      const mat = new THREE.MeshStandardMaterial({ color: prop.color, roughness: 0.85 });
      disposables.push(mat);
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.1, 0.5), mat);
      box.position.y = 0.55;
      group.add(box);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.1, 0.6), mat);
      cap.position.y = 1.15;
      group.add(cap);
      return { group, dispose: () => { disposables.forEach((d) => d.dispose()); box.geometry.dispose(); cap.geometry.dispose(); } };
    }
    case 'neon_sign': {
      const mat = new THREE.MeshStandardMaterial({
        color: prop.color,
        emissive: prop.color,
        emissiveIntensity: 1.6,
        toneMapped: false,
      });
      disposables.push(mat);
      const tube = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.06, 8, 24), mat);
      tube.position.y = 2.6;
      group.add(tube);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, 0.1), mat);
      bar.position.y = 2.0;
      group.add(bar);
      return { group, dispose: () => { disposables.forEach((d) => d.dispose()); tube.geometry.dispose(); bar.geometry.dispose(); } };
    }
    case 'phone_kiosk': {
      const mat = new THREE.MeshStandardMaterial({ color: prop.color, roughness: 0.6, metalness: 0.4 });
      disposables.push(mat);
      const kiosk = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.4, 0.9), mat);
      kiosk.position.y = 1.2;
      group.add(kiosk);
      const glow = new THREE.Mesh(
        new THREE.PlaneGeometry(0.7, 1.6),
        new THREE.MeshStandardMaterial({ color: '#a0d0f0', emissive: '#a0d0f0', emissiveIntensity: 1.0, toneMapped: false }),
      );
      glow.position.set(0, 1.3, 0.46);
      group.add(glow);
      const glowMat = glow.material as THREE.MeshStandardMaterial;
      disposables.push(glowMat);
      return {
        group,
        dispose: () => { disposables.forEach((d) => d.dispose()); kiosk.geometry.dispose(); glow.geometry.dispose(); },
      };
    }
    case 'hologram': {
      const mat = new THREE.MeshStandardMaterial({
        color: prop.color,
        emissive: prop.color,
        emissiveIntensity: 2.0,
        transparent: true,
        opacity: 0.7,
        toneMapped: false,
      });
      disposables.push(mat);
      const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.05, 8, 32), mat);
      ring1.position.y = 2.5;
      ring1.rotation.x = Math.PI / 2;
      group.add(ring1);
      const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.05, 8, 32), mat);
      ring2.position.y = 2.5;
      group.add(ring2);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.3, 2.5, 12, 1, true), mat);
      beam.position.y = 1.25;
      group.add(beam);
      const geoDispose = () => {
        ring1.geometry.dispose();
        ring2.geometry.dispose();
        beam.geometry.dispose();
      };
      // spin slowly via userData flag read by scene loop
      group.userData.spin = true;
      return { group, dispose: () => { disposables.forEach((d) => d.dispose()); geoDispose(); } };
    }
    case 'planter': {
      const mat = new THREE.MeshStandardMaterial({ color: prop.color, roughness: 0.9 });
      disposables.push(mat);
      const box = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.5, 1.0), mat);
      box.position.y = 0.25;
      group.add(box);
      const leafMat = new THREE.MeshStandardMaterial({ color: '#3a6a3a', roughness: 0.9 });
      disposables.push(leafMat);
      for (let i = 0; i < 4; i++) {
        const bush = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), leafMat);
        bush.position.set((Math.random() - 0.5) * 0.7, 0.55, (Math.random() - 0.5) * 0.7);
        group.add(bush);
      }
      return {
        group,
        dispose: () => {
          disposables.forEach((d) => d.dispose());
          box.geometry.dispose();
          group.traverse((o) => {
            if (o instanceof THREE.Mesh && o.geometry.type === 'SphereGeometry') o.geometry.dispose();
          });
        },
      };
    }
  }
}
