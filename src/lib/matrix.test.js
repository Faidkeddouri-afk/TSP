import { describe, it, expect } from 'vitest';
import { circleLayout, reconcileImport } from './matrix.js';

describe('circleLayout', () => {
  it('produces n points inside the canvas bounds', () => {
    const pts = circleLayout(5);
    expect(pts).toHaveLength(5);
    for (const p of pts) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(1000);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(700);
    }
  });
});

describe('reconcileImport', () => {
  const parsed = { labels: ['A', 'B', 'C'], matrix: [[null, 1, 2], [1, null, 3], [2, 3, null]] };

  it('keeps existing cities when the count matches', () => {
    const cities = [{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }];
    const out = reconcileImport(cities, parsed);
    expect(out.cities).toBe(cities);
    expect(out.customMatrix).toBe(parsed.matrix);
  });

  it('generates a circle layout when the count differs', () => {
    const out = reconcileImport([], parsed);
    expect(out.cities).toHaveLength(3);
    expect(out.customMatrix).toBe(parsed.matrix);
  });
});
