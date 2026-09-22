/**
 * Global Vitest setup: jest-dom matchers plus the browser APIs jsdom does not
 * implement. Everything here is additive and guarded, so a real browser (or a
 * later jsdom upgrade) keeps its native behaviour.
 */

import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
})

class ObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): unknown[] {
    return []
  }
}

function defineGlobal(name: string, value: unknown): void {
  if (typeof (globalThis as Record<string, unknown>)[name] !== 'undefined') {
    return
  }
  Object.defineProperty(globalThis, name, { value, writable: true, configurable: true })
}

defineGlobal('ResizeObserver', ObserverStub)
defineGlobal('IntersectionObserver', ObserverStub)

if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

if (typeof URL !== 'undefined' && typeof URL.createObjectURL !== 'function') {
  Object.defineProperty(URL, 'createObjectURL', {
    writable: true,
    configurable: true,
    value: () => 'blob:city-timelapse-test',
  })
  Object.defineProperty(URL, 'revokeObjectURL', { writable: true, configurable: true, value: () => {} })
}

if (typeof HTMLCanvasElement !== 'undefined') {
  const originalGetContext = HTMLCanvasElement.prototype.getContext
  // jsdom has no WebGL. Report a missing context instead of raising
  // "not implemented" noise, so components take their documented fallback path.
  HTMLCanvasElement.prototype.getContext = function patchedGetContext(
    this: HTMLCanvasElement,
    contextId: string,
    ...args: unknown[]
  ): unknown {
    if (typeof contextId === 'string' && contextId.toLowerCase().includes('webgl')) {
      return null
    }
    try {
      const original = originalGetContext as unknown as (
        this: HTMLCanvasElement,
        ...rest: unknown[]
      ) => unknown
      return original.apply(this, [contextId, ...args])
    } catch {
      return null
    }
  } as unknown as typeof HTMLCanvasElement.prototype.getContext
}
