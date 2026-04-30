/**
 * Parcel Service — Google Apps Script API client
 */

import type {
  CreateParcelPayload,
  CreateParcelResponse,
  GetParcelsPayload,
  GetParcelsResponse,
  GetParcelPayload,
  GetParcelResponse,
  ConfirmReceiptPayload,
  ConfirmReceiptResponse,
  ExportSummaryResponse,
  ParcelSummary,
  Parcel,
} from '@/types/parcel';
import { applyDerivedStatus, applyDerivedStatuses } from './parcelStatus';

const GAS_URL     = import.meta.env.VITE_GAS_URL     as string | undefined ?? '';
const GAS_API_KEY = import.meta.env.VITE_GAS_API_KEY as string | undefined ?? '';

// ── Branch list ──────────────────────────────────────────────────────────────

const DEFAULT_BRANCHES = [
  'MS', 'พระประแดง', 'บางนา', 'มีนบุรี', 'เลียบด่วน',
  'เดอะมอลล์บางกะปิ', 'วิภาวดี', 'พิบูลสงคราม', 'เดอะมอลล์บางแค',
  'มหาชัย', 'ศาลายา', 'กาญจนา', 'เซ็นทรัล พระราม 2',
];

/** Branches that have known coordinates in TrackingMap. */
export const BRANCHES_WITH_COORDS = [
  'MS','พระประแดง','บางนา','มีนบุรี','เลียบด่วน','เดอะมอลล์บางกะปิ',
  'วิภาวดี','พิบูลสงคราม','พันธุ์สงคราม','เดอะมอลล์บางแค','มหาชัย',
  'ศาลายา','กาญจนา','เซ็นทรัล พระราม 2','เซ็นทรัลพระราม 2',
];

// Legacy branch list that was shipped in an earlier version — treat as stale
const LEGACY_BRANCHES = [
  'ศูนย์ใหญ่บางนา', 'มหาชัย', 'ศาลายา', 'กาญจนา',
  'เซ็นทรัลพระราม 2', 'เรียบด่วน', 'เดอะมอลล์บางกะปิ', 'มีนบุรี',
];

function isLegacyBranchList(list: string[]): boolean {
  return (
    list.length === LEGACY_BRANCHES.length &&
    list.every((b, i) => b === LEGACY_BRANCHES[i])
  );
}

const storedBranches = (() => {
  try {
    return JSON.parse(localStorage.getItem('branches') ?? 'null') as string[] | null;
  } catch {
    return null;
  }
})();

let BRANCHES: string[] =
  !storedBranches || isLegacyBranchList(storedBranches)
    ? DEFAULT_BRANCHES
    : storedBranches;

const CONFIG_UPDATED_EVENT = 'parcel-config-updated';

export function getBranches(): string[] {
  return BRANCHES;
}

export function setBranches(branches: string[]): void {
  BRANCHES = branches;
  localStorage.setItem('branches', JSON.stringify(branches));
  window.dispatchEvent(new Event(CONFIG_UPDATED_EVENT));
}

export function isConfigured(): boolean {
  return !!GAS_URL && BRANCHES.length > 0;
}

export function getGasUrl(): string {
  return GAS_URL;
}

export function onConfigUpdated(listener: () => void): () => void {
  window.addEventListener(CONFIG_UPDATED_EVENT, listener);
  return () => window.removeEventListener(CONFIG_UPDATED_EVENT, listener);
}

// ── Internal API helper ──────────────────────────────────────────────────────

