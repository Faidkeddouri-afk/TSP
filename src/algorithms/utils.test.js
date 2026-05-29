import { describe, it, expect } from 'vitest';
import { buildCostMatrix, tourCost, isSymmetric, buildEuclideanMatrix } from './utils.js';

describe('buildCostMatrix', () => {
  const cities = [{ x: 0, y: 0 }, { x: 3, y: 4 }, { x: 0, y: 4 }];

  it('falls back to euclidean when no override', () => {
    const m = buildCostMatrix(cities, null);
    expect(m[0][1]).toBeCloseTo(5);
    expect(m[0][2]).toBeCloseTo(4);
    expect(m[1][2]).toBeCloseTo(3);
    expect(m[0][0]).toBe(0);
  });

  it('uses override cells and keeps euclidean for null cells', () => {
    const override = [
      [null, 10, null],
      [null, null, null],
      [null, null, null],
    ];
    const m = buildCostMatrix(cities, override);
    expect(m[0][1]).toBe(10);
    expect(m[0][2]).toBeCloseTo(4);
  });

  it('keeps an explicit zero override (not treated as missing)', () => {
    const override = [
      [null, 0, null],
      [null, null, null],
      [null, null, null],
    ];
    const m = buildCostMatrix(cities, override);
    expect(m[0][1]).toBe(0);
  });
});

describe('tourCost', () => {
  const m = [
    [0, 1, 2],
    [4, 0, 8],
    [16, 32, 0],
  ];
  it('sums directed edges with wraparound', () => {
    expect(tourCost(m, [0, 1, 2])).toBe(1 + 8 + 16);
  });
  it('is direction-dependent for asymmetric matrices', () => {
    expect(tourCost(m, [0, 2, 1])).toBe(2 + 32 + 4);
  });
  it('returns 0 for trivial tours', () => {
    expect(tourCost(m, [0])).toBe(0);
  });
});

describe('isSymmetric', () => {
  it('true for mirrored matrices', () => {
    expect(isSymmetric([[0, 5], [5, 0]])).toBe(true);
  });
  it('false for asymmetric matrices', () => {
    expect(isSymmetric([[0, 5], [7, 0]])).toBe(false);
  });
});

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
