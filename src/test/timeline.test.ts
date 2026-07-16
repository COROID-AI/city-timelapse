import { describe, it, expect } from 'vitest'
import { ERA_CONFIGS, ERA_LABELS, ERAS } from '../stores/types'

describe('Timeline Store Types', () => {
  it('should have all 6 eras', () => {
    expect(ERAS).toHaveLength(6)
    expect(ERAS).toContain('1945')
    expect(ERAS).toContain('1965')
    expect(ERAS).toContain('1985')
    expect(ERAS).toContain('2005')
    expect(ERAS).toContain('2025')
    expect(ERAS).toContain('2055')
  })

  it('should have era labels', () => {
    expect(ERA_LABELS['1945']).toContain('1945')
    expect(ERA_LABELS['2055']).toContain('2055')
  })

  it('should have building configurations for each era', () => {
    ERAS.forEach(era => {
      expect(ERA_CONFIGS[era].buildingStyle).toBeDefined()
      expect(ERA_CONFIGS[era].buildingStyle.height).toBeGreaterThan(0)
    })
  })

  it('should have vehicle configurations for each era', () => {
    ERAS.forEach(era => {
      expect(ERA_CONFIGS[era].vehicleStyle).toBeDefined()
      expect(ERA_CONFIGS[era].vehicleStyle.type).toBeDefined()
    })
  })

  it('should have pedestrian configurations for each era', () => {
    ERAS.forEach(era => {
      expect(ERA_CONFIGS[era].pedestrianStyle).toBeDefined()
      expect(ERA_CONFIGS[era].pedestrianStyle.clothingStyle).toBeDefined()
    })
  })

  it('should have storefront configurations for each era', () => {
    ERAS.forEach(era => {
      expect(ERA_CONFIGS[era].storefrontStyle).toBeDefined()
      expect(ERA_CONFIGS[era].storefrontStyle.signage).toBeDefined()
    })
  })
})