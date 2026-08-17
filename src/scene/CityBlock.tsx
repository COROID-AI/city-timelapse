import * as THREE from 'three';
import { useMemo } from 'react';
import type { EraInfo } from '../eras/types';
import { Building } from './Buildings';
import { Storefronts } from './Storefronts';
import { Billboards } from './Billboards';
import { POI } from './POI';

interface CityBlockProps {
  era: EraInfo;
}

export function CityBlock({ era }: CityBlockProps) {
  // Building definitions for each quadrant
  const buildings = useMemoBuildings(era);

  return (
    <group>
      {/* Buildings in each quadrant */}
      {buildings.map(b => (
        <Building key={b.id} {...b} era={era} />
      ))}

      {/* Storefronts at corners */}
      {[0, 1, 2, 3].map(q => (
        <Storefronts key={`sf-${q}`} era={era} quadrant={q} />
      ))}

      {/* Billboards */}
      <Billboards era={era} />

      {/* Points of interest */}
      <POI
        era={era}
        position={[0, 5, 0]}
        name="city-center"
        description="The heart of the city block"
      />
    </group>
  );
}

interface BuildingDef {
  id: string;
  position: [number, number, number];
  scale: [number, number, number];
}

function useMemoBuildings(era: EraInfo): BuildingDef[] {
  const defs: BuildingDef[] = [];
  let id = 0;

  // Quadrant 0 (NE) - taller buildings
  defs.push({
    id: `b-0-${id++}`,
    position: [25, 0, 25],
    scale: [8, 20 + Math.random() * 10, 6],
  });
  defs.push({
    id: `b-1-${id++}`,
    position: [25, 0, 15],
    scale: [6, 15 + Math.random() * 8, 5],
  });

  // Quadrant 1 (NW)
  defs.push({
    id: `b-0-${id++}`,
    position: [-25, 0, 25],
    scale: [7, 18 + Math.random() * 12, 7],
  });
  defs.push({
    id: `b-1-${id++}`,
    position: [-25, 0, 15],
    scale: [5, 12 + Math.random() * 6, 4],
  });

  // Quadrant 2 (SW)
  defs.push({
    id: `b-0-${id++}`,
    position: [-25, 0, -25],
    scale: [9, 22 + Math.random() * 8, 6],
  });
  defs.push({
    id: `b-1-${id++}`,
    position: [-25, 0, -15],
    scale: [6, 14 + Math.random() * 10, 5],
  });

  // Quadrant 3 (SE)
  defs.push({
    id: `b-0-${id++}`,
    position: [25, 0, -25],
    scale: [7, 16 + Math.random() * 14, 6],
  });
  defs.push({
    id: `b-1-${id++}`,
    position: [25, 0, -15],
    scale: [5, 10 + Math.random() * 8, 4],
  });

  // Era-specific megastructures
  if (era.year === 2055) {
    defs.push({
      id: `mega-0`,
      position: [0, 0, 0],
      scale: [12, 50, 12],
    });
  }

  return defs;
}
