import { motion } from 'framer-motion';

const ALGORITHMS = [
  { id: 'nearestNeighbor', label: 'NEAREST\nNEIGHBOR', short: 'NN', color: '#00f5ff' },
  { id: 'twoOpt',          label: '2-OPT\nLOCAL',    short: '2OPT', color: '#00ff88' },
  { id: 'simulatedAnnealing', label: 'SIMULATED\nANNEALING', short: 'SA', color: '#ffb700' },
  { id: 'genetic',         label: 'GENETIC\nALGORITHM', short: 'GA', color: '#bd00ff' },
  { id: 'bruteForce',      label: 'BRUTE\nFORCE',    short: 'BF', color: '#ff3366' },
];

const CITY_PRESETS = [8, 12, 16, 20];

const SPEED_OPTS = [
  { id: 'slow', label: 'SLOW' },
  { id: 'medium', label: 'MED' },
  { id: 'fast', label: 'FAST' },
  { id: 'instant', label: 'MAX' },
];

export default function ControlPanel({ solver }) {
  const {
    algorithm, speed, isRunning, isPaused, cities,
    setAlgorithm, setSpeed, start, pause, resume, reset,
    clearCities, generateRandom,
  } = solver;

  const canStart = cities.length >= 2 && !isRunning;
  const algo = ALGORITHMS.find(a => a.id === algorithm);

  return (
    <motion.div
      className="card p-4 flex flex-col gap-4"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
    >
      {/* Algorithm selector */}
      <div>
        <div className="label-text mb-2">ALGORITHM SELECT</div>
        <div className="grid grid-cols-5 gap-1">
          {ALGORITHMS.map(a => (
            <button
              key={a.id}
              onClick={() => setAlgorithm(a.id)}
              disabled={isRunning}
              title={a.label.replace('\n', ' ')}
              className="algo-btn"
              style={{
                borderColor: algorithm === a.id ? a.color : 'var(--border-divider)',
                color: algorithm === a.id ? a.color : 'var(--text-dim)',
                background: algorithm === a.id ? `${a.color}15` : 'transparent',
                boxShadow: algorithm === a.id ? `0 0 12px ${a.color}40, inset 0 0 8px ${a.color}10` : 'none',
              }}
            >
              {a.short}
            </button>
          ))}
        </div>
        {algorithm === 'bruteForce' && (
          <div className="mt-2 text-xs text-red-400 font-mono">
            ⚠ BRUTE FORCE: MAX 10 CITIES — EXPONENTIAL TIME
          </div>
        )}
      </div>

      {/* Speed */}
      <div>
        <div className="label-text mb-2">EXECUTION SPEED</div>
        <div className="grid grid-cols-4 gap-1">
          {SPEED_OPTS.map(s => (
            <button
              key={s.id}
              onClick={() => setSpeed(s.id)}
              className="speed-btn"
              style={{
                background: speed === s.id ? 'color-mix(in srgb, var(--accent-cyan) 12%, transparent)' : 'transparent',
                color: speed === s.id ? 'var(--accent-cyan)' : 'var(--text-dim)',
                borderColor: speed === s.id ? 'var(--accent-cyan)' : 'var(--border-divider)',
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* City generator */}
      <div>
        <div className="label-text mb-2">RANDOM CITIES</div>
        <div className="grid grid-cols-4 gap-1">
          {CITY_PRESETS.map(n => (
            <button
              key={n}
              onClick={() => generateRandom(n)}
              disabled={isRunning}
              className="city-btn"
              title={`Generate ${n} random cities`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Main controls */}
      <div className="flex gap-2">
        {!isRunning && !isPaused && (
          <button
            onClick={start}
            disabled={!canStart}
            className="ctrl-btn flex-1 primary"
            title="Start (Space)"
          >
            ▶ START
          </button>
        )}
        {isRunning && (
          <button onClick={pause} className="ctrl-btn flex-1 pause" title="Pause (Space)">
            ⏸ PAUSE
          </button>
        )}
        {isPaused && (
          <button onClick={resume} className="ctrl-btn flex-1 primary" title="Resume (Space)">
            ▶ RESUME
          </button>
        )}
        <button
          onClick={reset}
          className="ctrl-btn danger"
          title="Reset (R)"
        >
          ↺ RST
        </button>
        <button
          onClick={clearCities}
          disabled={isRunning}
          className="ctrl-btn danger"
          title="Clear cities (C)"
        >
          ✕ CLR
        </button>
      </div>

      {/* City count */}
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="text-gray-500">CITIES PLACED</span>
        <span style={{ color: algo?.color ?? '#00f5ff' }}>
          {cities.length} / 20
          {algorithm === 'bruteForce' && cities.length > 10 && (
            <span className="text-red-400 ml-2">EXCEEDS BF LIMIT</span>
          )}
        </span>
      </div>

      {/* Keyboard hints */}
      <div className="text-xs font-mono pt-2 flex gap-3" style={{ color: 'var(--text-dim)', borderTop: '1px solid var(--border-divider)' }}>
        <span><span style={{ color: 'var(--accent-cyan)' }}>SPC</span> play/pause</span>
        <span><span style={{ color: 'var(--accent-cyan)' }}>R</span> reset</span>
        <span><span style={{ color: 'var(--accent-cyan)' }}>C</span> clear</span>
      </div>
    </motion.div>
  );
}
