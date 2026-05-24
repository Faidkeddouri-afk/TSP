import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { distance } from '../algorithms/utils.js';

const nodeLabel = (i) => (i < 26 ? String.fromCharCode(65 + i) : `#${i}`);

export default function DistanceMatrix({ solver }) {
  const { cities, customMatrix, isRunning, setMatrixCell, resetMatrix, importFromFile } = solver;
  const [open, setOpen] = useState(false);
  const fileRef = useRef(null);

  const n = cities.length;
  const active = customMatrix != null;

  const onCellChange = (i, j, raw) => {
    const trimmed = raw.trim();
    if (trimmed === '') { setMatrixCell(i, j, null); return; }
    const num = Number(trimmed);
    if (!Number.isFinite(num) || num < 0) return; // reject invalid silently
    setMatrixCell(i, j, num);
  };

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (file) importFromFile(file);
    e.target.value = '';
  };

  return (
    <motion.div
      className="card p-4 flex flex-col gap-3"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
    >
      <div className="flex items-center justify-between">
        <button
          onClick={() => setOpen(o => !o)}
          className="label-text"
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-dim)' }}
        >
          {open ? '▾' : '▸'} DISTANCE MATRIX
        </button>
        {active && (
          <span className="text-xs font-mono font-bold" style={{ color: 'var(--accent-cyan)' }}>
            ● ACTIVE
          </span>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={isRunning}
          className="ctrl-btn flex-1"
          title="Import an .xlsx/.csv distance table"
          style={{ opacity: isRunning ? 0.4 : 1, cursor: isRunning ? 'not-allowed' : 'pointer' }}
        >
          ⬆ IMPORT EXCEL
        </button>
        <button
          onClick={resetMatrix}
          disabled={isRunning || !active}
          className="ctrl-btn danger"
          title="Discard custom distances, revert to euclidean"
          style={{ opacity: (isRunning || !active) ? 0.4 : 1, cursor: (isRunning || !active) ? 'not-allowed' : 'pointer' }}
        >
          ↺ EUCLID
        </button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={onFile} style={{ display: 'none' }} />
      </div>

      {open && (
        n < 2 ? (
          <div className="text-xs font-mono" style={{ color: 'var(--text-dim)' }}>
            Place at least 2 nodes (click the canvas or use RANDOM CITIES) to edit distances.
          </div>
        ) : (
          <div className="overflow-x-auto" style={{ maxWidth: '100%' }}>
            <table className="font-mono text-xs" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ padding: '2px 4px' }} />
                  {cities.map((_, j) => (
                    <th key={j} style={{ padding: '2px 4px', color: 'var(--accent-cyan)' }}>{nodeLabel(j)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cities.map((_, i) => (
                  <tr key={i}>
                    <td style={{ padding: '2px 4px', color: 'var(--accent-cyan)', fontWeight: 700 }}>{nodeLabel(i)}</td>
                    {cities.map((_, j) => {
                      if (i === j) {
                        return <td key={j} style={{ padding: '2px', textAlign: 'center', color: 'var(--text-dim)' }}>—</td>;
                      }
                      const override = customMatrix?.[i]?.[j];
                      const euclid = distance(cities[i], cities[j]);
                      return (
                        <td key={j} style={{ padding: '1px' }}>
                          <input
                            type="text"
                            inputMode="decimal"
                            disabled={isRunning}
                            value={override ?? ''}
                            placeholder={euclid.toFixed(0)}
                            onChange={(e) => onCellChange(i, j, e.target.value)}
                            style={{
                              width: '48px',
                              padding: '2px 3px',
                              textAlign: 'center',
                              background: 'transparent',
                              border: '1px solid var(--border-divider)',
                              color: override != null ? 'var(--accent-cyan)' : 'var(--text-dim)',
                              fontFamily: 'inherit',
                              fontSize: '11px',
                            }}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="text-xs font-mono mt-2" style={{ color: 'var(--text-dim)' }}>
              Blank = euclidean (greyed). Rows = from, columns = to (asymmetric).
            </div>
          </div>
        )
      )}
    </motion.div>
  );
}
