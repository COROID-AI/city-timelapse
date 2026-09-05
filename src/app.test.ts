import { describe, expect, it } from 'vitest'
import { ERA_IDS, ERA_REGISTRY, getEraSpec } from './eras'

describe('era registry (app-level)', () => {
  it('matches the plan description verbatim: five years, no 2055', () => {
    expect(ERA_IDS).toEqual(['1945', '1965', '1985', '2005', '2025'])
    expect(ERA_REGISTRY).toHaveLength(5)
    expect(ERA_IDS).not.toContain('2055')
    expect(getEraSpec('2025').year).toBe(2025)
  })
})