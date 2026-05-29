# Symmetric Custom Distances Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing per-cell-override / asymmetric custom-distance implementation with a symmetric-only, staging-then-Apply workflow that supports manual entry, Excel import with downloadable template, and automatic circle layout when a custom matrix is active.

**Architecture:** Two-mode model in `useTSPSolver` — Euclidean (today's default) or Custom Matrix. Transitions are atomic: `applyCustomMatrix({ matrix, labels })` swaps cities and matrix in one batched update; `resetMatrix()` clears both. The `DistanceMatrix` component owns staging state (working N, labels, upper-triangle cells, parsed-raw matrix for "view raw") and calls into the hook only on Apply / Reset / Cancel. Pure libs (`src/lib/excel.js`, `src/lib/matrix.js`, `src/algorithms/utils.js`) handle parse / symmetrize / template / layout / cost.

**Tech Stack:** React 19, Vite, Tailwind, framer-motion, SheetJS (`xlsx`), Vitest.

**Spec:** `docs/superpowers/specs/2026-05-29-symmetric-distances-design.md`

**Sequencing principle:** every task leaves the build + tests green. Lib additions land first (pure, additive). The hook and component rewire together in Task 3 (with a minimal component stub so nothing dangles). The full UI lands in Task 4. Polish (Canvas labels, ControlPanel disabled states) in Task 5. Dead code from the prior design (per-cell override path, edge-list import, B&B symmetry guard, `isSymmetric`) is removed in Task 6.

---

## Task 1: Excel lib — strict matrix parser, symmetrize, template

**Files:**
- Create: (none — modifying existing)
- Modify: `src/lib/excel.js`
- Test: `src/lib/excel.test.js`

This task ADDS three new exports next to the existing ones. The old `readFileToRows` / `parseSheetRows` exports stay until Task 6 so the hook keeps working. New code is TDD, one function at a time.

### 1a. `symmetrize(matrix)` — pure helper for averaging asymmetric input

- [ ] **Step 1: Write the failing test**

Append to `src/lib/excel.test.js`:

```js
import { symmetrize } from './excel.js';

describe('symmetrize', () => {
  it('returns the matrix unchanged and empty diffs when already symmetric', () => {
    const m = [
      [0, 5, 7],
      [5, 0, 9],
      [7, 9, 0],
    ];
    const { matrix, diffs } = symmetrize(m);
    expect(matrix).toEqual(m);
    expect(diffs).toEqual([]);
  });

  it('averages mismatched pairs and reports diffs', () => {
    const m = [
      [0, 10, 7],
      [12, 0, 9],
      [7, 9, 0],
    ];
    const { matrix, diffs } = symmetrize(m);
    expect(matrix[0][1]).toBe(11);
    expect(matrix[1][0]).toBe(11);
    expect(diffs).toEqual([{ i: 0, j: 1, a: 10, b: 12, value: 11 }]);
  });

  it('does not mutate the input', () => {
    const m = [[0, 10], [12, 0]];
    const copy = m.map(r => [...r]);
    symmetrize(m);
    expect(m).toEqual(copy);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/excel.test.js
```

Expected: 3 failures with `symmetrize is not exported` or similar.

- [ ] **Step 3: Add the implementation**

Append to `src/lib/excel.js` (below the existing exports):

```js
// Average mismatched (i,j) / (j,i) pairs. Returns a fresh matrix and the
// list of corrections, leaving the input untouched.
export function symmetrize(matrix) {
  const n = matrix.length;
  const out = matrix.map((row) => [...row]);
  const diffs = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = out[i][j];
      const b = out[j][i];
      if (a === b) continue;
      const value = (a + b) / 2;
      out[i][j] = value;
      out[j][i] = value;
      diffs.push({ i, j, a, b, value });
    }
  }
  return { matrix: out, diffs };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/lib/excel.test.js
```

Expected: all `symmetrize` tests pass; existing tests still pass.

### 1b. `parseDistanceFile(file)` — strict matrix-only parser

- [ ] **Step 5: Write the failing tests**

Append to `src/lib/excel.test.js`:

```js
import { parseDistanceFile } from './excel.js';
import * as XLSX from 'xlsx';

function sheetFile(rows, name = 'm.xlsx') {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new File([buf], name);
}

describe('parseDistanceFile — happy path', () => {
  it('parses a 3x3 matrix with header row and column', async () => {
    const file = sheetFile([
      ['',  'A', 'B', 'C'],
      ['A',  0,  12,   9],
      ['B', 12,   0,   8],
      ['C',  9,   8,   0],
    ]);
    const { labels, matrix } = await parseDistanceFile(file);
    expect(labels).toEqual(['A', 'B', 'C']);
    expect(matrix).toEqual([
      [0, 12, 9],
      [12, 0, 8],
      [9, 8, 0],
    ]);
  });

  it('treats blank diagonal cells as 0', async () => {
    const file = sheetFile([
      ['',  'A', 'B'],
      ['A',  '',  5],
      ['B',   5, ''],
    ]);
    const { matrix } = await parseDistanceFile(file);
    expect(matrix).toEqual([[0, 5], [5, 0]]);
  });

  it('returns the raw (not symmetrized) matrix', async () => {
    const file = sheetFile([
      ['',  'A', 'B', 'C'],
      ['A',  0,  10,   9],
      ['B', 12,   0,   8],
      ['C',  9,   8,   0],
    ]);
    const { matrix } = await parseDistanceFile(file);
    expect(matrix[0][1]).toBe(10);
    expect(matrix[1][0]).toBe(12);
  });
});

describe('parseDistanceFile — validation errors', () => {
  it('rejects a file whose first sheet is empty', async () => {
    const file = sheetFile([]);
    await expect(parseDistanceFile(file)).rejects.toThrow(
      /could not read file|use a \.xlsx/i
    );
  });

  it('rejects a sheet missing the header column', async () => {
    const file = sheetFile([
      ['A', 'B'],
      [ 0,   5],
      [ 5,   0],
    ]);
    await expect(parseDistanceFile(file)).rejects.toThrow(/missing headers/i);
  });

  it('rejects a non-square matrix', async () => {
    const file = sheetFile([
      ['',  'A', 'B', 'C'],
      ['A',  0,   1,   2],
      ['B',  1,   0,   3],
    ]);
    await expect(parseDistanceFile(file)).rejects.toThrow(/not square/i);
  });

  it('rejects mismatched row/column labels', async () => {
    const file = sheetFile([
      ['',  'A', 'B', 'C'],
      ['A',  0,   1,   2],
      ['B',  1,   0,   3],
      ['X',  2,   3,   0],
    ]);
    await expect(parseDistanceFile(file)).rejects.toThrow(
      /row labels don't match/i
    );
  });

  it('rejects N < 3', async () => {
    const file = sheetFile([
      ['',  'A', 'B'],
      ['A',  0,   5],
      ['B',  5,   0],
    ]);
    await expect(parseDistanceFile(file)).rejects.toThrow(/between 3 and 20/i);
  });

  it('rejects N > 20', async () => {
    const labels = Array.from({ length: 21 }, (_, i) => `C${i}`);
    const rows = [['', ...labels]];
    for (let i = 0; i < 21; i++) {
      rows.push([labels[i], ...Array.from({ length: 21 }, (_, j) => i === j ? 0 : 1)]);
    }
    await expect(parseDistanceFile(sheetFile(rows))).rejects.toThrow(/between 3 and 20/i);
  });

  it('rejects non-numeric off-diagonal cells', async () => {
    const file = sheetFile([
      ['',  'A',  'B',  'C'],
      ['A',  0,   'oops', 9],
      ['B',  5,    0,     8],
      ['C',  9,    8,     0],
    ]);
    await expect(parseDistanceFile(file)).rejects.toThrow(
      /not a non-negative number/i
    );
  });

  it('rejects negative cells', async () => {
    const file = sheetFile([
      ['',  'A', 'B', 'C'],
      ['A',  0,  -1,   9],
      ['B', -1,   0,   8],
      ['C',  9,   8,   0],
    ]);
    await expect(parseDistanceFile(file)).rejects.toThrow(
      /not a non-negative number/i
    );
  });

  it('rejects non-zero diagonal cells', async () => {
    const file = sheetFile([
      ['',  'A', 'B', 'C'],
      ['A',  7,  12,   9],
      ['B', 12,   0,   8],
      ['C',  9,   8,   0],
    ]);
    await expect(parseDistanceFile(file)).rejects.toThrow(/diagonal/i);
  });
});
```

- [ ] **Step 6: Run tests to verify they fail**

```bash
npx vitest run src/lib/excel.test.js
```

Expected: all `parseDistanceFile` tests fail with `parseDistanceFile is not exported` or similar.

- [ ] **Step 7: Add the implementation**

Append to `src/lib/excel.js`:

```js
const MIN_N = 3;
const MAX_N = 20;

function readWorkbookRows(buffer) {
  const wb = XLSX.read(buffer, { type: 'array' });
  if (!wb.SheetNames.length) return [];
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });
}

function isBlank(v) {
  return v === '' || v === null || v === undefined;
}

// Strict matrix parser. Throws on the first failure with a user-facing message.
// Returns the RAW matrix; callers run `symmetrize` separately.
export async function parseDistanceFile(file) {
  let rows;
  try {
    rows = readWorkbookRows(await file.arrayBuffer());
  } catch {
    throw new Error('Could not read file. Use a .xlsx, .xls, or .csv distance matrix.');
  }

  rows = rows.filter((r) => Array.isArray(r) && r.some((c) => !isBlank(c)));
  if (rows.length === 0) {
    throw new Error('Could not read file. Use a .xlsx, .xls, or .csv distance matrix.');
  }

  // Header row must start with a blank (or label) cell and have at least 2 names.
  const header = rows[0];
  const colLabels = header.slice(1).map((c) => String(c ?? '').trim());
  if (colLabels.length === 0 || colLabels.some(isBlank)) {
    throw new Error('Missing headers. Row 1 and column A must contain city names.');
  }

  const body = rows.slice(1);
  const rowLabels = body.map((r) => String(r[0] ?? '').trim());
  if (rowLabels.length === 0 || rowLabels.some(isBlank)) {
    throw new Error('Missing headers. Row 1 and column A must contain city names.');
  }

  const n = colLabels.length;
  if (body.length !== n) {
    throw new Error(`Matrix is not square: ${n} header columns vs. ${body.length} data rows.`);
  }
  for (let i = 0; i < n; i++) {
    if (body[i].length - 1 < n) {
      throw new Error(`Matrix is not square: row ${i + 1} has ${body[i].length - 1} values, expected ${n}.`);
    }
  }

  for (let i = 0; i < n; i++) {
    if (rowLabels[i] !== colLabels[i]) {
      throw new Error("Row labels don't match column labels.");
    }
  }

  if (n < MIN_N || n > MAX_N) {
    throw new Error(`Need between ${MIN_N} and ${MAX_N} cities, found ${n}.`);
  }

  const labels = colLabels;
  const matrix = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const raw = body[i][j + 1];
      if (i === j) {
        if (isBlank(raw)) { matrix[i][j] = 0; continue; }
        const num = Number(raw);
        if (!Number.isFinite(num) || num !== 0) {
          throw new Error(`Cell (${labels[i]}, ${labels[j]}) on the diagonal must be 0.`);
        }
        matrix[i][j] = 0;
        continue;
      }
      const num = Number(raw);
      if (isBlank(raw) || !Number.isFinite(num) || num < 0) {
        throw new Error(`Cell (${labels[i]}, ${labels[j]}) is not a non-negative number: "${raw ?? ''}".`);
      }
      matrix[i][j] = num;
    }
  }

  return { labels, matrix };
}
```

- [ ] **Step 8: Run tests to verify they pass**

```bash
npx vitest run src/lib/excel.test.js
```

Expected: all `parseDistanceFile` and `symmetrize` tests pass; pre-existing tests still pass.

### 1c. `buildTemplate(n)` — downloadable skeleton

- [ ] **Step 9: Write the failing test**

Append to `src/lib/excel.test.js`:

```js
import { buildTemplate } from './excel.js';

describe('buildTemplate', () => {
  it('produces a parseable 4x4 skeleton round-trippable through parseDistanceFile', async () => {
    const blob = buildTemplate();
    const file = new File([await blob.arrayBuffer()], 'tpl.xlsx');
    const { labels, matrix } = await parseDistanceFile(file);
    expect(labels).toEqual(['City1', 'City2', 'City3', 'City4']);
    expect(matrix.every((row, i) => row.every((v, j) => i === j ? v === 0 : v >= 0))).toBe(true);
  });

  it('respects a custom n', async () => {
    const blob = buildTemplate(5);
    const file = new File([await blob.arrayBuffer()], 'tpl.xlsx');
    const { labels } = await parseDistanceFile(file);
    expect(labels).toHaveLength(5);
  });
});
```

- [ ] **Step 10: Run test to verify it fails**

```bash
npx vitest run src/lib/excel.test.js
```

Expected: `buildTemplate is not exported`.

- [ ] **Step 11: Add the implementation**

Append to `src/lib/excel.js`:

```js
// Build a small N×N .xlsx skeleton with default labels and zeros on the
// diagonal. Off-diagonal cells are filled with 1 so the file round-trips
// through parseDistanceFile (which requires non-negative finite numbers).
// Users overwrite these with real distances before importing.
export function buildTemplate(n = 4) {
  const labels = Array.from({ length: n }, (_, i) => `City${i + 1}`);
  const rows = [['', ...labels]];
  for (let i = 0; i < n; i++) {
    const row = [labels[i]];
    for (let j = 0; j < n; j++) row.push(i === j ? 0 : 1);
    rows.push(row);
  }
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Distances');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
```

- [ ] **Step 12: Run tests to verify they pass**

```bash
npx vitest run src/lib/excel.test.js
```

Expected: all new tests pass; existing tests still pass.

### 1d. Commit

- [ ] **Step 13: Verify the rest of the test suite is still green**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 14: Commit**

```bash
git add src/lib/excel.js src/lib/excel.test.js
git commit -m "feat(excel): add strict distance-matrix parser, symmetrize, template

Adds parseDistanceFile, symmetrize, and buildTemplate. The old
readFileToRows / parseSheetRows exports remain in place; they are
removed in the cleanup task once their callers migrate."
```

---

## Task 2: utils.js — add `buildEuclideanMatrix`

**Files:**
- Modify: `src/algorithms/utils.js`
- Test: `src/algorithms/utils.test.js`

The old `buildCostMatrix` (per-cell override) and `isSymmetric` remain in place — they're removed in Task 6 once the hook stops calling them.

- [ ] **Step 1: Write the failing test**

Append to `src/algorithms/utils.test.js`:

```js
import { buildEuclideanMatrix } from './utils.js';

describe('buildEuclideanMatrix', () => {
  const cities = [{ x: 0, y: 0 }, { x: 3, y: 4 }, { x: 0, y: 4 }];

  it('produces an N×N matrix with 0 on the diagonal', () => {
    const m = buildEuclideanMatrix(cities);
    expect(m).toHaveLength(3);
    expect(m[0]).toHaveLength(3);
    expect(m[0][0]).toBe(0);
    expect(m[1][1]).toBe(0);
    expect(m[2][2]).toBe(0);
  });

  it('uses Euclidean distance for off-diagonal cells', () => {
    const m = buildEuclideanMatrix(cities);
    expect(m[0][1]).toBeCloseTo(5);
    expect(m[0][2]).toBeCloseTo(4);
    expect(m[1][2]).toBeCloseTo(3);
  });

  it('is symmetric', () => {
    const m = buildEuclideanMatrix(cities);
    for (let i = 0; i < m.length; i++) {
      for (let j = 0; j < m.length; j++) {
        expect(m[i][j]).toBeCloseTo(m[j][i]);
      }
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/algorithms/utils.test.js
```

Expected: `buildEuclideanMatrix is not exported`.

- [ ] **Step 3: Add the implementation**

Add to `src/algorithms/utils.js` (next to `buildCostMatrix`):

```js
// N×N matrix where cell[i][j] is the Euclidean distance between cities[i]
// and cities[j], and the diagonal is 0. Used when no custom matrix is set.
export const buildEuclideanMatrix = (cities) => {
  const n = cities.length;
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 0 : distance(cities[i], cities[j])))
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/algorithms/utils.test.js
```

Expected: new tests pass; existing tests still pass.

- [ ] **Step 5: Commit**

```bash
git add src/algorithms/utils.js src/algorithms/utils.test.js
git commit -m "feat(utils): add buildEuclideanMatrix (no override merging)

Distinct from the existing buildCostMatrix, which is removed in the
cleanup task once useTSPSolver migrates."
```

---

## Task 3: Rewire `useTSPSolver` to the two-mode model

**Files:**
- Modify: `src/hooks/useTSPSolver.js`
- Modify: `src/components/DistanceMatrix.jsx` (temporary minimal stub — replaced in Task 4)

This task swaps the hook's `customMatrix` semantics from per-cell-nullable to all-or-nothing, adds `cityLabels` state, replaces `setMatrixCell`/`importFromFile` with `applyCustomMatrix`, removes the B&B symmetry guard, and adds mode guards on `addCity`/`generateRandom`. `DistanceMatrix.jsx` becomes a temporary stub so the app keeps compiling — Task 4 replaces it.

There's no clean TDD pattern for a multi-state React hook of this size; verify with `npx vitest run` after edits and by running `npm run dev` and clicking through.

- [ ] **Step 1: Replace the imports block at the top of `src/hooks/useTSPSolver.js`**

```js
import { useState, useRef, useCallback, useEffect } from 'react';
import { nearestNeighborSolver } from '../algorithms/nearestNeighbor.js';
import { twoOptSolver } from '../algorithms/twoOpt.js';
import { simulatedAnnealingSolver } from '../algorithms/simulatedAnnealing.js';
import { geneticSolver } from '../algorithms/genetic.js';
import { bruteForceSolver } from '../algorithms/bruteForce.js';
import { branchAndBoundSolver } from '../algorithms/branchAndBound.js';
import { buildEuclideanMatrix } from '../algorithms/utils.js';
import { circleLayout } from '../lib/matrix.js';
```

The previous lines that imported `buildCostMatrix`, `isSymmetric`, `readFileToRows`, `parseSheetRows`, `reconcileImport` are removed in this same edit.

- [ ] **Step 2: Add `cityLabels` state next to `customMatrix`**

Find the `const [customMatrix, setCustomMatrix] = useState(null);` line and add immediately below it:

```js
  const [cityLabels, setCityLabels] = useState(null);
```

- [ ] **Step 3: In `start()`, remove the B&B symmetry guard and switch to `buildEuclideanMatrix`**

Replace the body block from the `if (algorithmRef.current === 'branchAndBound' && cities.length > 12) { ... }` check through the `const matrix = ...` and the now-stale symmetry guard with:

```js
    if (algorithmRef.current === 'branchAndBound' && cities.length > 12) {
      addLog('ERROR: Branch & Bound limited to 12 cities max', 'error');
      showToast('Branch & Bound: max 12 cities', 'error');
      return;
    }

    const matrix = customMatrix ?? buildEuclideanMatrix(cities);
```

That is: delete the `buildCostMatrix(cities, customMatrix)` line and the entire `if (algorithmRef.current === 'branchAndBound' && !isSymmetric(matrix)) { ... }` block.

- [ ] **Step 4: In `addCity`, replace the invalidation block with a hard guard**

Replace the current `addCity` callback:

```js
  const addCity = useCallback((city) => {
    if (isRunningRef.current) return;
    if (customMatrix) return; // custom-matrix mode owns the node set
    setCities(prev => {
      if (prev.length >= 20) return prev;
      return [...prev, city];
    });
  }, [customMatrix]);
```

- [ ] **Step 5: In `generateRandom`, add the same mode guard and drop the `setCustomMatrix(null)` line**

```js
  const generateRandom = useCallback((count) => {
    if (isRunningRef.current) return;
    if (customMatrix) return;
    stopInterval();
    genRef.current = null;
    setIsRunning(false);
    setIsPaused(false);
    const margin = 80;
    const newCities = Array.from({ length: count }, () => ({
      x: Math.random() * (1000 - margin * 2) + margin,
      y: Math.random() * (700 - margin * 2) + margin,
    }));
    setCities(newCities);
    setSolverState(INITIAL_STATE);
    setComparisonResults(null);
    addLog(`GENERATED — ${count} random cities`, 'system');
  }, [customMatrix, stopInterval, addLog]);
```

- [ ] **Step 6: In `clearCities`, also clear `cityLabels`**

Find the existing `setCustomMatrix(null);` line in `clearCities` and add right after:

```js
    setCityLabels(null);
```

- [ ] **Step 7: Replace `setMatrixCell` and `resetMatrix` with `applyCustomMatrix` and a new `resetMatrix`**

Delete the existing `setMatrixCell` and `resetMatrix` callbacks. Replace with:

```js
  const applyCustomMatrix = useCallback(({ matrix, labels }) => {
    if (isRunningRef.current) return;
    const n = matrix.length;
    const positions = circleLayout(n);
    const newCities = positions.map((p, i) => ({ ...p, label: labels[i] }));
    stopInterval();
    genRef.current = null;
    setIsRunning(false);
    setIsPaused(false);
    isRunningRef.current = false;
    setCities(newCities);
    setCustomMatrix(matrix);
    setCityLabels(labels);
    setSolverState(INITIAL_STATE);
    setComparisonResults(null);
    addLog(`APPLIED — custom ${n}×${n} matrix (${algorithmRef.current})`, 'system');
    showToast(`Custom matrix applied (${n} cities)`, 'success');

    // Auto-run, honoring the same algorithm caps as the RUN button.
    const algo = algorithmRef.current;
    if (algo === 'bruteForce' && n > 10) {
      addLog('AUTO-RUN SKIPPED — Brute force limited to 10 cities max', 'warn');
      showToast('Brute force: max 10 cities', 'error');
      return;
    }
    if (algo === 'branchAndBound' && n > 12) {
      addLog('AUTO-RUN SKIPPED — Branch & Bound limited to 12 cities max', 'warn');
      showToast('Branch & Bound: max 12 cities', 'error');
      return;
    }
    genRef.current = ALGORITHM_MAP[algo](newCities, matrix);
    startTimeRef.current = Date.now();
    prevBestRef.current = Infinity;
    setSolverState({ ...INITIAL_STATE, phase: 'running' });
    setIsRunning(true);
    isRunningRef.current = true;
    addLog(`INIT — algorithm: ${algo} | cities: ${n}`, 'system');
  }, [stopInterval, addLog, showToast]);

  const resetMatrix = useCallback(() => {
    if (isRunningRef.current) return;
    stopInterval();
    genRef.current = null;
    setIsRunning(false);
    setIsPaused(false);
    isRunningRef.current = false;
    setCities([]);
    setCustomMatrix(null);
    setCityLabels(null);
    setSolverState(INITIAL_STATE);
    setComparisonResults(null);
    addLog('RESET — custom matrix cleared, canvas empty', 'system');
  }, [stopInterval, addLog]);
```

- [ ] **Step 8: Delete `importFromFile`**

Remove the entire `importFromFile` callback. (The new staging UI in Task 4 will call `applyCustomMatrix` directly with the parsed result.)

- [ ] **Step 9: In `runComparison`, switch to `buildEuclideanMatrix` and drop the asymmetric skip**

Replace the inside of the `setTimeout(...)` block with:

```js
    setTimeout(() => {
      const matrix = customMatrix ?? buildEuclideanMatrix(cities);
      const results = {};
      for (const [name, solverFn] of Object.entries(ALGORITHM_MAP)) {
        const cityLimit = name === 'bruteForce' ? 10 : name === 'branchAndBound' ? 12 : Infinity;
        if (cities.length > cityLimit) {
          results[name] = { distance: null, time: null, skipped: true, tour: [] };
          addLog(`  ${name}: SKIPPED (${cities.length} cities > ${cityLimit})`, 'warn');
          continue;
        }
        const t0 = Date.now();
        const gen = solverFn([...cities], matrix);
        let lastValue = null;
        let r = gen.next();
        while (!r.done) { if (r.value) lastValue = r.value; r = gen.next(); }
        if (r.value) lastValue = r.value;
        const elapsed = Date.now() - t0;
        const dist = lastValue?.distance ?? Infinity;
        results[name] = { distance: dist, time: elapsed, tour: lastValue?.tour ?? [], skipped: false };
        addLog(`  ${name}: ${dist.toFixed(2)} units in ${elapsed}ms`, 'info');
      }
      setComparisonResults(results);
      setIsComparing(false);
      addLog('COMPARISON DONE', 'success');
    }, 10);
```

- [ ] **Step 10: Update the hook's `return` block**

Replace the existing return object with:

```js
  return {
    cities, customMatrix, cityLabels, algorithm, speed, isRunning, isPaused, solverState,
    logs, comparisonResults, isComparing, toast,
    addCity, clearCities, generateRandom,
    applyCustomMatrix, resetMatrix,
    setAlgorithm, setSpeed, start, pause, resume, reset, runComparison, clearComparison,
    addLog, showToast,
  };
```

(`addLog` and `showToast` are exposed so the staging panel in Task 4 can report parse errors through the same channels.)

- [ ] **Step 11: Update the dependency array of `start()`**

Find the closing `}, [cities, customMatrix, addLog, showToast, stopInterval]);` on `start()` — leave it as-is; the inputs are unchanged. Sanity-check after the edit.

- [ ] **Step 12: Update the dependency array of `runComparison()`**

Find the closing `}, [cities, customMatrix, addLog]);` — leave as-is.

- [ ] **Step 13: Replace `src/components/DistanceMatrix.jsx` with a minimal stub**

Overwrite the file entirely with:

```jsx
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
```

- [ ] **Step 14: Run the unit test suite**

```bash
npx vitest run
```

Expected: existing solver, utils, excel, and matrix tests all pass. (`utils.test.js`'s legacy `buildCostMatrix`/`isSymmetric` tests still pass because we haven't removed those exports yet.)

- [ ] **Step 15: Smoke-test the dev server**

```bash
npm run dev
```

Expected: app boots, you can click to place cities, RANDOM CITIES still works, START runs the selected algorithm. The `DistanceMatrix` card shows the stub with a disabled RESET button. Stop the server (`Ctrl+C`) before continuing.

- [ ] **Step 16: Commit**

```bash
git add src/hooks/useTSPSolver.js src/components/DistanceMatrix.jsx
git commit -m "refactor(solver): two-mode model with applyCustomMatrix

Replaces the per-cell override / asymmetric customMatrix model with a
single all-or-nothing matrix plus cityLabels. Adds applyCustomMatrix,
which atomically swaps cities (circle layout) + matrix + labels and
auto-runs the selected algorithm. Removes the B&B symmetry guard
(matrix is now always symmetric) and the node-set invalidation in
addCity/generateRandom (those are gated on customMatrix instead).

DistanceMatrix is temporarily a stub; the full staging UI lands in
the next task."
```

---

## Task 4: `DistanceMatrix.jsx` — full staging UI

**Files:**
- Modify: `src/components/DistanceMatrix.jsx`

Owns local working state (working N, labels, upper-triangle cell strings, raw pre-symmetrize matrix, diff list). Calls into the hook only on Apply / Reset / Cancel.

- [ ] **Step 1: Replace the file entirely**

Overwrite `src/components/DistanceMatrix.jsx` with:

```jsx
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
    active ? cityLabels.map((l) => (l === defaultLabel(0) ? '' : l)) : blankLabels(5)
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
              className="ctrl-btn"
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
```

- [ ] **Step 2: Smoke-test in the browser**

```bash
npm run dev
```

Walk through:
1. Open the DISTANCE MATRIX panel. Set N=4. Type a label "Paris" in input 1.
2. Fill the upper triangle: (Paris→2)=10, (Paris→3)=15, (Paris→4)=20, (2→3)=5, (2→4)=12, (3→4)=8.
3. Verify lower triangle shows `(10)`, `(15)`, etc. in dimmed style.
4. Press APPLY. Verify the canvas shows 4 circle-arranged nodes with the label "Paris" on node 0, and the solver auto-runs the currently selected algorithm.
5. Reopen the panel — working grid should be pre-filled.
6. Press RESET TO DEFAULT — canvas empties, panel collapses. Click on canvas to place a city — should work again.
7. Press TEMPLATE — verify `tsp-distance-template.xlsx` downloads.
8. Open the downloaded template in Excel/LibreOffice, change a few off-diagonal values, save, IMPORT it. Verify the grid populates and "Apply" works.
9. Make the downloaded file asymmetric (change one off-diagonal cell only). IMPORT — verify the diffs banner appears with the right average.
10. Try IMPORT with an obviously bad file (e.g., the same template but with a non-numeric cell) — verify a toast appears with a specific error.

Stop the server (`Ctrl+C`) before continuing.

- [ ] **Step 3: Run the unit test suite**

```bash
npx vitest run
```

Expected: all tests still pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/DistanceMatrix.jsx
git commit -m "feat(ui): symmetric distance matrix editor with staging + import preview

Local working state for N, labels, upper-triangle cells. Symmetric
mirroring (lower triangle is read-only display). Apply gate blocks
on empty/invalid cells. Excel import populates the staging grid for
preview-then-apply. Symmetrization runs after parse with a non-
blocking diff banner and 'Undo & view raw' affordance. Template
download via SheetJS."
```

---

## Task 5: Canvas labels + ControlPanel disabled states

**Files:**
- Modify: `src/components/Canvas.jsx`
- Modify: `src/components/ControlPanel.jsx`

Two small visual touchups that match the new model.

- [ ] **Step 1: Update `Canvas.jsx` to render `city.label` when present**

Find the existing index-label block in `src/components/Canvas.jsx`:

```jsx
              {/* Index label */}
              <text
                x={city.x + 9} y={city.y - 9}
                fill={tc.accent} fontSize="10" fontFamily="JetBrains Mono, monospace"
                opacity="0.9" style={{ userSelect: 'none' }}
              >
                {i}
              </text>
```

Replace the `{i}` with `{city.label ?? i}`:

```jsx
              {/* Label (custom matrix mode) or index (Euclidean mode) */}
              <text
                x={city.x + 9} y={city.y - 9}
                fill={tc.accent} fontSize="10" fontFamily="JetBrains Mono, monospace"
                opacity="0.9" style={{ userSelect: 'none' }}
              >
                {city.label ?? i}
              </text>
```

- [ ] **Step 2: Update `ControlPanel.jsx` to disable city-add buttons when `customMatrix` is active**

Find the destructure at the top of `ControlPanel`:

```jsx
  const {
    algorithm, speed, isRunning, isPaused, cities,
    setAlgorithm, setSpeed, start, pause, resume, reset,
    clearCities, generateRandom,
  } = solver;
```

Replace with:

```jsx
  const {
    algorithm, speed, isRunning, isPaused, cities, customMatrix,
    setAlgorithm, setSpeed, start, pause, resume, reset,
    clearCities, generateRandom,
  } = solver;

  const matrixActive = customMatrix != null;
  const lockedTitle = 'Disabled while custom matrix is active — RESET TO DEFAULT to re-enable';
```

Then find the RANDOM CITIES section:

```jsx
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
```

Replace with:

```jsx
      {/* City generator */}
      <div>
        <div className="label-text mb-2">RANDOM CITIES</div>
        <div className="grid grid-cols-4 gap-1">
          {CITY_PRESETS.map(n => (
            <button
              key={n}
              onClick={() => generateRandom(n)}
              disabled={isRunning || matrixActive}
              className="city-btn"
              title={matrixActive ? lockedTitle : `Generate ${n} random cities`}
              style={{ opacity: matrixActive ? 0.4 : undefined }}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
```

Click-to-place is handled by the Canvas's `handleClick` going through `addCity`, which Task 3 already guards on `customMatrix`. The Canvas doesn't need an extra UI change here (the cursor stays "crosshair", but clicks are no-ops — acceptable since the matrix panel makes the mode obvious).

- [ ] **Step 3: Smoke-test in the browser**

```bash
npm run dev
```

Walk through:
1. Apply a 4×4 custom matrix. Verify city labels render next to the nodes.
2. Verify RANDOM CITIES buttons (8/12/16/20) are dimmed/disabled.
3. Verify clicks on the canvas don't add new cities.
4. RESET TO DEFAULT, verify RANDOM CITIES re-enables and labels disappear (nodes show index again).

Stop the server before continuing.

- [ ] **Step 4: Commit**

```bash
git add src/components/Canvas.jsx src/components/ControlPanel.jsx
git commit -m "feat(ui): render city labels and gate city-add in custom matrix mode

Canvas now renders city.label when present (custom matrix mode),
falling back to the index otherwise. ControlPanel disables RANDOM
CITIES when customMatrix is active, with a tooltip pointing at
RESET TO DEFAULT."
```

---

## Task 6: Cleanup — remove dead code from prior design

**Files:**
- Modify: `src/algorithms/utils.js`
- Modify: `src/algorithms/utils.test.js`
- Modify: `src/lib/excel.js`
- Modify: `src/lib/excel.test.js`
- Modify: `src/lib/matrix.js`
- Modify: `src/lib/matrix.test.js`

At this point, the old `buildCostMatrix`, `isSymmetric`, `readFileToRows`, `parseSheetRows` (+ `parseMatrix`/`parseEdgeList` internals), and `reconcileImport` have no callers in the app. Their tests still pass but they're dead weight. This task removes them and trims tests.

- [ ] **Step 1: Verify nothing still imports the dead exports**

```bash
grep -rn "buildCostMatrix\|isSymmetric\|readFileToRows\|parseSheetRows\|reconcileImport" src --include="*.js" --include="*.jsx"
```

Expected: matches only inside `src/algorithms/utils.js`, `src/algorithms/utils.test.js`, `src/lib/excel.js`, `src/lib/excel.test.js`, `src/lib/matrix.js`, `src/lib/matrix.test.js`. If any other file shows up, fix that first.

- [ ] **Step 2: Trim `src/algorithms/utils.js`**

Replace the whole file with:

```js
export const distance = (a, b) =>
  Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

// N×N matrix where cell[i][j] is the Euclidean distance between cities[i]
// and cities[j], and the diagonal is 0. Used when no custom matrix is set.
export const buildEuclideanMatrix = (cities) => {
  const n = cities.length;
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 0 : distance(cities[i], cities[j])))
  );
};

// Sum of directed edge costs around the closed tour.
export const tourCost = (matrix, tour) => {
  if (!tour || tour.length < 2) return 0;
  let d = 0;
  for (let i = 0; i < tour.length; i++) {
    d += matrix[tour[i]][tour[(i + 1) % tour.length]];
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
```

- [ ] **Step 3: Trim `src/algorithms/utils.test.js`**

Replace the whole file with:

```js
import { describe, it, expect } from 'vitest';
import { buildEuclideanMatrix, tourCost } from './utils.js';

describe('buildEuclideanMatrix', () => {
  const cities = [{ x: 0, y: 0 }, { x: 3, y: 4 }, { x: 0, y: 4 }];

  it('produces an N×N matrix with 0 on the diagonal', () => {
    const m = buildEuclideanMatrix(cities);
    expect(m).toHaveLength(3);
    expect(m[0]).toHaveLength(3);
    expect(m[0][0]).toBe(0);
    expect(m[1][1]).toBe(0);
    expect(m[2][2]).toBe(0);
  });

  it('uses Euclidean distance for off-diagonal cells', () => {
    const m = buildEuclideanMatrix(cities);
    expect(m[0][1]).toBeCloseTo(5);
    expect(m[0][2]).toBeCloseTo(4);
    expect(m[1][2]).toBeCloseTo(3);
  });

  it('is symmetric', () => {
    const m = buildEuclideanMatrix(cities);
    for (let i = 0; i < m.length; i++) {
      for (let j = 0; j < m.length; j++) {
        expect(m[i][j]).toBeCloseTo(m[j][i]);
      }
    }
  });
});

describe('tourCost', () => {
  const m = [
    [0, 1, 2],
    [1, 0, 8],
    [2, 8, 0],
  ];
  it('sums edges around the closed tour', () => {
    expect(tourCost(m, [0, 1, 2])).toBe(1 + 8 + 2);
  });
  it('returns 0 for trivial tours', () => {
    expect(tourCost(m, [0])).toBe(0);
  });
});
```

- [ ] **Step 4: Trim `src/lib/excel.js`**

Delete the constants `DIST_KEYS`, `FROM_KEYS`, `TO_KEYS`, the `toCell`, `parseMatrix`, `parseEdgeList`, `parseSheetRows`, and `readFileToRows` functions. The file should contain only `XLSX` import + `parseDistanceFile`, `symmetrize`, `buildTemplate`, `readWorkbookRows`, `isBlank`, `MIN_N`, `MAX_N`. Concretely, the file becomes:

```js
import * as XLSX from 'xlsx';

const MIN_N = 3;
const MAX_N = 20;

function readWorkbookRows(buffer) {
  const wb = XLSX.read(buffer, { type: 'array' });
  if (!wb.SheetNames.length) return [];
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });
}

function isBlank(v) {
  return v === '' || v === null || v === undefined;
}

// Strict matrix parser. Throws on the first failure with a user-facing message.
// Returns the RAW matrix; callers run `symmetrize` separately.
export async function parseDistanceFile(file) {
  let rows;
  try {
    rows = readWorkbookRows(await file.arrayBuffer());
  } catch {
    throw new Error('Could not read file. Use a .xlsx, .xls, or .csv distance matrix.');
  }

  rows = rows.filter((r) => Array.isArray(r) && r.some((c) => !isBlank(c)));
  if (rows.length === 0) {
    throw new Error('Could not read file. Use a .xlsx, .xls, or .csv distance matrix.');
  }

  const header = rows[0];
  const colLabels = header.slice(1).map((c) => String(c ?? '').trim());
  if (colLabels.length === 0 || colLabels.some(isBlank)) {
    throw new Error('Missing headers. Row 1 and column A must contain city names.');
  }

  const body = rows.slice(1);
  const rowLabels = body.map((r) => String(r[0] ?? '').trim());
  if (rowLabels.length === 0 || rowLabels.some(isBlank)) {
    throw new Error('Missing headers. Row 1 and column A must contain city names.');
  }

  const n = colLabels.length;
  if (body.length !== n) {
    throw new Error(`Matrix is not square: ${n} header columns vs. ${body.length} data rows.`);
  }
  for (let i = 0; i < n; i++) {
    if (body[i].length - 1 < n) {
      throw new Error(`Matrix is not square: row ${i + 1} has ${body[i].length - 1} values, expected ${n}.`);
    }
  }

  for (let i = 0; i < n; i++) {
    if (rowLabels[i] !== colLabels[i]) {
      throw new Error("Row labels don't match column labels.");
    }
  }

  if (n < MIN_N || n > MAX_N) {
    throw new Error(`Need between ${MIN_N} and ${MAX_N} cities, found ${n}.`);
  }

  const labels = colLabels;
  const matrix = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const raw = body[i][j + 1];
      if (i === j) {
        if (isBlank(raw)) { matrix[i][j] = 0; continue; }
        const num = Number(raw);
        if (!Number.isFinite(num) || num !== 0) {
          throw new Error(`Cell (${labels[i]}, ${labels[j]}) on the diagonal must be 0.`);
        }
        matrix[i][j] = 0;
        continue;
      }
      const num = Number(raw);
      if (isBlank(raw) || !Number.isFinite(num) || num < 0) {
        throw new Error(`Cell (${labels[i]}, ${labels[j]}) is not a non-negative number: "${raw ?? ''}".`);
      }
      matrix[i][j] = num;
    }
  }

  return { labels, matrix };
}

