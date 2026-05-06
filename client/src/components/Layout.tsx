import React, { useState, useRef, useEffect, useMemo } from "react";
import { useParcelStore } from '@/hooks/useParcelStore';
import { useAuth } from '@/contexts/AuthContext';
import type { Parcel } from '@/types/parcel';
import { formatThaiDateTime, getDateTime } from '@/lib/dateUtils';
import { normalizeRole, type AppRole } from '@/lib/roles';
import { getBranches } from '@/lib/parcelService';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import NativeSelect, { resolveSelectValue } from '@/components/NativeSelect';

type PageId = "dashboard" | "create" | "track" | "users";

interface LayoutProps {
  children: React.ReactNode;
  currentPage: PageId;
  setCurrentPage: (page: PageId) => void;
}

const pagePaths: Record<PageId, string> = {
  dashboard: "/dashboard",
  create: "/create",
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
    if (status === 'ส่งสำเร็จ') return 'bg-emerald-500';
    if (status === 'กำลังจัดส่ง') return 'bg-blue-500';
    return 'bg-amber-500';
  };

  const currentRole = normalizeRole(user?.role ?? 'GUEST');
  const dashboardLabel =
    currentRole === 'USER'
      ? 'พัสดุของฉัน'
      : currentRole === 'MESSENGER'
        ? 'งานจัดส่ง'
        : 'ภาพรวมพัสดุ';
  const dashboardIcon =
    currentRole === 'MESSENGER'
      ? 'local_shipping'
      : currentRole === 'USER'
        ? 'inventory_2'
        : 'analytics';
  const allNavItems: NavItem[] = [
    { id: "dashboard", label: dashboardLabel, icon: dashboardIcon, badge: null, roles: ['ADMIN', 'MESSENGER', 'USER'], accent: "from-sky-400 to-blue-500" },
    { id: "create",    label: "สร้างพัสดุ", icon: "add_box", badge: null, roles: ['ADMIN'], accent: "from-amber-300 to-orange-500" },
    { id: "track",     label: "ค้นหาพัสดุ", icon: "qr_code_scanner", badge: null, roles: ['ADMIN', 'GUEST'], accent: "from-violet-300 to-indigo-500" },
    { id: "users",     label: "จัดการผู้ใช้", icon: "manage_accounts", badge: null, roles: ['ADMIN'], accent: "from-rose-300 to-red-500" },
  ];
  const navItems = allNavItems.filter(item => item.roles.includes(currentRole));

  const handleNav = (event: React.MouseEvent<HTMLAnchorElement>, id: PageId) => {
    event.preventDefault();
    setCurrentPage(id);
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
      {/* ── Main content ── */}
      <div className="flex min-h-screen flex-col">
        {/* Top bar */}
        <header
          className="sticky top-0 z-40"
          style={{
            background: 'rgba(248,249,255,0.85)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderBottom: '1px solid rgba(197,198,205,0.3)',
            boxShadow: '0 1px 12px rgba(9,20,38,0.06)',
          }}
        >
          <div className="flex h-14 items-center justify-between gap-3 px-4 lg:px-8">
            <div className="min-w-0">
              <p className="hidden text-[10px] font-black uppercase tracking-[0.18em] text-on-surface-variant/35 sm:block">DocTrack</p>
              <h1 className="truncate font-display text-base font-black leading-tight text-primary">
                {navItems.find(n => n.id === currentPage)?.label ?? currentPage}
              </h1>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
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
                  <div className="fixed right-4 top-16 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border border-outline-variant/20 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="px-4 py-3 border-b border-outline-variant/10 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-base text-primary">notifications_active</span>
                      <span className="font-display font-bold text-sm text-primary">อัปเดตล่าสุด</span>
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
                                <code className="min-w-0 break-all text-xs font-mono font-black text-primary">{p.TrackingID}</code>
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
              {user ? (
                <>
                  <button
                    type="button"
                    onClick={openProfile}
                    className="grid h-10 w-10 place-items-center rounded-2xl bg-primary text-white shadow-sm transition-all hover:opacity-90 active:scale-95"
                    title="โปรไฟล์"
                    aria-label="โปรไฟล์"
                  >
                    <span className="text-sm font-black uppercase">{user.name.charAt(0)}</span>
                  </button>
                  <button
                    type="button"
                    onClick={logout}
                    className="grid h-10 w-10 place-items-center rounded-2xl border border-red-200 bg-red-50 text-red-500 transition-all hover:bg-red-500 hover:text-white active:scale-95"
                    title="ออกจากระบบ"
                    aria-label="ออกจากระบบ"
                  >
                    <span className="material-symbols-outlined text-xl">logout</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/10 text-primary transition-all hover:bg-primary hover:text-white active:scale-95"
                  title="เข้าสู่ระบบพนักงาน"
                  aria-label="เข้าสู่ระบบพนักงาน"
                >
                  <span className="material-symbols-outlined text-xl">login</span>
                </button>
              )}
            </div>
          </div>
          {navItems.length > 1 && (
            <nav className="flex gap-2 overflow-x-auto px-4 pb-3 lg:px-8">
              {navItems.map((item) => {
                const active = currentPage === item.id;
                return (
                  <a
                    key={item.id}
                    href={pagePaths[item.id]}
                    onClick={(event) => handleNav(event, item.id)}
                    aria-current={active ? 'page' : undefined}
                    className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-2xl border px-3 font-display text-xs font-black transition-all ${
                      active
                        ? 'border-primary bg-primary text-white shadow-sm'
                        : 'border-outline-variant/30 bg-white/80 text-on-surface-variant hover:border-primary/30 hover:text-primary'
                    }`}
                  >
                    <span
                      className="material-symbols-outlined text-lg"
                      style={{ fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}
                    >
                      {item.icon}
                    </span>
                    {item.label}
                  </a>
                );
              })}
            </nav>
          )}
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-10 pt-5 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>

      {/* ── Edit Profile Dialog ── */}
      <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md rounded-3xl border-none bg-white p-0 shadow-2xl">
          <DialogHeader className="relative border-b border-outline-variant/20 bg-surface-container-lowest px-6 py-5 rounded-t-3xl">
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
