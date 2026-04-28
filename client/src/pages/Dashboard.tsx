/**
 * Dashboard Page
 * ภาพรวมการจัดส่ง
 * Design: Premium Logistics
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParcelStore } from '@/hooks/useParcelStore';
import StatusBadge from '@/components/StatusBadge';
import type { Parcel } from '@/types/parcel';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import Timeline from '@/components/Timeline';
import TrackingMap from '@/components/TrackingMap';
import { parseParcelTimeline } from '@/lib/timeline';
import { Skeleton } from '@/components/ui/skeleton';
import { formatThaiDate } from '@/lib/dateUtils';

interface DashboardProps {
  isConfigured: boolean;
}

function parseCreatedAt(value: string | undefined): Date | null {
  if (!value) return null;
  const normalized = value.replace(' ', 'T');
  const dt = new Date(normalized);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function toCsvValue(value: unknown) {
  const s = value == null ? '' : String(value);
  const escaped = s.replaceAll('"', '""');
  return `"${escaped}"`;
}

// Stats Card Component for consistent look
const StatsCard = ({ title, count, icon, borderColor, iconColor, bgIconColor }: any) => (
  <div className="bg-white p-6 rounded-3xl border border-outline-variant/30 shadow-sm hover:shadow-xl transition-all duration-300 group">
    <div className="flex justify-between items-start mb-6">
      <div className={`w-12 h-12 ${bgIconColor} rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 duration-300`}>
        <span className={`material-symbols-outlined text-2xl ${iconColor}`}>{icon}</span>
      </div>
      <div className="flex flex-col items-end">
        <span className="text-[10px] font-black text-on-surface-variant/30 uppercase tracking-[0.2em]">Real-time</span>
        <div className={`h-1 w-8 rounded-full mt-1 ${borderColor.replace('border-', 'bg-')}`}></div>
      </div>
    </div>
    <p className="font-display text-[10px] text-on-surface-variant font-black uppercase tracking-[0.15em] mb-1 opacity-60">{title}</p>
    <div className="flex items-baseline gap-1">
      <h3 className="font-display text-3xl font-black text-primary">{count}</h3>
      <span className="text-[10px] font-bold text-on-surface-variant/40">รายการ</span>
    </div>
  </div>
);

const TableSkeleton = () => (
  <div className="space-y-4 p-6">
    {[...Array(5)].map((_, i) => (
      <div key={i} className="flex items-center justify-between py-4 border-b border-outline-variant/10 last:border-0">
        <div className="flex-1 flex gap-4">
          <Skeleton className="h-12 w-12 rounded-lg" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
        <Skeleton className="h-8 w-24 rounded-full" />
      </div>
    ))}
  </div>
);

export default function Dashboard({ isConfigured }: DashboardProps) {
  const { parcels, summary, loading, loadParcels, loadSummary } = useParcelStore();
  const [filteredParcels, setFilteredParcels] = useState<Parcel[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ทั้งหมด');
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');

  const [selectedParcel, setSelectedParcel] = useState<Parcel | null>(null);
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [refreshCountdown, setRefreshCountdown] = useState(60);

  const handleRowClick = (parcel: Parcel) => {
    setSelectedParcel(parcel);
    setIsTimelineOpen(true);
  };

  const handleCopyTrackingID = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    toast.success(`คัดลอก ${id} แล้ว`);
  };

  const fetchData = useCallback(async () => {
    await Promise.all([loadParcels(), loadSummary()]);
    setRefreshCountdown(60);
  }, [loadParcels, loadSummary]);

  useEffect(() => {
    if (isConfigured) {
      fetchData();

      const timer = setInterval(() => {
        setRefreshCountdown((prev) => {
          if (prev <= 1) {
            fetchData();
            return 180;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [isConfigured, fetchData]);

  useEffect(() => {
    let filtered = parcels;

    if (statusFilter !== 'ทั้งหมด') {
      filtered = filtered.filter((p) => p['สถานะ'] === statusFilter);
    }

    if (searchTerm) {
      const query = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p['TrackingID'].toLowerCase().includes(query) ||
          p['ผู้ส่ง'].toLowerCase().includes(query) ||
          p['ผู้รับ'].toLowerCase().includes(query)
      );
    }

    const start = exportStartDate ? new Date(`${exportStartDate}T00:00:00`) : null;
    const end = exportEndDate ? new Date(`${exportEndDate}T23:59:59.999`) : null;
    
    if (start || end) {
      filtered = filtered.filter((p) => {
        const createdAt = parseCreatedAt(p['วันที่สร้าง']);
        if (!createdAt) return false;
        if (start && createdAt < start) return false;
        if (end && createdAt > end) return false;
        return true;
      });
    }

    setFilteredParcels(filtered);
  }, [parcels, statusFilter, searchTerm, exportStartDate, exportEndDate]);

  const handleRefresh = async () => {
    await fetchData();
    toast.success('อัปเดตข้อมูลเรียบร้อย');
  };

  const handleExport = () => {
    const rows = filteredParcels;
    if (rows.length === 0) {
      toast.error('ไม่มีข้อมูลให้ Export');
      return;
    }

    const headers: Array<keyof Parcel> = [
      'TrackingID', 'วันที่สร้าง', 'ผู้ส่ง', 'สาขาผู้ส่ง', 'ผู้รับ', 'สาขาผู้รับ',
      'ประเภทเอกสาร', 'รายละเอียด', 'หมายเหตุ', 'สถานะ', 'วันที่รับ', 'รูปยืนยัน',
    ];

    const csvLines: string[] = [headers.map((h) => toCsvValue(h)).join(',')];
    for (const p of rows) {
      csvLines.push(headers.map((h) => toCsvValue(p[h])).join(','));
    }

    const csv = `\uFEFF${csvLines.join('\n')}\n`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const filename = `export_${new Date().toISOString().split('T')[0]}.csv`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Export สำเร็จ (${rows.length} รายการ)`);
  };

  const selectedTimelineEvents = useMemo(() => 
    selectedParcel ? parseParcelTimeline(selectedParcel) : [],
  [selectedParcel]);

  if (!isConfigured) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-full max-w-md p-8 bg-white rounded-3xl shadow-xl border border-dashed border-error/30 text-center">
          <span className="material-symbols-outlined text-5xl text-error mb-4">warning</span>
          <h2 className="text-2xl font-bold text-primary mb-2">ยังไม่ได้ตั้งค่าระบบ</h2>
          <p className="text-on-surface-variant">กรุณาตั้งค่า GAS URL และ API KEY ในไฟล์ .env</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header Section */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="font-display text-3xl font-bold text-primary mb-1">Dashboard</h1>
          <p className="text-sm text-on-surface-variant">
            ภาพรวมการจัดส่งเอกสารและพัสดุแบบเรียลไทม์
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="ml-2 inline-flex items-center gap-1 text-primary-fixed-dim bg-primary/5 px-2 py-0.5 rounded-full text-[10px] hover:bg-primary/10 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title="คลิกเพื่อรีเฟรชข้อมูล"
            >
              <span className={`material-symbols-outlined text-[12px] ${loading ? 'animate-spin' : ''}`}>refresh</span>
              Auto-refresh in {Math.floor(refreshCountdown / 60)}:{(refreshCountdown % 60).toString().padStart(2, '0')}
            </button>
          </p>
        </div>
              </div>

      {/* Stats Overview - Bento Style */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-gutter">
        <StatsCard 
          title="พัสดุทั้งหมด" 
          count={summary?.total || 0} 
          icon="inventory_2" 
          borderColor="border-primary"
          iconColor="text-primary"
          bgIconColor="bg-surface-container"
        />
        <StatsCard 
          title="รอจัดส่ง" 
          count={summary?.pending || 0} 
          icon="pending_actions" 
          borderColor="border-secondary-container"
          iconColor="text-secondary"
          bgIconColor="bg-secondary-fixed/30"
        />
        <StatsCard 
          title="กำลังจัดส่ง" 
          count={summary?.transit || 0} 
          icon="local_shipping" 
          borderColor="border-blue-500"
          iconColor="text-blue-600"
          bgIconColor="bg-blue-50"
        />
        <StatsCard 
          title="ส่งถึงแล้ว" 
          count={summary?.delivered || 0} 
          icon="task_alt" 
          borderColor="border-tertiary-fixed-dim"
          iconColor="text-green-700"
          bgIconColor="bg-green-50"
        />
      </div>

      {/* Filter Section */}
      <div className="bg-white border border-outline-variant rounded-xl p-4 flex flex-wrap items-center gap-4 shadow-sm">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">search</span>
            <input 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-outline-variant rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none font-display" 
              placeholder="ค้นหา Tracking ID, ผู้ส่ง หรือ ผู้รับ..." 
              type="text"
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none bg-white border border-outline-variant rounded-lg pl-4 pr-10 py-2 text-sm font-display focus:ring-1 focus:ring-primary outline-none cursor-pointer"
            >
              <option value="ทั้งหมด">สถานะทั้งหมด</option>
              <option value="รอจัดส่ง">รอจัดส่ง</option>
              <option value="กำลังจัดส่ง">กำลังจัดส่ง</option>
              <option value="ส่งถึงแล้ว">ส่งถึงแล้ว</option>
            </select>
            <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm pointer-events-none">expand_more</span>
          </div>
          
          <div className="flex items-center bg-white border border-outline-variant rounded-lg overflow-hidden">
            <div className="flex items-center px-3 border-r border-outline-variant/30">
              <span className="text-[10px] font-bold text-on-surface-variant mr-2">START</span>
              <input 
                type="date" 
                className="text-xs bg-transparent border-none focus:ring-0 p-0 h-8" 
                value={exportStartDate}
                onChange={(e) => setExportStartDate(e.target.value)}
              />
            </div>
            <div className="flex items-center px-3">
              <span className="text-[10px] font-bold text-on-surface-variant mr-2">END</span>
              <input 
                type="date" 
                className="text-xs bg-transparent border-none focus:ring-0 p-0 h-8" 
                value={exportEndDate}
                onChange={(e) => setExportEndDate(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Data Table Section */}
      <div className="bg-white border border-outline-variant rounded-xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-outline-variant/10 flex justify-between items-center bg-surface-container-low/30">
          <h2 className="font-display text-base font-bold text-primary">รายการพัสดุล่าสุด</h2>
          <div className="flex gap-1">
            <button className="p-1.5 hover:bg-white rounded border border-transparent hover:border-outline-variant/30">
              <span className="material-symbols-outlined text-[20px]">more_horiz</span>
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          {loading && filteredParcels.length === 0 ? (
            <TableSkeleton />
          ) : filteredParcels.length === 0 ? (
            <div className="py-20 text-center flex flex-col items-center justify-center text-on-surface-variant">
              <div className="w-20 h-20 bg-surface-container-low rounded-full flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-4xl text-on-surface-variant/40">search_off</span>
              </div>
              <p className="font-bold text-lg text-primary">ไม่พบข้อมูลพัสดุ</p>
              <p className="text-sm">ลองปรับตัวกรองหรือคำค้นหาของคุณ</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-primary text-white font-display text-[10px] uppercase tracking-widest">
                  <th className="px-6 py-4 font-black rounded-tl-xl">Tracking ID</th>
                  <th className="px-6 py-4 font-black">Sender & Receiver</th>
                  <th className="px-6 py-4 font-black">Date & Time</th>
                  <th className="px-6 py-4 font-black">Status</th>
                  <th className="px-6 py-4 font-black text-right rounded-tr-xl">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10 text-sm">
                {filteredParcels.map((parcel) => (
                  <tr 
                    key={parcel.TrackingID}
                    className="hover:bg-surface-container-low/30 transition-colors group cursor-pointer"
                    onClick={() => handleRowClick(parcel)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-primary bg-surface-container px-2 py-1 rounded text-xs font-medium">{parcel.TrackingID}</span>
                        <button 
                          onClick={(e) => handleCopyTrackingID(e, parcel.TrackingID)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-on-surface-variant hover:text-primary"
                        >
                          <span className="material-symbols-outlined text-sm">content_copy</span>
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-on-surface-variant/60">FROM:</span>
                          <span className="font-semibold text-primary">{parcel['ผู้ส่ง']}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-on-surface-variant/60">TO:</span>
                          <span className="text-on-surface-variant font-medium">{parcel['ผู้รับ']}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-on-surface-variant font-medium">
                      <div className="flex flex-col">
                        <span>{formatThaiDate(parcel['วันที่สร้าง'])}</span>
                        <span className="text-[10px] opacity-60 font-mono">{parcel['วันที่สร้าง'].split(' ')[1]}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={parcel['สถานะ']} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-primary font-bold hover:underline text-xs">View Details</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        
        <div className="px-6 py-4 bg-surface-container-low/30 border-t border-outline-variant/10 flex items-center justify-between">
          <span className="text-xs text-on-surface-variant font-medium">Showing {filteredParcels.length} entries</span>
          <div className="flex gap-2">
            <button className="px-3 py-1 border border-outline-variant rounded bg-white text-xs font-semibold hover:bg-surface-container">Previous</button>
            <button className="px-3 py-1 border border-primary bg-primary text-white rounded text-xs font-semibold">1</button>
            <button className="px-3 py-1 border border-outline-variant rounded bg-white text-xs font-semibold hover:bg-surface-container">Next</button>
          </div>
        </div>
      </div>

      {/* Timeline Dialog */}
      <Dialog open={isTimelineOpen} onOpenChange={setIsTimelineOpen}>
        <DialogContent className="w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-hidden p-0 rounded-2xl border-none shadow-2xl">
          <div className="flex flex-col h-full max-h-[90vh]">
            <DialogHeader className="p-6 bg-primary text-white shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-2xl font-bold font-display">Tracking Journey</DialogTitle>
                <DialogDescription className="text-primary-fixed-dim mt-1">
                  Tracking ID: <span className="font-mono text-white font-bold">{selectedParcel?.TrackingID}</span>
                </DialogDescription>
              </div>
              <button
                onClick={() => setIsTimelineOpen(false)}
                className="p-3 bg-white/10 rounded-xl hover:bg-white/20 transition-colors"
              >
                <span className="material-symbols-outlined text-3xl text-secondary-container">close</span>
              </button>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-8 bg-background">
            {selectedParcel && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                  <h3 className="font-display font-bold text-lg mb-6 flex items-center gap-2 text-primary">
                    <span className="material-symbols-outlined">history</span>
                    ไทม์ไลน์การจัดส่ง
                  </h3>
                  <Timeline events={selectedTimelineEvents} />
                </div>
                <div className="space-y-6">
                  <div className="rounded-xl overflow-hidden border border-outline-variant shadow-sm h-[300px]">
                    <TrackingMap events={selectedTimelineEvents} />
                  </div>
                  <div className="bg-white rounded-2xl p-6 border border-outline-variant shadow-sm space-y-6">
                    <h4 className="text-[10px] font-black text-on-surface-variant/40 uppercase tracking-[0.2em] flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm">info</span>
                      Parcel Details
                    </h4>
                    <div className="grid grid-cols-2 gap-y-6 gap-x-4 text-sm">
                      <div className="space-y-1">
                        <p className="text-on-surface-variant/60 text-[10px] font-bold uppercase tracking-wider">ประเภท</p>
                        <p className="font-display font-black text-primary text-base">{selectedParcel['ประเภทเอกสาร']}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-on-surface-variant/60 text-[10px] font-bold uppercase tracking-wider">สถานะปัจจุบัน</p>
                        <div className="flex items-center gap-1.5">
                           <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                           <p className="font-display font-black text-primary text-base">{selectedParcel['สถานะ']}</p>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-on-surface-variant/60 text-[10px] font-bold uppercase tracking-wider">ต้นทาง</p>
                        <div className="flex items-center gap-1.5">
                           <span className="material-symbols-outlined text-sm text-on-surface-variant/40">location_on</span>
                           <p className="font-display font-bold text-primary">{selectedParcel['สาขาผู้ส่ง']}</p>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-on-surface-variant/60 text-[10px] font-bold uppercase tracking-wider">ปลายทาง</p>
                        <div className="flex items-center gap-1.5">
                           <span className="material-symbols-outlined text-sm text-secondary">home_pin</span>
                           <p className="font-display font-bold text-primary">{selectedParcel['สาขาผู้รับ']}</p>
                        </div>
                      </div>
                    </div>
                    {selectedParcel['รายละเอียด'] && (
                      <div className="pt-4 border-t border-outline-variant/10">
                        <p className="text-on-surface-variant/60 text-[10px] font-bold uppercase tracking-wider mb-2">รายละเอียดเพิ่มเติม</p>
                        <div className="p-3 bg-surface-container-low/50 rounded-xl border border-outline-variant/20">
                           <p className="text-sm text-primary font-medium leading-relaxed">{selectedParcel['รายละเอียด']}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
