import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Mesh, MeshStandardMaterial } from 'three';
import { PEDESTRIANS, VEHICLES, VEHICLE_PATH_EXTENT, PED_PATH_EXTENT } from './layout';
import { useSceneState } from './scene-state';
import { useEraStore } from '../lib/store';

/**
 * Moving vehicles and pedestrians. All meshes are mounted once and mutated in
 * place every frame (positions, scales, material uniforms) — zero allocation.
 *
 * Vehicle silhouette continuously interpolates across eras (tall/boxy vintage →
 * low/sleek future), and discrete headlight variants cross-fade based on the
 * fractional displayEra. Under reduced motion, movement stops and transitions
 * snap.
 */

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Cross-fade weights for 3 discrete headlight variants across the era range. */
function headlightWeights(displayEra: number): [number, number, number] {
  const centers = [1.0, 3.0, 5.0];
  const width = 1.8;
  const raw = [
    Math.max(0, 1 - Math.abs(displayEra - centers[0]) / width),
    Math.max(0, 1 - Math.abs(displayEra - centers[1]) / width),
    Math.max(0, 1 - Math.abs(displayEra - centers[2]) / width),
  ];
  const sum = raw[0] + raw[1] + raw[2] || 1;
  return [raw[0] / sum, raw[1] / sum, raw[2] / sum];
}

interface VehicleRefs {
  group: Group | null;
  body: Mesh | null;
  cabin: Mesh | null;
  wheels: Group | null;
  glow: Mesh | null;
}

