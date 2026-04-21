/**
 * Dashboard Page
 * ภาพรวมการจัดส่ง
 * Design: Minimalist Logistics
 */

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useParcelStore } from '@/hooks/useParcelStore';
import StatusBadge from '@/components/StatusBadge';
import { RefreshCw, Settings } from 'lucide-react';
import type { Parcel } from '@/types/parcel';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import Timeline from '@/components/Timeline';
import type { TimelineEvent } from '@/types/timeline';
import ImagePopup from '@/components/ImagePopup';

const parseParcelTimeline = (parcel: Parcel): TimelineEvent[] => {
  const events: TimelineEvent[] = [];
  let currentId = 1;

  // 1. Created Event
  events.push({
    id: String(currentId++),
    status: parcel['สถานะ'] === 'รอจัดส่ง' ? 'current' : 'completed',
    title: 'รับพัสดุเข้าระบบ',
    description: `ผู้ส่ง: ${parcel['ผู้ส่ง']} -> ผู้รับ: ${parcel['ผู้รับ']}`,
    timestamp: parcel['วันที่สร้าง'],
    location: parcel['สาขาผู้ส่ง'],
  });

  // 2. Parse Forwarding from Note
  const note = parcel['หมายเหตุ'] || '';
  const forwardRegex = /\[ส่งต่อโดย:\s*(.*?)\s*จากสาขา:\s*(.*?)\s*ไปสาขา:\s*(.*?)\s*เมื่อ:\s*(.*?)\]/g;
  let match;
  const forwardEvents: TimelineEvent[] = [];
  while ((match = forwardRegex.exec(note)) !== null) {
    forwardEvents.push({
      id: String(currentId++),
      status: 'completed',
      title: 'ส่งต่อพัสดุ',
      description: `ส่งต่อโดย: ${match[1]} ไปยังสาขา: ${match[3]}`,
      timestamp: match[4],
      location: match[2],
    });
  }

  if (parcel['สถานะ'] !== 'ส่งถึงแล้ว' && parcel['รูปยืนยัน'] && forwardEvents.length > 0) {
    forwardEvents[forwardEvents.length - 1].imageUrl = parcel['รูปยืนยัน'];
  }

  events.push(...forwardEvents);

  // 3. Status logic
  if (parcel['สถานะ'] === 'ส่งถึงแล้ว') {
    const proxyRegex = /\[รับแทนโดย:\s*(.*?)\s*เมื่อ:\s*(.*?)\]/;
    const proxyMatch = proxyRegex.exec(note);
    
    let desc = 'ส่งถึงผู้รับเรียบร้อย';
    let time = parcel['วันที่รับ'] || '';
    if (proxyMatch) {
      desc = `รับแทนโดย: ${proxyMatch[1]}`;
      time = proxyMatch[2];
    }

    events.push({
      id: String(currentId++),
      status: 'completed',
      title: 'พัสดุส่งถึงแล้ว',
      description: desc,
      timestamp: time,
      location: parcel['สาขาผู้รับ'], // Could be the forwarded branch, but this serves as final destination
      imageUrl: parcel['รูปยืนยัน'] || undefined,
    });
  } else if (parcel['สถานะ'] === 'กำลังจัดส่ง') {
    events.push({
      id: String(currentId++),
      status: 'current',
      title: 'กำลังจัดส่ง',
      description: 'พัสดุอยู่ระหว่างการเดินทาง',
      timestamp: '',
      location: '',
    });
  }

  return events;
};

interface DashboardProps {
  onConfigClick: () => void;
  isConfigured: boolean;
}

