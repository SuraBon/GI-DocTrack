import { describe, expect, it } from 'vitest';
import {
  isSafeSheetText,
  isValidEmployeeId,
  isValidTrackingId,
  normalizeEmployeeId,
  sanitizeTextInput,
  validatePassword,
  validateRequiredText,
} from './validation';

describe('validation helpers', () => {
  it('normalizes and validates employee IDs', () => {
    expect(normalizeEmployeeId(' emp_001 ')).toBe('EMP_001');
    expect(isValidEmployeeId('EMP_001')).toBe(true);
    expect(isValidEmployeeId('!!!')).toBe(false);
  });

  it('strips dangerous HTML/control characters from text', () => {
    expect(sanitizeTextInput(' <script>alert(1)</script> สาขา\u0000 ')).toBe('alert(1) สาขา');
  });

  it('blocks formula-leading sheet text and passwords', () => {
    expect(isSafeSheetText('=IMPORTXML("x")')).toBe(false);
    expect(validateRequiredText('@bad', 'ชื่อ')).toContain('ห้ามขึ้นต้น');
    expect(validatePassword('=1234')).toContain('ห้ามขึ้นต้น');
  });

  it('validates tracking IDs', () => {
    expect(isValidTrackingId('TRK202605041234')).toBe(true);
    expect(isValidTrackingId('bad')).toBe(false);
  });
});
