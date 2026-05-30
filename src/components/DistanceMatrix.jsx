import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { parseDistanceFile, symmetrize, buildTemplate } from '../lib/excel.js';

const MIN_N = 3;
const MAX_N = 20;

const defaultLabel = (i) =>
  i < 26 ? String.fromCharCode(65 + i) : `City${i + 1}`;

// Working state is an N×N grid of strings (so we can track partial input).
function blankCells(n) {
  return Array.from({ length: n }, () => Array(n).fill(''));
}

function blankLabels(n) {
  return Array.from({ length: n }, () => '');
}

function effectiveLabel(labels, i) {
  const v = (labels[i] ?? '').trim();
  return v === '' ? defaultLabel(i) : v;
}

// Returns null if any off-diagonal cell is empty or invalid; otherwise the
// N×N numeric matrix (symmetric: upper triangle mirrored into lower).
function compileWorkingMatrix(cells) {
  const n = cells.length;
  const out = Array.from({ length: n }, () => Array(n).fill(0));
  let empty = 0;
  let invalid = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const raw = cells[i][j].trim();
      if (raw === '') { empty++; continue; }
      const num = Number(raw);
      if (!Number.isFinite(num) || num < 0) { invalid++; continue; }
      out[i][j] = num;
      out[j][i] = num;
    }
  }
  if (empty === 0 && invalid === 0) return { matrix: out, empty, invalid };
  return { matrix: null, empty, invalid };
}

function resizeCells(cells, n) {
  const out = blankCells(n);
  const m = Math.min(cells.length, n);
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < m; j++) out[i][j] = cells[i][j];
  }
  return out;
}

function resizeLabels(labels, n) {
  const out = blankLabels(n);
  const m = Math.min(labels.length, n);
  for (let i = 0; i < m; i++) out[i] = labels[i];
  return out;
}

// Build a "cells" grid (string view, upper-triangle only meaningful) from a
// numeric matrix — used after Excel import and when reopening while active.
function cellsFromMatrix(matrix) {
  const n = matrix.length;
  const out = blankCells(n);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      out[i][j] = String(matrix[i][j]);
    }
  }
  return out;
}

