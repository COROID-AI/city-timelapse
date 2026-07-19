import { useMemo } from 'react'
import { EraType, ERA_CONFIGS, EraConfig } from '../types/era'

export function useEraConfig(era: number): { config: EraConfig } {
  return useMemo(() => {
    const eraKey = era as EraType
    return {
      config: ERA_CONFIGS[eraKey] || ERA_CONFIGS[1945]
    }
  }, [era])
}