import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import StatusBadge from '@/components/StatusBadge';
import Timeline from '@/components/Timeline';
import TrackingMap from '@/components/TrackingMap';
import type { Parcel } from '@/types/parcel';
import type { TimelineEvent } from '@/types/timeline';
import { useAuth } from '@/contexts/AuthContext';
import { normalizeRole } from '@/lib/roles';
import { applyDerivedStatus } from '@/lib/parcelStatus';

interface ParcelTimelineModalProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  selectedParcel: Parcel | null;
  selectedTimelineEvents: TimelineEvent[];
  hasKnownBranches: boolean;
  onConfirmParcel: (trackingId: string) => void;
  onDeleteParcel: () => void;
}

export default function ParcelTimelineModal({
  isOpen,
  setIsOpen,
  selectedParcel,
  selectedTimelineEvents,
  hasKnownBranches,
  onConfirmParcel,
  onDeleteParcel
}: ParcelTimelineModalProps) {
  const { user } = useAuth();
  const role = normalizeRole(user?.role);
  const canConfirmParcel = role === 'ADMIN' || role === 'MESSENGER';

  if (!selectedParcel) return null;

  // Use derived status so forwarded parcels show correctly
  const derivedParcel = applyDerivedStatus(selectedParcel);
  const isActuallyDelivered = derivedParcel['สถานะ'] === 'ส่งถึงแล้ว';

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="w-full max-w-[92vw] sm:max-w-3xl max-h-[88vh] overflow-hidden p-0 rounded-2xl border-none shadow-2xl" showCloseButton={false}>
        <div className="flex flex-col max-h-[88vh]">
          <DialogHeader className="shrink-0 p-4 sm:p-5 text-white"
            style={{ background: 'linear-gradient(135deg, #0d1f3c 0%, #091426 100%)' }}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-base sm:text-lg font-black font-display text-white leading-tight">เส้นทางการจัดส่ง</DialogTitle>
                <DialogDescription className="mt-1 min-w-0 text-xs leading-tight text-white/55">
                  หมายเลขติดตาม: <code className="font-mono text-white/80 font-bold break-all">{selectedParcel.TrackingID}</code>
                </DialogDescription>
              </div>
              <div className="flex shrink-0 items-center justify-end gap-2">
                {canConfirmParcel && !isActuallyDelivered && (
                  <button
                    onClick={() => { setIsOpen(false); onConfirmParcel(selectedParcel.TrackingID); }}
                    className="hidden items-center gap-1.5 px-3 py-2 bg-secondary text-primary rounded-xl font-display font-bold text-xs hover:opacity-90 active:scale-95 transition-all sm:flex"
                  >
                    <span className="material-symbols-outlined text-base">local_shipping</span>
                    ส่งพัสดุ
                  </button>
                )}
                <button onClick={() => setIsOpen(false)}
                  className="p-1.5 bg-white/10 rounded-xl hover:bg-white/20 transition-colors">
                  <span className="material-symbols-outlined text-white text-lg">close</span>
                </button>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 sm:justify-start">
              <StatusBadge status={selectedParcel['สถานะ']} />
              {canConfirmParcel && !isActuallyDelivered && (
                <button
                  onClick={() => { setIsOpen(false); onConfirmParcel(selectedParcel.TrackingID); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary text-primary rounded-xl font-display font-bold text-xs hover:opacity-90 active:scale-95 transition-all sm:hidden"
                >
                  <span className="material-symbols-outlined text-base">local_shipping</span>
                  ส่งพัสดุ
                </button>
              )}
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-3 sm:p-4 bg-background">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <p className="text-[10px] font-black text-on-surface-variant/40 uppercase tracking-[0.16em] mb-2 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">history</span>
                  ไทม์ไลน์การจัดส่ง
                </p>
                <Timeline events={selectedTimelineEvents} compact />
              </div>
              <div className="space-y-3">
                {hasKnownBranches ? (
                  <div className="rounded-2xl overflow-hidden border border-outline-variant/30 shadow-sm">
                    <TrackingMap events={selectedTimelineEvents} />
                  </div>
                ) : (
                  <div className="rounded-2xl border border-outline-variant/30 shadow-sm h-[150px] sm:h-[180px] bg-surface-container-lowest flex flex-col items-center justify-center p-4 text-center">
                    <span className="material-symbols-outlined text-3xl text-on-surface-variant/30 mb-2">map_off</span>
                    <p className="text-sm font-bold text-on-surface-variant">ยังไม่มีพิกัด GPS</p>
                    <p className="text-xs text-on-surface-variant/60 mt-1">แผนที่จะแสดงเมื่อมีการบันทึกตำแหน่งจากการสร้างหรือยืนยันรับพัสดุ</p>
                  </div>
                )}
                <div className="bg-white rounded-2xl p-3 sm:p-4 border border-outline-variant/30 shadow-sm">
                  <p className="text-[10px] font-black text-on-surface-variant/40 uppercase tracking-[0.16em] mb-3 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm">info</span>
                    รายละเอียดพัสดุ
                  </p>
                  <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                    {[
                      { label: 'ประเภท', value: selectedParcel['ประเภทเอกสาร'] },
                      { label: 'สถานะ', value: selectedParcel['สถานะ'] },
                      { label: 'ต้นทาง', value: selectedParcel['สาขาผู้ส่ง'] },
                      { label: 'ปลายทาง', value: selectedParcel['สาขาผู้รับ'] },
                    ].map(({ label, value }) => (
                      <div key={label} className="space-y-0.5">
                        <p className="text-[10px] font-bold text-on-surface-variant/50 uppercase tracking-wider">{label}</p>
                        <p className="break-words font-bold text-primary text-sm leading-tight">{value}</p>
                      </div>
                    ))}
                  </div>
                  {selectedParcel['รายละเอียด'] && (
                    <div className="mt-3 pt-3 border-t border-outline-variant/10">
                      <p className="text-[10px] font-bold text-on-surface-variant/50 uppercase tracking-wider mb-1.5">รายละเอียด</p>
                      <p className="text-sm text-primary font-medium leading-snug bg-surface-container-low/50 rounded-xl p-2.5 border border-outline-variant/20">
                        {selectedParcel['รายละเอียด']}
                      </p>
                    </div>
                  )}
                  {role === 'ADMIN' && (
                    <div className="mt-3 pt-3 border-t border-outline-variant/10 flex gap-3">
                      <button
                        onClick={onDeleteParcel}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-error/10 text-error font-bold py-2 rounded-xl hover:bg-error hover:text-white transition-colors text-sm"
                      >
                        <span className="material-symbols-outlined text-base">delete</span>
                        ลบรายการนี้
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
