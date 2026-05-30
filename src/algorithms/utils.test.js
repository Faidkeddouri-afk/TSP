import { describe, it, expect } from 'vitest';
import { buildEuclideanMatrix, tourCost } from './utils.js';

describe('buildEuclideanMatrix', () => {
  const cities = [{ x: 0, y: 0 }, { x: 3, y: 4 }, { x: 0, y: 4 }];

  it('produces an N×N matrix with 0 on the diagonal', () => {
    const m = buildEuclideanMatrix(cities);
    expect(m).toHaveLength(3);
    expect(m[0]).toHaveLength(3);
    expect(m[0][0]).toBe(0);
    expect(m[1][1]).toBe(0);
    expect(m[2][2]).toBe(0);
  });

  it('uses Euclidean distance for off-diagonal cells', () => {
    const m = buildEuclideanMatrix(cities);
    expect(m[0][1]).toBeCloseTo(5);
    expect(m[0][2]).toBeCloseTo(4);
    expect(m[1][2]).toBeCloseTo(3);
  });

  it('is symmetric', () => {
    const m = buildEuclideanMatrix(cities);
    for (let i = 0; i < m.length; i++) {
      for (let j = 0; j < m.length; j++) {
        expect(m[i][j]).toBeCloseTo(m[j][i]);
      }
    }
  });
});

describe('tourCost', () => {
  const m = [
    [0, 1, 2],
    [1, 0, 8],
    [2, 8, 0],
  ];
  it('sums edges around the closed tour', () => {
    expect(tourCost(m, [0, 1, 2])).toBe(1 + 8 + 2);
  });
  it('returns 0 for trivial tours', () => {
    expect(tourCost(m, [0])).toBe(0);
  });
});
