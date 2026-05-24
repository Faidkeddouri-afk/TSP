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
    expect(matrix[2][0]).toBeNull();
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
