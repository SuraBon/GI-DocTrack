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
import { formatThaiDate } from '@/lib/dateUtils';

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
    <div className="max-w-5xl mx-auto space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-2">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-primary mb-1">ติดตามพัสดุ</h1>
          <p className="text-xs sm:text-sm text-on-surface-variant">ค้นหาและติดตามสถานะการจัดส่งแบบ Real-time ของ LogiTrack</p>
        </div>
      </div>

      {/* Search Bar Section */}
      <div className="bg-white border border-outline-variant rounded-3xl p-6 md:p-8 shadow-sm">
        <form onSubmit={(e) => handleSearch(e)} className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1 group">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40 text-2xl transition-colors group-focus-within:text-primary">search</span>
            <input
              placeholder="กรอก Tracking ID หรือชื่อผู้รับ..."
              value={trackingId}
              onChange={(e) => setTrackingId(e.target.value.toUpperCase())}
              className="w-full h-12 sm:h-16 pl-12 pr-14 text-lg sm:text-xl font-display bg-surface-container-lowest border-2 border-outline-variant focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-2xl outline-none transition-all placeholder:text-outline-variant/60"
            />
            <button
              type="button"
              onClick={handlePasteTrackingID}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-xl text-on-surface-variant/40 hover:text-primary hover:bg-surface-container transition-all"
            >
              <span className="material-symbols-outlined text-2xl">content_paste</span>
            </button>
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="h-12 sm:h-16 px-6 sm:px-10 bg-primary text-white rounded-2xl font-display font-bold text-base sm:text-lg shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
          >
            {isLoading ? (
              <span className="material-symbols-outlined animate-spin text-2xl">progress_activity</span>
            ) : (
              'ติดตามพัสดุ'
            )}
          </button>
        </form>

        {recentSearches.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 mt-6 animate-in fade-in duration-500">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
              <span className="material-symbols-outlined text-base">history</span>
              ล่าสุด:
            </div>
            {recentSearches.map((id) => (
              <button
                key={id}
                onClick={() => { setTrackingId(id); handleSearch(undefined, id); }}
                className="px-4 py-2 bg-surface-container-low hover:bg-surface-container text-xs font-mono font-bold text-primary rounded-xl border border-outline-variant/30 transition-all active:scale-95"
              >
                {id}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Search Results List */}
      {searchResults.length > 0 && !parcel && (
        <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center gap-2 px-2">
            <span className="material-symbols-outlined text-primary text-xl">list_alt</span>
            <h3 className="text-sm font-bold text-primary uppercase tracking-widest">ผลการค้นหา ({searchResults.length})</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {searchResults.map((p) => (
              <div
                key={p.TrackingID}
                className="bg-white border border-outline-variant rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-primary/30 transition-all cursor-pointer group"
                onClick={() => { setParcel(p); setSearchResults([]); addToRecent(p.TrackingID); }}
              >
                <div className="flex justify-between items-start mb-4">
                  <code className="text-sm font-mono font-black text-primary bg-primary/5 px-3 py-1 rounded-lg">{p.TrackingID}</code>
                  <StatusBadge status={p['สถานะ']} />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-display font-bold text-primary">{p['ผู้ส่ง']}</span>
                    <span className="material-symbols-outlined text-outline-variant text-base">arrow_forward</span>
                    <span className="font-display font-bold text-primary">{p['ผู้รับ']}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-on-surface-variant/60 font-medium">
                    <span className="material-symbols-outlined text-sm">event</span>
                    {formatThaiDate(p['วันที่สร้าง'])}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detailed Parcel View */}
      {parcel && (
        <div className="space-y-8 animate-in zoom-in-95 duration-500">
          <div className="bg-white border border-outline-variant rounded-3xl overflow-hidden shadow-xl">
            {/* Parcel Card Header */}
            <div className="bg-primary p-5 sm:p-8 text-white">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 sm:gap-6">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    <h2 className="text-xl sm:text-3xl font-black tracking-wider font-mono">{parcel.TrackingID}</h2>
                    <button
                      onClick={(e) => handleCopyTrackingID(e, parcel.TrackingID)}
                      className="p-2 bg-white/10 rounded-xl hover:bg-white/20 transition-colors"
                      title="คัดลอก Tracking ID"
                    >
                      <span className="material-symbols-outlined text-xl">content_copy</span>
                    </button>
                  </div>
                  <div className="flex items-center gap-2 opacity-70">
                    <span className="material-symbols-outlined text-sm">category</span>
                    <span className="text-sm font-display font-medium">ประเภท: {parcel['ประเภทเอกสาร']}</span>
                  </div>
                </div>
                <div className="bg-white/10 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10 shadow-inner">
                  <StatusBadge status={parcel['สถานะ']} />
                </div>
              </div>
            </div>

            {/* Parcel Card Body */}
            <div className="p-4 sm:p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
                {/* Information Column */}
                <div className="space-y-8">
                  <div className="bg-surface-container-low/30 rounded-2xl p-6 border border-outline-variant/30 space-y-6">
                    <h4 className="text-[10px] font-black text-on-surface-variant/40 uppercase tracking-[0.2em] flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm">info</span>
                      Parcel Details
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-8 text-sm">
                      <div className="space-y-1">
                        <p className="text-on-surface-variant/60 text-[10px] font-bold uppercase tracking-wider">ชื่อผู้ส่ง</p>
                        <p className="font-display font-black text-primary text-base leading-tight">{parcel['ผู้ส่ง']}</p>
                        <div className="flex items-center gap-1 mt-1 opacity-60">
                          <span className="material-symbols-outlined text-[12px]">apartment</span>
                          <span className="text-[10px] font-bold">{parcel['สาขาผู้ส่ง']}</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-on-surface-variant/60 text-[10px] font-bold uppercase tracking-wider">ชื่อผู้รับ</p>
                        <p className="font-display font-black text-primary text-base leading-tight">{parcel['ผู้รับ']}</p>
                        <div className="flex items-center gap-1 mt-1 opacity-60">
                          <span className="material-symbols-outlined text-[12px] text-secondary">home_pin</span>
                          <span className="text-[10px] font-bold">{parcel['สาขาผู้รับ']}</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-on-surface-variant/60 text-[10px] font-bold uppercase tracking-wider">ประเภท</p>
                        <p className="font-display font-black text-primary text-base leading-tight">{parcel['ประเภทเอกสาร']}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-on-surface-variant/60 text-[10px] font-bold uppercase tracking-wider">สถานะปัจจุบัน</p>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                          <p className="font-display font-black text-primary text-base leading-tight">{parcel['สถานะ']}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Notes Section */}
                  {(parcel['รายละเอียด'] || parcel['หมายเหตุ']) && (
                    <div className="p-6 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl space-y-5 shadow-sm">
                      {parcel['รายละเอียด'] && (
                        <div>
                          <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-2 flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-sm">description</span>
                            รายละเอียดพัสดุ
                          </p>
                          <p className="text-primary font-display font-bold leading-relaxed">{parcel['รายละเอียด']}</p>
                        </div>
                      )}
                      {parcel['หมายเหตุ'] && parcel['หมายเหตุ'].replace(/\[.*?\]/g, '').trim() && (
                        <div>
                          <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-2 flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-sm">notes</span>
                            หมายเหตุ
                          </p>
                          <p className="text-on-surface-variant font-display italic leading-relaxed">
                            "{parcel['หมายเหตุ'].replace(/\[.*?\]/g, '').trim()}"
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Delivery Image Proof */}
                  {parcel['รูปยืนยัน'] && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 px-1">
                        <span className="material-symbols-outlined text-primary text-sm">photo_library</span>
                        <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">รูปภาพหลักฐานการจัดส่ง</p>
                      </div>
                      <ImagePopup url={parcel['รูปยืนยัน']} className="w-full rounded-2xl border border-outline-variant shadow-md hover:shadow-xl transition-all duration-300" />
                    </div>
                  )}
                </div>

                {/* Tracking & Map Column */}
                <div className="space-y-6">
                  <div className="bg-white rounded-3xl border border-outline-variant/30 shadow-md p-8 overflow-hidden">
                    <h3 className="font-display font-black text-primary text-xl mb-8 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center">
                        <span className="material-symbols-outlined">route</span>
                      </div>
                      ไทม์ไลน์การจัดส่ง
                    </h3>
                    <Timeline events={timelineEvents || []} />
                  </div>
                  <div className="rounded-3xl overflow-hidden border border-outline-variant/30 shadow-sm h-[300px]">
                    <TrackingMap events={timelineEvents || []} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!parcel && searchResults.length === 0 && trackingId && !isLoading && (
        <div className="bg-surface-container-low/50 border border-outline-variant border-dashed rounded-3xl p-12 text-center animate-in fade-in zoom-in-95 duration-500">
          <div className="w-20 h-20 bg-surface-container rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant/40">search_off</span>
          </div>
          <h3 className="font-display text-xl font-bold text-primary">ไม่พบข้อมูลพัสดุ</h3>
          <p className="text-on-surface-variant mt-2 max-w-sm mx-auto">ไม่พบหมายเลขพัสดุที่คุณระบุ กรุณาตรวจสอบความถูกต้องของ Tracking ID อีกครั้ง</p>
          <button
            onClick={() => setTrackingId('')}
            className="mt-6 text-primary font-display font-bold hover:underline"
          >
            ล้างข้อมูลและค้นหาใหม่
          </button>
        </div>
      )}
    </div>
  );
}
