import React from 'react';
import { useEra } from '../contexts/EraContext';
import { ERA_CONFIGS } from '../config/eras';

export const EraInfo: React.FC = () => {
  const { currentEra } = useEra();
  const config = ERA_CONFIGS[currentEra];

  return (
    <div className="era-info">
      <div className="era-title">{config.label} ({config.year})</div>
      <div className="era-description">{config.description}</div>
    </div>
  );
};