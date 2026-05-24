import { tourCost, shuffleArray } from './utils.js';

const fitness = (matrix, tour) => 1 / tourCost(matrix, tour);

function tournamentSelect(population, fitnesses, k = 5) {
  let best = null, bestFit = -Infinity;
  for (let i = 0; i < k; i++) {
    const idx = Math.floor(Math.random() * population.length);
    if (fitnesses[idx] > bestFit) { bestFit = fitnesses[idx]; best = population[idx]; }
  }
  return best;
}

function orderCrossover(p1, p2) {
  const n = p1.length;
  const a = Math.floor(Math.random() * n);
  const b = Math.floor(Math.random() * n);
  const [start, end] = [Math.min(a, b), Math.max(a, b)];
  const child = new Array(n).fill(-1);
  const segment = new Set();
  for (let i = start; i <= end; i++) { child[i] = p1[i]; segment.add(p1[i]); }
  let j = (end + 1) % n;
  let p = (end + 1) % n;
  let count = 0;
  const fill = n - (end - start + 1);
  while (count < fill) {
    if (!segment.has(p2[p])) { child[j] = p2[p]; j = (j + 1) % n; count++; }
    p = (p + 1) % n;
  }
  return child;
}

function mutate(tour, rate = 0.015) {
  const t = [...tour];
  for (let i = 0; i < t.length; i++) {
    if (Math.random() < rate) {
      const j = Math.floor(Math.random() * t.length);
      [t[i], t[j]] = [t[j], t[i]];
    }
  }
  return t;
}

export function* geneticSolver(cities, matrix) {
  if (cities.length < 2) return;
  const n = cities.length;
  const popSize = Math.max(60, n * 5);
  const maxGenerations = 800;

  let population = Array.from({ length: popSize }, () => shuffleArray([...Array(n).keys()]));
  let fitnesses = population.map(t => fitness(matrix, t));
  let bestIdx = fitnesses.indexOf(Math.max(...fitnesses));
  let bestTour = [...population[bestIdx]];
  let bestDist = tourCost(matrix, bestTour);
  const distHistory = [{ gen: 0, dist: bestDist }];

  for (let gen = 0; gen < maxGenerations; gen++) {
    const next = [[...bestTour]]; // elitism
    while (next.length < popSize) {
      const p1 = tournamentSelect(population, fitnesses);
      const p2 = tournamentSelect(population, fitnesses);
      next.push(mutate(orderCrossover(p1, p2)));
    }
    population = next;
    fitnesses = population.map(t => fitness(matrix, t));
    const curBestIdx = fitnesses.indexOf(Math.max(...fitnesses));
    const curDist = tourCost(matrix, population[curBestIdx]);
    if (curDist < bestDist) {
      bestDist = curDist;
      bestTour = [...population[curBestIdx]];
    }
    distHistory.push({ gen: gen + 1, dist: bestDist });

    yield {
      tour: [...bestTour], bestTour: [...bestTour],
      distance: bestDist, generation: gen + 1,
      iteration: gen + 1, exploredEdges: [],
      distHistory: distHistory.slice(-80),
      populationSize: popSize,
      phase: gen === maxGenerations - 1 ? 'complete' : 'evolving',
      algorithm: 'genetic',
    };
  }

  yield {
    tour: bestTour, bestTour, distance: bestDist,
    generation: maxGenerations, iteration: maxGenerations,
    distHistory, exploredEdges: [],
    phase: 'complete', complete: true, algorithm: 'genetic',
  };
}
