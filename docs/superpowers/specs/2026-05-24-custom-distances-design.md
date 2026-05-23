# Custom Distances: Manual Entry & Excel Import

**Date:** 2026-05-24
**Status:** Approved (design)

## Problem

The TSP visualizer is entirely coordinate-driven: nodes have `{x, y}` positions and
every edge cost is the Euclidean distance between them. Users need to:

1. Specify distances between nodes **manually**, independent of geometry.
2. **Import** a distance table from an Excel file.

This means a distance **matrix** must become the source of truth for edge cost,
overriding the Euclidean computation.

## Decisions

- **Matrix is source of truth.** When a custom matrix is present, algorithms use it;
  otherwise the app behaves exactly as today (Euclidean fallback).
- **Coexists with the geometric workflow.** Click-to-place and random-cities stay.
  The matrix is an optional override layered on top of the existing node set.
- **Asymmetric allowed.** `cost(A→B)` may differ from `cost(B→A)`. The full N×N grid
  is editable; no mirroring.
- **Excel: support both layouts**, auto-detected — N×N matrix grid, or `From/To/Distance`
  edge list.
- **Branch & Bound is disabled for asymmetric matrices** (its MST lower bound is only
  valid for symmetric distances and would otherwise prune the true optimum while
  claiming an exact answer). Brute force stays exact for asymmetric input.
- **Canvas edge-distance labels are out of scope for v1** (the status bar already shows
  total tour distance computed from the matrix).

## Architecture

### Cost matrix abstraction

A single N×N **cost matrix** is the contract between the node set and the solvers,
decoupling edge cost from coordinates.

- New state in `useTSPSolver`: `customMatrix` — either `null`, or an N×N array where each
  cell is a number (an override) or `null` (fall back to Euclidean for that pair). Indexed
  by city order.
- `buildCostMatrix(cities, customMatrix)` (in `utils.js`) produces the **effective** N×N
  matrix used by solvers:
  - `cell[i][j] = customMatrix?.[i]?.[j] ?? euclidean(cities[i], cities[j])`
  - `cell[i][i] = 0`
  - Partial overrides work: editing one cell leaves the rest Euclidean.
- `tourCost(matrix, tour)` sums **directed** edges
  `matrix[tour[k]][tour[(k+1) % n]]`, so asymmetric costs are honored.
- `isSymmetric(matrix, eps = 1e-9)` returns whether `matrix[i][j] === matrix[j][i]` for
  all pairs — used to guard Branch & Bound.

### Solver refactor

All six solvers change signature from `solver(cities)` to `solver(cities, matrix)`:

- `distance(cities[a], cities[b])` → `matrix[a][b]`
- `tourDistance(cities, tour)` → `tourCost(matrix, tour)`
- `branchAndBound.js` stops building its own coordinate matrix and uses the passed `matrix`.

`cities` is still passed (some solvers reference `cities.length`); coordinates are no longer
read for cost. The hook builds `const matrix = buildCostMatrix(cities, customMatrix)` and
passes it in both `start()` and `runComparison()`.

`tourDistance` in `utils.js` is removed once no solver imports it (or kept only if still
referenced). `distance` stays — `buildCostMatrix` uses it for the Euclidean fallback.

### Hook changes (`useTSPSolver.js`)

- State: `customMatrix`.
- `setMatrixCell(i, j, value)` — sets one override cell (or clears it to `null` when blank);
  lazily allocates the N×N array on first edit.
- `importMatrix(parsed)` — applies a parsed result from Excel (see below).
- `resetMatrix()` — sets `customMatrix = null`.
- B&B guard in `start()` and `runComparison()`: if the effective matrix is asymmetric and the
  algorithm is `branchAndBound`, refuse with a toast + log (mirrors the existing city-limit
  guards). In comparison, B&B is marked skipped for asymmetric input.
- **Invalidation:** `addCity`, `generateRandom`, and `clearCities` clear `customMatrix` when
  it exists (the node set / dimensions changed), with a log/toast: "custom distances cleared
  (node set changed)".

### Manual editor — `DistanceMatrix.jsx` (new)

Collapsible card in the sidebar (consistent with existing card styling / theme tokens).

- Editable N×N grid; header row + column show node labels (`A, B, C, …`; for >26 nodes use
  `A1, A2, …` or fall back to indices).
- Diagonal cells locked at `0`.
- Full grid editable (asymmetric).
- A blank cell shows the greyed Euclidean fallback value as a placeholder so the user sees the
  effective cost.
- Input validation: non-negative finite numbers only; invalid input is rejected (cell reverts).
- "RESET TO EUCLIDEAN" button → `resetMatrix()`.
- "ACTIVE" badge shown when `customMatrix` is non-null.
- If fewer than 2 nodes exist, show a hint to place nodes first instead of the grid.
- Up to 20 nodes → 20×20 grid; rendered inside the existing scrollable sidebar with its own
  horizontal scroll.

