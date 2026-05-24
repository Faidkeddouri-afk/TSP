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
