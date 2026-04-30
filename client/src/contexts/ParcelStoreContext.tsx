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
  hasMore: boolean;
  totalCount: number;
  loadParcels: (status?: string, reset?: boolean) => Promise<void>;
  loadMoreParcels: () => Promise<void>;
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
    latitude?: number,
    longitude?: number,
    eventType?: 'FORWARD' | 'PROXY' | 'DELIVERED',
    location?: string,
    destLocation?: string,
    person?: string,
  ) => Promise<{ success: boolean; error?: string }>;
}

const ParcelStoreContext = createContext<ParcelStoreValue | null>(null);

export function ParcelStoreProvider({ children }: { children: ReactNode }) {
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [summary, setSummary] = useState<ParcelSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [currentStatus, setCurrentStatus] = useState('ทั้งหมด');
  const offsetRef = useRef(0);

  const loadParcels = useCallback(async (status = 'ทั้งหมด', reset = true) => {
    setCurrentStatus(status);
    if (reset) {
      offsetRef.current = 0;
      setParcels([]);
    }
    setLoading(true);
    setError(null);
    try {
      const [res, summaryRes] = await Promise.all([
        parcelService.getParcels(status, 50, offsetRef.current),
        reset ? parcelService.exportSummary() : Promise.resolve(summary)
      ]);

      if (res.success) {
        setParcels(prev => reset ? (res.parcels || []) : [...prev, ...(res.parcels || [])]);
        setHasMore(res.hasMore || false);
        setTotalCount(res.totalCount || 0);
        offsetRef.current += (res.parcels || []).length;
        
        if (reset && summaryRes) {
          setSummary(summaryRes);
        }
        setError(null); // clear any previous error on success
      } else {
        setError(res.error ?? 'ไม่สามารถโหลดข้อมูลได้');
      }
    } catch (err) {
      setError('เกิดข้อผิดพลาดในการโหลดข้อมูล');
    } finally {
      setLoading(false);
    }
  }, [summary]);

  const loadMoreParcels = useCallback(async () => {
    if (!hasMore || loading) return;
    await loadParcels(currentStatus, false);
  }, [hasMore, loading, currentStatus, loadParcels]);

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
    async (trackingID, photoUrl, note, latitude, longitude, eventType, location, destLocation, person) => {
      setError(null);
      try {
        const res = await parcelService.confirmReceipt(trackingID, photoUrl, note, latitude, longitude, eventType, location, destLocation, person);
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
    () => ({ parcels, summary, loading, error, hasMore, totalCount, loadParcels, loadMoreParcels, createParcel, confirmReceipt }),
    [parcels, summary, loading, error, hasMore, totalCount, loadParcels, loadMoreParcels, createParcel, confirmReceipt],
  );

  return <ParcelStoreContext.Provider value={value}>{children}</ParcelStoreContext.Provider>;
}

export function useParcelStoreContext(): ParcelStoreValue {
  const ctx = useContext(ParcelStoreContext);
  if (!ctx) throw new Error('useParcelStore must be used within ParcelStoreProvider');
  return ctx;
}
