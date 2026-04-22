/**
 * Track Page
 * ติดตามสถานะพัสดุ
 * Design: Premium Logistics
 */

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import StatusBadge from '@/components/StatusBadge';
import Timeline from '@/components/Timeline';
import ImagePopup from '@/components/ImagePopup';
import { toast } from 'sonner';
import { Search, Calendar, Copy, ClipboardPaste, History, ArrowRight, Package, MapPin, User, Clock } from 'lucide-react';
import type { Parcel } from '@/types/parcel';
import { getParcel, searchParcels } from '@/lib/parcelService';
import { parseParcelTimeline } from '@/lib/timeline';
import TrackingMap from '@/components/TrackingMap';

export default function Track() {
  const [trackingId, setTrackingId] = useState('');
  const [parcel, setParcel] = useState<Parcel | null>(null);
  const [searchResults, setSearchResults] = useState<Parcel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('recent_searches');
    if (saved) setRecentSearches(JSON.parse(saved));
  }, []);

  const addToRecent = (id: string) => {
    const newRecent = [id, ...recentSearches.filter(i => i !== id)].slice(0, 5);
    setRecentSearches(newRecent);
    localStorage.setItem('recent_searches', JSON.stringify(newRecent));
  };

  const handleSearch = async (e?: React.FormEvent, searchId?: string) => {
    if (e) e.preventDefault();
    const idToSearch = searchId || trackingId;

    if (!idToSearch.trim()) {
      toast.error('กรุณากรอก Tracking ID');
      return;
    }

    setIsLoading(true);
    try {
      const response = await getParcel(idToSearch.trim());
      if (response.success && response.parcel) {
        setParcel(response.parcel);
        setSearchResults([]);
        addToRecent(response.parcel.TrackingID);
        toast.success('พบข้อมูลพัสดุ');
      } else {
        const results = await searchParcels(idToSearch.trim());
        if (results && results.length > 0) {
          if (results.length === 1) {
            setParcel(results[0]);
            setSearchResults([]);
            addToRecent(results[0].TrackingID);
          } else {
            setSearchResults(results);
            setParcel(null);
          }
          toast.success(`พบข้อมูล ${results.length} รายการ`);
        } else {
          setParcel(null);
          setSearchResults([]);
          toast.error('ไม่พบข้อมูลพัสดุ');
        }
      }
    } catch (err) {
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyTrackingID = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    toast.success(`คัดลอก ${id} แล้ว`);
  };

  const handlePasteTrackingID = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setTrackingId(text.trim().toUpperCase());
        toast.success('วาง Tracking ID เรียบร้อย');
      }
    } catch (e) {
      toast.error('ไม่สามารถวางข้อมูลได้');
    }
  };

  const timelineEvents = useMemo(() => 
    parcel ? parseParcelTimeline(parcel) : [],
  [parcel]);

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20 animate-in fade-in duration-700">
      <div className="space-y-1">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">ติดตามพัสดุ</h1>
        <p className="text-slate-500">ค้นหาและติดตามสถานะการจัดส่งแบบ Real-time</p>
      </div>

      {/* Search Section */}
      <Card className="border-none shadow-xl rounded-3xl overflow-hidden bg-white">
        <CardContent className="p-8 space-y-6">
          <form onSubmit={(e) => handleSearch(e)} className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-primary transition-colors" />
              <Input
                placeholder="กรอก Tracking ID หรือชื่อผู้รับ..."
                value={trackingId}
                onChange={(e) => setTrackingId(e.target.value.toUpperCase())}
                className="h-14 pl-12 pr-14 text-lg rounded-2xl border-slate-200 focus:ring-primary/20 transition-all"
              />
              <button
                type="button"
                onClick={handlePasteTrackingID}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-xl text-slate-400 hover:text-primary hover:bg-slate-50 transition-all"
              >
                <ClipboardPaste className="w-5 h-5" />
              </button>
            </div>
            <Button type="submit" disabled={isLoading} className="h-14 px-8 rounded-2xl text-lg font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all">
              {isLoading ? 'กำลังค้นหา...' : 'ติดตามพัสดุ'}
            </Button>
          </form>

          {recentSearches.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <div className="flex items-center text-xs font-bold text-slate-400 uppercase tracking-widest mr-2">
                <History className="w-3 h-3 mr-1" /> ล่าสุด:
              </div>
              {recentSearches.map((id) => (
                <button
                  key={id}
                  onClick={() => { setTrackingId(id); handleSearch(undefined, id); }}
                  className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 rounded-lg text-xs font-mono font-bold text-slate-600 transition-colors border border-slate-100"
                >
                  {id}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Search Results */}
      {searchResults.length > 0 && !parcel && (
        <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest px-2">ผลการค้นหา ({searchResults.length})</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {searchResults.map((p) => (
              <Card 
                key={p.TrackingID} 
                className="border-none shadow-md hover:shadow-xl transition-all cursor-pointer bg-white rounded-2xl group"
                onClick={() => { setParcel(p); setSearchResults([]); addToRecent(p.TrackingID); }}
              >
                <CardContent className="p-6 space-y-4">
                  <div className="flex justify-between items-start">
                    <code className="text-sm font-mono font-bold text-primary bg-primary/5 px-2 py-1 rounded-lg">{p.TrackingID}</code>
                    <StatusBadge status={p['สถานะ']} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      {p['ผู้ส่ง']} <ArrowRight className="w-3 h-3 text-slate-300" /> {p['ผู้รับ']}
                    </p>
                    <p className="text-xs text-slate-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {p['วันที่สร้าง']}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Detailed Result */}
      {parcel && (
        <div className="space-y-8 animate-in zoom-in-95 duration-500">
          <Card className="border-none shadow-xl rounded-3xl overflow-hidden bg-white">
            <CardHeader className="bg-slate-900 text-white p-8">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <h2 className="text-3xl font-extrabold tracking-tighter font-mono">{parcel.TrackingID}</h2>
                    <button onClick={(e) => handleCopyTrackingID(e, parcel.TrackingID)} className="p-2 bg-white/10 rounded-xl hover:bg-white/20 transition-colors">
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-slate-400 font-medium">ประเภท: {parcel['ประเภทเอกสาร']}</p>
                </div>
                <div className="bg-white/10 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10">
                  <StatusBadge status={parcel['สถานะ']} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="space-y-8">
                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-primary">
                        <div className="p-2 bg-primary/10 rounded-lg"><User className="w-4 h-4" /></div>
                        <span className="text-xs font-bold uppercase tracking-widest text-slate-400">ผู้ส่ง</span>
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 text-lg">{parcel['ผู้ส่ง']}</p>
                        <p className="text-sm text-slate-500 flex items-center gap-1 mt-1">
                          <MapPin className="w-3 h-3" /> {parcel['สาขาผู้ส่ง']}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-emerald-600">
                        <div className="p-2 bg-emerald-50 rounded-lg"><MapPin className="w-4 h-4" /></div>
                        <span className="text-xs font-bold uppercase tracking-widest text-slate-400">ผู้รับ</span>
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 text-lg">{parcel['ผู้รับ']}</p>
                        <p className="text-sm text-slate-500 flex items-center gap-1 mt-1">
                          <MapPin className="w-3 h-3" /> {parcel['สาขาผู้รับ']}
                        </p>
                      </div>
                    </div>
                  </div>

                  {(parcel['รายละเอียด'] || parcel['หมายเหตุ']) && (
                    <div className="p-6 bg-slate-50 rounded-2xl space-y-4 border border-slate-100">
                      {parcel['รายละเอียด'] && (
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">รายละเอียดพัสดุ</p>
                          <p className="text-slate-700 font-medium">{parcel['รายละเอียด']}</p>
                        </div>
                      )}
                      {parcel['หมายเหตุ'] && parcel['หมายเหตุ'].replace(/\[.*?\]/g, '').trim() && (
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">หมายเหตุ</p>
                          <p className="text-slate-600 italic">"{parcel['หมายเหตุ'].replace(/\[.*?\]/g, '').trim()}"</p>
                        </div>
                      )}
                    </div>
                  )}

                  {parcel['รูปยืนยัน'] && (
                    <div className="space-y-3">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">รูปภาพหลักฐาน</p>
                      <ImagePopup url={parcel['รูปยืนยัน']} className="w-full rounded-2xl shadow-sm hover:shadow-md transition-shadow" />
                    </div>
                  )}
                </div>

                <div className="space-y-6">
                  <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
                    <h3 className="text-sm font-bold text-slate-900 mb-6 flex items-center gap-2">
                      <History className="w-4 h-4 text-primary" /> เส้นทางการเดินทาง
                    </h3>
                    <Timeline events={timelineEvents || []} />
                  </div>
                  <TrackingMap events={timelineEvents || []} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty State */}
      {!parcel && searchResults.length === 0 && trackingId && !isLoading && (
        <Card className="border-none shadow-lg bg-amber-50 rounded-2xl p-8 text-center animate-in fade-in zoom-in-95">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8 text-amber-600" />
          </div>
          <h3 className="text-lg font-bold text-amber-900">ไม่พบข้อมูลพัสดุ</h3>
          <p className="text-amber-700 mt-1">กรุณาตรวจสอบ Tracking ID อีกครั้ง หรือค้นหาด้วยชื่อผู้รับ</p>
        </Card>
      )}
    </div>
  );
}
