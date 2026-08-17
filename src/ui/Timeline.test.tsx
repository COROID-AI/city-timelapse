import { describe, it, expect } from 'vitest';
import { Timeline } from './Timeline';
// Simple existence/import test since @testing-library/react needs @testing-library/dom peer dep
describe('Timeline', () => {
  it('exports Timeline component', () => {
    expect(typeof Timeline).toBe('function');
  });
});
