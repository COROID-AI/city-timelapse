import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, Group, MeshStandardMaterial, PointLight } from 'three';
import { LAMPS, TRAFFIC_LIGHTS } from './layout';
import { useSceneState } from './scene-state';
import { useEraStore } from '../lib/store';

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Street props: lamps with era-evolving luminaire shapes, traffic lights, and
 * neon/glass signage whose colour and visibility evolve per era.
 *
 * All meshes mount once; per-frame mutation drives colour, light intensity, and
 * per-era element cross-fade (opacity/visibility) — no remounts.
 */
export function StreetProps() {
  const state = useSceneState();
  const reduced = useEraStore((s) => s.reducedMotion || s.prefersReducedMotion);

  const lampBulbMats = useMemo<MeshStandardMaterial[]>(
    () =>
      LAMPS.map(() => new MeshStandardMaterial({ color: 0xffe9b0, emissive: 0xffd680, emissiveIntensity: 1 })),
    [],
  );
  const lampLights = useRef<(PointLight | null)[]>([]);
  const bulbMeshes = useRef<(Group | null)[]>([]);

  // Traffic light materials (red/yellow/green).
  const tlMats = useMemo(
    () => ({
      r: new MeshStandardMaterial({ color: 0xff2222, emissive: 0xff0000, emissiveIntensity: 0.4 }),
      y: new MeshStandardMaterial({ color: 0xffcc22, emissive: 0xffaa00, emissiveIntensity: 0.2 }),
      g: new MeshStandardMaterial({ color: 0x22ff44, emissive: 0x00cc22, emissiveIntensity: 0.4 }),
      housing: new MeshStandardMaterial({ color: 0x222222, roughness: 0.7, metalness: 0.4 }),
    }),
    [],
  );
  const tlGroups = useRef<(Group | null)[]>([]);

  // Signage — neon billboards whose colour and visibility evolve per era.
  const signageMats = useMemo(() => {
    const colors = [0xff3366, 0x33ccff, 0xffcc00, 0xff6600, 0x33ff99, 0xcc66ff, 0x00ddff, 0xff0099];
    return colors.map(
      (c) => new MeshStandardMaterial({ color: c, emissive: new Color(c), emissiveIntensity: 0.5, transparent: true }),
    );
  }, []);
  const signageMeshes = useRef<(Group | null)[]>([]);

  useFrame(() => {
    const t = state;
    const era = t.displayEra;
    const night = Math.max(0, Math.min(1, (t.windowEmissive - 0.2) / 1.0));

    // --- Lamps ---
    for (let i = 0; i < LAMPS.length; i++) {
      const m = lampBulbMats[i];
      m.emissiveIntensity = t.streetlightIntensity * (1.2 + night);
      const light = lampLights.current[i];
      if (light) light.intensity = reduced ? 0 : t.streetlightIntensity * 8 * night;
    }

    // --- Traffic lights (cycle slowly; disabled anim under reduced motion) ---
    const cyclePos = reduced ? 0 : (performance.now() * 0.0005) % 3;
    tlMats.r.emissiveIntensity = cyclePos < 1 ? 1.0 : 0.05;
    tlMats.y.emissiveIntensity = cyclePos >= 1 && cyclePos < 2 ? 1.0 : 0.05;
    tlMats.g.emissiveIntensity = cyclePos >= 2 ? 1.0 : 0.05;
    // Modern eras have brighter lights.
    const tlBoost = lerp(0.5, 1.5, era / 5);

    // --- Signage: fades in from era ~2 (1980s) onward ---
    for (let i = 0; i < signageMats.length; i++) {
      const m = signageMats[i];
      const sigEra = 2 + (i % 3); // each sign activates at a different era
      const visibility = Math.max(0, Math.min(1, (era - sigEra + 0.5) / 0.8));
      m.opacity = visibility;
      m.visible = visibility > 0.01;
      m.emissiveIntensity = (0.6 + night * 1.5) * visibility * tlBoost;
    }
  });

  return (
    <group>
      {/* Street lamps */}
      {LAMPS.map((lamp, i) => (
        <group key={`lamp${i}`} position={[lamp.x, 0, lamp.z]} rotation={[0, lamp.rot, 0]}>
          {/* Pole */}
          <mesh position={[0, 2.5, 0]} castShadow>
            <cylinderGeometry args={[0.08, 0.1, 5, 8]} />
            <meshStandardMaterial color={0x2a2a2e} roughness={0.6} metalness={0.5} />
          </mesh>
          {/* Arm */}
          <mesh position={[0.7, 4.9, 0]} castShadow>
            <boxGeometry args={[1.4, 0.08, 0.08]} />
            <meshStandardMaterial color={0x2a2a2e} roughness={0.6} metalness={0.5} />
          </mesh>
          {/* Luminaire group (era-evolving handled by material intensity) */}
          <group ref={(el) => { bulbMeshes.current[i] = el; }} position={[1.4, 4.85, 0]}>
            <mesh material={lampBulbMats[i]}>
              <sphereGeometry args={[0.18, 10, 10]} />
            </mesh>
          </group>
          {/* Era-specific housing: ornate (old) vs sleek (new) */}
          <mesh position={[1.4, 5.0, 0]}>
            <boxGeometry args={[0.5, 0.12, 0.25]} />
            <meshStandardMaterial color={0x1a1a1e} roughness={0.5} metalness={0.6} />
          </mesh>
          <pointLight
            ref={(el) => { lampLights.current[i] = el; }}
            position={[1.4, 4.6, 0]}
            color={'#ffd699'}
            distance={14}
            decay={2}
          />
        </group>
      ))}

      {/* Traffic lights at intersection corners */}
      {TRAFFIC_LIGHTS.map((tl, i) => (
        <group key={`tl${i}`} ref={(el) => { tlGroups.current[i] = el; }} position={[tl.x, 0, tl.z]} rotation={[0, tl.rot, 0]}>
          <mesh position={[0, 2.5, 0]} castShadow>
            <cylinderGeometry args={[0.06, 0.08, 5, 8]} />
            <meshStandardMaterial color={0x222226} roughness={0.6} metalness={0.5} />
          </mesh>
          <mesh position={[0, 4.2, 0.3]} material={tlMats.housing} castShadow>
            <boxGeometry args={[0.25, 0.75, 0.25]} />
          </mesh>
          <mesh position={[0, 4.5, 0.43]} material={tlMats.r}>
            <sphereGeometry args={[0.07, 8, 8]} />
          </mesh>
          <mesh position={[0, 4.25, 0.43]} material={tlMats.y}>
            <sphereGeometry args={[0.07, 8, 8]} />
          </mesh>
          <mesh position={[0, 4.0, 0.43]} material={tlMats.g}>
            <sphereGeometry args={[0.07, 8, 8]} />
          </mesh>
        </group>
      ))}

      {/* Neon signage / billboards on building faces (era-evolving) */}
      {[
        { x: 13.1, z: 7.5, w: 4, h: 1.5, ry: -Math.PI / 2 },
        { x: -7.5, z: 13.1, w: 4, h: 1.5, ry: 0 },
        { x: 7.5, z: -13.1, w: 4, h: 1.5, ry: Math.PI },
        { x: -13.1, z: -7.5, w: 4, h: 1.5, ry: Math.PI / 2 },
        { x: 26.1, z: 10, w: 5, h: 2, ry: -Math.PI / 2 },
        { x: -10, z: 26.1, w: 5, h: 2, ry: 0 },
        { x: -26.1, z: -10, w: 5, h: 2, ry: Math.PI / 2 },
        { x: 10, z: -26.1, w: 5, h: 2, ry: Math.PI },
      ].map((sign, i) => (
        <group
          key={`sign${i}`}
          ref={(el) => { signageMeshes.current[i] = el; }}
          position={[sign.x, 4 + (i % 3) * 2, sign.z]}
          rotation={[0, sign.ry, 0]}
          visible={false}
        >
          <mesh material={signageMats[i]}>
            <planeGeometry args={[sign.w, sign.h]} />
          </mesh>
          {/* Inner detail stripes for a "screen" look */}
          <mesh position={[0, 0, 0.01]}>
            <planeGeometry args={[sign.w * 0.8, sign.h * 0.3]} />
            <meshBasicMaterial color={0xffffff} transparent opacity={0.12} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
