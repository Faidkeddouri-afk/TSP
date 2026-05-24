export const distance = (a, b) =>
  Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

// Effective N×N cost matrix. A cell is the override value when present,
// otherwise the Euclidean distance between the two cities. Diagonal is 0.
export const buildCostMatrix = (cities, override = null) => {
  const n = cities.length;
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => {
      if (i === j) return 0;
      const o = override?.[i]?.[j];
      return (o === undefined || o === null) ? distance(cities[i], cities[j]) : o;
    })
  );
};

// Sum of directed edge costs around the closed tour.
export const tourCost = (matrix, tour) => {
  if (!tour || tour.length < 2) return 0;
  let d = 0;
  for (let i = 0; i < tour.length; i++) {
    d += matrix[tour[i]][tour[(i + 1) % tour.length]];
  }
  return d;
};

export const isSymmetric = (matrix, eps = 1e-9) => {
  const n = matrix.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(matrix[i][j] - matrix[j][i]) > eps) return false;
    }
  }
  return true;
};

export const shuffleArray = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
