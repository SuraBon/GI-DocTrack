export type SystemRole = 'USER' | 'MESSENGER' | 'ADMIN';
export type AppRole = SystemRole | 'GUEST';

export const SYSTEM_ROLES: SystemRole[] = ['USER', 'MESSENGER', 'ADMIN'];

export const ROLE_LABELS: Record<AppRole, string> = {
  USER: 'User',
  MESSENGER: 'Messenger',
  ADMIN: 'Admin',
  GUEST: 'Guest',
};

export function normalizeRole(role: unknown): AppRole {
  const normalized = String(role || '').trim().toUpperCase();

  if (normalized === 'ADMIN') return 'ADMIN';
  if (normalized === 'MESSENGER' || normalized === 'MANAGER') return 'MESSENGER';
  if (normalized === 'USER') return 'USER';
  return 'GUEST';
}
