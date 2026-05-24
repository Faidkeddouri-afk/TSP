import { tourCost } from './utils.js';

function factorial(n) {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

function* permutations(arr) {
  if (arr.length <= 1) { yield arr; return; }
  for (let i = 0; i < arr.length; i++) {
    const rest = arr.filter((_, j) => j !== i);
    for (const perm of permutations(rest)) yield [arr[i], ...perm];
  }
}

export function* bruteForceSolver(cities, matrix) {
  if (cities.length > 10) {
    yield { error: 'Too many cities (max 10 for brute force)', tour: [], distance: Infinity, complete: true };
    return;
  }
  if (cities.length < 2) return;

  const n = cities.length;
  const remaining = [...Array(n).keys()].slice(1);
  const total = factorial(n - 1);
  const yieldEvery = Math.max(1, Math.floor(total / 120));

  let bestTour = null, bestDist = Infinity, count = 0;

  for (const perm of permutations(remaining)) {
    const tour = [0, ...perm];
    const dist = tourCost(matrix, tour);
    count++;
    let improved = false;
    if (dist < bestDist) { bestDist = dist; bestTour = [...tour]; improved = true; }

    if (improved || count % yieldEvery === 0) {
      yield {
        tour: bestTour ? [...bestTour] : tour,
        bestTour: bestTour ? [...bestTour] : null,
        currentTour: [...tour],
        distance: bestDist,
        iteration: count,
        permutationsChecked: count,
        totalPermutations: total,
        exploredEdges: [],
        phase: improved ? 'improving' : 'exploring',
        algorithm: 'bruteForce',
        improved,
      };
    }
  }

  yield {
    tour: bestTour, bestTour, distance: bestDist,
    iteration: count, permutationsChecked: count, totalPermutations: total,
    exploredEdges: [], phase: 'complete', complete: true, algorithm: 'bruteForce',
  };
}
