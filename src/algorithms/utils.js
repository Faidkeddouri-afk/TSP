export const distance = (a, b) =>
  Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

// N×N matrix where cell[i][j] is the Euclidean distance between cities[i]
// and cities[j], and the diagonal is 0. Used when no custom matrix is set.
export const buildEuclideanMatrix = (cities) => {
  const n = cities.length;
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 0 : distance(cities[i], cities[j])))
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

export const shuffleArray = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
