# Symmetric Custom Distances: Manual Entry & Excel Import (v2)

**Date:** 2026-05-29
**Status:** Approved (design)

## Background

A previous iteration of custom-distance support shipped in
`docs/superpowers/specs/2026-05-24-custom-distances-design.md` and the matching
plan. That design treated `customMatrix` as a per-cell override layered onto an
Euclidean baseline and allowed asymmetric distances (with a Branch & Bound
guard). This document **replaces** that implementation.

The two designs are kept in tree as historical record. References to the prior
implementation in code, tests, and docs are removed or updated by this work.

## Problem

The TSP visualizer is coordinate-driven: cost is the Euclidean distance between
node `{x, y}` positions. Users need to drive routing from a distance matrix that
has no relation to geometry, either by typing it in or by importing a `.xlsx`
file. The matrix must become the source of truth when a user opts into custom
distances.

## Decisions

- **Two modes, not a blend.** Either the matrix drives cost (Custom-Matrix
  mode) or coordinates drive cost (Euclidean mode). No per-cell override.
- **Symmetric-only.** `cost(A→B) === cost(B→A)`. Editing `[i][j]` (i<j)
  mirrors live to `[j][i]`. Excel imports that are not symmetric are auto-
  corrected by averaging the two values, with a non-blocking warning banner
  listing every diff and an "Undo & view raw" option.
- **Staging then Apply.** The panel holds local working state (N, labels,
  cells). Apply commits to solver state and auto-runs the selected algorithm.
  Cancel discards local edits.
- **Apply gate: matrix must be complete.** Every off-diagonal cell must be a
  finite number ≥ 0. Empty or invalid cells disable Apply with an inline status.
- **Strict Excel layout.** First sheet, row 1 + column A are matching city
  labels in order, diagonal is 0 (or blank), 3 ≤ N ≤ 20. Edge-list auto-
  detection from the prior design is removed.
- **Canvas in Custom-Matrix mode:** N cities are auto-arranged evenly on a
  circle (display only). Click-to-place / RANDOM CITIES are disabled while
  custom matrix is active.
- **Reset to Default** = exit Custom-Matrix mode and clear cities (back to the
  app's empty default — matches today's CLEAR behavior).
- **B&B symmetry guard is removed** from the hook (matrix is always
  symmetric). The B&B node-count cap (existing pre-feature behavior) stays.

## Architecture

### Two modes

```
Euclidean mode (default)              Custom-Matrix mode (after Apply)
  customMatrix === null                 customMatrix: number[][]  (N×N)
  cityLabels === null                   cityLabels: string[]      (length N)
  cities placed by click / RANDOM       cities laid out on a circle
  cost = euclidean(cities[i], [j])      cost = customMatrix[i][j]
```

Transition Euclidean → Custom is `applyCustomMatrix({ matrix, labels })`.
Transition Custom → Euclidean is `resetMatrix()`. Both are atomic.

### Cost path

```
const matrix = customMatrix ?? buildEuclideanMatrix(cities);
solver(cities, matrix);
```

All six solvers already take `(cities, matrix)`; no signature change.

### Modules

- `src/lib/excel.js` — pure parse + symmetrize + template build.
  - `parseDistanceFile(file): Promise<{ labels, matrix }>` — `matrix` is
    the raw matrix as it appears in the file (not yet symmetrized).
  - `symmetrize(matrix): { matrix, diffs: { i, j, a, b, value }[] }` —
    called by the component after parse so the raw matrix is still
    available for the "Undo & view raw" affordance.
  - `buildTemplate(n = 4): Blob`
- `src/lib/matrix.js` — `circleLayout(n)` returning N evenly-spaced
  `{x, y}` positions for the canvas. (Existing module, kept.)
- `src/algorithms/utils.js` — pure cost functions.
  - `buildEuclideanMatrix(cities): number[][]` (renamed from `buildCostMatrix`)
  - `tourCost(matrix, tour): number`
  - `distance(a, b): number`
  - `isSymmetric` is removed.
- `src/hooks/useTSPSolver.js` — owns `customMatrix`, `cityLabels`, the
  Apply / Reset transitions, the mode guard on `addCity` / `generateRandom`,
  and auto-run after Apply.
- `src/components/DistanceMatrix.jsx` — owns staging state (working N,
  labels, upper-triangle cells, diffs banner). Calls into the hook only on
  Apply / Reset / Cancel.

## Manual editor UI (`DistanceMatrix.jsx`)

Surface: the existing collapsible sidebar card. Rewritten.

