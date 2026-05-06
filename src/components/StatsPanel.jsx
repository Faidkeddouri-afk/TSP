import { motion, AnimatePresence } from 'framer-motion';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';

function StatRow({ label, value, unit, color = 'var(--accent-cyan)', pulse = false }) {
  return (
    <div className="flex items-center justify-between py-1" style={{ borderBottom: '1px solid var(--border-divider)' }}>
      <span className="text-xs font-mono tracking-wider" style={{ color: 'var(--text-dim)' }}>{label}</span>
      <span
        className="text-sm font-mono font-bold tabular-nums"
        style={{ color, textShadow: pulse ? `0 0 8px ${color}` : undefined }}
      >
        {value ?? '—'}{unit ? <span className="text-xs text-gray-600 ml-1">{unit}</span> : null}
      </span>
    </div>
  );
}

function TempGauge({ temperature, initialTemp }) {
  const pct = initialTemp > 0 ? Math.min(100, (temperature / initialTemp) * 100) : 0;
  const hot = pct > 60;
  const color = hot ? '#ff3366' : pct > 30 ? '#ffb700' : '#00ff88';
  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs font-mono text-gray-500 mb-1">
        <span>TEMPERATURE</span>
        <span style={{ color }}>{temperature?.toFixed(1) ?? 0}</span>
      </div>
      <div className="h-2 rounded overflow-hidden" style={{ background: 'var(--bg-subtle)' }}>
        <motion.div
          className="h-full rounded"
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.3 }}
          style={{ background: `linear-gradient(90deg, #00ff88, ${color})`, boxShadow: `0 0 6px ${color}60` }}
        />
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="card px-2 py-1 text-xs font-mono">
      <span className="text-cyan-400">{payload[0].value?.toFixed(2)}</span>
      <span className="text-gray-500 ml-1">units</span>
    </div>
  );
};

export default function StatsPanel({ state, algorithm }) {
  const {
    distance, iteration, elapsed, phase, temperature, initialTemp,
    distHistory, tempHistory, generation, permutationsChecked, totalPermutations,
  } = state;

  const isDone = phase === 'complete';
  const isIdle = phase === 'idle';
  const distDisplay = distance < Infinity ? distance.toFixed(2) : '—';
  const elapsedDisplay = elapsed ? (elapsed / 1000).toFixed(2) : '0.00';

  const chartData = algorithm === 'simulatedAnnealing'
    ? (tempHistory ?? []).map(d => ({ x: d.iter, val: d.dist }))
    : (distHistory ?? []).map(d => ({ x: d.gen ?? d.iter, val: d.dist }));

  return (
    <motion.div
      className="card p-4 flex flex-col gap-1"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <div className="label-text mb-2 flex items-center gap-2">
        TELEMETRY
        {!isIdle && (
          <span
            className="text-xs px-2 py-0.5 rounded font-mono"
            style={{
              background: isDone ? 'rgba(0,255,136,0.15)' : phase === 'running' ? 'rgba(0,245,255,0.1)' : 'rgba(255,183,0,0.1)',
              color: isDone ? '#00ff88' : phase === 'running' ? '#00f5ff' : '#ffb700',
              border: `1px solid ${isDone ? '#00ff8830' : phase === 'running' ? '#00f5ff30' : '#ffb70030'}`,
            }}
          >
            {phase.toUpperCase()}
          </span>
        )}
      </div>

      <StatRow
        label="BEST DISTANCE"
        value={distDisplay}
        unit="units"
        color="#00f5ff"
        pulse={phase === 'improving'}
      />
      <StatRow
        label="ITERATION"
        value={generation != null ? `GEN ${generation}` : iteration > 0 ? iteration.toLocaleString() : '—'}
        color="#00ff88"
      />
      <StatRow
        label="ELAPSED"
        value={elapsedDisplay}
        unit="sec"
        color="#ffb700"
      />
      {permutationsChecked != null && (
        <StatRow
          label="PERMS CHECKED"
          value={`${permutationsChecked.toLocaleString()} / ${(totalPermutations ?? 0).toLocaleString()}`}
          color="#bd00ff"
        />
      )}

      {/* Temperature gauge for SA */}
      {algorithm === 'simulatedAnnealing' && temperature != null && (
        <TempGauge temperature={temperature} initialTemp={initialTemp ?? 5000} />
      )}

      {/* Chart for GA / SA */}
      <AnimatePresence>
        {chartData.length > 3 && (
          <motion.div
            className="mt-3 pt-3"
            style={{ borderTop: '1px solid var(--border-divider)' }}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <div className="text-xs text-gray-500 font-mono mb-1">
              {algorithm === 'genetic' ? 'BEST FITNESS / GENERATION' : 'BEST DISTANCE / ITERATION'}
            </div>
            <ResponsiveContainer width="100%" height={70}>
              <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <Line
                  type="monotone" dataKey="val"
                  stroke="#00f5ff" dot={false} strokeWidth={1.5}
                  isAnimationActive={false}
                />
                <XAxis dataKey="x" hide />
                <YAxis hide domain={['dataMin', 'dataMax']} />
                <Tooltip content={<CustomTooltip />} />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
