import { tourCost } from './utils.js';

export function* nearestNeighborSolver(cities, matrix) {
  if (cities.length < 2) return;
  const n = cities.length;
  const visited = new Array(n).fill(false);
  const tour = [0];
  visited[0] = true;
  let exploredEdges = [];

  while (tour.length < n) {
    const current = tour[tour.length - 1];
    let nearest = -1;
    let nearestDist = Infinity;

    for (let i = 0; i < n; i++) {
      if (!visited[i]) {
        const d = matrix[current][i];
        exploredEdges.push([current, i]);
        if (d < nearestDist) {
          nearestDist = d;
          nearest = i;
        }
      }
    }

    visited[nearest] = true;
    tour.push(nearest);

    yield {
      tour: [...tour],
      bestTour: [...tour],
      distance: tourCost(matrix, tour),
      exploredEdges: exploredEdges.slice(-Math.min(exploredEdges.length, 30)),
      iteration: tour.length - 1,
      phase: 'building',
      algorithm: 'nearestNeighbor',
    };
  }

  const finalTour = [...tour];
  yield {
    tour: finalTour,
    bestTour: finalTour,
    distance: tourCost(matrix, finalTour),
    exploredEdges: [],
    iteration: n,
    phase: 'complete',
    complete: true,
    algorithm: 'nearestNeighbor',
  };
}
