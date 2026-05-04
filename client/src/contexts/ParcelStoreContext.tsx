import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
    pin?: string,
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
    pin?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  removeParcelLocally: (trackingID: string) => void;
  updateParcelLocally: (trackingID: string, updates: Partial<Parcel>) => void;
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

  const summaryRef = useRef(summary);
  useEffect(() => { summaryRef.current = summary; }, [summary]);

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
        // Only fetch summary on reset — use ref to avoid stale closure without adding summary to deps
        reset ? parcelService.exportSummary() : Promise.resolve(summaryRef.current)
      ]);

      if (res.success) {
        let nextParcels: Parcel[] = [];
        setParcels(prev => {
          nextParcels = reset ? (res.parcels || []) : [...prev, ...(res.parcels || [])];
          return nextParcels;
        });
        setHasMore(res.hasMore || false);
        setTotalCount(res.totalCount || 0);
        offsetRef.current += (res.parcels || []).length;
        
        if (reset) {
          setSummary(summaryRes || summarizeParcels(nextParcels));
        }
        setError(null);
      } else {
        setError(res.error ?? 'ไม่สามารถโหลดข้อมูลได้');
      }
    } catch {
      setError('เกิดข้อผิดพลาดในการโหลดข้อมูล');
    } finally {
      setLoading(false);
    }
  }, []); // ✅ No deps — uses refs to avoid stale closures

  const loadMoreParcels = useCallback(async () => {
    if (!hasMore || loading) return;
    await loadParcels(currentStatus, false);
  }, [hasMore, loading, currentStatus, loadParcels]);

  const createParcel = useCallback<ParcelStoreValue['createParcel']>(
    async (senderName, senderBranch, receiverName, receiverBranch, docType, description, note, pin) => {
      setError(null);
      try {
        const res = await parcelService.createParcel(
          senderName, senderBranch, receiverName, receiverBranch, docType, description, note, pin
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
    async (trackingID, photoUrl, note, latitude, longitude, eventType, location, destLocation, person, pin) => {
      setError(null);
      try {
        const res = await parcelService.confirmReceipt(trackingID, photoUrl, note, latitude, longitude, eventType, location, destLocation, person, pin);
        if (res.success) {
          // Optimistic update already applied by the caller (ConfirmReceipt page).
          // Only do a background refresh — don't block the UI.
          loadParcels().catch(() => {});
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

  const removeParcelLocally = useCallback((trackingID: string) => {
    setParcels(prev => prev.filter(p => p.TrackingID !== trackingID));
    setTotalCount(prev => Math.max(0, prev - 1));
  }, []);

  const updateParcelLocally = useCallback((trackingID: string, updates: Partial<Parcel>) => {
    setParcels(prev => prev.map(p => p.TrackingID === trackingID ? { ...p, ...updates } : p));
  }, []);

  const value = useMemo<ParcelStoreValue>(
    () => ({ parcels, summary, loading, error, hasMore, totalCount, loadParcels, loadMoreParcels, createParcel, confirmReceipt, removeParcelLocally, updateParcelLocally }),
    [parcels, summary, loading, error, hasMore, totalCount, loadParcels, loadMoreParcels, createParcel, confirmReceipt, removeParcelLocally, updateParcelLocally],
  );

  return <ParcelStoreContext.Provider value={value}>{children}</ParcelStoreContext.Provider>;
}

export function useParcelStoreContext(): ParcelStoreValue {
  const ctx = useContext(ParcelStoreContext);
  if (!ctx) throw new Error('useParcelStore must be used within ParcelStoreProvider');
  return ctx;
}
