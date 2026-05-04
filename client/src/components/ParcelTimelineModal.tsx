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
      <DialogContent className="w-full max-w-[92vw] sm:max-w-4xl max-h-[90vh] overflow-hidden p-0 rounded-3xl border-none shadow-2xl">
        <div className="flex flex-col max-h-[90vh]">
          <DialogHeader className="shrink-0 p-5 sm:p-6 text-white"
            style={{ background: 'linear-gradient(135deg, #0d1f3c 0%, #091426 100%)' }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <DialogTitle className="text-lg sm:text-xl font-black font-display text-white">เส้นทางการจัดส่ง</DialogTitle>
                <DialogDescription className="text-white/50 mt-1 text-xs">
                  หมายเลขติดตาม: <code className="font-mono text-white/80 font-bold">{selectedParcel.TrackingID}</code>
                </DialogDescription>
                <div className="flex items-center gap-2 mt-2">
                  <StatusBadge status={selectedParcel['สถานะ']} />
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {canConfirmParcel && !isActuallyDelivered && (
                  <button
                    onClick={() => { setIsOpen(false); onConfirmParcel(selectedParcel.TrackingID); }}
                    className="flex items-center gap-1.5 px-3 py-2 bg-secondary text-primary rounded-xl font-display font-bold text-xs hover:opacity-90 active:scale-95 transition-all"
                  >
                    <span className="material-symbols-outlined text-base">local_shipping</span>
                    ส่งพัสดุ
                  </button>
                )}
                <button onClick={() => setIsOpen(false)}
                  className="p-2 bg-white/10 rounded-xl hover:bg-white/20 transition-colors">
                  <span className="material-symbols-outlined text-white text-xl">close</span>
                </button>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-background">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
              <div>
                <p className="text-[10px] font-black text-on-surface-variant/40 uppercase tracking-[0.2em] mb-4 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">history</span>
                  ไทม์ไลน์การจัดส่ง
                </p>
                <Timeline events={selectedTimelineEvents} />
              </div>
              <div className="space-y-4">
                {hasKnownBranches ? (
                  <div className="rounded-2xl overflow-hidden border border-outline-variant/30 shadow-sm">
                    <TrackingMap events={selectedTimelineEvents} />
                  </div>
                ) : (
                  <div className="rounded-2xl border border-outline-variant/30 shadow-sm h-[220px] sm:h-[260px] bg-surface-container-lowest flex flex-col items-center justify-center p-6 text-center">
                    <span className="material-symbols-outlined text-4xl text-on-surface-variant/30 mb-3">map_off</span>
                    <p className="text-sm font-bold text-on-surface-variant">ไม่สามารถแสดงแผนที่ได้</p>
                    <p className="text-xs text-on-surface-variant/60 mt-1">สาขาที่ระบุไม่มีพิกัดในระบบ</p>
                  </div>
                )}
                <div className="bg-white rounded-2xl p-4 sm:p-5 border border-outline-variant/30 shadow-sm">
                  <p className="text-[10px] font-black text-on-surface-variant/40 uppercase tracking-[0.2em] mb-4 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm">info</span>
                    รายละเอียดพัสดุ
                  </p>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {[
                      { label: 'ประเภท', value: selectedParcel['ประเภทเอกสาร'] },
                      { label: 'สถานะ', value: selectedParcel['สถานะ'] },
                      { label: 'ต้นทาง', value: selectedParcel['สาขาผู้ส่ง'] },
                      { label: 'ปลายทาง', value: selectedParcel['สาขาผู้รับ'] },
                    ].map(({ label, value }) => (
                      <div key={label} className="space-y-0.5">
                        <p className="text-[10px] font-bold text-on-surface-variant/50 uppercase tracking-wider">{label}</p>
                        <p className="font-bold text-primary text-sm leading-tight">{value}</p>
                      </div>
                    ))}
                  </div>
                  {selectedParcel['รายละเอียด'] && (
                    <div className="mt-4 pt-4 border-t border-outline-variant/10">
                      <p className="text-[10px] font-bold text-on-surface-variant/50 uppercase tracking-wider mb-1.5">รายละเอียด</p>
                      <p className="text-sm text-primary font-medium leading-relaxed bg-surface-container-low/50 rounded-xl p-3 border border-outline-variant/20">
                        {selectedParcel['รายละเอียด']}
                      </p>
                    </div>
                  )}
                  {role === 'ADMIN' && (
                    <div className="mt-4 pt-4 border-t border-outline-variant/10 flex gap-3">
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
