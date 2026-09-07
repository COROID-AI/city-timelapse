import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createCityBlockLayout } from '../../../src/layout/cityBlockLayout';
import { createEraState } from '../../../src/state/eraState';
import { Scene } from 'three';
import { createEra2005Content } from '../../../src/eras/2005/index';

describe('Era 2005 composition contract', () => {
  it('instantiates against the real foundation anchors and reactive era state, updates, switches era, and disposes with zero errors', () => {
    const layout = createCityBlockLayout();
    const eraState = createEraState(2005);
    const scene = new Scene();
    const content = createEra2005Content(layout, eraState, scene);
expect(content.year).toBe(2005);
expect(content.buildings).toHaveLength(layout.lots.length);
    content.instantiate();
    content.update(0.016);
expect(eraState.year).toBe(2005);
    eraState.setYear(2025);
expect(eraState.year).toBe(2025);
    eraState.setYear(2005);
expect(eraState.year).toBe(2005);
    content.update(0.016);
    content.dispose();
    content.dispose();
  });

  it('keeps all 2005 era content writes confined to its own module and test directories', () => {
    const dir = join(process.cwd(), 'src', 'eras', '2005');
    const files = readdirSync(dir).filter((f) => f.endsWith('.ts'));
expect(files.length).toBeGreaterThan(5);
    const allowedPrefixes = [
      './',
      '../',
      '../../layout/',
      '../../types/',
      '../../state/',
      '../../audio/',
      'three',
    ];
    for (const file of files) {
      const src = readFileSync(join(dir, file), 'utf8');
      for (const line of src.split('\n')) {
        const m = line.match(/from\s+['\"]([^'\"]+)['\"]/);
        if (!m) continue;
        const spec = m[1];
        const isAllowed = allowedPrefixes.some((p) => spec.startsWith(p));
expect(isAllowed).toBe(true);
      }
    }
  });
});

