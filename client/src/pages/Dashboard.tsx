/**
 * Dashboard Page
 */

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParcelStore } from '@/hooks/useParcelStore';
import { useAuth } from '@/contexts/AuthContext';
import { deleteParcel } from '@/lib/parcelService';
import { useDebounce } from '@/hooks/useDebounce';
import StatusBadge from '@/components/StatusBadge';
import type { Parcel } from '@/types/parcel';
import { toast } from 'sonner';
import { parseParcelTimeline } from '@/lib/timeline';
import { Skeleton } from '@/components/ui/skeleton';
import { formatThaiDateTime } from '@/lib/dateUtils';
import ParcelTimelineModal from '@/components/ParcelTimelineModal';
import ConfirmReceipt from '@/pages/ConfirmReceipt';
import CreateParcel from '@/pages/CreateParcel';
import Track from '@/pages/Track';
import { normalizeRole } from '@/lib/roles';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface DashboardProps { isConfigured: boolean; }

const STATS = [
  { key: 'total',     filter: 'ทั้งหมด',     label: 'ทั้งหมด',  icon: 'inventory_2',     iconBg: 'bg-slate-100',    iconText: 'text-primary' },
  { key: 'pending',   filter: 'รอสถานะจัดส่ง',    label: 'รอสถานะจัดส่ง', icon: 'pending_actions', iconBg: 'bg-amber-50',    iconText: 'text-amber-600' },
  { key: 'transit',   filter: 'กำลังจัดส่ง', label: 'กำลังจัดส่ง', icon: 'local_shipping', iconBg: 'bg-blue-50',     iconText: 'text-blue-600' },
  { key: 'delivered', filter: 'ส่งสำเร็จ',   label: 'ส่งสำเร็จ', icon: 'task_alt',       iconBg: 'bg-emerald-50',  iconText: 'text-emerald-600' },
] as const;

