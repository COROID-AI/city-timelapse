import { describe, expect, it } from 'vitest';

// Minimal smoke test proving the Vitest toolchain is wired up.
describe('scaffold', () => {
  it('runs a test', () => {
    expect(1 + 1).toBe(2);
  });
});