```
▾ DISTANCE MATRIX             [ ● ACTIVE ]    ← badge only after Apply

[ Cities (N): |__8__| ]   3 ≤ N ≤ 20

Labels (optional, blank → A, B, C…):
  1: |__A__|  2: |__B__|  3: |__C__|  …

         A      B      C      D     …
   A     —    |12|   |17|   |__|
   B   (12)    —    |__|   |__|     ← lower triangle dimmed,
   C   (17)  (  )    —    |__|        auto-mirrored, not editable
   D   ( )   ( )    ( )    —
   …

⚠ 4 empty cells. Apply disabled.        ← inline status

[ ↓ TEMPLATE ]  [ ⬆ IMPORT EXCEL ]  [ APPLY ]  [ CANCEL ]

After Apply, also: [ ↺ RESET TO DEFAULT ]
```

### Behavior

- **N input.** Number, clamped 3–20. Resizes the working grid (shrink
  truncates, grow appends empty rows/cols). Doesn't touch solver state.
- **Labels.** Optional text inputs. Blank → `A, B, C…` (`City 1, City 2…`
  past index 26). Headers in the grid update live as the user types.
- **Cells.**
  - Upper triangle (`i<j`) editable.
  - Lower triangle (`i>j`) dimmed, read-only, shows the mirrored value in
    parentheses. Editing `[i][j]` updates `[j][i]` immediately.
  - Diagonal locked at `0`, shown as `—`.
- **Per-cell validation.** On blur, non-numeric or negative input gets a red
  border and a tooltip "must be ≥ 0". The invalid value is not written into
  the working matrix (the cell retains its prior valid value, or stays empty).
- **Apply gate.** Disabled while any off-diagonal cell is empty or invalid.
  Hover tooltip names the blocker ("4 empty cells" / "fix invalid cells").
- **Apply.** Calls `applyCustomMatrix({ matrix, labels })` on the hook:
  - Commits the working matrix and labels to solver state.
  - Replaces cities with N circle-arranged nodes (labels carried through).
  - Shows the ● ACTIVE badge.
  - Auto-runs the currently selected algorithm.
- **Cancel.** Discards local edits, collapses the panel. If a matrix is
  already active, leaves it in place.
- **Reset to Default.** Visible only while ● ACTIVE. Clears `customMatrix`,
  `cityLabels`, and `cities`. Returns to empty-canvas Euclidean mode.
- **Pre-fill on reopen.** While ● ACTIVE, opening the panel loads the active
  matrix + labels into the working grid. Closing without Apply reverts to
  the active values, not to empty.
- **Solver running.** Every control in the panel is disabled while
  `isRunning`.

## Excel import

### Flow

1. `⬆ IMPORT EXCEL` opens a hidden `<input type="file"
   accept=".xlsx,.xls,.csv">`.
2. `parseDistanceFile(file)` parses the first sheet and returns
   `{ labels, matrix }` (raw matrix as it appears in the file), or throws
   a descriptive error.
3. The component calls `symmetrize(rawMatrix)` to get
   `{ matrix: corrected, diffs }`, and stashes `rawMatrix` for the "Undo &
   view raw" affordance.
4. On success, the working grid is populated with the **corrected** matrix.
   N input updates to match. Labels populate. Panel auto-expands.
5. **No automatic Apply.** The user reviews / edits / corrects, then presses
   Apply. The diffs banner (if any) appears above the grid.

### Accepted layout

```
        A     B     C     D
   A    0    12    17     9
   B   12     0    14    11
   C   17    14     0     8
   D    9    11     8     0
```

- First sheet only.
- Row 1: city labels.
- Column A: city labels in the same order as row 1.
- Diagonal: `0` or blank (treated as 0).
- Off-diagonal: finite numbers ≥ 0.
- 3 ≤ N ≤ 20.

### Validation order (first failure aborts with one toast)

| Check | Error message |
|---|---|
| File parses as a workbook with ≥ 1 non-empty sheet | "Could not read file. Use a .xlsx, .xls, or .csv distance matrix." |
| Has a header row and a header column | "Missing headers. Row 1 and column A must contain city names." |
| Matrix is square (header count = row count) | "Matrix is not square: N header columns vs. M data rows." |
| Row labels match column labels in order | "Row labels don't match column labels." |
| 3 ≤ N ≤ 20 | "Need between 3 and 20 cities, found N." |
| Every off-diagonal cell is a finite non-negative number | "Cell (B, D) is not a non-negative number: \"abc\"." |
| Diagonal cells are 0 or empty | "Cell (C, C) on the diagonal must be 0." |

### Symmetry handling

After parse, `symmetrize(matrix)` computes for every `i<j`:

- If `m[i][j] === m[j][i]`: keep.
- Else: replace both with `(m[i][j] + m[j][i]) / 2`, push a diff entry
  `{ i, j, a, b, value }`.

