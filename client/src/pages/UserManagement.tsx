import { useState, useEffect } from 'react';
import { getUsers, updateUserRole, UserRow } from '@/lib/parcelService';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { ROLE_LABELS, SYSTEM_ROLES, type SystemRole } from '@/lib/roles';

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

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
    if (employeeId === currentUser?.employeeId && newRole !== 'ADMIN') {
      toast.error('ไม่สามารถเปลี่ยนสิทธิ์ของตนเองให้ต่ำลงได้');
      return;
    }

    const res = await updateUserRole(employeeId, newRole);
    if (res.success) {
      toast.success('เปลี่ยนสิทธิ์ผู้ใช้สำเร็จ');
      setUsers(prev => prev.map(u => u.employeeId === employeeId ? { ...u, role: newRole as SystemRole } : u));
    } else {
      toast.error('ไม่สามารถเปลี่ยนสิทธิ์ได้');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-2xl text-primary font-bold">manage_accounts</span>
        </div>
        <div>
          <h1 className="text-2xl font-black font-display text-primary">การจัดการผู้ใช้งาน</h1>
          <p className="text-sm text-on-surface-variant">ตั้งค่าและมอบหมายสิทธิ์การใช้งานระบบ</p>
        </div>
      </div>

      <div className="bg-white border border-outline-variant/40 rounded-2xl shadow-sm overflow-hidden w-full">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-lowest border-b border-outline-variant/20">
                <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">รหัสพนักงาน</th>
                <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">ชื่อ-นามสกุล</th>
                <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">สาขา</th>
                <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">สถานะ PIN</th>
                <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">สิทธิ์การใช้งาน</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center">
                    <span className="material-symbols-outlined animate-spin text-3xl text-primary">progress_activity</span>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-on-surface-variant">
                    ไม่พบข้อมูลผู้ใช้งาน
                  </td>
                </tr>
              ) : (
                users.map(u => (
                  <tr key={u.employeeId} className="hover:bg-surface-container-lowest/50 transition-colors">
                    <td className="px-6 py-4 font-mono text-sm font-bold">{u.employeeId}</td>
                    <td className="px-6 py-4 text-sm">{u.name}</td>
                    <td className="px-6 py-4 text-sm">{u.branch}</td>
                    <td className="px-6 py-4">
                      {u.hasPin ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200">
                          <span className="material-symbols-outlined text-[14px]">check_circle</span>
                          ตั้งค่าแล้ว
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200">
                          <span className="material-symbols-outlined text-[14px]">pending</span>
                          รอดำเนินการ
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.employeeId, e.target.value)}
                        className="bg-surface-container border border-outline-variant/30 rounded-xl px-3 py-1.5 text-sm font-bold text-primary outline-none focus:ring-2 focus:ring-primary/20"
                        disabled={u.employeeId === currentUser?.employeeId}
                      >
                        {SYSTEM_ROLES.map(role => (
                          <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
