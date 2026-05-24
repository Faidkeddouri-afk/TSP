import { describe, it, expect } from 'vitest';
import { nearestNeighborSolver } from './nearestNeighbor.js';
import { bruteForceSolver } from './bruteForce.js';

function runToEnd(gen) {
  let last = null;
  let r = gen.next();
  while (!r.done) {
    if (r.value) last = r.value;
    r = gen.next();
  }
  if (r.value) last = r.value;
  return last;
}

const cities = [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }];
const matrix = [
  [0, 1, 5, 9],
  [1, 0, 2, 6],
  [5, 2, 0, 3],
  [9, 6, 3, 0],
];

describe('solvers use the cost matrix', () => {
  it('brute force finds the optimal directed tour cost', () => {
    const best = runToEnd(bruteForceSolver(cities, matrix));
    expect(best.distance).toBe(15);
  });

  it('nearest neighbor reports matrix-based distance', () => {
    const best = runToEnd(nearestNeighborSolver(cities, matrix));
    expect(best.distance).toBe(15);
  });
});