If diffs exist, the staging panel shows a non-blocking banner above the grid:

```
⚠ Imported matrix was not symmetric. 3 cells averaged:
   (B, D): 11 / 13 → 12
   (A, C): 17 / 18 → 17.5
   (C, D):  8 /  9 → 8.5
   [ Undo & view raw ]   [ Dismiss ]
```

"Undo & view raw" reloads the pre-symmetrization upper-triangle values into
the editable cells so the user can hand-correct instead. (The lower triangle
is read-only, so this is the only way to override the average.)

### Template download

`↓ TEMPLATE` button generates a 4×4 skeleton with default labels and `0`s on
the diagonal, off-diagonal blank:

```
        City1  City2  City3  City4
City1     0
City2            0
City3                   0
City4                          0
```

Filename: `tsp-distance-template.xlsx`. Generated client-side via
`XLSX.utils.aoa_to_sheet` + `XLSX.write` to a `Blob`. The component creates
an anchor, triggers download, revokes the URL.

## Hook changes (`useTSPSolver.js`)

State:
- `customMatrix: number[][] | null` (no nulls inside).
- `cityLabels: string[] | null` (present iff `customMatrix` is set).

Removed:
- `setMatrixCell`, `importMatrix` (single-cell editing and per-import wiring
  move into the component's staging state).
- B&B symmetry guard in `start()` / `runComparison()`.
- "custom distances cleared (node set changed)" invalidation in `addCity` /
  `generateRandom` / `clearCities`.

Added / changed:
- `applyCustomMatrix({ matrix, labels })`:
  - Validates `matrix` is square, symmetric, all finite ≥ 0, diagonal 0,
    `matrix.length === labels.length`, 3 ≤ N ≤ 20. (Component already
    enforces this; the hook is the contract boundary.)
  - Generates circle-layout cities via the existing
    `circleLayout(n)` helper in `src/lib/matrix.js`, then tags each with
    `labels[k]`.
  - Sets `customMatrix`, `cityLabels`, and `cities` in one batched state
    update so the canvas + solver see a consistent state.
  - Resets any current solver state, clears the tour.
  - Auto-runs the currently selected algorithm. If the selected algorithm is
    Branch & Bound and N exceeds the existing B&B cap (12), shows the same
    "N too large for Branch & Bound" toast as the manual RUN path and skips
    the auto-run (state changes still commit).
- `resetMatrix()`: clears `customMatrix`, `cityLabels`, and `cities`.
  Returns to empty-canvas Euclidean mode.
- `addCity`, `generateRandom`: guarded with
  `if (customMatrix) return;` (defense-in-depth; the buttons are also
  disabled in the UI).

## Solver / utils changes

- `src/algorithms/utils.js`:
  - Rename `buildCostMatrix(cities, customMatrix)` → `buildEuclideanMatrix(cities)`.
  - Drop the override-merge logic.
  - Remove `isSymmetric`.
  - Keep `tourCost(matrix, tour)`, `distance(a, b)`.
- `src/algorithms/branchAndBound.js`: no change.
- `src/algorithms/{nearestNeighbor,twoOpt,simulatedAnnealing,genetic,bruteForce}.js`:
  no change.

## Other component changes

- `src/components/Canvas.jsx`: when a city has a `label`, render it next
  to the node instead of the index. Two-line change against the existing
  label-render code.
- `src/components/ControlPanel.jsx`: disable `+ CITY` and RANDOM CITIES
  when `customMatrix != null`, tooltip "disabled while custom matrix is
  active — Reset to Default to re-enable."
- `src/App.jsx`: pass `customMatrix` / `cityLabels` through to children
  that need them (likely already wired via the `solver` prop bag — confirm
  during implementation).

## Component boundaries (summary)

- **`src/lib/excel.js`** — parse / symmetrize / template. No React, no DOM,
  no state. Pure functions, throws on validation failure.
- **`src/lib/matrix.js`** — `circleLayout(n)`. Pure.
- **`src/algorithms/utils.js`** — `buildEuclideanMatrix`, `tourCost`,
  `distance`. No React.
- **`src/hooks/useTSPSolver.js`** — owns mode (`customMatrix` /
  `cityLabels`), Apply / Reset transitions, mode guards on add-city /
  random-cities, auto-run after Apply.
- **`src/components/DistanceMatrix.jsx`** — owns staging state (working N,
  labels, upper-triangle cells, diffs banner). Calls the hook only on
  Apply / Reset / Cancel.

## Files

| File | Change |
|---|---|
| `src/components/DistanceMatrix.jsx` | **Rewrite.** Staging state, Apply / Cancel / Reset / Import / Template, cell + label validation, mirroring, disabled states, diffs banner. |
| `src/lib/excel.js` | Replace edge-list auto-detect with strict matrix-only parser. Add `symmetrize`, `buildTemplate`. Update error messages. |
| `src/lib/excel.test.js` | Drop edge-list tests. Add matrix happy path, each validation error, `symmetrize` (no-op + diffs), `buildTemplate` round-trip. |
| `src/lib/matrix.js` | Keep `circleLayout`. Remove `reconcileImport` (the staging panel now owns reconciliation). |
| `src/lib/matrix.test.js` | Drop `reconcileImport` tests; keep `circleLayout` tests. |
| `src/algorithms/utils.js` | Rename `buildCostMatrix` → `buildEuclideanMatrix`. Drop override-merge. Remove `isSymmetric`. |
| `src/algorithms/utils.test.js` | Drop per-cell override / `isSymmetric` tests. Keep `tourCost` / `buildEuclideanMatrix` happy paths. |
| `src/algorithms/branchAndBound.js` | No change. |
| `src/algorithms/{nearestNeighbor,twoOpt,simulatedAnnealing,genetic,bruteForce}.js` | No change. |
| `src/algorithms/solvers.test.js` | No change. |
| `src/hooks/useTSPSolver.js` | Replace `setMatrixCell` / `importMatrix` with `applyCustomMatrix`. Drop B&B symmetry guard. Drop node-set invalidation. Guard `addCity` / `generateRandom`. `resetMatrix` also clears cities. Auto-run after Apply. Uses `circleLayout` from `src/lib/matrix.js`. |
| `src/components/ControlPanel.jsx` | Disable `+ CITY` / RANDOM CITIES when custom matrix is active. |
| `src/components/Canvas.jsx` | Render `city.label` when present. |
| `src/App.jsx` | Confirm `customMatrix` / `cityLabels` flow through prop bag. |
| `docs/superpowers/specs/2026-05-29-symmetric-distances-design.md` | **New** (this document). |
| `docs/superpowers/plans/2026-05-29-symmetric-distances.md` | **New** (written next by `writing-plans`). |

The prior `docs/superpowers/specs/2026-05-24-custom-distances-design.md`
and its plan stay in tree as historical record.

## Testing

### Unit (vitest)

- **`excel.test.js`** (rewritten):
  - Matrix happy path (3×3, 5×5).
  - Each validation error from the table above triggers the expected message.
  - `symmetrize`: no-op on already-symmetric input; diffs returned with
    correct `(i, j, a, b, value)` tuples on asymmetric input.
  - `buildTemplate(n)` round-trips: parse the generated blob, get back
    `labels = ['City1', …, 'CityN']` and an all-zero diagonal with the rest
    blank-as-zero.
- **`utils.test.js`** (updated):
  - `buildEuclideanMatrix`: N×N, 0 diagonal, Euclidean off-diagonal,
    symmetric.
  - `tourCost`: sums a known tour against a known matrix.
- **`solvers.test.js`**: unchanged.

### Manual verification

- Open panel from empty canvas → set N=5 → fill upper triangle → labels
  stay default → Apply → canvas shows 5 nodes on a circle, solver auto-runs,
  status bar distance matches the matrix.
- Reopen panel while ● ACTIVE → grid pre-filled → edit one cell → Cancel →
  matrix unchanged.
- Reopen → edit → Apply → matrix updates, tour re-runs.
- Try Apply with one cell empty → button disabled, "1 empty cell" tooltip.
- Type `abc` in a cell → red border on blur, tooltip "must be ≥ 0".
- Download template → fill in Excel → Import → grid preview → Apply → tour
  runs.
- Import a non-symmetric file → diff banner shows averages → Apply → solver
  uses averaged values; Undo & view raw repopulates upper-triangle with the
  raw values for hand-correction.
- Import a non-square file → toast with the matching error, no state change.
- ● ACTIVE + Reset to Default → empty canvas, click-to-place + RANDOM
  CITIES re-enabled.
- While `isRunning` → every panel control disabled.
- N=13 + B&B selected + Apply → toast "N too large for Branch & Bound —
  pick another algorithm", no run; matrix and labels still committed.

## Out of scope (v1)

- Editing the lower triangle directly (mirror-from-upper only).
- Per-cell error messages stacked into a list (rely on inline border +
  tooltip).
- CSV-as-matrix support beyond what SheetJS handles natively.
- Persisting custom matrices across page reloads.
- Drag-and-drop on the file input (click-to-browse only).
- Editing city positions on canvas while a custom matrix is active.
- Edge-list (From/To/Distance) Excel layout — removed from the prior design.
