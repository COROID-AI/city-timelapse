import React, { useMemo } from 'react';
import { Group } from 'three';
import { EraConfig } from '../data/eraData';
import Block from './Block';
import Road from './Road';
import Trees from './Trees';
import SkyDome from './SkyDome';

interface CitySceneProps {
  era: number;
  config: EraConfig;
}

const CityScene: React.FC<CitySceneProps> = React.memo(({ era, config }) => {
  const blocks = useMemo(() => {
    const positions: [number, number, number][] = [];
    const gridSize = 4;
    const spacing = 35;
    const offset = (gridSize - 1) * spacing / 2;
    for (let x = 0; x < gridSize; x++) {
      for (let z = 0; z < gridSize; z++) {
        positions.push([x * spacing - offset, 0, z * spacing - offset]);
      }
    }
    return positions;
  }, []);

  const roadPositions = useMemo(() => {
    const roads: { start: [number, number, number]; end: [number, number, number]; width: number }[] = [];
    const gridSize = 4;
    const spacing = 35;
    const offset = (gridSize - 1) * spacing / 2;
    // Horizontal roads
    for (let z = 0; z < gridSize; z++) {
      roads.push({ start: [offset - 5, 0.05, z * spacing - offset], end: [-offset + 5, 0.05, z * spacing - offset], width: 14 });
    }
    // Vertical roads
    for (let x = 0; x < gridSize; x++) {
      roads.push({ start: [x * spacing - offset, 0.05, offset - 5], end: [x * spacing - offset, 0.05, -offset + 5], width: 14 });
    }
    return roads;
  }, []);

  return (
    <group>
      <SkyDome color={config.skyColor} />
      {blocks.map((pos, i) => (
        <Block key={`block-${i}`} position={pos} era={era} config={config} seed={i} />
      ))}
      {roadPositions.map((road, i) => (
        <Road key={`road-${i}`} start={road.start} end={road.end} width={road.width} color={config.roadColor} era={era} />
      ))}
      <Trees config={config} />
    </group>
  );
});

export default CityScene;