export default function Dashboard({ onConfigClick, isConfigured }: DashboardProps) {
  const { parcels, summary, loading, loadParcels, loadSummary } = useParcelStore();
  const [filteredParcels, setFilteredParcels] = useState<Parcel[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ทั้งหมด');
  
  const [selectedParcel, setSelectedParcel] = useState<Parcel | null>(null);
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);

  const handleRowClick = (parcel: Parcel) => {
    setSelectedParcel(parcel);
    setIsTimelineOpen(true);
  };

  useEffect(() => {
    if (isConfigured) {
      loadParcels();
      
      const interval = setInterval(() => {
        loadParcels();
      }, 180000); // 3 minutes

      return () => clearInterval(interval);
    }
  }, [isConfigured, loadParcels]);

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

    setFilteredParcels(filtered);
  }, [parcels, statusFilter, searchTerm]);

  const handleRefresh = async () => {
    await loadParcels();
    await loadSummary();
  };

  if (!isConfigured) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>ยังไม่ได้ตั้งค่า</CardTitle>
            <CardDescription>กรุณาตั้งค่า Google Apps Script URL ก่อนใช้งาน</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={onConfigClick} className="w-full gap-2">
              <Settings className="w-4 h-4" />
              ไปที่การตั้งค่า
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">ภาพรวมการจัดส่ง</h1>
          <p className="text-sm text-muted-foreground mt-1">ติดตามสถานะเอกสาร/พัสดุแบบ real-time</p>
        </div>
        <Button onClick={handleRefresh} variant="outline" size="sm" className="gap-2">
          <RefreshCw className="w-4 h-4" />
          รีเฟรช
        </Button>
      </div>

      {/* Stats Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">ทั้งหมด</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{summary.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">รอจัดส่ง</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-amber-600">{summary.pending}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">กำลังจัดส่ง</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">{summary.transit}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">ส่งถึงแล้ว</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{summary.delivered}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <Input
          placeholder="ค้นหา Tracking ID, ผู้ส่ง, ผู้รับ..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full md:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ทั้งหมด">ทั้งหมด</SelectItem>
            <SelectItem value="รอจัดส่ง">รอจัดส่ง</SelectItem>
            <SelectItem value="กำลังจัดส่ง">กำลังจัดส่ง</SelectItem>
            <SelectItem value="ส่งถึงแล้ว">ส่งถึงแล้ว</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>รายการพัสดุ</CardTitle>
          <CardDescription>{filteredParcels.length} รายการ</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">⏳ กำลังโหลด...</div>
          ) : filteredParcels.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">ไม่มีข้อมูล</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-semibold text-foreground">Tracking ID</th>
                    <th className="text-left py-3 px-4 font-semibold text-foreground">วันที่สร้าง</th>
                    <th className="text-left py-3 px-4 font-semibold text-foreground">ผู้ส่ง</th>
                    <th className="text-left py-3 px-4 font-semibold text-foreground">ผู้รับ</th>
                    <th className="text-left py-3 px-4 font-semibold text-foreground">ประเภท</th>
                    <th className="text-left py-3 px-4 font-semibold text-foreground">สถานะ</th>
                    <th className="text-left py-3 px-4 font-semibold text-foreground">หลักฐาน</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredParcels.map((parcel) => (
                    <tr 
                      key={parcel.TrackingID} 
                      className="border-b border-border hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => handleRowClick(parcel)}
                    >
                      <td className="py-3 px-4">
                        <code className="text-xs font-mono text-primary bg-primary/10 px-2 py-1 rounded">
                          {parcel.TrackingID}
                        </code>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">{parcel['วันที่สร้าง']}</td>
                      <td className="py-3 px-4">
                        <div className="font-medium">{parcel['ผู้ส่ง']}</div>
                        <div className="text-xs text-muted-foreground">{parcel['สาขาผู้ส่ง']}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium">{parcel['ผู้รับ']}</div>
                        <div className="text-xs text-muted-foreground">{parcel['สาขาผู้รับ']}</div>
                      </td>
                      <td className="py-3 px-4 text-sm">{parcel['ประเภทเอกสาร']}</td>
                      <td className="py-3 px-4">
                        <StatusBadge status={parcel['สถานะ']} />
                      </td>
                      <td className="py-3 px-4">
                        {parcel['รูปยืนยัน'] ? (
                          <ImagePopup url={parcel['รูปยืนยัน']} />
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
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
        <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>ประวัติการเดินทางของพัสดุ</DialogTitle>
            <DialogDescription>
              Tracking ID: {selectedParcel?.TrackingID}
            </DialogDescription>
          </DialogHeader>
          {selectedParcel && (
            <div className="mt-4">
              <Timeline events={parseParcelTimeline(selectedParcel)} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
