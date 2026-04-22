/**
 * Dashboard Page
 * ภาพรวมการจัดส่ง
 * Design: Premium Logistics
 */

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useParcelStore } from '@/hooks/useParcelStore';
import StatusBadge from '@/components/StatusBadge';
import { RefreshCw, Copy, Package, Truck, CheckCircle, Clock, Search, Filter, Download } from 'lucide-react';
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
const StatsCard = ({ title, count, icon: Icon, colorClass, gradientClass }: any) => (
  <Card className="overflow-hidden border-none shadow-md">
    <div className={`h-1.5 ${colorClass}`} />
    <CardContent className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
          <h3 className="text-3xl font-bold tracking-tight">{count}</h3>
        </div>
        <div className={`p-3 rounded-2xl ${gradientClass} bg-opacity-10`}>
          <Icon className={`w-6 h-6 ${colorClass.replace('bg-', 'text-')}`} />
        </div>
      </div>
    </CardContent>
  </Card>
);

const TableSkeleton = () => (
  <div className="space-y-4">
    {[...Array(5)].map((_, i) => (
      <div key={i} className="flex items-center justify-between py-4 border-b border-slate-50 last:border-0">
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
  const [refreshCountdown, setRefreshCountdown] = useState(180);

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
    setRefreshCountdown(180);
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

  const selectedTimelineEvents = selectedParcel ? parseParcelTimeline(selectedParcel) : [];

  if (!isConfigured) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md border-dashed">
          <CardHeader className="text-center">
            <CardTitle className="text-amber-600">⚠️ ยังไม่ได้ตั้งค่าระบบ</CardTitle>
            <CardDescription>กรุณาตั้งค่า GAS URL และ API KEY ในไฟล์ .env</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Top Section */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Dashboard</h1>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Clock className="w-4 h-4" />
            <span>รีเฟรชอัตโนมัติใน {Math.floor(refreshCountdown / 60)}:{(refreshCountdown % 60).toString().padStart(2, '0')} นาที</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
            <div className="flex items-center px-3 border-r border-slate-100">
              <span className="text-xs font-bold text-slate-400 mr-2">START</span>
              <input 
                type="date" 
                className="text-sm bg-transparent border-none focus:ring-0 p-0" 
                value={exportStartDate}
                onChange={(e) => setExportStartDate(e.target.value)}
              />
            </div>
            <div className="flex items-center px-3">
              <span className="text-xs font-bold text-slate-400 mr-2">END</span>
              <input 
                type="date" 
                className="text-sm bg-transparent border-none focus:ring-0 p-0" 
                value={exportEndDate}
                onChange={(e) => setExportEndDate(e.target.value)}
              />
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button onClick={handleExport} variant="outline" size="sm" className="h-10 px-4 rounded-xl shadow-sm hover:bg-slate-50">
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
            <Button onClick={handleRefresh} disabled={loading} size="sm" className="h-10 px-4 rounded-xl shadow-md transition-all active:scale-95">
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              รีเฟรช
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Cards Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard 
          title="พัสดุทั้งหมด" 
          count={summary?.total || 0} 
          icon={Package} 
          colorClass="bg-slate-600" 
          gradientClass="bg-slate-600"
        />
        <StatsCard 
          title="รอจัดส่ง" 
          count={summary?.pending || 0} 
          icon={Clock} 
          colorClass="bg-amber-500" 
          gradientClass="bg-amber-500"
        />
        <StatsCard 
          title="กำลังจัดส่ง" 
          count={summary?.transit || 0} 
          icon={Truck} 
          colorClass="bg-sky-500" 
          gradientClass="bg-sky-500"
        />
        <StatsCard 
          title="ส่งถึงแล้ว" 
          count={summary?.delivered || 0} 
          icon={CheckCircle} 
          colorClass="bg-emerald-500" 
          gradientClass="bg-emerald-500"
        />
      </div>

      {/* Filter & Table Section */}
      <Card className="border-none shadow-xl bg-white rounded-3xl overflow-hidden">
        <CardHeader className="border-b border-slate-50 p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl font-bold">รายการพัสดุล่าสุด</CardTitle>
              <CardDescription>แสดงรายการทั้งหมด {filteredParcels.length} รายการ</CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                <Input
                  placeholder="ค้นหา..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-10 w-full sm:w-64 rounded-xl border-slate-200 focus:ring-primary/20"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-40 h-10 rounded-xl border-slate-200">
                  <div className="flex items-center gap-2">
                    <Filter className="w-3 h-3" />
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="ทั้งหมด">สถานะทั้งหมด</SelectItem>
                  <SelectItem value="รอจัดส่ง">รอจัดส่ง</SelectItem>
                  <SelectItem value="กำลังจัดส่ง">กำลังจัดส่ง</SelectItem>
                  <SelectItem value="ส่งถึงแล้ว">ส่งถึงแล้ว</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading && filteredParcels.length === 0 ? (
            <div className="p-6"><TableSkeleton /></div>
          ) : filteredParcels.length === 0 ? (
            <div className="py-20 text-center flex flex-col items-center justify-center text-slate-400">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8" />
              </div>
              <p className="font-medium text-lg">ไม่พบข้อมูลพัสดุ</p>
              <p className="text-sm">ลองปรับตัวกรองหรือคำค้นหาของคุณ</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    <th className="text-left py-4 px-6 font-bold text-slate-600">TRACKING ID</th>
                    <th className="text-left py-4 px-6 font-bold text-slate-600">SENDER / RECEIVER</th>
                    <th className="text-left py-4 px-6 font-bold text-slate-600">DATE</th>
                    <th className="text-center py-4 px-6 font-bold text-slate-600">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredParcels.map((parcel) => (
                    <tr
                      key={parcel.TrackingID}
                      className="hover:bg-slate-50/80 transition-all cursor-pointer group"
                      onClick={() => handleRowClick(parcel)}
                    >
                      <td className="py-5 px-6">
                        <button
                          onClick={(e) => handleCopyTrackingID(e, parcel.TrackingID)}
                          className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg hover:bg-primary/10 transition-colors"
                        >
                          <span className="font-mono font-bold text-primary text-xs tracking-wider">{parcel.TrackingID}</span>
                          <Copy className="w-3 h-3 text-slate-400 group-hover:text-primary transition-colors" />
                        </button>
                      </td>
                      <td className="py-5 px-6">
                        <div className="flex items-center gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 rounded">FROM</span>
                              <span className="font-bold text-slate-900">{parcel['ผู้ส่ง']}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 rounded">TO</span>
                              <span className="font-medium">{parcel['ผู้รับ']}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-5 px-6 text-slate-500 font-medium">
                        {parcel['วันที่สร้าง'].split(' ')[0]}
                        <span className="block text-[10px] text-slate-400 font-mono">{parcel['วันที่สร้าง'].split(' ')[1]}</span>
                      </td>
                      <td className="py-5 px-6">
                        <div className="flex justify-center">
                          <StatusBadge status={parcel['สถานะ']} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Timeline Dialog */}
      <Dialog open={isTimelineOpen} onOpenChange={setIsTimelineOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0 rounded-3xl border-none shadow-2xl">
          <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-2xl font-extrabold">Tracking Journey</DialogTitle>
                <DialogDescription className="text-slate-400 mt-1">
                  Tracking ID: <span className="font-mono text-white font-bold">{selectedParcel?.TrackingID}</span>
                </DialogDescription>
              </div>
              <div className="p-3 bg-white/10 rounded-2xl">
                <Truck className="w-6 h-6 text-sky-400" />
              </div>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
            {selectedParcel && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Timeline events={selectedTimelineEvents} />
                <div className="space-y-6">
                  <TrackingMap events={selectedTimelineEvents} />
                  <Card className="bg-white rounded-2xl p-4 border-slate-100 shadow-sm">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Parcel Info</h4>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500">ประเภท:</span>
                        <span className="font-bold">{selectedParcel['ประเภทเอกสาร']}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">สาขาต้นทาง:</span>
                        <span className="font-bold">{selectedParcel['สาขาผู้ส่ง']}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">สาขาปลายทาง:</span>
                        <span className="font-bold">{selectedParcel['สาขาผู้รับ']}</span>
                      </div>
                    </div>
                  </Card>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