// Average mismatched (i,j) / (j,i) pairs. Returns a fresh matrix and the
// list of corrections, leaving the input untouched.
export function symmetrize(matrix) {
  const n = matrix.length;
  const out = matrix.map((row) => [...row]);
  const diffs = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = out[i][j];
      const b = out[j][i];
      if (a === b) continue;
      const value = (a + b) / 2;
      out[i][j] = value;
      out[j][i] = value;
      diffs.push({ i, j, a, b, value });
    }
  }
  return { matrix: out, diffs };
}

// Build a small N×N .xlsx skeleton with default labels and zeros on the
// diagonal. Off-diagonal cells are filled with 1 so the file round-trips
// through parseDistanceFile (which requires non-negative finite numbers).
// Users overwrite these with real distances before importing.
export function buildTemplate(n = 4) {
  const labels = Array.from({ length: n }, (_, i) => `City${i + 1}`);
  const rows = [['', ...labels]];
  for (let i = 0; i < n; i++) {
    const row = [labels[i]];
    for (let j = 0; j < n; j++) row.push(i === j ? 0 : 1);
    rows.push(row);
  }
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Distances');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
```

- [ ] **Step 5: Trim `src/lib/excel.test.js`**

Delete the two top describe blocks that reference `parseSheetRows` (the matrix and edge-list cases) and the legacy validation describe block. Keep all `symmetrize`, `parseDistanceFile`, and `buildTemplate` describes added in Task 1. Concretely the file's top imports become:

```js
import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseDistanceFile, symmetrize, buildTemplate } from './excel.js';
```

Remove any duplicate `import { parseSheetRows }` line and the legacy `describe('parseSheetRows — matrix layout', ...)`, `describe('parseSheetRows — edge list layout', ...)`, and `describe('parseSheetRows — validation', ...)` blocks.

- [ ] **Step 6: Trim `src/lib/matrix.js`**

Replace the whole file with:

```js
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
```

- [ ] **Step 7: Trim `src/lib/matrix.test.js`**

Replace the whole file with:

```js
import { describe, it, expect } from 'vitest';
import { circleLayout } from './matrix.js';

