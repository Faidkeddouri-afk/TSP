import { distance, tourDistance } from './utils.js';

// Prim's MST on a subset of node indices
function mstCost(nodes, distMatrix) {
  if (nodes.length <= 1) return 0;
  const inMST = new Set([nodes[0]]);
  const rest = new Set(nodes.slice(1));
  let cost = 0;
  while (rest.size > 0) {
    let minC = Infinity, minN = -1;
    for (const u of inMST) {
      for (const v of rest) {
        if (distMatrix[u][v] < minC) { minC = distMatrix[u][v]; minN = v; }
      }
    }
    inMST.add(minN);
    rest.delete(minN);
    cost += minC;
  }
  return cost;
}

function nearestNeighborTour(n, distMatrix) {
  const visited = new Array(n).fill(false);
  const tour = [0];
  visited[0] = true;
  while (tour.length < n) {
    const last = tour[tour.length - 1];
    let best = -1, bestD = Infinity;
    for (let i = 0; i < n; i++) {
      if (!visited[i] && distMatrix[last][i] < bestD) { bestD = distMatrix[last][i]; best = i; }
    }
    visited[best] = true;
    tour.push(best);
  }
  return tour;
}

export function* branchAndBoundSolver(cities) {
  const MAX_CITIES = 12;
  if (cities.length > MAX_CITIES) {
    yield { error: `Too many cities (max ${MAX_CITIES} for branch & bound)`, tour: [], distance: Infinity, complete: true };
    return;
  }
  if (cities.length < 2) return;

  const n = cities.length;

  const dist = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => i === j ? 0 : distance(cities[i], cities[j]))
  );

  // Initial upper bound via nearest-neighbor heuristic enables early pruning
  const nnTour = nearestNeighborTour(n, dist);
  let bestTour = nnTour;
  let bestDist = tourDistance(cities, nnTour);

  let nodesExplored = 0;
  let nodesPruned = 0;

  const initialVisited = new Array(n).fill(false);
  initialVisited[0] = true;

  // DFS stack: [path, costSoFar, visited]
  const stack = [[[0], 0, initialVisited]];

  const YIELD_EVERY = Math.max(3, n);

  while (stack.length > 0) {
    const [path, cost, visited] = stack.pop();
    const last = path[path.length - 1];
    nodesExplored++;

    if (path.length === n) {
      const totalCost = cost + dist[last][0];
      let improved = false;
      if (totalCost < bestDist - 0.001) {
        bestDist = totalCost;
        bestTour = [...path];
        improved = true;
      }
      yield {
        tour: [...bestTour],
        bestTour: [...bestTour],
        distance: bestDist,
        exploredEdges: [[last, 0]],
        iteration: nodesExplored,
        permutationsChecked: nodesExplored,
        nodesPruned,
        phase: improved ? 'improving' : 'exploring',
        algorithm: 'branchAndBound',
        improved,
      };
      continue;
    }

    // Generate children, compute MST lower bound, prune dominated branches
    const children = [];
    for (let next = 0; next < n; next++) {
      if (visited[next]) continue;
      const newCost = cost + dist[last][next];

      // Remaining sub-problem: next → unvisited* → 0
      // MST({next} ∪ unvisited_after_next ∪ {0}) is a valid lower bound on remaining path
      const mstNodes = [next];
      for (let i = 1; i < n; i++) {
        if (!visited[i] && i !== next) mstNodes.push(i);
      }
      mstNodes.push(0);

      const lb = newCost + mstCost(mstNodes, dist);

      if (lb >= bestDist - 0.001) {
        nodesPruned++;
        continue;
      }

      children.push([next, newCost, lb]);
    }

    // Push in descending lb order so the best branch (lowest lb) is popped first
    children.sort((a, b) => b[2] - a[2]);
    for (const [next, newCost] of children) {
      const newVisited = [...visited];
      newVisited[next] = true;
      stack.push([[...path, next], newCost, newVisited]);
    }

    if (nodesExplored % YIELD_EVERY === 0) {
      yield {
        tour: [...bestTour],
        bestTour: [...bestTour],
        distance: bestDist,
        exploredEdges: path.length > 1 ? [[path[path.length - 2], last]] : [],
        iteration: nodesExplored,
        permutationsChecked: nodesExplored,
        nodesPruned,
        phase: 'exploring',
        algorithm: 'branchAndBound',
      };
    }
  }

  yield {
    tour: [...bestTour],
    bestTour: [...bestTour],
    distance: bestDist,
    exploredEdges: [],
    iteration: nodesExplored,
    permutationsChecked: nodesExplored,
    nodesPruned,
    phase: 'complete',
    complete: true,
    algorithm: 'branchAndBound',
  };
}
