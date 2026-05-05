import { useState, useEffect, useRef } from 'react';
import { getUsers, updateUserRole, UserRow } from '@/lib/parcelService';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { SYSTEM_ROLES, type SystemRole } from '@/lib/roles';
import { Search, RefreshCw, Users, ShieldCheck, Truck, User } from 'lucide-react';

const ROLE_CONFIG: Record<SystemRole, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  ADMIN: {
    label: 'Admin',
    color: 'text-rose-600',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    icon: <ShieldCheck className="h-3.5 w-3.5" />,
  },
  MESSENGER: {
    label: 'Messenger',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: <Truck className="h-3.5 w-3.5" />,
  },
  USER: {
    label: 'User',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    icon: <User className="h-3.5 w-3.5" />,
  },
};

function RoleDropdown({
  value,
  onChange,
  disabled,
}: {
  value: SystemRole;
  onChange: (role: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const cfg = ROLE_CONFIG[value] ?? ROLE_CONFIG.USER;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(v => !v)}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all
          ${cfg.color} ${cfg.bg} ${cfg.border}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80 cursor-pointer'}`}
      >
        {cfg.icon}
        {cfg.label}
        {!disabled && (
          <span className={`material-symbols-outlined text-[14px] transition-transform ${open ? 'rotate-180' : ''}`}>
            expand_more
          </span>
        )}
      </button>

      {open && (
        <div className="absolute z-50 bottom-full mb-1 left-0 w-40 bg-white rounded-2xl border border-outline-variant/30 shadow-xl overflow-hidden py-1">
          {SYSTEM_ROLES.map(role => {
            const c = ROLE_CONFIG[role];
            return (
              <button
                key={role}
                type="button"
                onClick={() => { onChange(role); setOpen(false); }}
                className={`w-full flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition-colors
                  ${value === role ? `${c.bg} ${c.color}` : 'hover:bg-surface-container-lowest text-on-surface'}`}
              >
                <span className={c.color}>{c.icon}</span>
                {c.label}
                {value === role && (
                  <span className="material-symbols-outlined text-[14px] ml-auto" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const res = await getUsers();
    if (res.success && res.users) {
      setUsers(res.users);
    } else {
      toast.error('ไม่สามารถดึงข้อมูลผู้ใช้ได้');
    }
    setLoading(false);
  };

  const handleRoleChange = async (employeeId: string, newRole: string) => {
    if (employeeId === currentUser?.employeeId) {
      toast.error('ไม่สามารถเปลี่ยนสิทธิ์ของตนเองได้');
      return;
    }
    setUpdatingId(employeeId);
    const res = await updateUserRole(employeeId, newRole);
    if (res.success) {
      toast.success('เปลี่ยนสิทธิ์ผู้ใช้สำเร็จ');
      setUsers(prev => prev.map(u => u.employeeId === employeeId ? { ...u, role: newRole as SystemRole } : u));
    } else {
      toast.error(res.error || 'ไม่สามารถเปลี่ยนสิทธิ์ได้');
    }
    setUpdatingId(null);
  };

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    return (
      u.employeeId.toLowerCase().includes(q) ||
      u.name.toLowerCase().includes(q) ||
      u.branch.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    );
  });

  const counts = {
    total: users.length,
    admin: users.filter(u => u.role === 'ADMIN').length,
    messenger: users.filter(u => u.role === 'MESSENGER').length,
    user: users.filter(u => u.role === 'USER').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-2xl text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>manage_accounts</span>
          </div>
          <div>
            <h1 className="text-2xl font-black font-display text-primary">การจัดการผู้ใช้งาน</h1>
            <p className="text-sm text-on-surface-variant">ตั้งค่าและมอบหมายสิทธิ์การใช้งานระบบ</p>
          </div>
        </div>
        <button
          onClick={fetchUsers}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-outline-variant/40 text-sm font-bold text-on-surface-variant hover:bg-surface-container transition-all disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          รีเฟรช
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'ทั้งหมด', value: counts.total, icon: <Users className="h-5 w-5" />, color: 'text-primary', bg: 'bg-primary/10' },
          { label: 'Admin', value: counts.admin, icon: <ShieldCheck className="h-5 w-5" />, color: 'text-rose-600', bg: 'bg-rose-50' },
          { label: 'Messenger', value: counts.messenger, icon: <Truck className="h-5 w-5" />, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'User', value: counts.user, icon: <User className="h-5 w-5" />, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-outline-variant/30 p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${s.bg} ${s.color}`}>
              {s.icon}
            </div>
            <div>
              <p className="text-2xl font-black text-primary leading-none">{s.value}</p>
              <p className="text-xs text-on-surface-variant mt-0.5">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-on-surface-variant/40" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="ค้นหาด้วยรหัสพนักงาน ชื่อ สาขา หรือสิทธิ์..."
          className="w-full h-11 pl-11 pr-4 bg-white border border-outline-variant/40 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
        />
      </div>

      {/* Users */}
      <div className="bg-white border border-outline-variant/30 rounded-2xl shadow-sm overflow-hidden">
        <div className="sm:hidden">
          {loading ? (
            <div className="py-16 text-center">
              <span className="material-symbols-outlined animate-spin text-3xl text-primary">progress_activity</span>
              <p className="text-sm text-on-surface-variant mt-2">กำลังโหลด...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <Users className="mx-auto h-10 w-10 text-on-surface-variant/20 mb-2" />
              <p className="text-sm font-bold text-on-surface-variant/50">
                {search ? 'ไม่พบผู้ใช้ที่ค้นหา' : 'ยังไม่มีผู้ใช้งาน'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-outline-variant/10">
              {filtered.map(u => {
                const isSelf = u.employeeId === currentUser?.employeeId;
                const isUpdating = updatingId === u.employeeId;
                const cfg = ROLE_CONFIG[u.role as SystemRole] ?? ROLE_CONFIG.USER;
                return (
                  <div key={u.employeeId} className={`p-4 ${isSelf ? 'bg-primary/[0.03]' : ''}`}>
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-surface-container flex items-center justify-center shrink-0 text-sm font-black text-on-surface-variant uppercase">
                        {u.name.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <code className="font-mono text-sm font-black text-primary truncate">{u.employeeId}</code>
                          {isSelf && (
                            <span className="text-[10px] font-bold text-primary/60 bg-primary/10 px-1.5 py-0.5 rounded-md">คุณ</span>
                          )}
                        </div>
                        <p className="mt-1 text-sm font-bold text-on-surface truncate">{u.name}</p>
                        <p className="text-xs text-on-surface-variant/70 truncate">{u.branch}</p>
                      </div>
                      <span className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1 text-[11px] font-bold ${cfg.color} ${cfg.bg} ${cfg.border}`}>
                        {cfg.icon}
                        {cfg.label}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div>
                        {u.hasPin ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200">
                            <span className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                            ตั้งค่าแล้ว
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200">
                            <span className="material-symbols-outlined text-[13px]">pending</span>
                            รอดำเนินการ
                          </span>
                        )}
                      </div>
                      {isUpdating ? (
                        <span className="material-symbols-outlined animate-spin text-lg text-primary">progress_activity</span>
                      ) : (
                        <RoleDropdown
                          value={u.role as SystemRole}
                          onChange={(role) => handleRoleChange(u.employeeId, role)}
                          disabled={isSelf}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-lowest border-b border-outline-variant/20">
                <th className="px-5 py-3.5 text-[11px] font-black text-on-surface-variant/60 uppercase tracking-widest">รหัสพนักงาน</th>
                <th className="px-5 py-3.5 text-[11px] font-black text-on-surface-variant/60 uppercase tracking-widest">ชื่อ-นามสกุล</th>
                <th className="px-5 py-3.5 text-[11px] font-black text-on-surface-variant/60 uppercase tracking-widest">สาขา</th>
                <th className="px-5 py-3.5 text-[11px] font-black text-on-surface-variant/60 uppercase tracking-widest">สิทธิ์</th>
                <th className="px-5 py-3.5 text-[11px] font-black text-on-surface-variant/60 uppercase tracking-widest">PIN</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center">
                    <span className="material-symbols-outlined animate-spin text-3xl text-primary">progress_activity</span>
                    <p className="text-sm text-on-surface-variant mt-2">กำลังโหลด...</p>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center">
                    <Users className="mx-auto h-10 w-10 text-on-surface-variant/20 mb-2" />
                    <p className="text-sm font-bold text-on-surface-variant/50">
                      {search ? 'ไม่พบผู้ใช้ที่ค้นหา' : 'ยังไม่มีผู้ใช้งาน'}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map(u => {
                  const isSelf = u.employeeId === currentUser?.employeeId;
                  const isUpdating = updatingId === u.employeeId;
                  return (
                    <tr key={u.employeeId} className={`transition-colors ${isSelf ? 'bg-primary/[0.03]' : 'hover:bg-surface-container-lowest/60'}`}>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <code className="font-mono text-sm font-black text-primary">{u.employeeId}</code>
                          {isSelf && (
                            <span className="text-[10px] font-bold text-primary/60 bg-primary/10 px-1.5 py-0.5 rounded-md">คุณ</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-surface-container flex items-center justify-center shrink-0 text-xs font-black text-on-surface-variant uppercase">
                            {u.name.charAt(0)}
                          </div>
                          <span className="text-sm font-bold text-on-surface">{u.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-sm text-on-surface-variant">{u.branch}</span>
                      </td>
                      <td className="px-5 py-4">
                        {isUpdating ? (
                          <span className="material-symbols-outlined animate-spin text-lg text-primary">progress_activity</span>
                        ) : (
                          <RoleDropdown
                            value={u.role as SystemRole}
                            onChange={(role) => handleRoleChange(u.employeeId, role)}
                            disabled={isSelf}
                          />
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {u.hasPin ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200">
                            <span className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                            ตั้งค่าแล้ว
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200">
                            <span className="material-symbols-outlined text-[13px]">pending</span>
                            รอดำเนินการ
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {!loading && filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-outline-variant/10 bg-surface-container-lowest/50">
            <p className="text-xs text-on-surface-variant/50 font-bold">
              แสดง {filtered.length} จาก {users.length} รายการ
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
