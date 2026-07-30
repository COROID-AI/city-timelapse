import React, { useMemo } from 'react';
import { Group } from 'three';
import { EraConfig } from '../data/eraData';
import Building from './Building';
import Vehicle from './Vehicle';
import Pedestrian from './Pedestrian';
import Storefront from './Storefront';
import Billboard from './Billboard';

interface BuildingsCollectionProps {
  position: [number, number, number];
  era: number;
  config: EraConfig;
  seed: number;
}

const BuildingsCollection: React.FC<BuildingsCollectionProps> = React.memo(({ position, era, config, seed }) => {
  const buildings = useMemo(() => {
    const count = 3 + Math.floor(Math.abs(seed * 7 + seed) % 4);
    const blds: { pos: [number, number, number]; w: number; d: number; h: number; colorIndex: number }[] = [];
    const baseX = position[0] - 12;
    const baseZ = position[2] - 12;
    for (let i = 0; i < count; i++) {
      const w = 5 + Math.abs((seed * 13 + i * 7) % 8);
      const d = 5 + Math.abs((seed * 11 + i * 3) % 8);
      const h = (4 + Math.abs((seed * 17 + i * 11) % 20)) * config.buildingHeightMultiplier;
      const angle = i * 0.3;
      blds.push({
        pos: [baseX + i * (w + 2) + Math.sin(angle) * 2, 0, baseZ + Math.cos(angle) * 2],
        w, d, h,
        colorIndex: (seed + i) % config.buildingColors.length,
      });
    }
    return blds;
  }, [position, seed, config]);

  return (
    <>
      {buildings.map((b, i) => (
        <Building
          key={`bld-${i}`}
          position={b.pos}
          width={b.w}
          depth={b.d}
          height={b.h}
          colorIndex={b.colorIndex}
          config={config}
          seed={seed * 10 + i}
        />
      ))}
    </>
  );
});

interface BlockVehiclesProps {
  position: [number, number, number];
  config: EraConfig;
  seed: number;
}

const BlockVehicles: React.FC<BlockVehiclesProps> = React.memo(({ position, config, seed }) => {
  const vehicles = useMemo(() => {
    const v: { pos: [number, number, number]; rotation: number; colorIndex: number }[] = [];
    const count = Math.max(1, Math.floor(config.vehicleCount / 6));
    for (let i = 0; i < count; i++) {
      const lane = position[2] - 6 + (i % 3) * 6;
      const x = position[0] - 10 + (i * 7) % 20;
      v.push({
        pos: [x, 0.5, lane],
        rotation: i % 2 === 0 ? Math.PI / 2 : -Math.PI / 2,
        colorIndex: i % 3,
      });
    }
    return v;
  }, [position, config.vehicleCount, seed]);

  return (
    <>
      {vehicles.map((v, i) => (
        <Vehicle key={`veh-${i}`} position={v.pos} rotation={v.rotation} colorIndex={v.colorIndex} config={config} />
      ))}
    </>
  );
});

interface BlockPedestriansProps {
  position: [number, number, number];
  config: EraConfig;
  seed: number;
}

const BlockPedestrians: React.FC<BlockPedestriansProps> = React.memo(({ position, config, seed }) => {
  const pedestrians = useMemo(() => {
    const p: { pos: [number, number, number]; colorIndex: number }[] = [];
    const count = Math.max(1, Math.floor(config.pedestrianCount / 8));
    for (let i = 0; i < count; i++) {
      p.push({
        pos: [position[0] + (Math.sin(seed + i) * 10), 0, position[2] + (Math.cos(seed + i) * 10)],
        colorIndex: i % 4,
      });
    }
    return p;
  }, [position, config.pedestrianCount, seed]);

  return (
    <>
      {pedestrians.map((p, i) => (
        <Pedestrian key={`ped-${i}`} position={p.pos as [number, number, number]} colorIndex={p.colorIndex} config={config} />
      ))}
    </>
  );
});

interface BlockStorefrontsProps {
  buildings: { pos: [number, number, number]; w: number; d: number; h: number; colorIndex: number }[];
  config: EraConfig;
  seed: number;
}

const BlockStorefronts: React.FC<BlockStorefrontsProps> = React.memo(({ buildings, config, seed }) => {
  const storefronts = useMemo(() => {
    return buildings.slice(0, 2).map((b, i) => ({
      ...b,
      storefrontZ: b.pos[2] + b.d / 2 + 1,
    }));
  }, [buildings]);

  return (
    <>
      {storefronts.map((s, i) => (
        <Storefront key={`store-${i}`} position={[s.pos[0], 0, s.storefrontZ]} width={s.w} config={config} seed={seed * 5 + i} />
      ))}
    </>
  );
});

interface BlockBillboardsProps {
  buildings: { pos: [number, number, number]; w: number; d: number; h: number; colorIndex: number }[];
  config: EraConfig;
  seed: number;
}

const BlockBillboards: React.FC<BlockBillboardsProps> = React.memo(({ buildings, config, seed }) => {
  const billboards = useMemo(() => {
    if (config.billboardCount === 0) return [];
    return buildings.slice(0, Math.min(2, config.billboardCount)).map((b, i) => ({
      pos: [b.pos[0], b.h + 3, b.pos[2]],
    }));
  }, [buildings, config.billboardCount]);

  return (
    <>
      {billboards.map((bp, i) => (
        <Billboard key={`bb-${i}`} position={bp.pos as [number, number, number]} config={config} seed={seed * 3 + i} />
      ))}
    </>
  );
});

interface BlockProps {
  position: [number, number, number];
  era: number;
  config: EraConfig;
  seed: number;
}

const Block: React.FC<BlockProps> = React.memo(({ position, era, config, seed }) => {
  const buildings = useMemo(() => {
    const count = 3 + Math.floor(Math.abs(seed * 7 + seed) % 4);
    const blds: { pos: [number, number, number]; w: number; d: number; h: number; colorIndex: number }[] = [];
    const baseX = position[0] - 12;
    const baseZ = position[2] - 12;
    for (let i = 0; i < count; i++) {
      const w = 5 + Math.abs((seed * 13 + i * 7) % 8);
      const d = 5 + Math.abs((seed * 11 + i * 3) % 8);
      const h = (4 + Math.abs((seed * 17 + i * 11) % 20)) * config.buildingHeightMultiplier;
      const angle = i * 0.3;
      blds.push({
        pos: [baseX + i * (w + 2) + Math.sin(angle) * 2, 0, baseZ + Math.cos(angle) * 2],
        w, d, h,
        colorIndex: (seed + i) % config.buildingColors.length,
      });
    }
    return blds;
  }, [position, seed, config]);

  return (
    <group position={position}>
      <BuildingsCollection position={position} era={era} config={config} seed={seed} />
      <BlockStorefronts buildings={buildings} config={config} seed={seed} />
      <BlockBillboards buildings={buildings} config={config} seed={seed} />
      <BlockVehicles position={position} config={config} seed={seed} />
      <BlockPedestrians position={position} config={config} seed={seed} />
    </group>
  );
});

export default Block;
