const EMPLOYEE_ID_REGEX = /^[A-Z0-9_]{1,50}$/;
const PASSWORD_REGEX = /^[A-Za-z0-9!@#$%^&*()_\-+=.?]{4,100}$/;
const TRACKING_ID_REGEX = /^TRK\d{8}\d{4,}$/;
const DANGEROUS_SHEET_PREFIX_REGEX = /^[=+\-@\t\r]/;
const CONTROL_CHARS_REGEX = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

export function sanitizeTextInput(value: unknown, maxLength = 200): string {
  return String(value ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/[<>"'`]/g, '')
    .replace(CONTROL_CHARS_REGEX, '')
    .trim()
    .slice(0, maxLength);
}

export function normalizeEmployeeId(value: unknown): string {
  return String(value ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '')
    .slice(0, 50);
}

export function isValidEmployeeId(value: unknown): boolean {
  return EMPLOYEE_ID_REGEX.test(normalizeEmployeeId(value));
}

export function isSafeSheetText(value: unknown): boolean {
  return !DANGEROUS_SHEET_PREFIX_REGEX.test(String(value ?? '').trim());
}

export function validatePassword(value: unknown, maxLength = 20): string | null {
  const password = String(value ?? '').replace(CONTROL_CHARS_REGEX, '').trim();
  if (password.length < 4 || password.length > maxLength) {
    return `รหัสผ่านต้องมี 4-${maxLength} ตัวอักษร`;
  }
  if (!PASSWORD_REGEX.test(password) || DANGEROUS_SHEET_PREFIX_REGEX.test(password)) {
    return 'รหัสผ่านใช้ได้เฉพาะตัวอักษร ตัวเลข และสัญลักษณ์พื้นฐาน และห้ามขึ้นต้นด้วย = + - หรือ @';
  }
  return null;
}

export function validateRequiredText(value: unknown, label: string, minLength = 1, maxLength = 200): string | null {
  const text = sanitizeTextInput(value, maxLength + 1);
  if (text.length < minLength) return `กรุณากรอก${label}${minLength > 1 ? `อย่างน้อย ${minLength} ตัวอักษร` : ''}`;
  if (text.length > maxLength) return `${label}ยาวเกินไป`;
  if (!isSafeSheetText(text)) return `${label}ห้ามขึ้นต้นด้วย = + - หรือ @`;
  return null;
}

export function isValidTrackingId(value: unknown): boolean {
  return TRACKING_ID_REGEX.test(String(value ?? '').trim().toUpperCase());
}

