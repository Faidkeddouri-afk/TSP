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
export async function readFileToRows(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });
}

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

  // Header row must start with a blank top-left corner cell and have at least 2 names.
  const header = rows[0];
  if (!isBlank(header[0])) {
    throw new Error('Missing headers. Row 1 and column A must contain city names.');
  }
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
