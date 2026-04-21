/**
 * Parcel Service
 * ฟังก์ชันสำหรับเรียก Google Apps Script API
 */

import type {
  CreateParcelPayload,
  CreateParcelResponse,
  GetParcelsPayload,
  GetParcelsResponse,
  GetParcelPayload,
  GetParcelResponse,
  ExportSummaryResponse,
  ConfirmReceiptPayload,
  ConfirmReceiptResponse,
  ParcelSummary,
  Parcel,
} from '@/types/parcel';

const GAS_URL = 'https://script.google.com/macros/s/AKfycbyo_gnEeKuDJD_1usBKk5GMt2KBwRDJzMPjok18MHfJGh1C2rbCLMACxN6M7jStaz30RQ/exec';
const DEFAULT_BRANCHES = [
  'ศูนย์ใหญ่บางนา',
  'มหาชัย',
  'ศาลายา',
  'กาญจนา',
  'เซ็นทรัลพระราม 2',
  'เรียบด่วน',
  'เดอะมอลล์บางกะปิ',
  'มีนบุรี',
];

export function getGasUrl() {
  return GAS_URL;
}

let BRANCHES = JSON.parse(localStorage.getItem('branches') || 'null') as string[] || DEFAULT_BRANCHES;

export function setBranches(branches: string[]) {
  BRANCHES = branches;
  localStorage.setItem('branches', JSON.stringify(branches));
}

export function getBranches() {
  return BRANCHES;
}

export function isConfigured() {
  return !!GAS_URL && BRANCHES.length > 0;
}

async function callAPI<T>(payload: any): Promise<T | null> {
  if (!GAS_URL) {
    throw new Error('กรุณาตั้งค่า Google Apps Script URL ก่อน');
  }

  try {
    const response = await fetch(GAS_URL, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'text/plain' },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

export async function createParcel(
  senderName: string,
  senderBranch: string,
  receiverName: string,
  receiverBranch: string,
  docType: string,
  description?: string,
  note?: string
): Promise<CreateParcelResponse> {
  const payload: CreateParcelPayload = {
    action: 'createParcel',
    senderName,
    senderBranch,
    receiverName,
    receiverBranch,
    docType,
    description,
    note,
  };

  const response = await callAPI<any>(payload);
  if (response) {
    return {
      success: response.success,
      trackingID: response.trackingID || response.trackingId,
      error: response.error,
    };
  }
  return { success: false };
}

export async function getParcels(status: string = 'ทั้งหมด'): Promise<GetParcelsResponse> {
  const payload: GetParcelsPayload = {
    action: 'getParcels',
    status,
  };

  return (await callAPI<GetParcelsResponse>(payload)) || { success: false, parcels: [] };
}

export async function getParcel(trackingID: string): Promise<GetParcelResponse> {
  const payload: GetParcelPayload = {
    action: 'getParcel',
    trackingID,
  };

  return (await callAPI<GetParcelResponse>(payload)) || { success: false };
}

export async function exportSummary(): Promise<ParcelSummary | null> {
  const payload = { action: 'exportSummary' };

  const response = await callAPI<ExportSummaryResponse>(payload);
  return response?.summary || null;
}

export async function confirmReceipt(
  trackingID: string,
  photoUrl: string,
  note?: string
): Promise<ConfirmReceiptResponse> {
  const payload: ConfirmReceiptPayload = {
    action: 'confirmReceipt',
    trackingID,
    photoUrl,
    note,
  };

  return (await callAPI<ConfirmReceiptResponse>(payload)) || { success: false };
}

export async function searchParcels(query: string): Promise<Parcel[]> {
  const response = await getParcels('ทั้งหมด');

  if (!response.success) {
    return [];
  }

  const ql = query.toLowerCase();
  return response.parcels.filter(
    (p) =>
      p['ผู้ส่ง'].toLowerCase().includes(ql) ||
      p['ผู้รับ'].toLowerCase().includes(ql) ||
      p['TrackingID'].toLowerCase().includes(ql)
  );
}
