import { motion } from 'framer-motion';

const ALGO_LABELS = {
  nearestNeighbor: 'Nearest Neighbor',
  twoOpt: '2-Opt Local Search',
  simulatedAnnealing: 'Simulated Annealing',
  genetic: 'Genetic Algorithm',
  bruteForce: 'Brute Force',
  branchAndBound: 'Branch & Bound',
};

const ALGO_COLORS = {
  nearestNeighbor: '#00f5ff',
  twoOpt: '#00ff88',
  simulatedAnnealing: '#ffb700',
  genetic: '#bd00ff',
  bruteForce: '#ff3366',
  branchAndBound: '#ff8c00',
};

export default function ComparisonTable({ results, onClose, isComparing }) {
  if (!results && !isComparing) return null;

  const entries = Object.entries(results ?? {});
  const validDists = entries.filter(([, r]) => !r.skipped && r.distance != null && r.distance < Infinity);
  const bestDist = validDists.length > 0 ? Math.min(...validDists.map(([, r]) => r.distance)) : null;

  return (
    <motion.div
      className="card p-4"
      style={{ borderColor: 'rgba(255,183,0,0.25)' }}
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="label-text" style={{ color: '#ffb700' }}>COMPARISON RESULTS</div>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-white text-xs font-mono transition-colors"
        >
          [CLOSE]
        </button>
      </div>

      {isComparing ? (
        <div className="text-center py-4 text-cyan-400 font-mono text-sm animate-pulse">
          RUNNING ALL ALGORITHMS...
        </div>
      ) : (
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="border-b border-white/10 text-gray-500">
              <th className="text-left pb-2">ALGORITHM</th>
              <th className="text-right pb-2">DISTANCE</th>
              <th className="text-right pb-2">TIME</th>
              <th className="text-right pb-2">VS BEST</th>
            </tr>
          </thead>
          <tbody>
            {entries.sort(([, a], [, b]) => {
              if (a.skipped) return 1;
              if (b.skipped) return -1;
              return (a.distance ?? Infinity) - (b.distance ?? Infinity);
            }).map(([name, result]) => {
              const isBest = bestDist != null && result.distance === bestDist;
              const pctAbove = bestDist && result.distance && !result.skipped
                ? ((result.distance - bestDist) / bestDist * 100).toFixed(1)
                : null;
              return (
                <tr
                  key={name}
                  className="border-b border-white/5"
                  style={{ background: isBest ? 'rgba(0,255,136,0.05)' : undefined }}
                >
                  <td className="py-2" style={{ color: ALGO_COLORS[name] }}>
                    {isBest && <span className="mr-1">★</span>}
                    {ALGO_LABELS[name]}
                  </td>
                  <td className="text-right py-2" style={{ color: ALGO_COLORS[name] }}>
                    {result.skipped ? <span className="text-gray-600">SKIP</span>
                      : result.distance < Infinity ? result.distance.toFixed(2) : '—'}
                  </td>
                  <td className="text-right py-2 text-gray-400">
                    {result.skipped ? '—' : `${result.time}ms`}
                  </td>
                  <td className="text-right py-2">
                    {result.skipped ? <span className="text-gray-600">—</span>
                      : isBest ? <span className="text-green-400">BEST</span>
                      : pctAbove != null ? <span className="text-amber-400">+{pctAbove}%</span>
                      : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </motion.div>
  );
}