export default function DistanceMatrix({ solver }) {
  const { customMatrix, cityLabels, isRunning, applyCustomMatrix, resetMatrix, addLog, showToast } = solver;
  const active = customMatrix != null;
  const [open, setOpen] = useState(false);

  // Working state (local; committed only on Apply).
  const [workingN, setWorkingN] = useState(active ? customMatrix.length : 5);
  const [cells, setCells] = useState(() =>
    active ? cellsFromMatrix(customMatrix) : blankCells(5)
  );
  const [labels, setLabels] = useState(() =>
    active ? cityLabels.map((l, i) => (l === defaultLabel(i) ? '' : l)) : blankLabels(5)
  );
  const [invalidSet, setInvalidSet] = useState(() => new Set()); // "i,j" keys with invalid input
  const [rawImport, setRawImport] = useState(null);  // pre-symmetrize matrix for "view raw"
  const [diffs, setDiffs] = useState([]);            // symmetrize diffs (banner)
  const [diffsLabels, setDiffsLabels] = useState([]); // labels at the time of import

  const fileRef = useRef(null);

  // When the active matrix changes (Apply / Reset elsewhere), refresh the
  // working state to match — but only when the panel isn't being edited.
  useEffect(() => {
    if (active) {
      setWorkingN(customMatrix.length);
      setCells(cellsFromMatrix(customMatrix));
      setLabels(cityLabels.map((l, i) => (l === defaultLabel(i) ? '' : l)));
      setInvalidSet(new Set());
      setDiffs([]);
      setRawImport(null);
    } else {
      // Matrix was just cleared (resetMatrix called). Return working state
      // to the blank default so reopening shows a fresh grid.
      setWorkingN(5);
      setCells(blankCells(5));
      setLabels(blankLabels(5));
      setInvalidSet(new Set());
      setDiffs([]);
      setRawImport(null);
    }
    // Intentionally not depending on cells/labels/etc.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, customMatrix, cityLabels]);

  const compiled = useMemo(() => compileWorkingMatrix(cells), [cells]);
  const canApply = !isRunning && compiled.matrix !== null && invalidSet.size === 0;

  const setN = (n) => {
    const clamped = Math.max(MIN_N, Math.min(MAX_N, n | 0));
    setWorkingN(clamped);
    setCells((prev) => resizeCells(prev, clamped));
    setLabels((prev) => resizeLabels(prev, clamped));
    setInvalidSet(new Set());
  };

  const onCellChange = (i, j, raw) => {
    // Mirror upper-triangle edits to the cells state; lower triangle is
    // displayed from the upper via render below.
    if (i > j) return;
    setCells((prev) => {
      const next = prev.map((r) => [...r]);
      next[i][j] = raw;
      return next;
    });
    // Live-validate: empty is "not yet", non-numeric/negative is invalid.
    const trimmed = raw.trim();
    const key = `${i},${j}`;
    setInvalidSet((prev) => {
      const next = new Set(prev);
      next.delete(key);
      if (trimmed !== '') {
        const num = Number(trimmed);
        if (!Number.isFinite(num) || num < 0) next.add(key);
      }
      return next;
    });
  };

  const onLabelChange = (i, raw) => {
    setLabels((prev) => {
      const next = [...prev];
      next[i] = raw;
      return next;
    });
  };

  const onApply = () => {
    if (!canApply) return;
    const finalLabels = labels.map((_, i) => effectiveLabel(labels, i));
    applyCustomMatrix({ matrix: compiled.matrix, labels: finalLabels });
    setOpen(false);
  };

  const onCancel = () => {
    if (active) {
      setWorkingN(customMatrix.length);
      setCells(cellsFromMatrix(customMatrix));
      setLabels(cityLabels.map((l, i) => (l === defaultLabel(i) ? '' : l)));
    } else {
      setWorkingN(5);
      setCells(blankCells(5));
      setLabels(blankLabels(5));
    }
    setInvalidSet(new Set());
    setDiffs([]);
    setRawImport(null);
    setOpen(false);
  };

  const onImport = async (file) => {
    try {
      const { labels: parsedLabels, matrix: rawMatrix } = await parseDistanceFile(file);
      const { matrix: corrected, diffs: diffList } = symmetrize(rawMatrix);
      setOpen(true);
      setWorkingN(corrected.length);
      setCells(cellsFromMatrix(corrected));
      setLabels(parsedLabels.map((l, i) => (l === defaultLabel(i) ? '' : l)));
      setInvalidSet(new Set());
      setRawImport(rawMatrix);
      setDiffs(diffList);
      setDiffsLabels(parsedLabels);
      const n = corrected.length;
      addLog(`PARSED — ${n}×${n} matrix from ${file.name}${diffList.length ? ` (${diffList.length} cells averaged)` : ''}`, 'system');
      showToast(`Parsed ${n}×${n} matrix — review and Apply`, diffList.length ? 'warn' : 'success');
    } catch (e) {
      addLog(`IMPORT ERROR — ${e.message}`, 'error');
      showToast(e.message, 'error');
    }
  };

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (f) onImport(f);
    e.target.value = '';
  };

  const onTemplate = () => {
    const blob = buildTemplate(4);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tsp-distance-template.xlsx';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const onUndoSymmetrize = () => {
    if (!rawImport) return;
    setCells(cellsFromMatrix(rawImport));
    setDiffs([]);
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
          onClick={() => setOpen((o) => !o)}
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

      {open && (
        <>
          <div className="flex items-center gap-2 text-xs font-mono" style={{ color: 'var(--text-dim)' }}>
            <span>CITIES (N):</span>
            <input
              type="number"
              min={MIN_N}
              max={MAX_N}
              value={workingN}
              onChange={(e) => setN(Number(e.target.value))}
              disabled={isRunning}
              style={{
                width: '52px',
                padding: '2px 4px',
                background: 'transparent',
                border: '1px solid var(--border-divider)',
                color: 'var(--accent-cyan)',
                fontFamily: 'inherit',
                fontSize: '11px',
                textAlign: 'center',
              }}
            />
            <span>({MIN_N}–{MAX_N})</span>
          </div>

          <div className="text-xs font-mono" style={{ color: 'var(--text-dim)' }}>
            LABELS (optional, blank → {defaultLabel(0)}, {defaultLabel(1)}, …):
          </div>
          <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))' }}>
            {Array.from({ length: workingN }, (_, i) => (
              <input
                key={i}
                type="text"
                value={labels[i] ?? ''}
                placeholder={defaultLabel(i)}
                onChange={(e) => onLabelChange(i, e.target.value)}
                disabled={isRunning}
                style={{
                  padding: '2px 4px',
                  background: 'transparent',
                  border: '1px solid var(--border-divider)',
                  color: 'var(--accent-cyan)',
                  fontFamily: 'inherit',
                  fontSize: '11px',
                  textAlign: 'center',
                }}
              />
            ))}
          </div>

          {diffs.length > 0 && (
            <div className="text-xs font-mono p-2 rounded" style={{ border: '1px solid #ffb700', color: '#ffb700' }}>
              ⚠ Imported matrix was not symmetric. {diffs.length} cell{diffs.length === 1 ? '' : 's'} averaged:
              <ul className="mt-1 ml-3">
                {diffs.slice(0, 5).map((d) => (
                  <li key={`${d.i},${d.j}`}>
                    ({diffsLabels[d.i]}, {diffsLabels[d.j]}): {d.a} / {d.b} → {d.value}
                  </li>
                ))}
                {diffs.length > 5 && <li>… and {diffs.length - 5} more</li>}
              </ul>
              <div className="mt-1 flex gap-2">
                <button
                  onClick={onUndoSymmetrize}
                  className="ctrl-btn"
                  style={{ fontSize: '10px', padding: '2px 6px' }}
                >
                  Undo & view raw
                </button>
                <button
                  onClick={() => setDiffs([])}
                  className="ctrl-btn"
                  style={{ fontSize: '10px', padding: '2px 6px' }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto" style={{ maxWidth: '100%' }}>
            <table className="font-mono text-xs" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ padding: '2px 4px' }} />
                  {Array.from({ length: workingN }, (_, j) => (
                    <th key={j} style={{ padding: '2px 4px', color: 'var(--accent-cyan)' }}>
                      {effectiveLabel(labels, j)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: workingN }, (_, i) => (
                  <tr key={i}>
                    <td style={{ padding: '2px 4px', color: 'var(--accent-cyan)', fontWeight: 700 }}>
                      {effectiveLabel(labels, i)}
                    </td>
                    {Array.from({ length: workingN }, (_, j) => {
                      if (i === j) {
                        return (
                          <td key={j} style={{ padding: '2px', textAlign: 'center', color: 'var(--text-dim)' }}>
                            —
                          </td>
                        );
                      }
                      if (i > j) {
                        // Lower-triangle: mirrored, read-only display.
                        const upper = cells[j][i] ?? '';
                        return (
                          <td key={j} style={{ padding: '1px', textAlign: 'center', color: 'var(--text-dim)' }}>
                            ({upper || ' '})
                          </td>
                        );
                      }
                      const v = cells[i][j];
                      const invalid = invalidSet.has(`${i},${j}`);
                      return (
                        <td key={j} style={{ padding: '1px' }}>
                          <input
                            type="text"
                            inputMode="decimal"
                            disabled={isRunning}
                            value={v}
                            onChange={(e) => onCellChange(i, j, e.target.value)}
                            title={invalid ? 'must be ≥ 0' : undefined}
                            style={{
                              width: '48px',
                              padding: '2px 3px',
                              textAlign: 'center',
                              background: 'transparent',
                              border: `1px solid ${invalid ? '#ff3366' : 'var(--border-divider)'}`,
                              color: invalid ? '#ff3366' : 'var(--accent-cyan)',
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
          </div>

          <div className="text-xs font-mono" style={{ color: 'var(--text-dim)' }}>
            {compiled.matrix
              ? '✓ Matrix complete'
              : `${compiled.empty ? `${compiled.empty} empty cell${compiled.empty === 1 ? '' : 's'}` : ''}${compiled.empty && compiled.invalid ? ' · ' : ''}${compiled.invalid ? `${compiled.invalid} invalid cell${compiled.invalid === 1 ? '' : 's'}` : ''}`}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={onTemplate}
              disabled={isRunning}
              className="ctrl-btn"
              title="Download a .xlsx skeleton"
              style={{ opacity: isRunning ? 0.4 : 1 }}
            >
              ↓ TEMPLATE
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={isRunning}
              className="ctrl-btn accent"
              title="Import a .xlsx/.csv distance matrix"
              style={{ opacity: isRunning ? 0.4 : 1 }}
            >
              ⬆ IMPORT EXCEL
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={onFile}
              style={{ display: 'none' }}
            />
            <button
              onClick={onApply}
              disabled={!canApply}
              className="ctrl-btn primary"
              title={
                canApply
                  ? 'Replace canvas with N circle-arranged nodes and re-run'
                  : isRunning
                  ? 'Solver is running'
                  : compiled.invalid
                  ? 'Fix invalid cells'
                  : `${compiled.empty} empty cells`
              }
              style={{ opacity: canApply ? 1 : 0.4 }}
            >
              ✓ APPLY
            </button>
            <button
              onClick={onCancel}
              disabled={isRunning}
              className="ctrl-btn"
              title="Discard local edits"
              style={{ opacity: isRunning ? 0.4 : 1 }}
            >
              ✕ CANCEL
            </button>
            {active && (
              <button
                onClick={resetMatrix}
                disabled={isRunning}
                className="ctrl-btn danger"
                title="Clear custom matrix, empty canvas, re-enable click-to-place"
                style={{ opacity: isRunning ? 0.4 : 1 }}
              >
                ↺ RESET TO DEFAULT
              </button>
            )}
          </div>
        </>
      )}
    </motion.div>
  );
}
