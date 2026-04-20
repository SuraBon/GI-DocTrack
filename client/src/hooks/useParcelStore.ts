/**
 * Parcel Store Hook
 * State management สำหรับข้อมูลพัสดุ
 */

import { useState, useCallback } from 'react';
import type { Parcel, ParcelSummary } from '@/types/parcel';
import * as parcelService from '@/lib/parcelService';

export function useParcelStore() {
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [summary, setSummary] = useState<ParcelSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadParcels = useCallback(async (status: string = 'ทั้งหมด') => {
    setLoading(true);
    setError(null);
    try {
      const response = await parcelService.getParcels(status);
      if (response.success) {
        setParcels(response.parcels);
      } else {
        setError(response.error || 'ไม่สามารถโหลดข้อมูลได้');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSummary = useCallback(async () => {
    try {
      const data = await parcelService.exportSummary();
      if (data) {
        setSummary(data);
      }
    } catch (err) {
      console.error('Failed to load summary:', err);
    }
  }, []);

  const createParcel = useCallback(
    async (
      senderName: string,
      senderBranch: string,
      receiverName: string,
      receiverBranch: string,
      docType: string,
      description?: string,
      note?: string
    ) => {
      setError(null);
      try {
        const response = await parcelService.createParcel(
          senderName,
          senderBranch,
          receiverName,
          receiverBranch,
          docType,
          description,
          note
        );
        if (response.success) {
          await loadParcels();
          await loadSummary();
          return response.trackingID;
        } else {
          setError(response.error || 'ไม่สามารถสร้างรายการได้');
          return null;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
        return null;
      }
    },
    [loadParcels, loadSummary]
  );

  const confirmReceipt = useCallback(
    async (trackingID: string, photoUrl: string, note?: string) => {
      setError(null);
      try {
        const response = await parcelService.confirmReceipt(trackingID, photoUrl, note);
        if (response.success) {
          await loadParcels();
          await loadSummary();
          return true;
        } else {
          setError(response.error || 'ไม่สามารถยืนยันการรับได้');
          return false;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
        return false;
      }
    },
    [loadParcels, loadSummary]
  );

  return {
    parcels,
    summary,
    loading,
    error,
    loadParcels,
    loadSummary,
    createParcel,
    confirmReceipt,
  };
}
