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
import { BRANCHES_WITH_COORDS } from '@/lib/parcelService';
import { parseParcelTimeline } from '@/lib/timeline';
import { Skeleton } from '@/components/ui/skeleton';
import { formatThaiDateTime } from '@/lib/dateUtils';
import ParcelTimelineModal from '@/components/ParcelTimelineModal';
import { normalizeRole } from '@/lib/roles';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface DashboardProps { isConfigured: boolean; onConfirmParcel: (trackingId: string) => void; }

const STATS = [
  { key: 'total',     label: 'พัสดุทั้งหมด',  icon: 'inventory_2',    grad: 'from-[#091426] to-[#1e3a5f]',  text: 'text-white' },
  { key: 'pending',   label: 'รอจัดส่ง',       icon: 'pending_actions', grad: 'from-amber-500 to-orange-400',  text: 'text-white' },
  { key: 'transit',   label: 'กำลังจัดส่ง',    icon: 'local_shipping',  grad: 'from-blue-600 to-blue-400',     text: 'text-white' },
  { key: 'delivered', label: 'ส่งถึงแล้ว',     icon: 'task_alt',        grad: 'from-emerald-600 to-teal-400',  text: 'text-white' },
] as const;

const StatsCard = ({ label, icon, grad, text, count }: { label: string; icon: string; grad: string; text: string; count: number }) => (
  <div className="relative w-full overflow-hidden rounded-2xl p-4 sm:p-6 shadow-sm border bg-white hover:shadow-md transition-all duration-300 group cursor-default">
    {/* Gradient accent top */}
    <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${grad} rounded-t-2xl`} />
    <div className="flex items-start justify-between mt-1">
      <div>
        <p className="text-[10px] sm:text-xs font-bold text-on-surface-variant/60 uppercase tracking-[0.15em] mb-1.5 sm:mb-2">{label}</p>
        <div className="flex items-baseline gap-1.5">
          <span className="text-3xl sm:text-4xl font-black text-primary font-display">{count}</span>
          <span className="text-[10px] sm:text-xs text-on-surface-variant/40 font-bold">รายการ</span>
        </div>
      </div>
      <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform duration-300`}>
        <span className={`material-symbols-outlined text-lg sm:text-xl ${text}`} style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
      </div>
    </div>
  </div>
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

