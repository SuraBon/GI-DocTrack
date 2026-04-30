import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { ArrowRight, PackageSearch, Search, ShieldCheck, Truck, UserRound } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getParcel, searchParcels } from '@/lib/parcelService';
import StatusBadge from '@/components/StatusBadge';
import { formatThaiDate } from '@/lib/dateUtils';
import type { Parcel } from '@/types/parcel';

const DEMO_ACCOUNTS = [
  { role: 'User', username: 'user_test', password: 'user123', Icon: UserRound },
  { role: 'Messenger', username: 'messenger_test', password: 'messenger123', Icon: Truck },
  { role: 'Admin', username: 'admin_test', password: 'admin123', Icon: ShieldCheck },
];

export default function Login() {
  const { loginUser, setupUserPin, loading } = useAuth();
  
  const [employeeId, setEmployeeId] = useState('');
  const [pin, setPin] = useState('');
  const [isSetup, setIsSetup] = useState(false);
  const [isTrackOpen, setIsTrackOpen] = useState(false);
  const [guestQuery, setGuestQuery] = useState('');
  const [isTracking, setIsTracking] = useState(false);
  const [guestParcel, setGuestParcel] = useState<Parcel | null>(null);
  const [guestResults, setGuestResults] = useState<Parcel[]>([]);
  
  // For setup
  const [name, setName] = useState('');
  const [branch, setBranch] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId) {
      toast.error('กรุณากรอกรหัสพนักงาน');
      return;
    }

    if (isSetup) {
      if (pin.length < 4 || !name || !branch) {
        toast.error('กรุณากรอกข้อมูลให้ครบถ้วนและ PIN ต้องมี 4 หลัก');
        return;
      }
      const res = await setupUserPin(employeeId, pin, name, branch);
      if (res.success) {
        toast.success('ตั้งค่า PIN สำเร็จ');
      } else {
        toast.error(res.error || 'เกิดข้อผิดพลาดในการตั้งค่า');
      }
    } else {
      if (!pin) {
        toast.error('กรุณากรอกรหัสผ่าน');
        return;
      }
      
      const res = await loginUser(employeeId, pin);
      
      if (res.success) {
        if (res.needsSetup) {
          setIsSetup(true);
          setName(res.name !== 'Unknown' ? res.name! : '');
          setBranch(res.branch !== 'Unknown' ? res.branch! : '');
          toast.info('เข้าใช้งานครั้งแรก กรุณาตั้งค่า PIN และข้อมูลของท่าน');
        } else {
          toast.success('เข้าสู่ระบบสำเร็จ');
        }
      } else {
        toast.error(res.error || 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ');
      }
    }
  };

  const resetGuestTracking = () => {
    setGuestQuery('');
    setGuestParcel(null);
    setGuestResults([]);
    setIsTracking(false);
  };

  const handleTrackOpenChange = (open: boolean) => {
    setIsTrackOpen(open);
    if (!open) resetGuestTracking();
  };

  const handleGuestTracking = async (e?: React.FormEvent, queryOverride?: string) => {
    e?.preventDefault();
    const query = (queryOverride ?? guestQuery).trim();
    if (!query) {
      toast.error('กรุณากรอกหมายเลขติดตามหรือชื่อผู้รับ');
      return;
    }

    if (queryOverride) setGuestQuery(queryOverride);
    setIsTracking(true);
    try {
      const exact = await getParcel(query);
      if (exact.success && exact.parcel) {
        setGuestParcel(exact.parcel);
        setGuestResults([]);
        return;
      }

      const results = await searchParcels(query);
      if (results.length === 1) {
        setGuestParcel(results[0]);
        setGuestResults([]);
      } else if (results.length > 1) {
        setGuestParcel(null);
        setGuestResults(results);
      } else {
        setGuestParcel(null);
        setGuestResults([]);
        toast.error('ไม่พบข้อมูลพัสดุ');
      }
    } catch {
      toast.error('ไม่สามารถติดตามพัสดุได้ กรุณาลองใหม่');
    } finally {
      setIsTracking(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl sm:shadow-2xl p-6 sm:p-8 border border-outline-variant/20">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Truck className="h-8 w-8 text-primary" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-black font-display text-primary">
            {isSetup ? 'ตั้งค่าการเข้าใช้งาน' : 'เข้าสู่ระบบ'}
          </h1>
          <p className="text-sm text-on-surface-variant mt-2">
            {isSetup ? 'กรุณาตั้งรหัส PIN และข้อมูลของท่าน' : 'ระบบติดตามพัสดุและเอกสาร'}
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-on-surface-variant mb-1.5">Username</label>
            <input
              type="text"
              value={employeeId}
              onChange={e => setEmployeeId(e.target.value)}
              disabled={isSetup || loading}
              className="w-full h-12 bg-surface-container-lowest border border-outline-variant/60 rounded-xl px-4 text-primary font-bold focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all disabled:opacity-50"
              placeholder="user_test"
            />
          </div>

          {isSetup && (
            <>
              <div>
                <label className="block text-sm font-bold text-on-surface-variant mb-1.5">ชื่อ-นามสกุล</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  disabled={loading}
                  className="w-full h-12 bg-surface-container-lowest border border-outline-variant/60 rounded-xl px-4 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  placeholder="ชื่อของท่าน"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-on-surface-variant mb-1.5">สาขาประจำ</label>
                <input
                  type="text"
                  value={branch}
                  onChange={e => setBranch(e.target.value)}
                  disabled={loading}
                  className="w-full h-12 bg-surface-container-lowest border border-outline-variant/60 rounded-xl px-4 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  placeholder="เช่น พิบูลสงคราม"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-bold text-on-surface-variant mb-1.5">
              {isSetup ? 'ตั้งรหัสผ่าน' : 'Password'}
            </label>
            <input
              type="password"
              value={pin}
              onChange={e => setPin(e.target.value)}
              disabled={loading}
              className="w-full h-12 bg-surface-container-lowest border border-outline-variant/60 rounded-xl px-4 text-base font-bold focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              placeholder="••••••••"
            />
          </div>

          {!isSetup && (
            <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-on-surface-variant/50 mb-2">Demo accounts</p>
              <div className="grid gap-2">
                {DEMO_ACCOUNTS.map(account => {
                  const Icon = account.Icon;
                  return (
                  <button
                    key={account.username}
                    type="button"
                    onClick={() => {
                      setEmployeeId(account.username);
                      setPin(account.password);
                    }}
                    className="flex items-center justify-between gap-3 rounded-xl border border-outline-variant/20 bg-white px-3 py-2 text-left hover:border-primary/30 hover:bg-primary/[0.03] transition-all"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                      <span className="text-xs font-bold text-primary">{account.role}</span>
                    </span>
                    <code className="truncate text-[11px] font-bold text-on-surface-variant/70">
                      {account.username} / {account.password}
                    </code>
                  </button>
                  );
                })}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 mt-6 bg-primary text-white rounded-xl font-display font-bold shadow-md shadow-primary/20 hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
            ) : (
              <span>{isSetup ? 'บันทึกข้อมูลและเข้าสู่ระบบ' : 'เข้าสู่ระบบ'}</span>
            )}
          </button>
          
          {!isSetup && (
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => setIsTrackOpen(true)}
                className="text-on-surface-variant/60 font-bold text-sm hover:text-primary hover:underline transition-colors"
              >
                ติดตามพัสดุโดยไม่ต้องเข้าระบบ
              </button>
            </div>
          )}
        </form>
      </div>

      <Dialog open={isTrackOpen} onOpenChange={handleTrackOpenChange}>
        <DialogContent className="max-h-[88vh] w-[calc(100vw-2rem)] max-w-3xl overflow-hidden rounded-3xl border-none bg-white p-0 shadow-2xl">
          <DialogHeader className="border-b border-outline-variant/20 bg-surface-container-lowest px-5 py-5 sm:px-7">
            <div className="flex items-center gap-3 pr-8">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <PackageSearch className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <DialogTitle className="font-display text-xl font-black text-primary">ติดตามพัสดุ</DialogTitle>
                <DialogDescription className="mt-1 text-xs text-on-surface-variant">
                  ค้นหาด้วยหมายเลขติดตามหรือชื่อผู้รับโดยไม่ต้องเข้าสู่ระบบ
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="max-h-[calc(88vh-96px)] overflow-y-auto p-5 sm:p-7">
            <form onSubmit={handleGuestTracking} className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-on-surface-variant/45" aria-hidden="true" />
                <input
                  value={guestQuery}
                  onChange={(e) => setGuestQuery(e.target.value.toUpperCase())}
                  placeholder="กรอกหมายเลขติดตาม หรือชื่อผู้รับ..."
                  className="h-12 w-full rounded-2xl border-2 border-outline-variant/50 bg-white pl-12 pr-4 font-display text-base font-bold text-primary outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10"
                  autoFocus
                />
              </div>
              <button
                type="submit"
                disabled={isTracking}
                className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-6 font-display text-sm font-bold text-white shadow-lg shadow-primary/15 transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
              >
                {isTracking ? (
                  <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                ) : (
                  <>
                    ติดตามพัสดุ
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-5">
              {guestParcel ? (
                <div className="overflow-hidden rounded-3xl border border-outline-variant/30 bg-white shadow-sm">
                  <div className="bg-primary px-5 py-4 text-white">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/55">Tracking ID</p>
                        <code className="mt-1 block font-mono text-xl font-black tracking-wide">{guestParcel.TrackingID}</code>
                      </div>
                      <div className="rounded-xl bg-white/10 px-3 py-2">
                        <StatusBadge status={guestParcel['สถานะ']} />
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-4 p-5 sm:grid-cols-2">
                    <div className="rounded-2xl bg-surface-container-lowest p-4">
                      <p className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant/50">ผู้ส่ง</p>
                      <p className="mt-1 font-bold text-primary">{guestParcel['ผู้ส่ง']}</p>
                      <p className="text-xs text-on-surface-variant/60">{guestParcel['สาขาผู้ส่ง']}</p>
                    </div>
                    <div className="rounded-2xl bg-surface-container-lowest p-4">
                      <p className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant/50">ผู้รับ</p>
                      <p className="mt-1 font-bold text-primary">{guestParcel['ผู้รับ']}</p>
                      <p className="text-xs text-on-surface-variant/60">{guestParcel['สาขาผู้รับ']}</p>
                    </div>
                    <div className="rounded-2xl bg-surface-container-lowest p-4">
                      <p className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant/50">ประเภท</p>
                      <p className="mt-1 font-bold text-primary">{guestParcel['ประเภทเอกสาร'] || '-'}</p>
                    </div>
                    <div className="rounded-2xl bg-surface-container-lowest p-4">
                      <p className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant/50">วันที่สร้าง</p>
                      <p className="mt-1 font-bold text-primary">{formatThaiDate(guestParcel['วันที่สร้าง'])}</p>
                    </div>
                  </div>
                </div>
              ) : guestResults.length > 0 ? (
                <div className="space-y-3">
                  <p className="px-1 text-xs font-bold text-on-surface-variant/60">พบ {guestResults.length} รายการ</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {guestResults.map(parcel => (
                      <button
                        key={parcel.TrackingID}
                        type="button"
                        onClick={() => {
                          setGuestParcel(parcel);
                          setGuestResults([]);
                        }}
                        className="rounded-2xl border border-outline-variant/30 bg-white p-4 text-left shadow-sm transition-all hover:border-primary/35 hover:bg-primary/[0.03]"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <code className="rounded-lg bg-primary/5 px-2 py-1 font-mono text-xs font-black text-primary">{parcel.TrackingID}</code>
                          <StatusBadge status={parcel['สถานะ']} />
                        </div>
                        <div className="mt-3 flex items-center gap-2 text-sm">
                          <span className="truncate font-bold text-primary">{parcel['ผู้ส่ง']}</span>
                          <ArrowRight className="h-4 w-4 shrink-0 text-on-surface-variant/35" aria-hidden="true" />
                          <span className="truncate font-bold text-primary">{parcel['ผู้รับ']}</span>
                        </div>
                        <p className="mt-1 text-xs text-on-surface-variant/55">{formatThaiDate(parcel['วันที่สร้าง'])}</p>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-3xl border border-dashed border-outline-variant/40 bg-surface-container-lowest px-6 py-12 text-center">
                  <PackageSearch className="mx-auto h-10 w-10 text-on-surface-variant/30" aria-hidden="true" />
                  <p className="mt-3 font-display text-sm font-bold text-primary">กรอกข้อมูลเพื่อเริ่มติดตามพัสดุ</p>
                  <p className="mt-1 text-xs text-on-surface-variant/60">ผลการค้นหาจะแสดงใน popup นี้</p>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
