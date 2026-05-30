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
  // First pass: off-diagonal cells (check 6 per spec validation order table)
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const raw = body[i][j + 1];
      const num = Number(raw);
      if (isBlank(raw) || !Number.isFinite(num) || num < 0) {
        throw new Error(`Cell (${labels[i]}, ${labels[j]}) is not a non-negative number: "${raw ?? ''}".`);
      }
      matrix[i][j] = num;
    }
  }
  // Second pass: diagonal cells (check 7 per spec validation order table)
  for (let i = 0; i < n; i++) {
    const raw = body[i][i + 1];
    if (isBlank(raw)) { matrix[i][i] = 0; continue; }
    const num = Number(raw);
    if (!Number.isFinite(num) || num !== 0) {
      throw new Error(`Cell (${labels[i]}, ${labels[i]}) on the diagonal must be 0.`);
    }
    matrix[i][i] = 0;
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