const StatsCard = ({
  label,
  icon,
  iconBg,
  iconText,
  count,
  active,
  onClick,
}: {
  label: string;
  icon: string;
  iconBg: string;
  iconText: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={`flex min-h-[92px] w-full items-center rounded-2xl border bg-white px-5 py-4 text-left shadow-sm transition-all duration-300 active:scale-[0.99] ${
      active
        ? 'border-primary/45 ring-2 ring-primary/10'
        : 'border-outline-variant/25 hover:border-primary/25 hover:shadow-md'
    }`}
  >
    <div className="flex min-w-0 items-center gap-4">
      <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${iconBg}`}>
        <span className={`material-symbols-outlined text-2xl ${iconText}`} style={{ fontVariationSettings: "'FILL' 0" }}>{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="text-3xl font-black leading-none text-primary font-display">{count}</p>
        <p className="mt-1 truncate text-sm font-medium leading-tight text-primary">{label}</p>
      </div>
    </div>
  </button>
);

const TableSkeleton = () => (
  <div className="space-y-0 w-full">
    {[...Array(6)].map((_, i) => (
      <div key={i} className="flex flex-col sm:flex-row items-start sm:items-center gap-4 px-4 sm:px-6 py-4 border-b border-outline-variant/10 w-full">
        <Skeleton className="h-8 w-28 rounded-lg" />
        <div className="flex-1 space-y-2 w-full">
          <Skeleton className="h-4 w-3/4 sm:w-1/2" />
          <Skeleton className="h-3 w-1/2 sm:w-1/3" />
        </div>
        <Skeleton className="h-4 w-20 hidden sm:block" />
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
    ))}
  </div>
);

const PARCEL_MILESTONES = [
  { status: 'รอสถานะจัดส่ง', label: 'รอสถานะจัดส่ง', icon: 'pending_actions' },
  { status: 'กำลังจัดส่ง', label: 'กำลังจัดส่ง', icon: 'local_shipping' },
  { status: 'ส่งสำเร็จ', label: 'ส่งสำเร็จ', icon: 'task_alt' },
] as const;

const getMilestoneIndex = (status: Parcel['สถานะ']) => {
  if (status === 'ส่งสำเร็จ') return 2;
  if (status === 'กำลังจัดส่ง') return 1;
  return 0;
};

const ParcelMilestone = ({ status }: { status: Parcel['สถานะ'] }) => {
  const currentIndex = getMilestoneIndex(status);

  return (
    <div className="mt-2.5 rounded-xl border border-outline-variant/20 bg-surface-container-lowest/65 px-3 py-2">
      <div className="flex items-center">
        {PARCEL_MILESTONES.map((step, index) => {
          const done = index <= currentIndex;
          const active = index === currentIndex;
          return (
            <div key={step.status} className="flex flex-1 items-center last:flex-none">
              <div className="flex min-w-0 flex-col items-center gap-1">
                <span
                  className={`grid h-6 w-6 place-items-center rounded-full border text-[13px] transition-colors ${
                    done
                      ? 'border-primary bg-primary text-white'
                      : 'border-outline-variant/40 bg-white text-on-surface-variant/35'
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: done ? "'FILL' 1" : "'FILL' 0" }}>
                    {step.icon}
                  </span>
                </span>
                <span className={`max-w-[82px] truncate text-[9px] font-black leading-none sm:text-[10px] ${active ? 'text-primary' : done ? 'text-on-surface-variant/65' : 'text-on-surface-variant/35'}`}>
                  {step.label}
                </span>
              </div>
              {index < PARCEL_MILESTONES.length - 1 && (
                <div className={`mx-2 h-0.5 flex-1 rounded-full ${index < currentIndex ? 'bg-primary' : 'bg-outline-variant/25'}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const MobileParcelCard = ({
  parcel,
  onOpen,
  canConfirm,
  onConfirm,
}: {
  parcel: Parcel;
  onOpen: () => void;
  canConfirm: boolean;
  onConfirm: () => void;
}) => (
  <div className="w-full rounded-xl border border-outline-variant/20 bg-white p-3 text-left shadow-sm transition-all">
    <div className="w-full text-left">
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0 flex-1">
          <code className="inline-block max-w-full break-all rounded-md bg-primary/6 px-2 py-0.5 font-mono text-[11px] font-black leading-tight text-primary">
            {parcel.TrackingID}
          </code>
          <div className="mt-2 flex min-w-0 items-center gap-1.5">
            <span className="truncate text-sm font-black text-primary">{parcel['ผู้ส่ง']}</span>
            <span className="material-symbols-outlined shrink-0 text-base text-outline-variant">arrow_forward</span>
            <span className="truncate text-sm font-black text-primary">{parcel['ผู้รับ']}</span>
          </div>
          <div className="mt-1 flex min-w-0 items-center gap-1 text-xs text-on-surface-variant/55">
            <span className="truncate">{parcel['สาขาผู้ส่ง']}</span>
            <span className="shrink-0">→</span>
            <span className="truncate">{parcel['สาขาผู้รับ']}</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-on-surface-variant/55">
            <span className="material-symbols-outlined text-[13px]">event</span>
            <span>{formatThaiDateTime(parcel['วันที่สร้าง'])}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <StatusBadge status={parcel['สถานะ']} className="h-6 w-[92px] text-[10px]" />
          <button
            type="button"
            onClick={onOpen}
            className="inline-flex items-center gap-0.5 rounded-full bg-primary/8 px-2 py-1 text-[10px] font-black text-primary transition-colors hover:bg-primary hover:text-white active:scale-95"
          >
            ดูรายละเอียด
            <span className="material-symbols-outlined text-[13px]">chevron_right</span>
          </button>
        </div>
      </div>
      <ParcelMilestone status={parcel['สถานะ']} />
    </div>
    {canConfirm && (
      <button
        type="button"
        onClick={onConfirm}
        className="mt-2.5 flex h-9 w-full items-center justify-center gap-2 rounded-xl bg-primary text-xs font-black text-white shadow-sm active:scale-[0.99]"
      >
        <span className="material-symbols-outlined text-base">add_a_photo</span>
        บันทึกหลักฐาน
      </button>
    )}
  </div>
);

export default function Dashboard({ isConfigured }: DashboardProps) {
  const { user } = useAuth();
  const { parcels, summary, loading, loadParcels, hasMore, loadMoreParcels, removeParcelLocally } = useParcelStore();
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [statusFilter, setStatusFilter] = useState('ทั้งหมด');
  const [selectedParcel, setSelectedParcel] = useState<Parcel | null>(null);
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [confirmTrackingId, setConfirmTrackingId] = useState<string | null>(null);
  const [isConfirmFlowOpen, setIsConfirmFlowOpen] = useState(false);
  const [isConfirmPreparingCamera, setIsConfirmPreparingCamera] = useState(false);
  const [isCreateFlowOpen, setIsCreateFlowOpen] = useState(false);
  const [isTrackFlowOpen, setIsTrackFlowOpen] = useState(false);
  const [refreshCountdown, setRefreshCountdown] = useState(120);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const isFetchingRef = useRef(false);
  const role = normalizeRole(user?.role);
  const isUserDashboard = role === 'USER';
  const canConfirmParcel = role === 'ADMIN' || role === 'MESSENGER';
  const stats = useMemo(() => STATS.map((stat) => (
    isUserDashboard && stat.key === 'total'
      ? { ...stat, label: 'พัสดุของฉันทั้งหมด' }
      : stat
  )), [isUserDashboard]);

  // Single fetch function — loadParcels already recomputes summary internally
  // ✅ FIX: Use ref to avoid stale closure without adding loadParcels to deps
  const loadParcelsRef = useRef(loadParcels);
  useEffect(() => { loadParcelsRef.current = loadParcels; }, [loadParcels]);

  const fetchData = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      await loadParcelsRef.current();
    } catch {
      toast.error('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      isFetchingRef.current = false;
      setRefreshCountdown(120);
    }
  }, []); // ✅ Empty deps — no infinite loop risk

  // Initial load
  useEffect(() => {
    if (!isConfigured) return;
    fetchData();
  }, [isConfigured, fetchData]);

  // Countdown tick — pauses when tab is hidden to save GAS quota
  useEffect(() => {
    if (!isConfigured) return;
    const timer = setInterval(() => {
      // Don't refresh when tab is not visible
      if (document.hidden) return;
      let shouldRefresh = false;
      setRefreshCountdown(prev => {
        if (prev <= 1) {
          shouldRefresh = true;
          return 0;
        }
        return prev - 1;
      });
      if (shouldRefresh) {
        fetchData();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [isConfigured, fetchData]);

  const filteredParcels = useMemo(() => {
    let f = parcels;
    if (statusFilter !== 'ทั้งหมด') f = f.filter(p => p['สถานะ'] === statusFilter);
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      f = f.filter(p =>
        p.TrackingID.toLowerCase().includes(q) ||
        p['ผู้ส่ง'].toLowerCase().includes(q) ||
        p['ผู้รับ'].toLowerCase().includes(q)
      );
    }
    return f;
  }, [parcels, statusFilter, debouncedSearch]);

  // Pagination calculations
  const { totalPages, paginatedParcels, startIndex, endIndex } = useMemo(() => {
    const total = Math.max(1, Math.ceil(filteredParcels.length / pageSize));
    const paginated = filteredParcels.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    const start = filteredParcels.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const end = Math.min(currentPage * pageSize, filteredParcels.length);
    return { totalPages: total, paginatedParcels: paginated, startIndex: start, endIndex: end };
  }, [filteredParcels, currentPage, pageSize]);

  // Reset page when filter changes
  useEffect(() => { setCurrentPage(1); }, [statusFilter, debouncedSearch]);

  // Clamp currentPage ไม่ให้เกิน totalPages เมื่อข้อมูลเปลี่ยน
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [totalPages, currentPage]);

  const handleRefresh = async () => {
    if (loading) return; // ป้องกันกดซ้ำระหว่าง loading
    await fetchData();
    toast.success('อัปเดตข้อมูลเรียบร้อย');
  };

  const selectedTimelineEvents = useMemo(() =>
    selectedParcel ? parseParcelTimeline(selectedParcel) : [], [selectedParcel]);

  /** True when the selected parcel has at least one known-coordinate branch. */
  const selectedParcelHasKnownBranches = useMemo(() => {
    if (!selectedParcel) return false;
    return selectedTimelineEvents.some(
      event => typeof event.latitude === 'number' && typeof event.longitude === 'number'
    );
  }, [selectedParcel, selectedTimelineEvents]);

  const clearFilters = () => { setSearchTerm(''); setStatusFilter('ทั้งหมด'); setCurrentPage(1); };
  const hasFilters = !!(searchTerm || statusFilter !== 'ทั้งหมด');

  const handleDelete = async () => {
    if (!selectedParcel) return;
    setIsDeleteConfirmOpen(true);
  };

  const openConfirmFlow = (trackingId: string) => {
    setIsTimelineOpen(false);
    setConfirmTrackingId(trackingId);
    setIsConfirmFlowOpen(true);
  };

  const executeDelete = async () => {
    if (!selectedParcel) return;
    const trackingID = selectedParcel.TrackingID;
    setIsTimelineOpen(false);
    setIsDeleteConfirmOpen(false);
    removeParcelLocally(trackingID);
    toast.success('กำลังลบรายการ...');
    const res = await deleteParcel(trackingID);
    if (res.success) {
      toast.success('ลบรายการสำเร็จ');
    } else {
      toast.error('ไม่สามารถลบรายการได้ จะทำการรีโหลดข้อมูล');
      loadParcels(undefined, true);
    }
  };

  if (!isConfigured) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-full max-w-sm p-8 bg-white rounded-3xl shadow-xl text-center border border-error/10">
          <div className="w-16 h-16 bg-error/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-3xl text-error">warning</span>
          </div>
          <h2 className="text-xl font-bold text-primary mb-2">ยังไม่ได้ตั้งค่าระบบ</h2>
          <p className="text-sm text-on-surface-variant">กรุณาตั้งค่า GAS URL และ API KEY ในไฟล์ .env</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {isUserDashboard && (
        <div className="grid grid-cols-2 gap-2 sm:max-w-md">
          <button
            type="button"
            onClick={() => setIsCreateFlowOpen(true)}
            className="flex items-center gap-2.5 rounded-xl border border-outline-variant/25 bg-white p-3 text-left shadow-sm active:scale-[0.99]"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-600">
              <span className="material-symbols-outlined text-xl">add_box</span>
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-black text-primary">สร้างพัสดุ</span>
              <span className="block truncate text-[11px] font-semibold text-on-surface-variant/55">เปิดฟอร์ม</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => setIsTrackFlowOpen(true)}
            className="flex items-center gap-2.5 rounded-xl border border-outline-variant/25 bg-white p-3 text-left shadow-sm active:scale-[0.99]"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600">
              <span className="material-symbols-outlined text-xl">qr_code_scanner</span>
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-black text-primary">ค้นหาพัสดุ</span>
              <span className="block truncate text-[11px] font-semibold text-on-surface-variant/55">ติดตามสถานะ</span>
            </span>
          </button>
        </div>
      )}

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 gap-2 sm:hidden">
        {stats.map(s => (
          <button
            key={s.key}
            type="button"
            onClick={() => setStatusFilter(s.filter)}
            aria-pressed={statusFilter === s.filter}
            className={`rounded-xl border bg-white/90 p-2.5 text-left shadow-sm transition-all active:scale-[0.99] ${
              statusFilter === s.filter
                ? 'border-primary/45 ring-2 ring-primary/10'
                : 'border-outline-variant/25'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${s.iconBg}`}>
                <span className={`material-symbols-outlined text-lg ${s.iconText}`}>{s.icon}</span>
              </div>
              <div className="min-w-0">
                <p className="text-xl font-black leading-none text-primary">{summary?.[s.key] ?? 0}</p>
                <p className="mt-0.5 truncate text-xs font-medium text-primary">{s.label}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
      <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <StatsCard key={s.key} label={s.label} icon={s.icon} iconBg={s.iconBg} iconText={s.iconText}
            count={summary?.[s.key] ?? 0}
            active={statusFilter === s.filter}
            onClick={() => setStatusFilter(s.filter)}
          />
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="bg-white/85 backdrop-blur-sm border border-outline-variant/30 rounded-xl p-2.5 sm:rounded-2xl sm:p-4 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-base">search</span>
            <input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="ค้นหาหมายเลขติดตาม, ผู้ส่ง หรือ ผู้รับ..."
              className="w-full bg-surface-container-lowest border border-outline-variant/50 rounded-xl pl-9 pr-4 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-display transition-all"
            />
          </div>
          <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
            <div className="flex h-8 items-center gap-1 rounded-lg border border-outline-variant/35 bg-white px-2 text-[11px] font-medium text-on-surface-variant">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-mono font-bold text-primary">{refreshCountdown}s</span>
            </div>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="grid h-8 w-8 place-items-center rounded-lg border border-outline-variant/35 bg-white text-on-surface-variant shadow-sm transition-all hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
              title="รีเฟรช"
            >
              <span className={`material-symbols-outlined text-lg ${loading ? 'animate-spin' : ''}`}>refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="bg-white/90 backdrop-blur-sm border border-outline-variant/35 rounded-xl sm:rounded-2xl overflow-hidden shadow-sm">
        {/* Table header bar */}
        <div className="px-3 py-2.5 sm:px-5 sm:py-3 border-b border-outline-variant/10 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-primary text-base sm:text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>table_rows</span>
            <h2 className="font-display font-bold text-primary text-sm">รายการพัสดุ</h2>
            <span className="px-2 py-0.5 bg-primary/8 text-primary text-[11px] font-bold rounded-full">
              {filteredParcels.length}
            </span>
            {loading && <span className="material-symbols-outlined text-sm text-primary animate-spin">progress_activity</span>}
          </div>
          {hasFilters && (
            <button onClick={clearFilters}
              className="flex items-center gap-1 text-[11px] sm:text-xs text-error/80 hover:text-error font-semibold transition-colors">
              <span className="material-symbols-outlined text-sm">filter_alt_off</span>
              ล้างตัวกรอง
            </button>
          )}
        </div>

        <div>
          {loading && !filteredParcels.length ? (
            <TableSkeleton />
          ) : !filteredParcels.length ? (
            <div className="py-16 text-center flex flex-col items-center gap-3">
              <div className="w-16 h-16 bg-surface-container rounded-2xl flex items-center justify-center">
                <span className="material-symbols-outlined text-3xl text-on-surface-variant/30">search_off</span>
              </div>
              <div>
                <p className="font-bold text-primary">ไม่พบข้อมูลพัสดุ</p>
                <p className="text-sm text-on-surface-variant mt-0.5">ลองปรับตัวกรองหรือคำค้นหา</p>
              </div>
              {hasFilters && (
                <button onClick={clearFilters} className="text-sm text-primary font-bold hover:underline">ล้างตัวกรอง</button>
              )}
            </div>
          ) : (
            <>
            <div className="space-y-2 p-2 sm:hidden">
              {paginatedParcels.map((parcel) => (
                <MobileParcelCard
                  key={parcel.TrackingID}
                  parcel={parcel}
                  onOpen={() => { setSelectedParcel(parcel); setIsTimelineOpen(true); }}
                  canConfirm={canConfirmParcel && parcel['สถานะ'] !== 'ส่งสำเร็จ'}
                  onConfirm={() => openConfirmFlow(parcel.TrackingID)}
                />
              ))}
            </div>
            <div className="hidden overflow-x-auto sm:block">
            <table className="w-full text-left border-collapse min-w-[580px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest font-black text-on-surface-variant/50 border-b border-outline-variant/10">
                  <th className="px-5 py-2.5 bg-surface-container-lowest/60">หมายเลขติดตาม</th>
                  <th className="px-4 py-2.5 bg-surface-container-lowest/60">ผู้ส่ง → ผู้รับ</th>
                  <th className="px-4 py-2.5 bg-surface-container-lowest/60">วันที่</th>
                  <th className="px-4 py-2.5 bg-surface-container-lowest/60">สถานะ</th>
                  <th className="px-4 py-2.5 bg-surface-container-lowest/60 text-right">การดำเนินการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/8">
                {paginatedParcels.map((parcel) => (
                  <tr
                    key={parcel.TrackingID}
                    onClick={() => { setSelectedParcel(parcel); setIsTimelineOpen(true); }}
                    className="hover:bg-primary/[0.025] transition-colors group cursor-pointer"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <code className="font-mono text-primary bg-primary/6 px-2 py-1 rounded-lg text-xs font-bold tracking-wide">
                          {parcel.TrackingID}
                        </code>
                        <button
                          onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(parcel.TrackingID); toast.success(`คัดลอก ${parcel.TrackingID}`); }}
                          className="opacity-0 group-hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 opacity-100 transition-opacity text-on-surface-variant/40 hover:text-primary p-0.5 rounded"
                        >
                          <span className="material-symbols-outlined text-sm">content_copy</span>
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-sm">
                        <span className="font-semibold text-primary truncate max-w-[100px]">{parcel['ผู้ส่ง']}</span>
                        <span className="material-symbols-outlined text-outline-variant text-sm shrink-0">arrow_forward</span>
                        <span className="text-on-surface-variant font-medium truncate max-w-[100px]">{parcel['ผู้รับ']}</span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[10px] text-on-surface-variant/40">{parcel['สาขาผู้ส่ง']}</span>
                        <span className="text-[10px] text-on-surface-variant/30">→</span>
                        <span className="text-[10px] text-on-surface-variant/40">{parcel['สาขาผู้รับ']}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">
                      <span className="text-sm font-medium">{formatThaiDateTime(parcel['วันที่สร้าง'])}</span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={parcel['สถานะ']} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canConfirmParcel && parcel['สถานะ'] !== 'ส่งสำเร็จ' ? (
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            openConfirmFlow(parcel.TrackingID);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-black text-white shadow-sm transition-all hover:opacity-90 active:scale-95"
                        >
                          <span className="material-symbols-outlined text-sm">add_a_photo</span>
                          บันทึกหลักฐาน
                        </button>
                      ) : (
                        <button className="inline-flex items-center gap-1 text-xs font-bold text-primary/60 group-hover:text-primary transition-colors">
                          ดูรายละเอียด
                          <span className="material-symbols-outlined text-sm group-hover:translate-x-0.5 transition-transform">chevron_right</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            </>
          )}
        </div>

        {/* Footer + Pagination */}
        {filteredParcels.length > 0 && (
          <div className="px-5 py-3 border-t border-outline-variant/10 bg-surface-container-lowest/40 flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Info + page size */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-on-surface-variant/60">
                แสดง <span className="font-bold text-primary">{startIndex}–{endIndex}</span> จาก <span className="font-bold text-primary">{filteredParcels.length}</span> รายการ
                {filteredParcels.length !== parcels.length && <span className="text-on-surface-variant/40"> (กรองจาก {parcels.length})</span>}
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-on-surface-variant/50">แสดง</span>
                <select
                  value={pageSize}
                  onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                  className="text-xs font-bold text-primary bg-white border border-outline-variant/40 rounded-lg px-2 py-1 outline-none cursor-pointer"
                >
                  {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                <span className="text-xs text-on-surface-variant/50">ต่อหน้า</span>
              </div>
            </div>

            {/* Page controls */}
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg text-on-surface-variant/50 hover:text-primary hover:bg-surface-container disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <span className="material-symbols-outlined text-base">first_page</span>
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg text-on-surface-variant/50 hover:text-primary hover:bg-surface-container disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <span className="material-symbols-outlined text-base">chevron_left</span>
                </button>

                {/* Page numbers */}
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                  .reduce<(number | '...')[]>((acc, p, i, arr) => {
                    if (i > 0 && (p as number) - (arr[i - 1] as number) > 1) acc.push('...');
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, i) =>
                    p === '...' ? (
                      <span key={`ellipsis-${i}`} className="px-1 text-xs text-on-surface-variant/30">…</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setCurrentPage(p as number)}
                        className={`min-w-[30px] h-[30px] rounded-lg text-xs font-bold transition-all ${
                          currentPage === p
                            ? 'bg-primary text-white shadow-sm'
                            : 'text-on-surface-variant/60 hover:text-primary hover:bg-surface-container'
                        }`}
                      >
                        {p}
                      </button>
                    )
                  )}

                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-lg text-on-surface-variant/50 hover:text-primary hover:bg-surface-container disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <span className="material-symbols-outlined text-base">chevron_right</span>
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-lg text-on-surface-variant/50 hover:text-primary hover:bg-surface-container disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <span className="material-symbols-outlined text-base">last_page</span>
                </button>
              </div>
            )}
            
            {/* Backend Load More Button */}
            {hasMore && (
              <button
                onClick={loadMoreParcels}
                disabled={loading}
                className="text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {loading ? (
                  <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                ) : (
                  <span className="material-symbols-outlined text-sm">download</span>
                )}
                โหลดข้อมูลเพิ่ม
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Timeline Dialog ── */}
      <ParcelTimelineModal
        isOpen={isTimelineOpen}
        setIsOpen={setIsTimelineOpen}
        selectedParcel={selectedParcel}
        selectedTimelineEvents={selectedTimelineEvents}
        hasKnownBranches={selectedParcelHasKnownBranches}
        onConfirmParcel={openConfirmFlow}
        onDeleteParcel={handleDelete}
      />

      {/* ── Confirm / Photo Capture Dialog ── */}
      <Dialog
        open={isConfirmFlowOpen}
        onOpenChange={(open) => {
          setIsConfirmFlowOpen(open);
          if (!open) {
            setConfirmTrackingId(null);
            setIsConfirmPreparingCamera(false);
          }
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="max-h-[92vh] w-[calc(100vw-1rem)] max-w-2xl overflow-hidden rounded-3xl border-none bg-transparent p-0 shadow-none"
        >
          <div className="modal-scroll relative max-h-[92vh] overflow-y-auto p-3 pr-4 sm:p-5 sm:pr-6">
            {!isConfirmPreparingCamera && (
              <button
                type="button"
                onClick={() => setIsConfirmFlowOpen(false)}
                className="absolute right-6 top-6 z-20 grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 active:scale-95"
                aria-label="ปิดหน้าบันทึกการจัดส่ง"
              >
                <span className="material-symbols-outlined text-2xl">close</span>
              </button>
            )}
            <ConfirmReceipt
              key={confirmTrackingId ?? 'confirm-flow'}
              initialTrackingId={confirmTrackingId}
              onInitialTrackingIdConsumed={() => undefined}
              autoCheckInitial
              autoOpenCamera
              embedded
              onPreparingCameraChange={setIsConfirmPreparingCamera}
              onComplete={() => {
                setIsConfirmFlowOpen(false);
                setConfirmTrackingId(null);
                setIsConfirmPreparingCamera(false);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* ── User Quick Create Dialog ── */}
      <Dialog open={isCreateFlowOpen} onOpenChange={setIsCreateFlowOpen}>
        <DialogContent
          showCloseButton={false}
          className="max-h-[92vh] w-[calc(100vw-1rem)] max-w-3xl overflow-hidden rounded-3xl border-none bg-background p-0 shadow-2xl"
        >
          <DialogHeader className="shrink-0 border-b border-outline-variant/20 bg-primary px-5 py-4 text-white">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/10 text-secondary-container">
                  <span className="material-symbols-outlined text-xl">add_box</span>
                </span>
                <DialogTitle className="font-display text-lg font-black text-white">สร้างพัสดุ</DialogTitle>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateFlowOpen(false)}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/10 text-white transition-colors hover:bg-white/20"
                aria-label="ปิดหน้าสร้างพัสดุ"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>
          </DialogHeader>
          <div className="max-h-[calc(92vh-76px)] overflow-y-auto p-3 sm:p-5">
            <CreateParcel embedded />
          </div>
        </DialogContent>
      </Dialog>

      {/* ── User Quick Track Dialog ── */}
      <Dialog open={isTrackFlowOpen} onOpenChange={setIsTrackFlowOpen}>
        <DialogContent
          showCloseButton={false}
          className="max-h-[92vh] w-[calc(100vw-1rem)] max-w-3xl overflow-hidden rounded-3xl border-none bg-background p-0 shadow-2xl"
        >
          <DialogHeader className="shrink-0 border-b border-outline-variant/20 bg-primary px-5 py-4 text-white">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/10 text-secondary-container">
                  <span className="material-symbols-outlined text-xl">qr_code_scanner</span>
                </span>
                <DialogTitle className="font-display text-lg font-black text-white">ค้นหาพัสดุ</DialogTitle>
              </div>
              <button
                type="button"
                onClick={() => setIsTrackFlowOpen(false)}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/10 text-white transition-colors hover:bg-white/20"
                aria-label="ปิดหน้าค้นหาพัสดุ"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>
          </DialogHeader>
          <div className="max-h-[calc(92vh-76px)] overflow-y-auto p-3 sm:p-5">
            <Track embedded />
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm Dialog ── */}
      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-primary">ยืนยันการลบรายการ</AlertDialogTitle>
            <AlertDialogDescription>
              คุณแน่ใจหรือไม่ว่าต้องการลบรายการ{' '}
              <code className="font-mono font-bold text-primary bg-primary/8 px-1.5 py-0.5 rounded">
                {selectedParcel?.TrackingID}
              </code>
              {' '}การดำเนินการนี้ไม่สามารถย้อนกลับได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeDelete}
              className="rounded-xl bg-error text-white hover:bg-error/90"
            >
              ลบรายการ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
