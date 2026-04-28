import React, { useState, useRef, useEffect } from "react";
import { useParcelStore } from '@/hooks/useParcelStore';
import type { Parcel } from '@/types/parcel';

interface LayoutProps {
  children: React.ReactNode;
  currentPage: string;
  setCurrentPage: (page: string) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, currentPage, setCurrentPage }) => {
  const { parcels } = useParcelStore();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [seenIds, setSeenIds] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('seen_parcel_ids') ?? '[]')); }
    catch { return new Set(); }
  });
  const notifRef = useRef<HTMLDivElement>(null);

  // พัสดุที่อัพเดทล่าสุด — เรียงตามวันที่รับ/สร้าง ล่าสุดก่อน
  const recentParcels = [...parcels]
    .sort((a, b) => {
      const da = a['วันที่รับ'] || a['วันที่สร้าง'];
      const db = b['วันที่รับ'] || b['วันที่สร้าง'];
      return db.localeCompare(da);
    })
    .slice(0, 8);

  const unreadCount = recentParcels.filter(p => !seenIds.has(p.TrackingID)).length;

  const markAllSeen = () => {
    const next = new Set([...seenIds, ...recentParcels.map(p => p.TrackingID)]);
    setSeenIds(next);
    localStorage.setItem('seen_parcel_ids', JSON.stringify([...next]));
  };

  const handleBellClick = () => {
    setIsNotifOpen(v => !v);
    if (!isNotifOpen) markAllSeen();
  };

  // ปิด dropdown เมื่อคลิกนอก
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const getStatusColor = (status: Parcel['สถานะ']) => {
    if (status === 'ส่งถึงแล้ว') return 'bg-emerald-500';
    if (status === 'กำลังจัดส่ง') return 'bg-blue-500';
    return 'bg-amber-500';
  };

  const navItems = [
    { id: "dashboard", label: "ภาพรวมระบบ", icon: "dashboard", badge: null },
    { id: "create",    label: "สร้างรายการใหม่", icon: "add_box", badge: null },
    { id: "confirm",   label: "ยืนยันรับพัสดุ", icon: "photo_camera", badge: null },
    { id: "track",     label: "ติดตามสถานะ", icon: "location_searching", badge: null },
  ];

  const handleNav = (id: string) => {
    setCurrentPage(id);
    if (window.innerWidth < 1024) setIsSidebarOpen(false);
  };

  return (
    <div className="min-h-screen font-body text-on-background">
      {/* ── Sidebar ── */}
      <aside
        className={`
          h-screen fixed left-0 top-0 z-50
          flex flex-col
          transition-all duration-300 ease-in-out
          ${isSidebarOpen ? 'w-64 px-4 translate-x-0' : 'w-16 px-2 -translate-x-full lg:translate-x-0'}
        `}
        style={{
          background: 'linear-gradient(180deg, #0d1f3c 0%, #091426 60%, #060e1a 100%)',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '4px 0 24px rgba(0,0,0,0.25)',
        }}
      >
        {/* Logo */}
        <div className={`flex items-center ${isSidebarOpen ? 'gap-3' : 'justify-center'} px-2 pt-2 pb-6 mb-2`}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shrink-0"
            style={{ background: 'linear-gradient(135deg, #fea619 0%, #ff8c00 100%)' }}>
            <span className="material-symbols-outlined text-white text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              local_shipping
            </span>
          </div>
          {isSidebarOpen && (
            <div className="flex flex-col min-w-0">
              <span className="text-white font-black text-lg font-display leading-none">DocTrack</span>
              <span className="text-white/40 text-[10px] font-semibold uppercase tracking-wider mt-0.5">ระบบจัดการพัสดุ</span>
            </div>
          )}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="hidden lg:flex ml-auto p-1.5 text-white/30 hover:text-white hover:bg-white/10 rounded-lg transition-all shrink-0"
          >
            <span className="material-symbols-outlined text-lg">
              {isSidebarOpen ? 'chevron_left' : 'chevron_right'}
            </span>
          </button>
        </div>

        {/* Divider */}
        <div className="h-px bg-white/5 mx-2 mb-4" />

        {/* Nav */}
        <nav className="flex-1 space-y-1">
          {navItems.map((item) => {
            const active = currentPage === item.id;
            return (
              <a
                key={item.id}
                onClick={() => handleNav(item.id)}
                title={isSidebarOpen ? undefined : item.label}
                className={`
                  flex items-center
                  ${isSidebarOpen ? 'gap-3 px-3 rounded-xl' : 'justify-center rounded-xl mx-auto w-10'}
                  py-2.5 font-display text-sm font-semibold cursor-pointer
                  transition-all duration-200 relative group
                  ${active
                    ? 'text-white'
                    : 'text-white/45 hover:text-white/80 hover:bg-white/5'
                  }
                `}
                style={active ? {
                  background: 'linear-gradient(135deg, rgba(254,166,25,0.18) 0%, rgba(254,166,25,0.08) 100%)',
                  boxShadow: 'inset 0 0 0 1px rgba(254,166,25,0.2)',
                } : {}}
              >
                {/* Active indicator bar — only when expanded */}
                {active && isSidebarOpen && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-r-full bg-secondary-container" />
                )}
                <span
                  className={`material-symbols-outlined text-xl shrink-0 transition-colors ${active ? 'text-secondary-container' : ''}`}
                  style={{ fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}
                >
                  {item.icon}
                </span>
                {isSidebarOpen && <span className="truncate">{item.label}</span>}
              </a>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="mt-auto pt-4 border-t border-white/5 space-y-1">
          <a
            className={`flex items-center ${isSidebarOpen ? 'gap-3 px-3' : 'justify-center'} py-2.5 text-white/30 hover:text-white/60 font-display text-sm font-semibold cursor-pointer hover:bg-white/5 rounded-xl transition-all`}
            title={isSidebarOpen ? undefined : "ติดต่อช่วยเหลือ"}
          >
            <span className="material-symbols-outlined text-xl">contact_support</span>
            {isSidebarOpen && "ติดต่อช่วยเหลือ"}
          </a>
        </div>
      </aside>

      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* ── Main content ── */}
      <div className={`flex flex-col min-h-screen transition-all duration-300 ${isSidebarOpen ? 'lg:ml-64' : 'lg:ml-16'}`}>
        {/* Top bar */}
        <header
          className="sticky top-0 z-40 flex justify-between items-center px-4 lg:px-6 h-14"
          style={{
            background: 'rgba(248,249,255,0.85)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderBottom: '1px solid rgba(197,198,205,0.3)',
            boxShadow: '0 1px 12px rgba(9,20,38,0.06)',
          }}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="lg:hidden p-2 min-w-[40px] min-h-[40px] text-on-surface-variant hover:bg-surface-container transition-colors rounded-xl"
            >
              <span className="material-symbols-outlined text-xl">
                {isSidebarOpen ? 'close' : 'menu'}
              </span>
            </button>
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-on-surface-variant/40 font-medium hidden sm:block">DocTrack</span>
              <span className="text-on-surface-variant/30 hidden sm:block">/</span>
              <span className="font-semibold text-primary capitalize">
                {navItems.find(n => n.id === currentPage)?.label ?? currentPage}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="relative" ref={notifRef}>
              <button
                onClick={handleBellClick}
                className="relative p-2 text-on-surface-variant hover:bg-surface-container transition-colors rounded-xl"
              >
                <span className="material-symbols-outlined text-xl">notifications</span>
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-0.5 bg-error rounded-full border-2 border-white flex items-center justify-center text-[9px] font-black text-white leading-none">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown */}
              {isNotifOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-outline-variant/20 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="px-4 py-3 border-b border-outline-variant/10 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-base text-primary">notifications_active</span>
                      <span className="font-display font-bold text-sm text-primary">อัพเดทล่าสุด</span>
                    </div>
                    <span className="text-[10px] text-on-surface-variant/50 font-bold uppercase tracking-wider">{recentParcels.length} รายการ</span>
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-outline-variant/8">
                    {recentParcels.length === 0 ? (
                      <div className="py-8 text-center text-sm text-on-surface-variant/50">
                        <span className="material-symbols-outlined text-3xl block mb-2 opacity-30">inbox</span>
                        ยังไม่มีรายการ
                      </div>
                    ) : recentParcels.map(p => (
                      <div key={p.TrackingID} className="px-4 py-3 hover:bg-surface-container-lowest transition-colors cursor-default">
                        <div className="flex items-start gap-3">
                          <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${getStatusColor(p['สถานะ'])}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <code className="text-xs font-mono font-black text-primary">{p.TrackingID}</code>
                              <span className="text-[10px] text-on-surface-variant/40 shrink-0">{p['สถานะ']}</span>
                            </div>
                            <p className="text-xs text-on-surface-variant mt-0.5 truncate">
                              {p['ผู้ส่ง']} → {p['ผู้รับ']}
                            </p>
                            <p className="text-[10px] text-on-surface-variant/40 mt-0.5">
                              {p['วันที่รับ'] || p['วันที่สร้าง']}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="px-4 sm:px-6 lg:px-8 pt-6 pb-10 flex-1 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
