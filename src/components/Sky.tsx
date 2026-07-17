import React from 'react'
import { useEraStore } from '../stores/eraStore'
import { ERA_CONFIGS } from '../lib/types'

interface SkyProps {
  era: string
}

export const Sky: React.FC<SkyProps> = ({ era }) => {
  const config = ERA_CONFIGS.find(c => c.era === era)
  const skyColor = config?.colorPalette.sky || '#87CEEB'

  return (
    <color attach="background" args={[skyColor]} />
  )
}