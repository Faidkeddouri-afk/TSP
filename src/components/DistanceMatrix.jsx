import { motion } from 'framer-motion';

// Temporary stub — replaced by the full staging UI in Task 4.
export default function DistanceMatrix({ solver }) {
  const { customMatrix, resetMatrix, isRunning } = solver;
  const active = customMatrix != null;
  return (
    <motion.div
      className="card p-4 flex items-center justify-between"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
    >
      <span className="label-text" style={{ color: 'var(--text-dim)' }}>
        DISTANCE MATRIX
        {active && (
          <span className="ml-2 text-xs font-mono font-bold" style={{ color: 'var(--accent-cyan)' }}>
            ● ACTIVE
          </span>
        )}
      </span>
      <button
        onClick={resetMatrix}
        disabled={isRunning || !active}
        className="ctrl-btn danger"
        title="Reset to default"
        style={{ opacity: (isRunning || !active) ? 0.4 : 1 }}
      >
        ↺ RESET
      </button>
    </motion.div>
  );
}
