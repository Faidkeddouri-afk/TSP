import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { symmetrize, parseDistanceFile, buildTemplate } from './excel.js';

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
      ['',  'A', 'B', 'C'],
      ['A',  '',  5,   3],
      ['B',   5, '',   4],
      ['C',   3,  4,  ''],
    ]);
    const { matrix } = await parseDistanceFile(file);
    expect(matrix[0][0]).toBe(0);
    expect(matrix[1][1]).toBe(0);
    expect(matrix[2][2]).toBe(0);
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

  it('parses a 5x5 symmetric matrix', async () => {
    const file = sheetFile([
      ['',  'A','B','C','D','E'],
      ['A',  0,  1,  2,  3,  4],
      ['B',  1,  0,  5,  6,  7],
      ['C',  2,  5,  0,  8,  9],
      ['D',  3,  6,  8,  0, 10],
      ['E',  4,  7,  9, 10,  0],
    ]);
    const { labels, matrix } = await parseDistanceFile(file);
    expect(labels).toEqual(['A','B','C','D','E']);
    expect(matrix).toHaveLength(5);
    matrix.forEach((row) => expect(row).toHaveLength(5));
    expect(matrix[0][4]).toBe(4);
    expect(matrix[4][0]).toBe(4);
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
      ['A', 'B', 'C'],
      [ 0,   5,   3],
      [ 5,   0,   4],
      [ 3,   4,   0],
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

  it('reports off-diagonal errors before diagonal errors when both are present', async () => {
    const file = sheetFile([
      ['',  'A', 'B', 'C'],
      ['A',  7,  'oops', 9],
      ['B',  5,   0,     8],
      ['C',  9,   8,     0],
    ]);
    // Off-diagonal "oops" should fire BEFORE the diagonal "7" at (A,A).
    await expect(parseDistanceFile(file)).rejects.toThrow(/not a non-negative number/i);
  });
});

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