export default function Dashboard({ isConfigured, onConfirmParcel }: DashboardProps) {
  const { user } = useAuth();
  const { parcels, summary, loading, loadParcels, hasMore, loadMoreParcels, removeParcelLocally } = useParcelStore();
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [statusFilter, setStatusFilter] = useState('ทั้งหมด');
  const [selectedParcel, setSelectedParcel] = useState<Parcel | null>(null);
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [refreshCountdown, setRefreshCountdown] = useState(120);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const isFetchingRef = useRef(false);
  const role = normalizeRole(user?.role);
  const isUserDashboard = role === 'USER';
  const dashboardTitle = isUserDashboard ? 'พัสดุของฉัน' : 'ภาพรวมระบบ';
  const dashboardSubtitle = isUserDashboard
    ? 'ติดตามสถานะพัสดุและเอกสารที่คุณสร้างไว้ทั้งหมด'
    : 'ภาพรวมการจัดส่งเอกสารและพัสดุแบบเรียลไทม์';
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
    return selectedTimelineEvents.some(event => typeof event.latitude === 'number' && typeof event.longitude === 'number')
      || BRANCHES_WITH_COORDS.includes(selectedParcel['สาขาผู้ส่ง'])
      || BRANCHES_WITH_COORDS.includes(selectedParcel['สาขาผู้รับ']);
  }, [selectedParcel, selectedTimelineEvents]);

  const clearFilters = () => { setSearchTerm(''); setStatusFilter('ทั้งหมด'); setCurrentPage(1); };
  const hasFilters = !!(searchTerm || statusFilter !== 'ทั้งหมด');

  const handleDelete = async () => {
    if (!selectedParcel) return;
    setIsDeleteConfirmOpen(true);
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
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* ── Header ── */}
      <div className="relative overflow-hidden rounded-3xl border border-white/60 bg-white/70 p-5 sm:p-6 shadow-sm backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-primary-fixed/55 to-transparent" />
        <div className="relative flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-black text-primary">{dashboardTitle}</h1>
          <p className="text-xs sm:text-sm text-on-surface-variant mt-1">{dashboardSubtitle}</p>
          {isUserDashboard && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-primary/10 bg-primary/5 px-3 py-1 text-[11px] font-bold text-primary">
              <span className="material-symbols-outlined text-sm">person_pin</span>
              แสดงเฉพาะรายการที่คุณสร้าง
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Countdown pill */}
          <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-xs font-medium text-on-surface-variant border border-outline-variant/40 bg-white/70 backdrop-blur-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-mono font-bold text-primary text-[11px] sm:text-xs">{refreshCountdown}s</span>
          </div>
          <button onClick={handleRefresh}
            disabled={loading}
            className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl border border-outline-variant/40 bg-white/70 backdrop-blur-sm hover:bg-white transition-all text-on-surface-variant hover:text-primary shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            title="รีเฟรช">
            <span className={`material-symbols-outlined text-base sm:text-lg ${loading ? 'animate-spin' : ''}`}>refresh</span>
          </button>
        </div>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {stats.map(s => (
          <StatsCard key={s.key} label={s.label} icon={s.icon} grad={s.grad} text={s.text}
            count={summary?.[s.key] ?? 0} />
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="bg-white/80 backdrop-blur-sm border border-outline-variant/40 rounded-2xl p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-base">search</span>
            <input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="ค้นหาหมายเลขติดตาม, ผู้ส่ง หรือ ผู้รับ..."
              className="w-full bg-surface-container-lowest border border-outline-variant/60 rounded-xl pl-9 pr-4 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-display transition-all"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Status */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="appearance-none w-full sm:w-auto bg-surface-container-lowest border border-outline-variant/60 rounded-xl pl-3 pr-8 py-2 text-sm font-display focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none cursor-pointer"
              >
                <option value="ทั้งหมด">สถานะทั้งหมด</option>
                <option value="รอจัดส่ง">รอจัดส่ง</option>
                <option value="กำลังจัดส่ง">กำลังจัดส่ง</option>
                <option value="ส่งถึงแล้ว">ส่งถึงแล้ว</option>
              </select>
              <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-sm pointer-events-none">expand_more</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="bg-white/90 backdrop-blur-sm border border-outline-variant/40 rounded-2xl overflow-hidden shadow-sm">
        {/* Table header bar */}
        <div className="px-5 py-3.5 border-b border-outline-variant/10 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-primary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>table_rows</span>
            <h2 className="font-display font-bold text-primary text-sm">รายการพัสดุ</h2>
            <span className="px-2 py-0.5 bg-primary/8 text-primary text-[11px] font-bold rounded-full">
              {filteredParcels.length}
            </span>
            {loading && <span className="material-symbols-outlined text-sm text-primary animate-spin">progress_activity</span>}
          </div>
          {hasFilters && (
            <button onClick={clearFilters}
              className="flex items-center gap-1 text-xs text-error/80 hover:text-error font-semibold transition-colors">
              <span className="material-symbols-outlined text-sm">filter_alt_off</span>
              ล้างตัวกรอง
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
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
            <table className="w-full text-left border-collapse min-w-[580px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest font-black text-on-surface-variant/50 border-b border-outline-variant/10">
                  <th className="px-5 py-3 bg-surface-container-lowest/60">หมายเลขติดตาม</th>
                  <th className="px-4 py-3 bg-surface-container-lowest/60">ผู้ส่ง → ผู้รับ</th>
                  <th className="px-4 py-3 bg-surface-container-lowest/60">วันที่</th>
                  <th className="px-4 py-3 bg-surface-container-lowest/60">สถานะ</th>
                  <th className="px-4 py-3 bg-surface-container-lowest/60 text-right">การดำเนินการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/8">
                {paginatedParcels.map((parcel) => (
                  <tr
                    key={parcel.TrackingID}
                    onClick={() => { setSelectedParcel(parcel); setIsTimelineOpen(true); }}
                    className="hover:bg-primary/[0.025] transition-colors group cursor-pointer"
                  >
                    <td className="px-5 py-3.5">
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
                    <td className="px-4 py-3.5">
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
                    <td className="px-4 py-3.5 text-on-surface-variant">
                      <span className="text-sm font-medium">{formatThaiDateTime(parcel['วันที่สร้าง'])}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={parcel['สถานะ']} />
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button className="inline-flex items-center gap-1 text-xs font-bold text-primary/60 group-hover:text-primary transition-colors">
                        ดูรายละเอียด
                        <span className="material-symbols-outlined text-sm group-hover:translate-x-0.5 transition-transform">chevron_right</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
        onConfirmParcel={onConfirmParcel}
        onDeleteParcel={handleDelete}
      />

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
