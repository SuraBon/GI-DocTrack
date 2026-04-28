import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Parcel, ParcelSummary } from '@/types/parcel';
import * as parcelService from '@/lib/parcelService';
import { summarizeParcels } from '@/lib/parcelStatus';

interface ParcelStoreValue {
  parcels: Parcel[];
  summary: ParcelSummary | null;
  loading: boolean;
  error: string | null;
  loadParcels: (status?: string) => Promise<void>;
  createParcel: (
    senderName: string,
    senderBranch: string,
    receiverName: string,
    receiverBranch: string,
    docType: string,
    description?: string,
    note?: string,
  ) => Promise<string | null>;
  confirmReceipt: (
    trackingID: string,
    photoUrl: string,
    note?: string,
  ) => Promise<{ success: boolean; error?: string }>;
}

const ParcelStoreContext = createContext<ParcelStoreValue | null>(null);

export function ParcelStoreProvider({ children }: { children: ReactNode }) {
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [summary, setSummary] = useState<ParcelSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const loadParcels = useCallback(async (status = 'ทั้งหมด') => {
    setLoading(true);
    setError(null);
    try {
      const res = await parcelService.getParcels(status);
      if (res.success) {
        setParcels(res.parcels);
        // Always recompute summary from the client-side list so derived
        // statuses (forwarded parcels) are reflected correctly.
        if (status === 'ทั้งหมด') {
          setSummary(summarizeParcels(res.parcels));
        }
      } else {
        setError(res.error ?? 'ไม่สามารถโหลดข้อมูลได้');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
    }
  }, []);

  const createParcel = useCallback<ParcelStoreValue['createParcel']>(
    async (senderName, senderBranch, receiverName, receiverBranch, docType, description, note) => {
      setError(null);
      try {
        const res = await parcelService.createParcel(
          senderName, senderBranch, receiverName, receiverBranch, docType, description, note,
        );
        if (!res.success) {
          setError(res.error ?? 'ไม่สามารถสร้างรายการได้');
          return null;
        }
        await loadParcels();
        return res.trackingID ?? null;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด';
        setError(message);
        return null;
      }
    },
    [loadParcels],
  );

  const confirmReceipt = useCallback<ParcelStoreValue['confirmReceipt']>(
    async (trackingID, photoUrl, note) => {
      setError(null);
      try {
        const res = await parcelService.confirmReceipt(trackingID, photoUrl, note);
        if (res.success) {
          await loadParcels();
        } else {
          setError(res.error ?? 'ไม่สามารถยืนยันการรับได้');
        }
        return res;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด';
        setError(message);
        return { success: false, error: message };
      }
    },
    [loadParcels],
  );

  const value = useMemo<ParcelStoreValue>(
    () => ({ parcels, summary, loading, error, loadParcels, createParcel, confirmReceipt }),
    [parcels, summary, loading, error, loadParcels, createParcel, confirmReceipt],
  );

  return <ParcelStoreContext.Provider value={value}>{children}</ParcelStoreContext.Provider>;
}

export function useParcelStoreContext(): ParcelStoreValue {
  const ctx = useContext(ParcelStoreContext);
  if (!ctx) throw new Error('useParcelStore must be used within ParcelStoreProvider');
  return ctx;
}
