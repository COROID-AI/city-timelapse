/**
 * Billboards / ads — per-era crossfading canvased faces.
 *
 * Each billboard spot hosts a stack of ERA_COUNT planes, one per era, each with
 * its own procedurally generated ad texture. Opacity crossfades between the two
 * adjacent eased-era samples so an ad morphs in place as the era sweeps. Emissive
 * intensity scales with the era's billboard glow.
 */

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { BILLBOARD_SPOTS } from "./layout";
import { ERAS } from "../data/eras";
import { eraState } from "../runtime/eraState";
import { buildBillboardTexture } from "../utils/textures";
import { variantOpacity } from "../utils/interp";
import type { InterpolatedEra } from "../utils/interp";

export function Billboards({
  rt,
}: {
  rt: React.RefObject<{ era: InterpolatedEra; clock: number }>;
}) {
  const spots = useMemo(() => BILLBOARD_SPOTS, []);
  // precompute textures: one per (spot, era)
  const texGrid = useMemo(
    () =>
      spots.map((_s, si) =>
        ERAS.map((era, ei) =>
          buildBillboardTexture({
            palette: era.billboards.palette,
            text: era.billboards.text,
            emissive: era.billboards.emissive,
            seed: si * 100 + ei + 1,
          })
        )
      ),
    [spots]
  );

  const matRefs = useRef<(THREE.MeshBasicMaterial | null)[][]>([]);

  useFrame(() => {
    const e = rt.current.era;
    const ef = eraState.eraFloat;
    for (let si = 0; si < spots.length; si++) {
      const row = matRefs.current[si];
      if (!row) continue;
      for (let ei = 0; ei < ERAS.length; ei++) {
        const m = row[ei];
        if (!m) continue;
        const op = variantOpacity(ef, ei);
        const era = ERAS[ei]!;
        m.opacity = op;
        m.toneMapped = era.billboards.emissive < 0.5;
      }
    }
    void e;
  });

  return (
    <group>
      {spots.map((spot, si) => (
        <group key={si} position={[spot.x, spot.y, spot.z]}>
          {/* Support arm */}
          <mesh position={[-0.4, -spot.h / 2, 0]} castShadow>
            <boxGeometry args={[0.3, spot.h, 0.3]} />
            <meshStandardMaterial color="#333" roughness={0.6} metalness={0.4} />
          </mesh>
          {ERAS.map((_, ei) => (
            <mesh
              key={ei}
              position={[0, 0, 0]}
              rotation={[0, -Math.PI / 2, 0]}
            >
              <planeGeometry args={[spot.w, spot.h]} />
              <meshBasicMaterial
                ref={(el) => {
                  if (!matRefs.current[si]) matRefs.current[si] = [];
                  matRefs.current[si]![ei] = el;
                }}
                map={texGrid[si]![ei]!}
                transparent
                opacity={ei === 4 ? 1 : 0}
                side={THREE.DoubleSide}
                toneMapped={false}
              />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}