async function callAPI<T>(payload: object): Promise<T> {
  if (!GAS_URL) {
    throw new Error('กรุณาตั้งค่า Google Apps Script URL ก่อน');
  }

  let response: Response;
  try {
    let authData = {};
    const storedUser = localStorage.getItem('doc_track_user');
    if (storedUser) {
      try {
        const u = JSON.parse(storedUser);
        authData = { employeeId: u.employeeId, role: u.role, token: u.token };
      } catch (e) {
        // ignore
      }
    }

    response = await fetch(GAS_URL, {
      method: 'POST',
      body: JSON.stringify({ ...authData, ...payload, apiKey: GAS_API_KEY }),
      // GAS requires text/plain to avoid CORS preflight
      headers: { 'Content-Type': 'text/plain' },
    });
  } catch {
    throw new Error('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต');
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('API Key ไม่ถูกต้องหรือไม่มีสิทธิ์เข้าถึง');
    } else if (response.status >= 500) {
      throw new Error('เซิร์ฟเวอร์ขัดข้อง กรุณาลองใหม่อีกครั้ง');
    }
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json() as any;
  if (data && data.success === false) {
    if (data.error === "Authentication required (Missing Token)" || data.error === "Invalid token signature" || data.error === "Malformed token") {
      window.dispatchEvent(new Event('auth_error'));
    }
  }
  return data as T;
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function createParcel(
  senderName: string,
  senderBranch: string,
  receiverName: string,
  receiverBranch: string,
  docType: string,
  description?: string,
  note?: string,
  pin?: string,
): Promise<CreateParcelResponse> {
  const payload: CreateParcelPayload = {
    action: 'createParcel',
    senderName, senderBranch, receiverName, receiverBranch, docType, description, note, pin
  };
  try {
    const res = await callAPI<Record<string, unknown>>(payload);
    return {
      success: Boolean(res.success),
      trackingID: (res.trackingID ?? res.trackingId) as string | undefined,
      error: res.error as string | undefined,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด';
    return { success: false, error: message };
  }
}

export async function getParcels(status: string = 'ทั้งหมด', limit: number = 50, offset: number = 0): Promise<GetParcelsResponse> {
  const payload = { action: 'getParcels', status, limit, offset };
  try {
    const res = await callAPI<GetParcelsResponse>(payload);
    if (res.success && Array.isArray(res.parcels)) {
      let parcels = applyDerivedStatuses(res.parcels);
      if (status !== 'ทั้งหมด') {
        parcels = parcels.filter(p => p['สถานะ'] === status);
      }
      return { ...res, parcels };
    }
    return { success: false, parcels: [], error: res.error };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด';
    return { success: false, parcels: [], error: message };
  }
}

export async function getParcel(trackingID: string): Promise<GetParcelResponse> {
  const payload: GetParcelPayload = { action: 'getParcel', trackingID };
  try {
    const res = await callAPI<GetParcelResponse>(payload);
    if (res.success && res.parcel) {
      return { success: true, parcel: applyDerivedStatus(res.parcel) };
    }
    return { success: false, error: res.error };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด';
    return { success: false, error: message };
  }
}

export async function confirmReceipt(
  trackingID: string,
  photoUrl: string,
  note?: string,
  latitude?: number,
  longitude?: number,
  eventType?: 'FORWARD' | 'PROXY' | 'DELIVERED',
  location?: string,
  destLocation?: string,
  person?: string,
  pin?: string,
): Promise<ConfirmReceiptResponse> {
  const payload: ConfirmReceiptPayload = { action: 'confirmReceipt', trackingID, photoUrl, note, latitude, longitude, eventType, location, destLocation, person, pin };
  try {
    return await callAPI<ConfirmReceiptResponse>(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด';
    return { success: false, error: message };
  }
}

export async function searchParcels(query: string): Promise<Parcel[]> {
  try {
    const res = await callAPI<{ success: boolean; parcels?: Parcel[] }>({
      action: 'searchParcels',
      query,
    });
    if (res.success && Array.isArray(res.parcels)) {
      return applyDerivedStatuses(res.parcels);
    }
    return [];
  } catch {
    return [];
  }
}

/** Fetches a raw summary from the backend (used as a fallback). */
export async function exportSummary(): Promise<ParcelSummary | null> {
  try {
    const res = await callAPI<ExportSummaryResponse>({ action: 'exportSummary' });
    return res.summary ?? null;
  } catch {
    return null;
  }
}

// --- Users & RBAC ---

export interface User {
  employeeId: string;
  name: string;
  branch: string;
  role: 'User' | 'Manager' | 'Admin' | 'Guest';
  token?: string;
}

export interface UserRow extends User {
  hasPin: boolean;
  createdAt: string;
}

export async function login(employeeId: string, pin?: string): Promise<{ success: boolean, needsSetup?: boolean, user?: User, error?: string, role?: string, name?: string, branch?: string }> {
  try {
    return await callAPI({ action: 'login', employeeId, pin });
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด' };
  }
}

export async function setupPin(employeeId: string, pin: string, name: string, branch: string): Promise<{ success: boolean, user?: User, error?: string }> {
  try {
    return await callAPI({ action: 'setupPin', employeeId, pin, name, branch });
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด' };
  }
}

export async function getUsers(): Promise<{ success: boolean, users?: UserRow[], error?: string }> {
  try {
    return await callAPI({ action: 'getUsers' });
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด' };
  }
}

export async function updateUserRole(targetId: string, newRole: string): Promise<{ success: boolean, error?: string }> {
  try {
    return await callAPI({ action: 'updateUserRole', targetId, newRole });
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด' };
  }
}

export async function deleteParcel(trackingID: string): Promise<{ success: boolean, error?: string }> {
  try {
    return await callAPI({ action: 'deleteParcel', trackingID });
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด' };
  }
}

export async function editParcel(trackingID: string, updates: Partial<Record<string, string>>): Promise<{ success: boolean, error?: string }> {
  try {
    return await callAPI({ action: 'editParcel', trackingID, updates });
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด' };
  }
}
