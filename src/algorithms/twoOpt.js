import { tourCost } from './utils.js';

function buildInitialTour(matrix, n) {
  const visited = new Array(n).fill(false);
  const tour = [0];
  visited[0] = true;
  while (tour.length < n) {
    const cur = tour[tour.length - 1];
    let best = -1, bestD = Infinity;
    for (let i = 0; i < n; i++) {
      if (!visited[i]) {
        const d = matrix[cur][i];
        if (d < bestD) { bestD = d; best = i; }
      }
    }
    visited[best] = true;
    tour.push(best);
  }
  return tour;
}

function twoOptSwap(tour, i, k) {
  const t = [...tour];
  let l = i + 1, r = k;
  while (l < r) { [t[l], t[r]] = [t[r], t[l]]; l++; r--; }
  return t;
}

export function* twoOptSolver(cities, matrix) {
  if (cities.length < 3) return;
  const n = cities.length;
  let tour = buildInitialTour(matrix, n);
  let bestDist = tourCost(matrix, tour);
  let iteration = 0;
  let improved = true;

  yield {
    tour: [...tour], bestTour: [...tour], distance: bestDist,
    exploredEdges: [], iteration: 0, phase: 'init', algorithm: 'twoOpt',
  };

  while (improved) {
    improved = false;
    for (let i = 0; i < n - 1; i++) {
      for (let k = i + 1; k < n; k++) {
        const newTour = twoOptSwap(tour, i, k);
        const newDist = tourCost(matrix, newTour);
        iteration++;

        if (newDist < bestDist - 0.001) {
          tour = newTour;
          bestDist = newDist;
          improved = true;

          yield {
            tour: [...tour], bestTour: [...tour], distance: bestDist,
            exploredEdges: [[tour[i], tour[i + 1]], [tour[k], tour[(k + 1) % n]]],
            iteration, phase: 'improving', algorithm: 'twoOpt', improved: true,
          };
        } else if (iteration % 15 === 0) {
          yield {
            tour: [...tour], bestTour: [...tour], distance: bestDist,
            exploredEdges: [[tour[i], tour[(i + 1) % n]], [tour[k], tour[(k + 1) % n]]],
            iteration, phase: 'exploring', algorithm: 'twoOpt',
          };
        }
      }
    }
  }

  yield {
    tour, bestTour: tour, distance: bestDist, exploredEdges: [],
    iteration, phase: 'complete', complete: true, algorithm: 'twoOpt',
  };
}
