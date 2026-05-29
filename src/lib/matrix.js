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