export function Traffic() {
  const state = useSceneState();
  const reduced = useEraStore((s) => s.reducedMotion || s.prefersReducedMotion);

  const vRefs = useRef<VehicleRefs[]>([]);
  const pRefs = useRef<(Group | null)[]>([]);

  // Stable materials created once.
  const mats = useMemo(() => {
    const body: MeshStandardMaterial[] = VEHICLES.map(
      () => new MeshStandardMaterial({ color: 0x444444, roughness: 0.4, metalness: 0.5 }),
    );
    const headlight: MeshStandardMaterial[] = [
      new MeshStandardMaterial({ color: 0xffeeaa, emissive: 0xffcc66, emissiveIntensity: 1 }),
      new MeshStandardMaterial({ color: 0xffffff, emissive: 0xeef2ff, emissiveIntensity: 1.5 }),
      new MeshStandardMaterial({ color: 0x65f0ff, emissive: 0x65f0ff, emissiveIntensity: 2, transparent: true }),
    ];
    const tail: MeshStandardMaterial[] = VEHICLES.map(
      () => new MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.5 }),
    );
    const glow = new MeshStandardMaterial({
      color: 0x65f0ff,
      emissive: 0x65f0ff,
      emissiveIntensity: 1.5,
      transparent: true,
      opacity: 0.3,
    });
    const ped: MeshStandardMaterial[] = PEDESTRIANS.map(
      () => new MeshStandardMaterial({ color: 0x556677, roughness: 0.8 }),
    );
    return { body, headlight, tail, glow, ped };
  }, []);

  useFrame((_, rawDelta) => {
    const delta = reduced ? 0 : Math.min(rawDelta, 0.05);
    const t = state;
    const era = t.displayEra;
    const tNorm = era / 5;

    // --- Headlight cross-fade (shared materials) ---
    const [w0, w1, w2] = headlightWeights(era);
    const setHead = (idx: number, w: number) => {
      const m = mats.headlight[idx];
      m.opacity = w;
      m.transparent = w < 0.999;
      m.visible = w > 0.01;
    };
    setHead(0, w0);
    setHead(1, w1);
    setHead(2, w2);
    mats.headlight[0].emissiveIntensity = t.headlightIntensity * 1.2;
    mats.headlight[1].emissiveIntensity = t.headlightIntensity * 1.6;
    mats.headlight[2].emissiveIntensity = t.headlightIntensity * 2.0;

    // --- Vehicles ---
    for (let i = 0; i < VEHICLES.length; i++) {
      const v = VEHICLES[i];
      const refs = vRefs.current[i];
      if (!refs?.group) continue;
      const g = refs.group;

      // Travel along path.
      const extent = VEHICLE_PATH_EXTENT * 2;
      const travel = ((v.phase * extent + delta * v.speed * 8 + extent) % extent) - VEHICLE_PATH_EXTENT;
      if (v.axis === 'ns') {
        g.position.set(v.lane, 0, travel);
        g.rotation.y = v.speed > 0 ? Math.PI : 0;
      } else {
        g.position.set(travel, 0, v.lane);
        g.rotation.y = v.speed > 0 ? -Math.PI / 2 : Math.PI / 2;
      }

      // Continuous silhouette: tall/boxy vintage → low/sleek future.
      const scaleY = lerp(1.25, 0.72, tNorm);
      const scaleX = lerp(0.88, 1.18, tNorm);
      g.scale.set(scaleX, scaleY, 1);

      // Body material from era color.
      const bm = mats.body[i];
      bm.color.copy(t.vehicleColor);
      bm.roughness = lerp(0.6, 0.12, tNorm);
      bm.metalness = lerp(0.1, 0.85, tNorm);

      // Tail light intensity grows toward modern eras.
      mats.tail[i].emissiveIntensity = t.headlightIntensity * 0.6;

      // Wheels fade out in future (hover transition).
      if (refs.wheels) {
        refs.wheels.visible = tNorm < 0.8;
        refs.wheels.scale.setScalar(lerp(1, 0.3, Math.max(0, (tNorm - 0.4) / 0.4)));
      }

      // Underglow fades in for future eras.
      if (refs.glow) {
        const gw = Math.max(0, Math.min(1, (era - 3.5) / 1.5));
        refs.glow.visible = gw > 0.01;
        (refs.glow.material as MeshStandardMaterial).opacity = gw * 0.35;
        (refs.glow.material as MeshStandardMaterial).emissiveIntensity = t.headlightIntensity * 1.5;
      }
    }

    // --- Pedestrians ---
    for (let i = 0; i < PEDESTRIANS.length; i++) {
      const p = PEDESTRIANS[i];
      const g = pRefs.current[i];
      if (!g) continue;

      const extent = PED_PATH_EXTENT * 2;
      const travel = ((p.phase * extent + delta * p.speed * 8 + extent) % extent) - PED_PATH_EXTENT;
      if (p.axis === 'ns') {
        g.position.x = p.lane;
        g.position.z = travel;
      } else {
        g.position.x = travel;
        g.position.z = p.lane;
      }
      g.rotation.y = p.speed > 0 ? 0 : Math.PI;

      // Walk bob (disabled under reduced motion).
      g.position.y = reduced ? 0 : Math.abs(Math.sin(performance.now() * 0.006 + i * 1.7)) * 0.06;
    }
  });

  return (
    <group>
      {/* Vehicles */}
      {VEHICLES.map((_v, i) => (
        <group
          key={`v${i}`}
          ref={(el) => {
            vRefs.current[i] = vRefs.current[i] || { group: null, body: null, cabin: null, wheels: null, glow: null };
            vRefs.current[i].group = el;
          }}
        >
          {/* Body */}
          <mesh ref={(el) => { if (vRefs.current[i]) vRefs.current[i].body = el; }} position={[0, 0.55, 0]} material={mats.body[i]} castShadow>
            <boxGeometry args={[2.6, 0.7, 1.2]} />
          </mesh>
          {/* Cabin */}
          <mesh ref={(el) => { if (vRefs.current[i]) vRefs.current[i].cabin = el; }} position={[0, 1.05, 0]} material={mats.body[i]} castShadow>
            <boxGeometry args={[1.4, 0.5, 1.0]} />
          </mesh>
          {/* Wheels (4) */}
          <group ref={(el) => { if (vRefs.current[i]) vRefs.current[i].wheels = el; }}>
            {([-0.85, 0.85] as const).flatMap((wx) =>
              ([-0.62, 0.62] as const).map((wz) => (
                <mesh key={`${wx}-${wz}`} position={[wx, 0.3, wz]} rotation={[0, 0, Math.PI / 2]} castShadow>
                  <cylinderGeometry args={[0.3, 0.3, 0.22, 12]} />
                  <meshStandardMaterial color={0x111111} roughness={0.9} />
                </mesh>
              )),
            )}
          </group>
          {/* Tail lights */}
          <mesh position={[-1.32, 0.5, 0.42]} material={mats.tail[i]}>
            <boxGeometry args={[0.06, 0.08, 0.16]} />
          </mesh>
          <mesh position={[-1.32, 0.5, -0.42]} material={mats.tail[i]}>
            <boxGeometry args={[0.06, 0.08, 0.16]} />
          </mesh>
          {/* Headlights — 3 cross-fading styles */}
          <mesh position={[1.35, 0.5, 0.38]} material={mats.headlight[0]}>
            <sphereGeometry args={[0.12, 8, 8]} />
          </mesh>
          <mesh position={[1.35, 0.5, -0.38]} material={mats.headlight[0]}>
            <sphereGeometry args={[0.12, 8, 8]} />
          </mesh>
          <mesh position={[1.33, 0.5, 0]} material={mats.headlight[1]}>
            <boxGeometry args={[0.06, 0.1, 0.95]} />
          </mesh>
          <mesh position={[1.34, 0.5, 0]} material={mats.headlight[2]}>
            <boxGeometry args={[0.04, 0.05, 1.05]} />
          </mesh>
          {/* Underglow (future) */}
          <mesh
            ref={(el) => { if (vRefs.current[i]) vRefs.current[i].glow = el; }}
            position={[0, 0.08, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            material={mats.glow}
            visible={false}
          >
            <planeGeometry args={[2.4, 1.0]} />
          </mesh>
        </group>
      ))}

      {/* Pedestrians */}
      {PEDESTRIANS.map((_p, i) => (
        <group
          key={`p${i}`}
          ref={(el) => {
            pRefs.current[i] = el;
          }}
        >
          <mesh position={[0, 0.9, 0]} material={mats.ped[i]} castShadow>
            <capsuleGeometry args={[0.16, 0.5, 4, 8]} />
          </mesh>
          <mesh position={[0, 1.4, 0]} material={mats.ped[i]} castShadow>
            <sphereGeometry args={[0.15, 8, 8]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
