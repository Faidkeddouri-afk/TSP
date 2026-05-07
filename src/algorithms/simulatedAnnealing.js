import { tourDistance, shuffleArray } from './utils.js';

export function* simulatedAnnealingSolver(cities) {
  if (cities.length < 2) return;
  const n = cities.length;

  let tour = shuffleArray([...Array(n).keys()]);
  let bestTour = [...tour];
  let bestDist = tourDistance(cities, tour);
  let currentDist = bestDist;

  const initialTemp = 5000;
  const coolingRate = 0.9997;
  const minTemp = 0.5;
  let temp = initialTemp;
  let iteration = 0;
  const tempHistory = [{ iter: 0, temp: initialTemp, dist: bestDist }];

  while (temp > minTemp) {
    const i = Math.floor(Math.random() * n);
    const j = Math.floor(Math.random() * n);
    if (i === j) { temp *= coolingRate; iteration++; continue; }

    const [a, b] = [Math.min(i, j), Math.max(i, j)];
    const newTour = [...tour];
    let l = a, r = b;
    while (l < r) { [newTour[l], newTour[r]] = [newTour[r], newTour[l]]; l++; r--; }

    const newDist = tourDistance(cities, newTour);
    const delta = newDist - currentDist;

    if (delta < 0 || Math.random() < Math.exp(-delta / temp)) {
      tour = newTour;
      currentDist = newDist;
      if (currentDist < bestDist) {
        bestDist = currentDist;
        bestTour = [...tour];
      }
    }

    temp *= coolingRate;
    iteration++;

    if (iteration % 80 === 0) {
      tempHistory.push({ iter: iteration, temp, dist: bestDist });
      yield {
        tour: [...bestTour], bestTour: [...bestTour],
        distance: bestDist, currentDistance: currentDist,
        temperature: temp, initialTemp,
        iteration, exploredEdges: [],
        tempHistory: tempHistory.slice(-60),
        phase: delta < 0 ? 'improving' : 'exploring',
        algorithm: 'simulatedAnnealing',
      };
    }
  }

  yield {
    tour: bestTour, bestTour, distance: bestDist,
    temperature: 0, initialTemp, iteration,
    tempHistory, exploredEdges: [],
    phase: 'complete', complete: true, algorithm: 'simulatedAnnealing',
  };
}
