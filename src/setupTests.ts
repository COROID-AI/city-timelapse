import React from 'react'
import '@testing-library/jest-dom'

import { vi } from 'vitest'

// happy-dom doesn't provide WebGL; mock r3f Canvas so unit tests can mount without errors.
vi.mock('@react-three/fiber', async () => {
  const actual = await vi.importActual<any>('@react-three/fiber')

  return {
    ...actual,
    Canvas: ({ children }: { children: React.ReactNode }) => {
      return React.createElement('div', { 'data-testid': 'r3f-canvas' }, children)
    },
  }
})