### Excel import — `src/lib/excel.js` (new) + UI control

- Add `xlsx` (SheetJS) as a dependency.
- "IMPORT EXCEL" button with a hidden `<input type="file" accept=".xlsx,.xls,.csv">`.
- Parse the first sheet to a row array. Auto-detect layout:
  - Headers containing `from` / `to` / `distance` (case-insensitive) → **edge list**.
    Node order is order of first appearance across the From/To columns.
  - Otherwise a roughly square sheet with a label header row + column → **matrix**.
- Returns a normalized `{ labels: string[], matrix: (number|null)[][] }`.
- **Node reconciliation** (handled in `importMatrix`):
  - If parsed node count `=== cities.length` → apply to existing nodes by order.
  - Else → generate that many nodes in a **circle auto-layout** (display positions only) and
    apply the matrix.
- Errors (non-square matrix, non-numeric cells, negative values, empty sheet) surface via toast
  + log and abort the import without mutating state.
- For edge-list / sparse input, unspecified pairs remain `null` (Euclidean fallback). When nodes
  came from a circle layout (no meaningful geometry), the import warns if the matrix is
  incomplete.

### Wiring

- Mount `DistanceMatrix` and the "IMPORT EXCEL" control in the sidebar (via `ControlPanel.jsx`
  or directly in `App.jsx`'s scrollable panel), passing the relevant `solver` handles.
- Status bar (`App.jsx`) and `StatsPanel` are unaffected — `solverState.distance` now reflects
  the matrix automatically.

## Component boundaries

- `utils.js` — pure cost functions (`buildCostMatrix`, `tourCost`, `isSymmetric`, `distance`).
  No React, no I/O. Testable in isolation.
- `src/lib/excel.js` — pure parse + detect + normalize. Takes a workbook/array, returns
  `{ labels, matrix }` or throws a descriptive error. No React.
- `useTSPSolver.js` — owns `customMatrix` state and reconciliation/guard logic.
- `DistanceMatrix.jsx` — presentational grid; reads `cities` + `customMatrix`, calls
  `setMatrixCell` / `resetMatrix` / `importMatrix`. No cost logic of its own.

## Files

| File | Change |
|------|--------|
| `src/algorithms/utils.js` | add `buildCostMatrix`, `tourCost`, `isSymmetric`; keep `distance`; drop `tourDistance` if unused |
| `src/algorithms/nearestNeighbor.js` | signature + matrix lookups |
| `src/algorithms/twoOpt.js` | signature + matrix lookups |
| `src/algorithms/simulatedAnnealing.js` | signature + matrix lookups |
| `src/algorithms/genetic.js` | signature + matrix lookups |
| `src/algorithms/bruteForce.js` | signature + matrix lookups |
| `src/algorithms/branchAndBound.js` | use passed matrix; (guard lives in hook) |
| `src/hooks/useTSPSolver.js` | `customMatrix` state, `setMatrixCell`, `importMatrix`, `resetMatrix`, B&B symmetry guard, invalidation, pass matrix to solvers |
| `src/components/DistanceMatrix.jsx` | **new** — editable grid + import button |
| `src/lib/excel.js` | **new** — parse / detect / normalize |
| `src/components/ControlPanel.jsx` or `src/App.jsx` | mount editor + import control |
| `package.json` | add `xlsx`; add `vitest` (dev) for unit tests |

## Testing

No test runner is currently installed. Add `vitest` (dev dependency) and a `test` script to
support unit tests.

**Unit tests:**
- `buildCostMatrix` — Euclidean fallback when override is `null`; per-cell override; diagonal 0;
  partial override leaves other cells Euclidean.
- `tourCost` — directed sum with wraparound; asymmetric matrix yields direction-dependent totals.
- `isSymmetric` — true for mirrored, false for asymmetric.
- `excel.js` — parses N×N matrix; parses edge list; rejects non-square / non-numeric / negative;
  correct `labels` ordering.

**Manual verification:**
- Place nodes, edit one matrix cell, run NN / 2-opt / brute force; confirm reported distance
  reflects the override.
- Import a sample `.xlsx` in both layouts; confirm node reconciliation (matching count vs.
  circle layout).
- Set an asymmetric matrix; confirm B&B is blocked with a toast and brute force still runs.
- Reset to Euclidean; confirm behavior matches today's app.

## Out of scope (v1)

- Canvas edge-distance labels.
- Matrix-only node definition flow (defining nodes purely from a matrix with no geometric mode).
- Editing distances by clicking edges on the canvas.