describe('circleLayout', () => {
  it('produces n points inside the canvas bounds', () => {
    const pts = circleLayout(5);
    expect(pts).toHaveLength(5);
    for (const p of pts) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(1000);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(700);
    }
  });

  it('places the first node at the top of the circle', () => {
    const pts = circleLayout(4, 1000, 700, 90);
    expect(pts[0].x).toBeCloseTo(500);
    expect(pts[0].y).toBeCloseTo(700 / 2 - (Math.min(1000, 700) / 2 - 90));
  });
});
```

- [ ] **Step 8: Run the full test suite**

```bash
npx vitest run
```

Expected: all tests pass (no references to removed exports).

- [ ] **Step 9: Smoke-test once more**

```bash
npm run dev
```

Quick walk-through: empty canvas → click two cities → START runs Euclidean tour. Then open DISTANCE MATRIX → set N=5 → fill it → APPLY → tour reruns with the custom matrix. RESET TO DEFAULT → empty canvas again. Stop the server.

- [ ] **Step 10: Commit**

```bash
git add src/algorithms/utils.js src/algorithms/utils.test.js src/lib/excel.js src/lib/excel.test.js src/lib/matrix.js src/lib/matrix.test.js
git commit -m "chore: remove dead code from prior asymmetric distance design

Drops buildCostMatrix and isSymmetric (utils), readFileToRows and
parseSheetRows + edge-list internals (excel), reconcileImport (matrix),
and their tests. All callers migrated to the two-mode model in
earlier tasks."
```

---

## Done

After Task 6 the branch is feature-complete against the spec:

- ✓ Manual symmetric distance entry with optional labels, validation, Apply gate
- ✓ Excel import preview with per-cell errors, symmetrization auto-correct + diff banner + Undo
- ✓ Downloadable .xlsx template
- ✓ Two-mode model: Euclidean (default) ↔ Custom Matrix
- ✓ Auto-circle layout in Custom Matrix mode; click-to-place / RANDOM CITIES gated
- ✓ Reset to Default returns to empty Euclidean canvas
- ✓ Solver auto-runs on Apply, with B&B / Brute Force cap toasts preserved
- ✓ All six solvers unchanged (already on the `(cities, matrix)` signature)
- ✓ Dead code from the prior asymmetric design removed; test suite green
