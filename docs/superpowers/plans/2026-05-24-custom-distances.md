# Custom Distances Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users override Euclidean edge costs with a custom distance matrix, edited by hand or imported from an Excel file, while keeping the existing coordinate-based workflow intact.

**Architecture:** Introduce an N×N **cost matrix** as the contract between the node set and the solvers. All algorithms read edge cost from `matrix[i][j]` instead of computing Euclidean distance from coordinates. The hook builds the effective matrix (`override ?? euclidean`) before each run. A new editor component and an Excel parser populate the override matrix.

**Tech Stack:** React 19, Vite, framer-motion, `xlsx` (SheetJS, new), `vitest` (new, dev). Algorithms are pure generator functions.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/algorithms/utils.js` | Pure cost functions: `distance`, `buildCostMatrix`, `tourCost`, `isSymmetric`, `shuffleArray` |
| `src/algorithms/*.js` (6 solvers) | Consume `(cities, matrix)`; cost via `matrix[i][j]` / `tourCost` |
| `src/lib/excel.js` | Pure `parseSheetRows(rows)` → `{labels, matrix}`; thin `readFileToRows(file)` using `xlsx` |
| `src/lib/matrix.js` | Pure `circleLayout(n)`, `reconcileImport(cities, parsed)` |
| `src/hooks/useTSPSolver.js` | Owns `customMatrix`; `setMatrixCell`/`resetMatrix`/`importFromFile`; B&B symmetry guard; passes matrix to solvers; invalidation |
| `src/components/DistanceMatrix.jsx` | Editable grid + Excel import button (presentational) |
| `src/App.jsx` | Mounts `DistanceMatrix` in the sidebar |

---

## Task 1: Add tooling (vitest + xlsx)

**Files:**
- Modify: `package.json`
- Create: `src/sanity.test.js`

- [ ] **Step 1: Install dependencies**

Run:
```bash
npm install xlsx
npm install -D vitest
```
Expected: both added to `package.json`, no errors.

- [ ] **Step 2: Add the test script**

In `package.json`, add to the `"scripts"` block (after `"lint"`):
```json
    "test": "vitest run",
```

- [ ] **Step 3: Write a sanity test**

Create `src/sanity.test.js`:
```js
import { describe, it, expect } from 'vitest';

describe('test runner', () => {
  it('works', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 4: Run it**

Run: `npx vitest run src/sanity.test.js`
Expected: PASS (1 passed).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/sanity.test.js
git commit -m "chore: add vitest and xlsx for custom-distance feature"
```

---

## Task 2: Cost functions in utils.js

**Files:**
- Modify: `src/algorithms/utils.js`
- Test: `src/algorithms/utils.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/algorithms/utils.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { buildCostMatrix, tourCost, isSymmetric } from './utils.js';

describe('buildCostMatrix', () => {
  const cities = [{ x: 0, y: 0 }, { x: 3, y: 4 }, { x: 0, y: 4 }];

  it('falls back to euclidean when no override', () => {
    const m = buildCostMatrix(cities, null);
    expect(m[0][1]).toBeCloseTo(5);
    expect(m[0][2]).toBeCloseTo(4);
    expect(m[1][2]).toBeCloseTo(3);
    expect(m[0][0]).toBe(0);
  });

  it('uses override cells and keeps euclidean for null cells', () => {
    const override = [
      [null, 10, null],
      [null, null, null],
      [null, null, null],
    ];
    const m = buildCostMatrix(cities, override);
    expect(m[0][1]).toBe(10);
    expect(m[0][2]).toBeCloseTo(4);
  });

  it('keeps an explicit zero override (not treated as missing)', () => {
    const override = [
      [null, 0, null],
      [null, null, null],
      [null, null, null],
    ];
    const m = buildCostMatrix(cities, override);
    expect(m[0][1]).toBe(0);
  });
});

describe('tourCost', () => {
  const m = [
    [0, 1, 2],
    [4, 0, 8],
    [16, 32, 0],
  ];
  it('sums directed edges with wraparound', () => {
    expect(tourCost(m, [0, 1, 2])).toBe(1 + 8 + 16);
  });
  it('is direction-dependent for asymmetric matrices', () => {
    expect(tourCost(m, [0, 2, 1])).toBe(2 + 32 + 4);
  });
  it('returns 0 for trivial tours', () => {
    expect(tourCost(m, [0])).toBe(0);
  });
});

describe('isSymmetric', () => {
  it('true for mirrored matrices', () => {
    expect(isSymmetric([[0, 5], [5, 0]])).toBe(true);
  });
  it('false for asymmetric matrices', () => {
    expect(isSymmetric([[0, 5], [7, 0]])).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/algorithms/utils.test.js`
Expected: FAIL — `buildCostMatrix`, `tourCost`, `isSymmetric` are not exported.

- [ ] **Step 3: Implement the functions**

Replace the entire contents of `src/algorithms/utils.js` with:
```js
export const distance = (a, b) =>
  Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

// Effective N×N cost matrix. A cell is the override value when present,
// otherwise the Euclidean distance between the two cities. Diagonal is 0.
export const buildCostMatrix = (cities, override = null) => {
  const n = cities.length;
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => {
      if (i === j) return 0;
      const o = override?.[i]?.[j];
      return (o === undefined || o === null) ? distance(cities[i], cities[j]) : o;
    })
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

export const isSymmetric = (matrix, eps = 1e-9) => {
  const n = matrix.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(matrix[i][j] - matrix[j][i]) > eps) return false;
    }
  }
  return true;
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

Note: `tourDistance` is intentionally removed here. The solvers still import it until Task 3, so the dev server / build will be broken between Task 2 and Task 3 — that is expected and resolved in Task 3. Unit tests in this task do not depend on the solvers.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/algorithms/utils.test.js`
Expected: PASS (all `buildCostMatrix` / `tourCost` / `isSymmetric` tests pass).

- [ ] **Step 5: Commit**

```bash
git add src/algorithms/utils.js src/algorithms/utils.test.js
git commit -m "feat: add cost-matrix helpers (buildCostMatrix, tourCost, isSymmetric)"
```

---

## Task 3: Refactor solvers to consume a cost matrix

**Files:**
- Modify: `src/algorithms/nearestNeighbor.js`
- Modify: `src/algorithms/twoOpt.js`
- Modify: `src/algorithms/simulatedAnnealing.js`
- Modify: `src/algorithms/genetic.js`
- Modify: `src/algorithms/bruteForce.js`
- Modify: `src/algorithms/branchAndBound.js`
- Test: `src/algorithms/solvers.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/algorithms/solvers.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { nearestNeighborSolver } from './nearestNeighbor.js';
import { bruteForceSolver } from './bruteForce.js';

function runToEnd(gen) {
  let last = null;
  let r = gen.next();
  while (!r.done) {
    if (r.value) last = r.value;
    r = gen.next();
  }
  if (r.value) last = r.value;
  return last;
}

// Coordinates are dummies — the matrix is the source of truth.
const cities = [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }];
const matrix = [
  [0, 1, 5, 9],
  [1, 0, 2, 6],
  [5, 2, 0, 3],
  [9, 6, 3, 0],
];

describe('solvers use the cost matrix', () => {
  it('brute force finds the optimal directed tour cost', () => {
    const best = runToEnd(bruteForceSolver(cities, matrix));
    // Optimal symmetric tour 0-1-2-3-0 = 1+2+3+9 = 15
    expect(best.distance).toBe(15);
  });

  it('nearest neighbor reports matrix-based distance', () => {
    const best = runToEnd(nearestNeighborSolver(cities, matrix));
    // NN from 0: 0->1(1)->2(2)->3(3)->0(9) = 15
    expect(best.distance).toBe(15);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/algorithms/solvers.test.js`
Expected: FAIL — solvers ignore the second argument and call the removed `tourDistance` (import error or wrong result).

- [ ] **Step 3: Refactor `nearestNeighbor.js`**

Replace the entire contents of `src/algorithms/nearestNeighbor.js` with:
```js
import { tourCost } from './utils.js';

export function* nearestNeighborSolver(cities, matrix) {
  if (cities.length < 2) return;
  const n = cities.length;
  const visited = new Array(n).fill(false);
  const tour = [0];
  visited[0] = true;
  let exploredEdges = [];

  while (tour.length < n) {
    const current = tour[tour.length - 1];
    let nearest = -1;
    let nearestDist = Infinity;

    for (let i = 0; i < n; i++) {
      if (!visited[i]) {
        const d = matrix[current][i];
        exploredEdges.push([current, i]);
        if (d < nearestDist) {
          nearestDist = d;
          nearest = i;
        }
      }
    }

    visited[nearest] = true;
    tour.push(nearest);

    yield {
      tour: [...tour],
      bestTour: [...tour],
      distance: tourCost(matrix, tour),
      exploredEdges: exploredEdges.slice(-Math.min(exploredEdges.length, 30)),
      iteration: tour.length - 1,
      phase: 'building',
      algorithm: 'nearestNeighbor',
    };
  }

  const finalTour = [...tour];
  yield {
    tour: finalTour,
    bestTour: finalTour,
    distance: tourCost(matrix, finalTour),
    exploredEdges: [],
    iteration: n,
    phase: 'complete',
    complete: true,
    algorithm: 'nearestNeighbor',
  };
}
```

- [ ] **Step 4: Refactor `twoOpt.js`**

Replace the entire contents of `src/algorithms/twoOpt.js` with:
```js
import { tourCost } from './utils.js';

function buildInitialTour(matrix, n) {
  const visited = new Array(n).fill(false);
  const tour = [0];
  visited[0] = true;
  while (tour.length < n) {
    const cur = tour[tour.length - 1];
    let best = -1, bestD = Infinity;
    for (let i = 0; i < n; i++) {
      if (!visited[i]) {
        const d = matrix[cur][i];
        if (d < bestD) { bestD = d; best = i; }
      }
    }
    visited[best] = true;
    tour.push(best);
  }
  return tour;
}

function twoOptSwap(tour, i, k) {
  const t = [...tour];
  let l = i + 1, r = k;
  while (l < r) { [t[l], t[r]] = [t[r], t[l]]; l++; r--; }
  return t;
}

export function* twoOptSolver(cities, matrix) {
  if (cities.length < 3) return;
  const n = cities.length;
  let tour = buildInitialTour(matrix, n);
  let bestDist = tourCost(matrix, tour);
  let iteration = 0;
  let improved = true;

  yield {
    tour: [...tour], bestTour: [...tour], distance: bestDist,
    exploredEdges: [], iteration: 0, phase: 'init', algorithm: 'twoOpt',
  };

  while (improved) {
    improved = false;
    for (let i = 0; i < n - 1; i++) {
      for (let k = i + 1; k < n; k++) {
        const newTour = twoOptSwap(tour, i, k);
        const newDist = tourCost(matrix, newTour);
        iteration++;

        if (newDist < bestDist - 0.001) {
          tour = newTour;
          bestDist = newDist;
          improved = true;

          yield {
            tour: [...tour], bestTour: [...tour], distance: bestDist,
            exploredEdges: [[tour[i], tour[i + 1]], [tour[k], tour[(k + 1) % n]]],
            iteration, phase: 'improving', algorithm: 'twoOpt', improved: true,
          };
        } else if (iteration % 15 === 0) {
          yield {
            tour: [...tour], bestTour: [...tour], distance: bestDist,
            exploredEdges: [[tour[i], tour[(i + 1) % n]], [tour[k], tour[(k + 1) % n]]],
            iteration, phase: 'exploring', algorithm: 'twoOpt',
          };
        }
      }
    }
  }

  yield {
    tour, bestTour: tour, distance: bestDist, exploredEdges: [],
    iteration, phase: 'complete', complete: true, algorithm: 'twoOpt',
  };
}
```

- [ ] **Step 5: Refactor `simulatedAnnealing.js`**

In `src/algorithms/simulatedAnnealing.js`:

Change line 1 from:
```js
import { tourDistance, shuffleArray } from './utils.js';
```
to:
```js
import { tourCost, shuffleArray } from './utils.js';
```

Change the signature on line 3 from `export function* simulatedAnnealingSolver(cities) {` to:
```js
export function* simulatedAnnealingSolver(cities, matrix) {
```

Replace the two `tourDistance(cities, ...)` calls:
- Line 9 `let bestDist = tourDistance(cities, tour);` → `let bestDist = tourCost(matrix, tour);`
- Line 29 `const newDist = tourDistance(cities, newTour);` → `const newDist = tourCost(matrix, newTour);`

- [ ] **Step 6: Refactor `genetic.js`**

In `src/algorithms/genetic.js`:

Change line 1 from:
```js
import { tourDistance, shuffleArray } from './utils.js';
```
to:
```js
import { tourCost, shuffleArray } from './utils.js';
```

Change line 3 from:
```js
const fitness = (cities, tour) => 1 / tourDistance(cities, tour);
```
to:
```js
const fitness = (matrix, tour) => 1 / tourCost(matrix, tour);
```

Change the signature on line 44 from `export function* geneticSolver(cities) {` to:
```js
export function* geneticSolver(cities, matrix) {
```

Replace the remaining cost calls:
- Line 51 `let fitnesses = population.map(t => fitness(cities, t));` → `let fitnesses = population.map(t => fitness(matrix, t));`
- Line 54 `let bestDist = tourDistance(cities, bestTour);` → `let bestDist = tourCost(matrix, bestTour);`
- Line 65 `fitnesses = population.map(t => fitness(cities, t));` → `fitnesses = population.map(t => fitness(matrix, t));`
- Line 67 `const curDist = tourDistance(cities, population[curBestIdx]);` → `const curDist = tourCost(matrix, population[curBestIdx]);`

- [ ] **Step 7: Refactor `bruteForce.js`**

In `src/algorithms/bruteForce.js`:

Change line 1 from:
```js
import { tourDistance } from './utils.js';
```
to:
```js
import { tourCost } from './utils.js';
```

Change the signature on line 17 from `export function* bruteForceSolver(cities) {` to:
```js
export function* bruteForceSolver(cities, matrix) {
```

Change line 33 from:
```js
    const dist = tourDistance(cities, tour);
```
to:
```js
    const dist = tourCost(matrix, tour);
```

(Leave the `cities.length > 10` guard and everything else unchanged.)

- [ ] **Step 8: Refactor `branchAndBound.js`**

In `src/algorithms/branchAndBound.js`:

Change line 1 from:
```js
import { distance, tourDistance } from './utils.js';
```
to:
```js
import { tourCost } from './utils.js';
```

Change the signature on line 39 from `export function* branchAndBoundSolver(cities) {` to:
```js
export function* branchAndBoundSolver(cities, matrix) {
```

Replace the local matrix build (lines 49-51):
```js
  const dist = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => i === j ? 0 : distance(cities[i], cities[j]))
  );
```
with:
```js
  const dist = matrix;
```

Change line 56 from:
```js
  let bestDist = tourDistance(cities, nnTour);
```
to:
```js
  let bestDist = tourCost(matrix, nnTour);
```

(All other references already use the local `dist` matrix and stay unchanged.)

- [ ] **Step 9: Run the solver tests to verify they pass**

Run: `npx vitest run src/algorithms/solvers.test.js`
Expected: PASS (brute force = 15, nearest neighbor = 15).

- [ ] **Step 10: Run the full unit suite**

Run: `npx vitest run`
Expected: PASS (utils + solvers + sanity). Confirms no solver still imports `tourDistance`.

- [ ] **Step 11: Commit**

```bash
git add src/algorithms/
git commit -m "refactor: solvers consume a cost matrix instead of coordinates"
```

---

## Task 4: Excel parser

**Files:**
- Create: `src/lib/excel.js`
- Test: `src/lib/excel.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/excel.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { parseSheetRows } from './excel.js';

describe('parseSheetRows — matrix layout', () => {
  const rows = [
    ['', 'A', 'B', 'C'],
    ['A', 0, 12, 45],
    ['B', 12, 0, 30],
    ['C', 45, 30, 0],
  ];
  it('returns labels and an N×N matrix', () => {
    const { labels, matrix } = parseSheetRows(rows);
    expect(labels).toEqual(['A', 'B', 'C']);
    expect(matrix[0][1]).toBe(12);
    expect(matrix[2][1]).toBe(30);
  });
  it('stores the diagonal as null', () => {
    const { matrix } = parseSheetRows(rows);
    expect(matrix[0][0]).toBeNull();
  });
});

describe('parseSheetRows — edge list layout', () => {
  const rows = [
    ['From', 'To', 'Distance'],
    ['A', 'B', 12],
    ['B', 'A', 18],
    ['A', 'C', 45],
  ];
  it('builds nodes in order of appearance and honors direction', () => {
    const { labels, matrix } = parseSheetRows(rows);
    expect(labels).toEqual(['A', 'B', 'C']);
    expect(matrix[0][1]).toBe(12);
    expect(matrix[1][0]).toBe(18);
    expect(matrix[0][2]).toBe(45);
    expect(matrix[2][0]).toBeNull(); // unspecified -> euclidean fallback later
  });
});

describe('parseSheetRows — validation', () => {
  it('throws on a non-square matrix', () => {
    expect(() => parseSheetRows([
      ['', 'A', 'B', 'C'],
      ['A', 0, 1, 2],
      ['B', 1, 0, 3],
    ])).toThrow(/square/i);
  });
  it('throws on non-numeric cells', () => {
    expect(() => parseSheetRows([
      ['', 'A', 'B'],
      ['A', 0, 'oops'],
      ['B', 5, 0],
    ])).toThrow(/non-numeric/i);
  });
  it('throws on negative distances', () => {
    expect(() => parseSheetRows([
      ['', 'A', 'B'],
      ['A', 0, -3],
      ['B', 3, 0],
    ])).toThrow(/negative/i);
  });
  it('throws on an empty sheet', () => {
    expect(() => parseSheetRows([])).toThrow(/empty/i);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/excel.test.js`
Expected: FAIL — `./excel.js` does not exist.

- [ ] **Step 3: Implement the parser**

Create `src/lib/excel.js`:
```js
import * as XLSX from 'xlsx';

const DIST_KEYS = ['distance', 'dist', 'cost', 'weight'];
const FROM_KEYS = ['from', 'source', 'origin'];
const TO_KEYS = ['to', 'target', 'dest', 'destination'];

function toCell(v) {
  if (v === '' || v === null || v === undefined) return null;
  const num = Number(v);
  if (!Number.isFinite(num)) throw new Error(`non-numeric value "${v}"`);
  if (num < 0) throw new Error(`negative distance ${num}`);
  return num;
}

function parseMatrix(rows) {
  const labels = rows[0].slice(1).map((c) => String(c ?? '').trim());
  const n = labels.length;
  if (n < 2) throw new Error('matrix needs at least 2 nodes');
  const body = rows.slice(1);
  if (body.length !== n) {
    throw new Error(`matrix not square: ${n} columns but ${body.length} rows`);
  }
  const matrix = Array.from({ length: n }, () => Array(n).fill(null));
  for (let i = 0; i < n; i++) {
    const cells = body[i].slice(1);
    if (cells.length < n) {
      throw new Error(`matrix not square: row ${i + 1} has ${cells.length} values, expected ${n}`);
    }
    for (let j = 0; j < n; j++) {
      matrix[i][j] = i === j ? null : toCell(cells[j]);
    }
  }
  return { labels, matrix };
}

function parseEdgeList(rows, fromIdx, toIdx, distIdx) {
  const labels = [];
  const index = new Map();
  const idOf = (name) => {
    const k = String(name).trim();
    if (!index.has(k)) { index.set(k, labels.length); labels.push(k); }
    return index.get(k);
  };
  const edges = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const f = row[fromIdx];
    const t = row[toIdx];
    if (f === undefined || f === '' || f === null) continue;
    if (t === undefined || t === '' || t === null) continue;
    edges.push([idOf(f), idOf(t), toCell(row[distIdx])]);
  }
  const n = labels.length;
  if (n < 2) throw new Error('edge list needs at least 2 nodes');
  const matrix = Array.from({ length: n }, () => Array(n).fill(null));
  for (const [i, j, d] of edges) {
    if (i !== j) matrix[i][j] = d;
  }
  return { labels, matrix };
}

// Pure: rows is an array of arrays (cells). Returns { labels, matrix }.
export function parseSheetRows(rows) {
  const clean = (rows || []).filter(
    (r) => Array.isArray(r) && r.some((c) => c !== '' && c !== null && c !== undefined)
  );
  if (clean.length === 0) throw new Error('empty sheet');

  const header = clean[0].map((c) => String(c ?? '').trim().toLowerCase());
  const fromIdx = header.findIndex((h) => FROM_KEYS.includes(h));
  const toIdx = header.findIndex((h) => TO_KEYS.includes(h));
  const distIdx = header.findIndex((h) => DIST_KEYS.includes(h));

  if (fromIdx !== -1 && toIdx !== -1 && distIdx !== -1) {
    return parseEdgeList(clean, fromIdx, toIdx, distIdx);
  }
  return parseMatrix(clean);
}

// Thin wrapper around SheetJS — reads the first sheet to an array of rows.
// Not unit-tested (touches the file system / browser File API).
export async function readFileToRows(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/excel.test.js`
Expected: PASS (matrix, edge list, all validation cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/excel.js src/lib/excel.test.js
git commit -m "feat: add Excel distance parser (matrix + edge-list auto-detect)"
```

---

## Task 5: Node reconciliation helpers

**Files:**
- Create: `src/lib/matrix.js`
- Test: `src/lib/matrix.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/matrix.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { circleLayout, reconcileImport } from './matrix.js';

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
});

describe('reconcileImport', () => {
  const parsed = { labels: ['A', 'B', 'C'], matrix: [[null, 1, 2], [1, null, 3], [2, 3, null]] };

  it('keeps existing cities when the count matches', () => {
    const cities = [{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }];
    const out = reconcileImport(cities, parsed);
    expect(out.cities).toBe(cities);
    expect(out.customMatrix).toBe(parsed.matrix);
  });

  it('generates a circle layout when the count differs', () => {
    const out = reconcileImport([], parsed);
    expect(out.cities).toHaveLength(3);
    expect(out.customMatrix).toBe(parsed.matrix);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/matrix.test.js`
Expected: FAIL — `./matrix.js` does not exist.

- [ ] **Step 3: Implement the helpers**

Create `src/lib/matrix.js`:
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

// Map a parsed import onto the node set. If the parsed node count matches the
// current cities, apply the matrix to them; otherwise create circle-laid nodes.
export function reconcileImport(cities, parsed) {
  const n = parsed.matrix.length;
  if (cities.length === n) {
    return { cities, customMatrix: parsed.matrix };
  }
  return { cities: circleLayout(n), customMatrix: parsed.matrix };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/matrix.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/matrix.js src/lib/matrix.test.js
git commit -m "feat: add circle layout and import reconciliation helpers"
```

---

## Task 6: Hook integration

**Files:**
- Modify: `src/hooks/useTSPSolver.js`

- [ ] **Step 1: Update imports**

In `src/hooks/useTSPSolver.js`, change the imports at the top. Replace:
```js
import { tourDistance } from './utils.js';
```
(line 8) with:
```js
import { buildCostMatrix, isSymmetric } from '../algorithms/utils.js';
import { readFileToRows, parseSheetRows } from '../lib/excel.js';
import { reconcileImport } from '../lib/matrix.js';
```

Note: line 8 currently reads `import { tourDistance } from '../algorithms/utils.js';` — match the actual path in the file (it imports from `../algorithms/utils.js`). Remove the `tourDistance` import entirely; it is unused in the hook.

- [ ] **Step 2: Add `customMatrix` state**

After the `const [cities, setCities] = useState([]);` line, add:
```js
  const [customMatrix, setCustomMatrix] = useState(null);
```

- [ ] **Step 3: Build and pass the matrix + add the B&B guard in `start()`**

In `start()`, locate the existing block:
```js
    stopInterval();
    genRef.current = ALGORITHM_MAP[algorithmRef.current](cities);
    startTimeRef.current = Date.now();
```
Replace it with:
```js
    const matrix = buildCostMatrix(cities, customMatrix);
    if (algorithmRef.current === 'branchAndBound' && !isSymmetric(matrix)) {
      addLog('ERROR: Branch & Bound requires symmetric distances', 'error');
      showToast('B&B needs symmetric distances', 'error');
      return;
    }

    stopInterval();
    genRef.current = ALGORITHM_MAP[algorithmRef.current](cities, matrix);
    startTimeRef.current = Date.now();
```
Then add `customMatrix` to the `start` callback dependency array (the array currently ends `[cities, addLog, showToast, stopInterval]` → make it `[cities, customMatrix, addLog, showToast, stopInterval]`).

- [ ] **Step 4: Build the matrix and guard B&B in `runComparison()`**

In `runComparison()`, inside the `setTimeout` callback, add the matrix build at the very top of the callback body (before `const results = {};`):
```js
      const matrix = buildCostMatrix(cities, customMatrix);
      const symmetric = isSymmetric(matrix);
```
Then, inside the `for` loop, replace:
```js
        const cityLimit = name === 'bruteForce' ? 10 : name === 'branchAndBound' ? 12 : Infinity;
        if (cities.length > cityLimit) {
          results[name] = { distance: null, time: null, skipped: true, tour: [] };
          addLog(`  ${name}: SKIPPED (${cities.length} cities > ${cityLimit})`, 'warn');
          continue;
        }
```
with:
```js
        const cityLimit = name === 'bruteForce' ? 10 : name === 'branchAndBound' ? 12 : Infinity;
        if (cities.length > cityLimit) {
          results[name] = { distance: null, time: null, skipped: true, tour: [] };
          addLog(`  ${name}: SKIPPED (${cities.length} cities > ${cityLimit})`, 'warn');
          continue;
        }
        if (name === 'branchAndBound' && !symmetric) {
          results[name] = { distance: null, time: null, skipped: true, tour: [] };
          addLog('  branchAndBound: SKIPPED (asymmetric matrix)', 'warn');
          continue;
        }
```
Then replace the solver invocation:
```js
        const gen = solverFn([...cities]);
```
with:
```js
        const gen = solverFn([...cities], matrix);
```
Finally, add `customMatrix` to the `runComparison` dependency array (currently `[cities, addLog]` → `[cities, customMatrix, addLog]`).

- [ ] **Step 5: Invalidate the matrix when the node set changes**

In `addCity`, replace the body:
```js
  const addCity = useCallback((city) => {
    if (isRunningRef.current) return;
    setCities(prev => {
      if (prev.length >= 20) return prev;
      return [...prev, city];
    });
  }, []);
```
with:
```js
  const addCity = useCallback((city) => {
    if (isRunningRef.current) return;
    setCities(prev => {
      if (prev.length >= 20) return prev;
      return [...prev, city];
    });
    setCustomMatrix(prev => {
      if (prev) addLog('custom distances cleared (node set changed)', 'warn');
      return null;
    });
  }, [addLog]);
```

In `clearCities`, add `setCustomMatrix(null);` right after `setCities([]);`.

In `generateRandom`, add `setCustomMatrix(null);` right after `setCities(newCities);`.

- [ ] **Step 6: Add the matrix mutation + import actions**

Add these three callbacks (place them after `generateRandom`):
```js
  const setMatrixCell = useCallback((i, j, value) => {
    if (isRunningRef.current) return;
    setCustomMatrix(prev => {
      const n = cities.length;
      const next = prev
        ? prev.map(row => [...row])
        : Array.from({ length: n }, () => Array(n).fill(null));
      next[i][j] = value;
      return next;
    });
  }, [cities.length]);

  const resetMatrix = useCallback(() => {
    if (isRunningRef.current) return;
    setCustomMatrix(null);
    addLog('DISTANCES — reset to euclidean', 'system');
  }, [addLog]);

  const importFromFile = useCallback(async (file) => {
    if (isRunningRef.current) return;
    try {
      const rows = await readFileToRows(file);
      const parsed = parseSheetRows(rows);
      const { cities: newCities, customMatrix: m } = reconcileImport(cities, parsed);
      stopInterval();
      genRef.current = null;
      setIsRunning(false);
      setIsPaused(false);
      isRunningRef.current = false;
      setCities(newCities);
      setCustomMatrix(m);
      setSolverState(INITIAL_STATE);
      setComparisonResults(null);
      const n = parsed.labels.length;
      addLog(`IMPORTED — ${n} nodes from ${file.name}`, 'system');
      showToast(`Imported ${n}×${n} distance matrix`, 'success');
    } catch (e) {
      addLog(`IMPORT ERROR — ${e.message}`, 'error');
      showToast(`Import failed: ${e.message}`, 'error');
    }
  }, [cities, stopInterval, addLog, showToast]);
```

- [ ] **Step 7: Export the new values**

In the final `return { ... }` object, add `customMatrix`, `setMatrixCell`, `resetMatrix`, and `importFromFile`. The returned object should now include them, e.g. extend the existing returned fields:
```js
  return {
    cities, customMatrix, algorithm, speed, isRunning, isPaused, solverState,
    logs, comparisonResults, isComparing, toast,
    addCity, clearCities, generateRandom,
    setMatrixCell, resetMatrix, importFromFile,
    setAlgorithm, setSpeed, start, pause, resume, reset, runComparison, clearComparison,
  };
```

- [ ] **Step 8: Verify the unit suite still passes and the app builds**

Run: `npx vitest run`
Expected: PASS (no regressions).

Run: `npm run build`
Expected: build succeeds with no import/reference errors.

- [ ] **Step 9: Commit**

```bash
git add src/hooks/useTSPSolver.js
git commit -m "feat: wire custom matrix, Excel import, and B&B symmetry guard into solver hook"
```

---

## Task 7: Distance matrix editor component

**Files:**
- Create: `src/components/DistanceMatrix.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Create the component**

Create `src/components/DistanceMatrix.jsx`:
```jsx
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
```

- [ ] **Step 2: Mount it in the sidebar**

In `src/App.jsx`, add the import near the other component imports (after the `ControlPanel` import):
```jsx
import DistanceMatrix from './components/DistanceMatrix.jsx';
```
Then in the scrollable sidebar panel, add the component right after `<ControlPanel solver={solver} />`:
```jsx
          <ControlPanel solver={solver} />
          <DistanceMatrix solver={solver} />
```

- [ ] **Step 3: Verify build + lint**

Run: `npm run build`
Expected: build succeeds.

Run: `npm run lint`
Expected: no new errors in `DistanceMatrix.jsx` / `App.jsx`.

- [ ] **Step 4: Commit**

```bash
git add src/components/DistanceMatrix.jsx src/App.jsx
git commit -m "feat: add distance matrix editor with Excel import to sidebar"
```

---

## Task 8: Manual verification

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Open the printed local URL in a browser.

- [ ] **Step 2: Verify the Euclidean baseline is unchanged**

- Click "12" under RANDOM CITIES.
- Select NEAREST NEIGHBOR, press START.
- Confirm it solves and the status-bar DIST is a sensible number. (No matrix = behaves like today.)

- [ ] **Step 3: Verify manual editing**

- Open DISTANCE MATRIX. Confirm a grid appears with greyed Euclidean placeholders and an "● ACTIVE" badge that is absent initially.
- Type a large value (e.g. `999`) into cell A→B. Confirm the cell turns cyan and "● ACTIVE" appears.
- Run NEAREST NEIGHBOR and 2-OPT. Confirm the reported DIST changes versus the Euclidean baseline (the edited edge is now expensive).
- Click "↺ EUCLID". Confirm the badge disappears and the cell reverts to the greyed placeholder.

- [ ] **Step 4: Verify Excel matrix import**

- Create `test-matrix.csv` with:
  ```
  ,A,B,C,D
  A,0,12,45,9
  B,12,0,30,21
  C,45,30,0,15
  D,9,21,15,0
  ```
- Click "⬆ IMPORT EXCEL", choose the file. Confirm a success toast, 4 nodes laid out in a circle on the canvas, and the matrix grid showing the imported values.
- Run BRUTE FORCE. Confirm it completes and DIST matches the matrix.

- [ ] **Step 5: Verify Excel edge-list import**

- Create `test-edges.csv` with:
  ```
  From,To,Distance
  A,B,12
  B,A,18
  A,C,45
  C,A,45
  B,C,30
  C,B,30
  ```
- Import it. Confirm 3 circle-laid nodes and the asymmetric A→B=12 / B→A=18 values appear in the grid.

- [ ] **Step 6: Verify the asymmetric B&B guard**

- With the asymmetric edge-list matrix loaded, select BRANCH & BOUND and press START.
- Confirm it is blocked with the "B&B needs symmetric distances" toast and does not run.
- Confirm BRUTE FORCE still runs on the same asymmetric matrix.

- [ ] **Step 7: Verify invalidation**

- With a custom matrix active, click the canvas to add a node.
- Confirm the "● ACTIVE" badge disappears and a "custom distances cleared (node set changed)" log entry appears.

- [ ] **Step 8: Final full check**

Run: `npx vitest run`
Expected: all unit tests pass.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 9: Report results**

Summarize which manual checks passed. If any UI check could not be performed, state so explicitly rather than claiming success.

