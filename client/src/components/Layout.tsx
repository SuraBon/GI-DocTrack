import React, { useState, useRef, useEffect, useMemo } from "react";
import { useParcelStore } from '@/hooks/useParcelStore';
import { useAuth } from '@/contexts/AuthContext';
import type { Parcel } from '@/types/parcel';
import { formatThaiDateTime, getDateTime } from '@/lib/dateUtils';
import { normalizeRole, ROLE_LABELS, type AppRole } from '@/lib/roles';
import { getBranches } from '@/lib/parcelService';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import NativeSelect, { resolveSelectValue } from '@/components/NativeSelect';

type PageId = "dashboard" | "create" | "confirm" | "track" | "users";

interface LayoutProps {
  children: React.ReactNode;
  currentPage: PageId;
  setCurrentPage: (page: PageId) => void;
}

const pagePaths: Record<PageId, string> = {
  dashboard: "/dashboard",
  create: "/create",
  confirm: "/confirm",
  track: "/track",
  users: "/users",
};

type NavItem = {
  id: PageId;
  label: string;
  icon: string;
  badge: null;
  roles: AppRole[];
  accent: string;
};

const Layout: React.FC<LayoutProps> = ({ children, currentPage, setCurrentPage }) => {
  const { parcels } = useParcelStore();
  const { user, logout, updateUserProfile } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: '', branch: '', currentPassword: '', newPassword: '', confirmPassword: '' });
  const [profileLoading, setProfileLoading] = useState(false);
  const [seenIds, setSeenIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('seen_parcel_ids');
      if (!stored) return new Set();
      const data = JSON.parse(stored);
      if (data.timestamp && Date.now() - data.timestamp > 30 * 24 * 60 * 60 * 1000) {
        localStorage.removeItem('seen_parcel_ids');
        return new Set();
      }
      return new Set(Array.isArray(data.ids) ? data.ids : data);
    } catch {
      return new Set();
    }
  });
  const notifRef = useRef<HTMLDivElement>(null);

  const recentParcels = useMemo(() => [...parcels]
      .sort((a, b) => {
        const da = getDateTime(a['วันที่รับ'] || a['วันที่สร้าง']);
        const db = getDateTime(b['วันที่รับ'] || b['วันที่สร้าง']);
        return db - da;
      })
      .slice(0, 8),
    [parcels],
  );

  const unreadCount = recentParcels.filter(p => !seenIds.has(p.TrackingID)).length;

  const markAllSeen = () => {
    const next = new Set([...Array.from(seenIds), ...recentParcels.map(p => p.TrackingID)]);
    setSeenIds(next);
    localStorage.setItem('seen_parcel_ids', JSON.stringify({
      ids: Array.from(next),
      timestamp: Date.now(),
    }));
  };

  const handleBellClick = () => {
    const opening = !isNotifOpen;
    setIsNotifOpen(opening);
    if (opening) markAllSeen();
  };

  useEffect(() => {
    const handleMouse = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsNotifOpen(false);
    };
    document.addEventListener('mousedown', handleMouse);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleMouse);
      document.removeEventListener('keydown', handleKey);
    };
  }, []);

  const getStatusColor = (status: Parcel['สถานะ']) => {
    if (status === 'ส่งถึงแล้ว') return 'bg-emerald-500';
    if (status === 'กำลังจัดส่ง') return 'bg-blue-500';
    return 'bg-amber-500';
  };

  const currentRole = normalizeRole(user?.role ?? 'GUEST');
  const allNavItems: NavItem[] = [
    { id: "dashboard", label: currentRole === 'USER' ? "พัสดุของฉัน" : "ภาพรวมระบบ", icon: "dashboard", badge: null, roles: ['ADMIN', 'MESSENGER', 'USER'], accent: "from-sky-400 to-blue-500" },
    { id: "create",    label: "สร้างรายการใหม่", icon: "add_box", badge: null, roles: ['ADMIN', 'MESSENGER', 'USER'], accent: "from-amber-300 to-orange-500" },
    { id: "confirm",   label: "ยืนยันรับพัสดุ", icon: "photo_camera", badge: null, roles: ['ADMIN', 'MESSENGER'], accent: "from-emerald-300 to-teal-500" },
    { id: "track",     label: "ติดตามสถานะ", icon: "location_searching", badge: null, roles: ['ADMIN', 'MESSENGER', 'USER', 'GUEST'], accent: "from-violet-300 to-indigo-500" },
    { id: "users",     label: "จัดการผู้ใช้", icon: "manage_accounts", badge: null, roles: ['ADMIN'], accent: "from-rose-300 to-red-500" },
  ];
  const navItems = allNavItems.filter(item => item.roles.includes(currentRole));

  const handleNav = (event: React.MouseEvent<HTMLAnchorElement>, id: PageId) => {
    event.preventDefault();
    setCurrentPage(id);
    if (window.innerWidth < 1024) setIsSidebarOpen(false);
  };

  const openProfile = () => {
    setProfileForm({ name: user?.name ?? '', branch: user?.branch ?? '', currentPassword: '', newPassword: '', confirmPassword: '' });
    setIsProfileOpen(true);
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const { name, branch, currentPassword, newPassword, confirmPassword } = profileForm;
    if (!name.trim()) { toast.error('กรุณากรอกชื่อ-นามสกุล'); return; }
    if (!branch.trim() || !resolveSelectValue(branch)) { toast.error('กรุณาเลือกสาขา'); return; }
    if (newPassword && newPassword.length < 4) { toast.error('รหัสผ่านใหม่ต้องมีอย่างน้อย 4 ตัวอักษร'); return; }
    if (newPassword && newPassword !== confirmPassword) { toast.error('รหัสผ่านใหม่ไม่ตรงกัน'); return; }
    if (newPassword && !currentPassword) { toast.error('กรุณากรอกรหัสผ่านปัจจุบัน'); return; }

    setProfileLoading(true);
    const res = await updateUserProfile(
      name.trim() !== user?.name ? name.trim() : undefined,
      resolveSelectValue(branch) !== user?.branch ? resolveSelectValue(branch) : undefined,
      newPassword || undefined,
      newPassword ? currentPassword : undefined,
    );
    setProfileLoading(false);

    if (res.success) {
      toast.success('บันทึกข้อมูลสำเร็จ');
      setIsProfileOpen(false);
    } else {
      toast.error(res.error || 'เกิดข้อผิดพลาด');
    }
  };

  return (
    <div className="min-h-screen font-body text-on-background">
      {/* ── Sidebar ── */}
      <aside
        className={`
          h-screen fixed left-0 top-0 z-50
          flex flex-col
          transition-all duration-300 ease-in-out
          ${isSidebarOpen ? 'w-72 px-4 translate-x-0' : 'w-[76px] px-3 -translate-x-full lg:translate-x-0'}
        `}
        style={{
          background: 'linear-gradient(180deg, #10213c 0%, #091426 58%, #071120 100%)',
          borderRight: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '6px 0 22px rgba(5,12,24,0.22)',
        }}
      >
        {/* Logo — only when expanded */}
        {isSidebarOpen && (
          <div className="flex items-center gap-3 px-0 pt-3 pb-4 mb-1">
            <div className="flex flex-col min-w-0">
              <span className="text-white font-black text-lg font-display leading-none">DocTrack</span>
              <span className="text-white/40 text-[10px] font-semibold uppercase tracking-wider mt-0.5">ระบบจัดการพัสดุ</span>
            </div>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="hidden lg:flex ml-auto p-1.5 text-white/30 hover:text-white hover:bg-white/10 rounded-lg transition-all shrink-0"
            >
              <span className="material-symbols-outlined text-lg">chevron_left</span>
            </button>
          </div>
        )}

        {/* Divider — only when expanded */}
        {isSidebarOpen && <div className="h-px bg-white/8 mx-2 mb-4" />}

        {/* Nav */}
        <nav className="relative flex-1 space-y-2 pt-2">
          {/* Expand button — top of nav when collapsed */}
          {!isSidebarOpen && (
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="hidden lg:flex justify-center items-center mx-auto h-11 w-11 rounded-xl text-white/30 hover:text-white hover:bg-white/10 transition-all mb-2"
              title="ขยาย sidebar"
            >
              <span className="material-symbols-outlined text-lg">chevron_right</span>
            </button>
          )}

          {navItems.map((item) => {
            const active = currentPage === item.id;
            return (
              <a
                key={item.id}
                href={pagePaths[item.id]}
                onClick={(event) => handleNav(event, item.id)}
                title={isSidebarOpen ? undefined : item.label}
                aria-current={active ? "page" : undefined}
                className={`
                  flex items-center
                  ${isSidebarOpen ? 'gap-3 px-3 rounded-xl' : 'justify-center rounded-xl mx-auto h-11 w-11'}
                  ${isSidebarOpen ? 'py-3' : 'py-0'} font-display text-sm font-semibold cursor-pointer
                  transition-all duration-200 relative group
                  ${active
                    ? 'text-white'
                    : 'text-white/48 hover:text-white/80 hover:bg-white/5'
                  }
                `}
                style={active ? {
                  background: isSidebarOpen ? 'rgba(255,255,255,0.11)' : 'rgba(254,166,25,0.13)',
                  boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.12)',
                } : {}}
              >
                {active && (
                  <span className={`absolute ${isSidebarOpen ? 'left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full' : '-left-3 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full'} bg-secondary-container`} />
                )}
                <span
                  className={`material-symbols-outlined shrink-0 text-[23px] transition-all ${active ? 'text-secondary-container' : 'text-white/48 group-hover:text-white/80'}`}
                  style={{ fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}
                >
                  {item.icon}
                </span>
                {isSidebarOpen && <span className="truncate pl-1">{item.label}</span>}
              </a>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="relative mt-auto pt-4 border-t border-white/8 space-y-2 pb-3">
          {user ? (
            <>
              <button
                onClick={openProfile}
                title={isSidebarOpen ? 'แก้ไขโปรไฟล์' : user.name}
                className={`w-full flex items-center ${isSidebarOpen ? 'gap-3 px-3' : 'justify-center'} py-2.5 rounded-xl bg-white/[0.07] ring-1 ring-white/8 hover:bg-white/[0.12] transition-colors text-left`}
              >
                <div className="w-9 h-9 rounded-xl bg-white/10 ring-1 ring-white/10 flex items-center justify-center shrink-0 text-white font-black text-xs uppercase">
                  {user.name.charAt(0)}
                </div>
                {isSidebarOpen && (
                  <div className="flex flex-col min-w-0 overflow-hidden flex-1">
                    <span className="text-white text-xs font-bold truncate">{user.name}</span>
                    <span className="text-white/40 text-[10px] truncate">{ROLE_LABELS[currentRole]} • {user.branch}</span>
                  </div>
                )}
                {isSidebarOpen && (
                  <span className="material-symbols-outlined text-white/30 text-base shrink-0">edit</span>
                )}
              </button>
              <button
                onClick={logout}
                className={`w-full flex items-center ${isSidebarOpen ? 'gap-3 px-3' : 'justify-center'} py-2.5 text-red-300 hover:text-white hover:bg-red-500/15 font-display text-sm font-semibold cursor-pointer rounded-xl transition-all`}
                title={isSidebarOpen ? undefined : "ออกจากระบบ"}
              >
                <span className="material-symbols-outlined text-xl">logout</span>
                {isSidebarOpen && "ออกจากระบบ"}
              </button>
            </>
          ) : (
            <button
              onClick={() => window.location.reload()}
              className={`w-full flex items-center ${isSidebarOpen ? 'gap-3 px-3' : 'justify-center'} py-2.5 text-primary hover:text-primary hover:bg-primary/10 font-display text-sm font-semibold cursor-pointer rounded-xl transition-all`}
              title={isSidebarOpen ? undefined : "เข้าสู่ระบบพนักงาน"}
            >
              <span className="material-symbols-outlined text-xl">login</span>
              {isSidebarOpen && "เข้าสู่ระบบพนักงาน"}
            </button>
          )}
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
      <div className={`flex flex-col min-h-screen transition-all duration-300 ${isSidebarOpen ? 'lg:ml-72' : 'lg:ml-[76px]'}`}>
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
                              {formatThaiDateTime(p['วันที่รับ'] || p['วันที่สร้าง'])}
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

      {/* ── Edit Profile Dialog ── */}
      <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md rounded-3xl border-none bg-white p-0 shadow-2xl">
          <DialogHeader className="border-b border-outline-variant/20 bg-surface-container-lowest px-6 py-5 rounded-t-3xl">
            <div className="flex items-center gap-3 pr-8">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>manage_accounts</span>
              </div>
              <div>
                <DialogTitle className="font-display text-xl font-black text-primary">แก้ไขโปรไฟล์</DialogTitle>
                <DialogDescription className="mt-1 text-xs text-on-surface-variant">
                  แก้ไขชื่อ สาขา หรือรหัสผ่านของคุณ
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleProfileSave} className="p-6 space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-bold text-on-surface-variant mb-1.5">ชื่อ-นามสกุล</label>
              <input
                type="text"
                value={profileForm.name}
                onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))}
                disabled={profileLoading}
                className="w-full h-12 bg-surface-container-lowest border border-outline-variant/60 rounded-2xl px-4 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all disabled:opacity-50"
                placeholder="ชื่อ-นามสกุล"
              />
            </div>

            {/* Branch */}
            <div>
              <label className="block text-sm font-bold text-on-surface-variant mb-1.5">สาขาประจำ</label>
              <NativeSelect
                value={profileForm.branch}
                onChange={v => setProfileForm(f => ({ ...f, branch: v }))}
                options={getBranches()}
                placeholder="เลือกสาขา"
                icon="apartment"
                disabled={profileLoading}
                otherPlaceholder="ระบุชื่อสาขา"
              />
            </div>

            {/* Divider */}
            <div className="pt-2 border-t border-outline-variant/20">
              <p className="text-xs font-bold text-on-surface-variant/50 uppercase tracking-wider mb-3">เปลี่ยนรหัสผ่าน (ไม่บังคับ)</p>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-bold text-on-surface-variant mb-1.5">รหัสผ่านปัจจุบัน</label>
                  <input
                    type="password"
                    value={profileForm.currentPassword}
                    onChange={e => setProfileForm(f => ({ ...f, currentPassword: e.target.value }))}
                    disabled={profileLoading}
                    className="w-full h-12 bg-surface-container-lowest border border-outline-variant/60 rounded-2xl px-4 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all disabled:opacity-50"
                    placeholder="••••••••"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-on-surface-variant mb-1.5">รหัสผ่านใหม่</label>
                  <input
                    type="password"
                    value={profileForm.newPassword}
                    onChange={e => setProfileForm(f => ({ ...f, newPassword: e.target.value }))}
                    disabled={profileLoading}
                    className="w-full h-12 bg-surface-container-lowest border border-outline-variant/60 rounded-2xl px-4 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all disabled:opacity-50"
                    placeholder="อย่างน้อย 4 ตัวอักษร"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-on-surface-variant mb-1.5">ยืนยันรหัสผ่านใหม่</label>
                  <input
                    type="password"
                    value={profileForm.confirmPassword}
                    onChange={e => setProfileForm(f => ({ ...f, confirmPassword: e.target.value }))}
                    disabled={profileLoading}
                    className="w-full h-12 bg-surface-container-lowest border border-outline-variant/60 rounded-2xl px-4 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all disabled:opacity-50"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsProfileOpen(false)}
                disabled={profileLoading}
                className="flex-1 h-12 rounded-2xl border border-outline-variant/40 font-bold text-on-surface-variant hover:bg-surface-container transition-all disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={profileLoading}
                className="flex-1 h-12 bg-primary text-white rounded-2xl font-display font-bold shadow-md shadow-primary/20 hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {profileLoading ? (
                  <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                ) : 'บันทึก'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Layout;
