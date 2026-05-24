// Lay out n nodes evenly on a circle within the canvas (display only;
// the cost matrix — not geometry — drives edge costs).
export function circleLayout(n, width = 1000, height = 700, margin = 90) {
  const cx = width / 2;
  const cy = height / 2;
  const r = Math.min(width, height) / 2 - margin;
  return Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i) / n - Math.PI / 2;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  });
}

// Map a parsed import onto the node set. If the parsed node count matches the
// current cities, apply the matrix to them; otherwise create circle-laid nodes.
export function reconcileImport(cities, parsed) {
  const n = parsed.matrix.length;
  if (cities.length === n) {
    return { cities, customMatrix: parsed.matrix };
  }
  return { cities: circleLayout(n), customMatrix: parsed.matrix };
}
