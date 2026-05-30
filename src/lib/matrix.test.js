import { describe, it, expect } from 'vitest';
import { circleLayout } from './matrix.js';

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

  it('places the first node at the top of the circle', () => {
    const pts = circleLayout(4, 1000, 700, 90);
    expect(pts[0].x).toBeCloseTo(500);
    expect(pts[0].y).toBeCloseTo(700 / 2 - (Math.min(1000, 700) / 2 - 90));
  });
});
