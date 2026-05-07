export const distance = (a, b) =>
  Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

export const tourDistance = (cities, tour) => {
  if (!tour || tour.length < 2) return 0;
  let d = 0;
  for (let i = 0; i < tour.length; i++) {
    const from = cities[tour[i]];
    const to = cities[tour[(i + 1) % tour.length]];
    if (from && to) d += distance(from, to);
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
