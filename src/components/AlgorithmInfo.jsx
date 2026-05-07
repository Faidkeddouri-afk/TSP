import { motion, AnimatePresence } from 'framer-motion';

const INFO = {
  nearestNeighbor: {
    name: 'NEAREST NEIGHBOR GREEDY',
    color: '#00f5ff',
    timeComplexity: 'O(n²)',
    spaceComplexity: 'O(n)',
    pros: ['Very fast execution', 'Simple to understand', 'Good first approximation'],
    cons: ['Often suboptimal (15–25% above optimal)', 'No backtracking', 'Sensitive to start city'],
    bestFor: 'Quick approximate solutions on large graphs',
    description: 'Greedily selects the nearest unvisited city at each step. Fast but gets trapped in locally poor choices.',
  },
  twoOpt: {
    name: '2-OPT LOCAL SEARCH',
    color: '#00ff88',
    timeComplexity: 'O(n²) per pass',
    spaceComplexity: 'O(n)',
    pros: ['Improves any initial tour', 'Guaranteed local optimum', 'Deterministic'],
    cons: ['Can get stuck in local minima', 'Slow on large n', 'Depends on initial tour'],
    bestFor: 'Improving an existing tour; medium-sized instances',
    description: 'Tests all edge pair reversals. If reversing a segment reduces total distance, the swap is accepted.',
  },
  simulatedAnnealing: {
    name: 'SIMULATED ANNEALING',
    color: '#ffb700',
    timeComplexity: 'O(n·T) per temp step',
    spaceComplexity: 'O(n)',
    pros: ['Escapes local minima', 'Good global search', 'Tunable quality/speed'],
    cons: ['Requires parameter tuning', 'Slow convergence', 'Non-deterministic'],
    bestFor: 'High-quality solutions when time permits; NP-hard optimization',
    description: 'Probabilistically accepts worse solutions with probability e^(−Δ/T), allowing escape from local optima as temperature cools.',
  },
  genetic: {
    name: 'GENETIC ALGORITHM',
    color: '#bd00ff',
    timeComplexity: 'O(g·p·n)',
    spaceComplexity: 'O(p·n)',
    pros: ['Strong global search', 'Parallel evolution', 'Naturally parallelizable'],
    cons: ['Slow convergence', 'Many hyperparameters', 'Non-deterministic'],
    bestFor: 'Complex optimization landscapes; when many solutions are needed',
    description: 'Evolves a population of tours using tournament selection, order crossover (OX), and swap mutation with elitism.',
  },
  bruteForce: {
    name: 'BRUTE FORCE EXHAUSTIVE',
    color: '#ff3366',
    timeComplexity: 'O(n!)',
    spaceComplexity: 'O(n)',
    pros: ['Guaranteed optimal solution', 'Simple to implement', 'Exact answer'],
    cons: ['Infeasible for n > 12', 'Exponential explosion', 'No intelligence'],
    bestFor: 'Verifying other algorithms; tiny instances (≤10 cities)',
    description: 'Enumerates all (n−1)! permutations of cities and returns the minimum distance tour found.',
  },
};

export default function AlgorithmInfo({ algorithm }) {
  const info = INFO[algorithm];
  if (!info) return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={algorithm}
        className="card p-4"
        style={{ borderColor: `${info.color}25` }}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.2 }}
      >
        <div className="label-text mb-3" style={{ color: info.color }}>
          ALGORITHM PROFILE
        </div>

        <div
          className="text-sm font-display font-bold mb-2 tracking-wider"
          style={{ color: info.color, textShadow: `0 0 10px ${info.color}60` }}
        >
          {info.name}
        </div>

        <p className="text-xs text-gray-400 font-mono leading-relaxed mb-3">
          {info.description}
        </p>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-white/3 rounded px-2 py-1.5 border border-white/5">
            <div className="text-xs text-gray-500 mb-0.5">TIME COMPLEXITY</div>
            <div className="text-sm font-mono" style={{ color: info.color }}>{info.timeComplexity}</div>
          </div>
          <div className="bg-white/3 rounded px-2 py-1.5 border border-white/5">
            <div className="text-xs text-gray-500 mb-0.5">SPACE COMPLEXITY</div>
            <div className="text-sm font-mono" style={{ color: info.color }}>{info.spaceComplexity}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-xs text-green-400 font-mono mb-1">+ ADVANTAGES</div>
            <ul className="space-y-0.5">
              {info.pros.map((p, i) => (
                <li key={i} className="text-xs text-gray-400 font-mono flex gap-1">
                  <span className="text-green-400 flex-shrink-0">›</span>{p}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-xs text-red-400 font-mono mb-1">− LIMITATIONS</div>
            <ul className="space-y-0.5">
              {info.cons.map((c, i) => (
                <li key={i} className="text-xs text-gray-400 font-mono flex gap-1">
                  <span className="text-red-400 flex-shrink-0">›</span>{c}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-2 pt-2 border-t border-white/5">
          <span className="text-xs text-gray-500 font-mono">BEST FOR: </span>
          <span className="text-xs font-mono" style={{ color: info.color }}>{info.bestFor}</span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
