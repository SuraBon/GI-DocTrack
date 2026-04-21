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
        const overriddenParcels = response.parcels.map((parcel) => {
          if (parcel['สถานะ'] === 'ส่งถึงแล้ว') {
            const note = parcel['หมายเหตุ'] || '';
            const lastForwardIdx = note.lastIndexOf('[ส่งต่อโดย:');
            const lastProxyIdx = note.lastIndexOf('[รับแทนโดย:');
            const lastNormalIdx = note.lastIndexOf('[รับพัสดุเรียบร้อย');
            
            const maxIdx = Math.max(lastForwardIdx, lastProxyIdx, lastNormalIdx);
            
            if (maxIdx >= 0 && maxIdx === lastForwardIdx) {
              return { ...parcel, 'สถานะ': 'กำลังจัดส่ง' } as Parcel;
            }
          }
          return parcel;
        });
        setParcels(overriddenParcels);

        // Recalculate summary locally if we fetched all parcels
        if (status === 'ทั้งหมด') {
          let total = 0, pending = 0, transit = 0, delivered = 0;
          overriddenParcels.forEach(p => {
            total++;
            if (p['สถานะ'] === 'รอจัดส่ง') pending++;
            else if (p['สถานะ'] === 'กำลังจัดส่ง') transit++;
            else if (p['สถานะ'] === 'ส่งถึงแล้ว') delivered++;
          });
          setSummary({ total, pending, transit, delivered });
        }
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
          return response;
        } else {
          setError(response.error || 'ไม่สามารถยืนยันการรับได้');
          return response;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
        return { success: false, error: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด' };
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
