import { describe, expect, it } from 'vitest';
import { formatThaiDate, formatThaiDateTime, getDateTime } from './dateUtils';

describe('dateUtils', () => {
  it('formats ISO-like dates as Thai Buddhist dates', () => {
    expect(formatThaiDate('2026-04-23 10:30:00')).toBe('23 เมษายน 2569');
    expect(formatThaiDateTime('2026-04-23 10:30:00')).toBe('23 เมษายน 2569 10:30 น.');
  });

  it('does not invent midnight for legacy date-only values', () => {
    expect(formatThaiDateTime('2026-04-23')).toBe('23 เมษายน 2569');
    expect(formatThaiDateTime('23 เมษายน 2569')).toBe('23 เมษายน 2569');
  });

  it('parses Thai Buddhist dates for sorting', () => {
    expect(getDateTime('23 เมษายน 2569 10:30')).toBe(new Date(2026, 3, 23, 10, 30).getTime());
  });
});
