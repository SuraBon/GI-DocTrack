/**
 * Confirm Receipt Page
 * ยืนยันการรับพัสดุด้วยรูปภาพ
 * Design: Premium Stepper UI
 */

import { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useParcelStore } from '@/hooks/useParcelStore';
import PinInput from '@/components/PinInput';
import { getBranches, getParcel } from '@/lib/parcelService';
import { formatThaiDateTime } from '@/lib/dateUtils';
import { toast } from 'sonner';
import type { Parcel } from '@/types/parcel';
import { useGeolocation } from '@/hooks/useGeolocation';
import { MapView } from '@/components/Map';

const OTHER_BRANCH_VALUE = '__OTHER_BRANCH__';

/** Rendered outside the main component so it never remounts on state changes. */
function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center mb-8 sm:mb-10">
      {[1, 2, 3].map((step) => (
        <div key={step} className="flex items-center">
          <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all duration-500 font-display font-bold text-base sm:text-lg ${
            currentStep === step
              ? 'bg-primary text-white shadow-xl shadow-primary/20 scale-110'
              : currentStep > step
                ? 'bg-green-500 text-white'
                : 'bg-surface-container text-on-surface-variant/40'
          }`}>
            {currentStep > step
              ? <span className="material-symbols-outlined text-xl sm:text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              : step}
          </div>
          {step < 3 && (
            <div className="w-8 sm:w-12 h-1 mx-1 sm:mx-2 rounded-full overflow-hidden bg-surface-container">
              <div className={`h-full bg-green-500 transition-all duration-500 ${currentStep > step ? 'w-full' : 'w-0'}`} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function ConfirmReceipt({
  initialTrackingId,
  onInitialTrackingIdConsumed,
}: {
  initialTrackingId?: string | null;
  onInitialTrackingIdConsumed?: () => void;
}) {
  const { confirmReceipt, updateParcelLocally, loadParcels } = useParcelStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const branches = getBranches();

  // Steps: 1 (Check), 2 (Photo), 3 (Confirm)
  const [currentStep, setCurrentStep] = useState(1);
  const [trackingId, setTrackingId] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [pin, setPin] = useState('');

  const { position, status: geoStatus, errorMessage: geoError, requestLocation, reset: resetGeo } = useGeolocation();

  const [isForwarding, setIsForwarding] = useState(false);
  const [forwardSender, setForwardSender] = useState('');
  const [forwardFromBranch, setForwardFromBranch] = useState('');
  const [forwardToBranch, setForwardToBranch] = useState('');
  const [isProxy, setIsProxy] = useState(false);
  const [proxyName, setProxyName] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [checkedParcel, setCheckedParcel] = useState<Parcel | null>(null);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);

  const [customForwardFromBranch, setCustomForwardFromBranch] = useState('');
  const [customForwardToBranch, setCustomForwardToBranch] = useState('');
  const [isDelivered, setIsDelivered] = useState(false);

  // Auto-fill tracking ID เมื่อถูก navigate มาจาก Dashboard
  // Reset state ทั้งหมดก่อนเพื่อไม่ให้ค้างจากรายการก่อนหน้า
  useEffect(() => {
    if (!initialTrackingId) return;

    // Reset ทุก state กลับ default
    setCurrentStep(1);
    setTrackingId(initialTrackingId);
    setPhotoUrl('');
    setPhotoPreview(null);
    setNote('');
    setIsForwarding(false);
    setForwardSender('');
    setForwardFromBranch('');
    setForwardToBranch('');
    setCustomForwardFromBranch('');
    setCustomForwardToBranch('');
    setIsProxy(false);
    setProxyName('');
    setCheckedParcel(null);
    setIsDelivered(false);
    setIsConfirmDialogOpen(false);
    resetGeo();
    if (fileInputRef.current) fileInputRef.current.value = '';

    onInitialTrackingIdConsumed?.();
  }, [initialTrackingId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCheckParcel = async () => {
    if (!trackingId.trim()) {
      toast.error('กรุณากรอกหมายเลขติดตามก่อนตรวจสอบ');
      return;
    }

    setIsChecking(true);
    try {
      const res = await getParcel(trackingId.trim());
      if (res.success && res.parcel) {
        const p = res.parcel;

        let currentBranch = p['สาขาผู้ส่ง'];
        const parcelNote = p['หมายเหตุ'] || '';
        const forwardRegex = /\[ส่งต่อโดย:\s*(.*?)\s*จากสาขา:\s*(.*?)\s*ไปสาขา:\s*(.*?)\s*เมื่อ:\s*(.*?)\]/g;
        let match;
        while ((match = forwardRegex.exec(parcelNote)) !== null) {
          currentBranch = match[3];
        }

        setForwardFromBranch(branches.includes(currentBranch) ? currentBranch : OTHER_BRANCH_VALUE);
        if (!branches.includes(currentBranch)) {
          setCustomForwardFromBranch(currentBranch);
        }

        setCheckedParcel(p);

        const currentStatus = p['สถานะ'];
        const noteStr = String(p['หมายเหตุ'] || "");
        let actuallyDelivered = currentStatus === "ส่งถึงแล้ว";
        if (actuallyDelivered) {
          const maxIdx = Math.max(
            noteStr.lastIndexOf('[ส่งต่อโดย:'),
            noteStr.lastIndexOf('[รับแทนโดย:'),
            noteStr.lastIndexOf('[รับพัสดุเรียบร้อย')
          );
          if (maxIdx >= 0 && maxIdx === noteStr.lastIndexOf('[ส่งต่อโดย:')) {
            actuallyDelivered = false;
          }
        }
        setIsDelivered(actuallyDelivered);

        if (actuallyDelivered) {
          toast.warning(`พัสดุนี้ถูกจัดส่งถึงที่หมายเรียบร้อยแล้ว`);
        } else {
          toast.success(`พบข้อมูลพัสดุ ปลายทาง: ${p['สาขาผู้รับ']}`);
          setCurrentStep(2); // Auto move to photo step
          requestLocation(); // Request GPS automatically on step 2
        }
      } else {
        toast.error('ไม่พบข้อมูลพัสดุ หรือหมายเลขติดตามไม่ถูกต้อง');
      }
    } catch {
      toast.error('เกิดข้อผิดพลาดในการตรวจสอบ');
    } finally {
      setIsChecking(false);
    }
  };

  const handlePasteTrackingID = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setTrackingId(text.trim().toUpperCase());
        toast.success('วางหมายเลขติดตามเรียบร้อย');
      }
    } catch {
      toast.error('ไม่สามารถวางข้อมูลได้');
    }
  };

  const processImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('กรุณาเลือกไฟล์รูปภาพ');
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => {
      toast.error('ไม่สามารถอ่านไฟล์ได้ กรุณาลองใหม่');
    };
    reader.onload = (event) => {
      const img = new Image();
      img.onerror = () => {
        toast.error('ไม่สามารถโหลดรูปภาพได้ กรุณาเลือกไฟล์อื่น');
      };
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 1200;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height = Math.round((height * MAX_WIDTH) / width);
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width = Math.round((width * MAX_HEIGHT) / height);
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
            setPhotoPreview(compressedDataUrl);
            setPhotoUrl(compressedDataUrl);
            toast.success('เลือกรูปภาพสำเร็จ');
          } else {
            toast.error('ไม่สามารถประมวลผลรูปภาพได้');
          }
        } catch {
          toast.error('เกิดข้อผิดพลาดในการประมวลผลรูปภาพ');
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImageFile(file);
  };

  const executeConfirm = async () => {
    setIsConfirmDialogOpen(false);
    setIsLoading(true);
    try {
      let eventType: 'FORWARD' | 'PROXY' | 'DELIVERED' | undefined;
      let eventLocation: string | undefined;
      let eventDestLocation: string | undefined;
      let eventPerson: string | undefined;

      const finalForwardFromBranch = forwardFromBranch === OTHER_BRANCH_VALUE ? customForwardFromBranch.trim() : forwardFromBranch.trim();
      const finalForwardToBranch = forwardToBranch === OTHER_BRANCH_VALUE ? customForwardToBranch.trim() : forwardToBranch.trim();

      if (isForwarding && finalForwardToBranch) {
        eventType = 'FORWARD';
        eventLocation = finalForwardFromBranch;
        eventDestLocation = finalForwardToBranch;
        eventPerson = forwardSender;
      } else if (isProxy && proxyName) {
        eventType = 'PROXY';
        eventLocation = checkedParcel?.['สาขาผู้รับ'];
        eventPerson = proxyName;
      } else if (!isForwarding && !isProxy) {
        eventType = 'DELIVERED';
        eventLocation = checkedParcel?.['สาขาผู้รับ'];
        eventPerson = checkedParcel?.['ผู้รับ'];
      }

      const finalTrackingId = trackingId;
      const finalEventType = eventType;
      
      // Optimistic Update
      const newStatus = isForwarding ? 'กำลังจัดส่ง' : 'ส่งถึงแล้ว';
      if (typeof updateParcelLocally === 'function') {
        updateParcelLocally(finalTrackingId, { 'สถานะ': newStatus });
      }

      toast.success('กำลังบันทึกข้อมูล...');
      
      const response = await confirmReceipt(
        finalTrackingId,
        photoUrl,
        note,
        position?.latitude,
        position?.longitude,
        finalEventType,
        eventLocation,
        eventDestLocation,
        eventPerson,
        pin
      );
      
      if (response && response.success) {
        toast.success('บันทึกข้อมูลเรียบร้อยแล้ว');
        // Reset all state
        setCurrentStep(1);
        setTrackingId('');
        setPhotoUrl('');
        setPhotoPreview(null);
        setNote('');
        setIsForwarding(false);
        setForwardSender('');
        setForwardFromBranch('');
        setForwardToBranch('');
        setCustomForwardFromBranch('');
        setCustomForwardToBranch('');
        setIsProxy(false);
        setProxyName('');
        setCheckedParcel(null);
        setIsDelivered(false);
        resetGeo();
      } else {
        toast.error(response?.error ? `เกิดข้อผิดพลาด: ${response.error}` : 'ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่');
        // Revert local update
        if (typeof loadParcels === 'function') loadParcels(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header Section */}
      <div className="text-center space-y-2 mb-8 sm:mb-10">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-primary tracking-tight">ยืนยันรับพัสดุ</h1>
        <p className="text-xs sm:text-sm text-on-surface-variant">ทำตามขั้นตอนเพื่อยืนยันการรับหรือส่งต่อพัสดุผ่านระบบ LogiTrack</p>
      </div>

      <StepIndicator currentStep={currentStep} />

      {isLoading && createPortal(
        <div className="fixed inset-0 bg-white/60 backdrop-blur-sm z-[100] flex flex-col items-center justify-center animate-in fade-in duration-300">
          <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-5xl text-primary animate-spin">progress_activity</span>
          </div>
          <p className="text-lg font-bold text-primary font-display">กำลังบันทึกข้อมูล...</p>
          <p className="text-on-surface-variant text-sm">กรุณารอสักครู่ ระบบกำลังประมวลผล</p>
        </div>,
        document.body
      )}

      {/* Step 1: Check Tracking ID */}
      {currentStep === 1 && (
        <div className="bg-white border border-outline-variant rounded-3xl overflow-hidden shadow-xl animate-in slide-in-from-right-4 duration-500">
          <div className="bg-surface-container-low/30 p-5 sm:p-8 border-b border-outline-variant/10 text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4 text-primary">
              <span className="material-symbols-outlined text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>search</span>
            </div>
            <h2 className="font-display text-xl font-bold text-primary">ระบุหมายเลขติดตาม</h2>
            <p className="text-xs text-on-surface-variant uppercase font-bold tracking-widest mt-1">กรอกเลขที่พัสดุเพื่อเริ่มต้นทำรายการ</p>
          </div>
          <div className="p-5 sm:p-8 space-y-6">
            <div className="space-y-4">
              <div className="relative group">
                <input
                  placeholder="เช่น TRK20260420001"
                  value={trackingId}
                  onChange={(e) => setTrackingId(e.target.value.toUpperCase())}
                  className="w-full h-14 sm:h-16 text-xl sm:text-2xl font-mono tracking-[0.2em] pl-6 pr-14 rounded-2xl border-2 border-outline-variant focus:border-primary focus:ring-4 focus:ring-primary/5 outline-none transition-all text-primary placeholder:text-outline-variant placeholder:font-sans placeholder:text-base sm:placeholder:text-lg placeholder:tracking-normal"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handlePasteTrackingID}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-xl text-on-surface-variant hover:text-primary hover:bg-surface-container transition-all"
                  title="วางจากคลิปบอร์ด"
                >
                  <span className="material-symbols-outlined text-2xl">content_paste</span>
                </button>
              </div>

              {checkedParcel && isDelivered && (
                <div className="p-4 bg-error-container/30 border border-error/10 rounded-2xl text-error text-sm flex items-start gap-3 animate-in shake duration-300">
                  <span className="material-symbols-outlined text-xl">block</span>
                  <div>
                    <p className="font-bold">พัสดุนี้ถูกจัดส่งถึงที่หมายแล้ว</p>
                    <p className="opacity-80">ไม่สามารถยืนยันซ้ำได้ กรุณาตรวจสอบ ID อีกครั้ง</p>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleCheckParcel}
              disabled={isChecking || !trackingId || isDelivered}
              className="w-full group flex items-center justify-center gap-3 h-16 bg-primary text-white rounded-2xl font-display font-bold text-lg shadow-lg shadow-primary/20 hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
            >
              {isChecking ? (
                <>
                  <span className="material-symbols-outlined animate-spin">progress_activity</span>
                  กำลังตรวจสอบ...
                </>
              ) : (
                <>
                  ตรวจสอบข้อมูลพัสดุ
                  <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Photo Evidence */}
      {currentStep === 2 && (
        <div className="bg-white border border-outline-variant rounded-3xl overflow-hidden shadow-xl animate-in slide-in-from-right-4 duration-500">
          <div className="bg-surface-container-low/30 p-5 sm:p-8 border-b border-outline-variant/10 text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4 text-primary">
              <span className="material-symbols-outlined text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>photo_camera</span>
            </div>
            <h2 className="font-display text-xl font-bold text-primary">ถ่ายรูปหลักฐาน</h2>
            <p className="text-xs text-on-surface-variant uppercase font-bold tracking-widest mt-1">อัปโหลดรูปภาพพัสดุหรือหลักฐานการรับ</p>
          </div>
          <div className="p-5 sm:p-8 space-y-6">
            {!photoPreview ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-outline-variant rounded-3xl p-8 sm:p-12 text-center cursor-pointer hover:border-primary hover:bg-surface-container-lowest transition-all group relative overflow-hidden"
              >
                {/* hidden file input — no capture so desktop gets file picker, mobile gets both options */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <div className="w-20 h-20 bg-surface-container rounded-3xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 group-hover:bg-primary/5 transition-all">
                  <span className="material-symbols-outlined text-4xl text-on-surface-variant group-hover:text-primary transition-colors">add_a_photo</span>
                </div>
                <p className="text-lg font-bold text-primary font-display">คลิกเพื่อเปิดกล้อง / เลือกรูป</p>
                <p className="text-on-surface-variant mt-2 text-sm">ระบบจะบีบอัดรูปภาพให้อัตโนมัติเพื่อประหยัดพื้นที่</p>
              </div>
            ) : (
              <div className="relative rounded-3xl overflow-hidden border border-outline-variant shadow-inner group aspect-video bg-surface-container-lowest">
                <img src={photoPreview} alt="Preview" className="w-full h-full object-contain" />
                <div className="absolute inset-0 bg-primary/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-4 backdrop-blur-[2px]">
                  <button
                    className="flex items-center gap-2 px-6 py-2.5 bg-white text-primary rounded-xl font-bold active:scale-95 transition-all shadow-lg hover:bg-primary hover:text-white"
                    onClick={() => {
                      setPhotoPreview(null);
                      setPhotoUrl('');
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                  >
                    <span className="material-symbols-outlined">restart_alt</span>
                    ถ่ายใหม่
                  </button>
                  <p className="text-white font-medium text-sm flex items-center gap-2">
                    <span className="material-symbols-outlined text-lg">zoom_out_map</span>
                    แสดงภาพเต็ม
                  </p>
                </div>
              </div>
            )}

            {/* GPS Status Indicator */}
            <div className={`p-4 rounded-2xl flex items-start gap-3 border ${
              geoStatus === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
              geoStatus === 'error' || geoStatus === 'denied' ? 'bg-error-container/30 border-error/20 text-error' :
              'bg-surface-container-low border-outline-variant text-on-surface-variant'
            }`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                geoStatus === 'success' ? 'bg-green-100 text-green-700' :
                geoStatus === 'error' || geoStatus === 'denied' ? 'bg-error-container text-error' :
                'bg-surface-container text-on-surface-variant'
              }`}>
                <span className={`material-symbols-outlined text-lg ${geoStatus === 'loading' ? 'animate-spin' : ''}`}>
                  {geoStatus === 'success' ? 'my_location' :
                   geoStatus === 'loading' ? 'progress_activity' :
                   geoStatus === 'error' || geoStatus === 'denied' ? 'location_disabled' : 'location_searching'}
                </span>
              </div>
              <div className="flex-1">
                <p className="font-bold text-sm">
                  {geoStatus === 'success' ? 'ดึงพิกัด GPS สำเร็จ' :
                   geoStatus === 'loading' ? 'กำลังดึงพิกัด GPS...' :
                   geoStatus === 'denied' ? 'ไม่ได้รับอนุญาตให้เข้าถึง GPS' :
                   geoStatus === 'error' ? 'ไม่สามารถดึงพิกัด GPS ได้' : 'รอการดึงพิกัด GPS'}
                </p>
                <p className="text-xs mt-0.5 opacity-80">
                  {geoStatus === 'success' && position ? `${position.latitude.toFixed(6)}, ${position.longitude.toFixed(6)} (ความแม่นยำ ~${Math.round(position.accuracy)}m)` :
                   geoError ? geoError :
                   'ระบบต้องการพิกัด GPS ในการยืนยันพัสดุ'}
                </p>
                {(geoStatus === 'error' || geoStatus === 'denied') && (
                  <button
                    onClick={requestLocation}
                    className="mt-2 text-xs font-bold underline underline-offset-2 hover:opacity-80"
                  >
                    ลองใหม่อีกครั้ง
                  </button>
                )}
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => {
                  setCurrentStep(1);
                  // reset photo state เมื่อย้อนกลับ
                  setPhotoPreview(null);
                  setPhotoUrl('');
                  resetGeo();
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="flex items-center justify-center gap-2 h-14 flex-1 rounded-2xl font-display font-bold border-2 border-outline-variant text-on-surface-variant hover:bg-surface-container transition-colors"
              >
                <span className="material-symbols-outlined">arrow_back</span>
                ย้อนกลับ
              </button>
              <button
                onClick={() => setCurrentStep(3)}
                disabled={!photoPreview || geoStatus !== 'success'}
                title={geoStatus !== 'success' ? "กรุณาเปิดใช้งาน GPS ก่อน" : ""}
                className="flex items-center justify-center gap-2 h-14 flex-[2] bg-primary text-white rounded-2xl font-display font-bold shadow-lg shadow-primary/20 hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
              >
                ขั้นตอนถัดไป
                <span className="material-symbols-outlined">arrow_forward</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Final Details & Confirm */}
      {currentStep === 3 && (
        <div className="bg-white border border-outline-variant rounded-3xl overflow-hidden shadow-xl animate-in slide-in-from-right-4 duration-500">
          <div className="bg-surface-container-low/30 p-5 sm:p-8 border-b border-outline-variant/10 text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4 text-primary">
              <span className="material-symbols-outlined text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>fact_check</span>
            </div>
            <h2 className="font-display text-xl font-bold text-primary">ข้อมูลเพิ่มเติมและยืนยัน</h2>
            <p className="text-xs text-on-surface-variant uppercase font-bold tracking-widest mt-1">ระบุรายละเอียดการรับพัสดุให้ครบถ้วน</p>
          </div>
          <div className="p-5 sm:p-8 space-y-6 sm:space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-surface-container-lowest border border-outline-variant p-5 rounded-2xl text-sm">
              <div className="flex items-center gap-3 text-on-surface-variant">
                <span className="material-symbols-outlined text-primary text-xl">barcode_scanner</span>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-wider opacity-60 leading-none">หมายเลขติดตาม</span>
                  <span className="font-mono font-bold text-primary text-base leading-tight">{trackingId}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 text-on-surface-variant">
                <span className="material-symbols-outlined text-primary text-xl">person</span>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-wider opacity-60 leading-none">ชื่อผู้รับต้นฉบับ</span>
                  <span className="font-bold text-primary text-base leading-tight">{checkedParcel?.['ผู้รับ']}</span>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-4">
                <div className={`p-5 rounded-2xl border-2 transition-all duration-300 ${isForwarding ? 'bg-secondary-fixed/10 border-secondary-container' : 'bg-white border-outline-variant/30 hover:border-outline-variant'}`}>
                  <div className="flex items-center justify-between cursor-pointer group" onClick={() => { setIsForwarding(!isForwarding); if (!isForwarding) setIsProxy(false); }}>
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${isForwarding ? 'bg-secondary text-white' : 'bg-surface-container text-on-surface-variant'}`}>
                        <span className="material-symbols-outlined text-2xl">fork_right</span>
                      </div>
                      <div>
                        <p className="font-display font-bold text-primary">ส่งต่อพัสดุ</p>
                        <p className="text-[11px] text-on-surface-variant opacity-60">ส่งพัสดุต่อให้พนักงานคนอื่นหรือรถเที่ยวถัดไป</p>
                      </div>
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isForwarding ? 'border-secondary bg-secondary' : 'border-outline-variant group-hover:border-primary'}`}>
                      {isForwarding && <span className="material-symbols-outlined text-white text-base">check</span>}
                    </div>
                  </div>
                  {isForwarding && (
                    <div className="mt-5 space-y-4 animate-in slide-in-from-top-2 duration-300">
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 text-lg">person</span>
                        <input
                          placeholder="ระบุชื่อพนักงานที่ส่งต่อ"
                          value={forwardSender}
                          onChange={(e) => setForwardSender(e.target.value)}
                          className="w-full bg-white border border-outline-variant rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-1 focus:ring-secondary outline-none font-display"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <div className="relative">
                            <select
                              value={forwardFromBranch}
                              onChange={(e) => setForwardFromBranch(e.target.value)}
                              className="w-full bg-white border border-outline-variant rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-1 focus:ring-secondary outline-none font-display appearance-none"
                            >
                              <option value="" disabled>จากสาขา</option>
                              {branches.map(b => <option key={b} value={b}>{b}</option>)}
                              <option value={OTHER_BRANCH_VALUE}>อื่นๆ</option>
                            </select>
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 text-lg">flight_takeoff</span>
                          </div>
                          {forwardFromBranch === OTHER_BRANCH_VALUE && (
                            <input
                              placeholder="ระบุชื่อสาขาต้นทาง"
                              value={customForwardFromBranch}
                              onChange={(e) => setCustomForwardFromBranch(e.target.value)}
                              maxLength={100}
                              className="w-full bg-white border border-outline-variant rounded-xl px-4 py-2.5 text-sm focus:ring-1 focus:ring-secondary outline-none font-display animate-in slide-in-from-top-2 duration-200"
                            />
                          )}
                        </div>
                        <div className="space-y-2">
                          <div className="relative">
                            <select
                              value={forwardToBranch}
                              onChange={(e) => setForwardToBranch(e.target.value)}
                              className="w-full bg-white border border-outline-variant rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-1 focus:ring-secondary outline-none font-display appearance-none"
                            >
                              <option value="" disabled>ไปสาขา</option>
                              {branches.map(b => <option key={b} value={b}>{b}</option>)}
                              <option value={OTHER_BRANCH_VALUE}>อื่นๆ</option>
                            </select>
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 text-lg">flight_land</span>
                          </div>
                          {forwardToBranch === OTHER_BRANCH_VALUE && (
                            <input
                              placeholder="ระบุชื่อสาขาปลายทาง"
                              value={customForwardToBranch}
                              onChange={(e) => setCustomForwardToBranch(e.target.value)}
                              maxLength={100}
                              className="w-full bg-white border border-outline-variant rounded-xl px-4 py-2.5 text-sm focus:ring-1 focus:ring-secondary outline-none font-display animate-in slide-in-from-top-2 duration-200"
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className={`p-5 rounded-2xl border-2 transition-all duration-300 ${isProxy ? 'bg-blue-50 border-blue-500' : 'bg-white border-outline-variant/30 hover:border-outline-variant'}`}>
                  <div className="flex items-center justify-between cursor-pointer group" onClick={() => { setIsProxy(!isProxy); if (!isProxy) setIsForwarding(false); }}>
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${isProxy ? 'bg-blue-600 text-white' : 'bg-surface-container text-on-surface-variant'}`}>
                        <span className="material-symbols-outlined text-2xl">account_circle</span>
                      </div>
                      <div>
                        <p className="font-display font-bold text-primary">มีผู้รับแทน</p>
                        <p className="text-[11px] text-on-surface-variant opacity-60">กรณีบุคคลอื่นรับแทนผู้รับตัวจริง</p>
                      </div>
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isProxy ? 'border-blue-600 bg-blue-600' : 'border-outline-variant group-hover:border-primary'}`}>
                      {isProxy && <span className="material-symbols-outlined text-white text-base">check</span>}
                    </div>
                  </div>
                  {isProxy && (
                    <div className="mt-5 animate-in slide-in-from-top-2 duration-300">
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 text-lg">person</span>
                        <input
                          placeholder="ระบุชื่อผู้รับแทน"
                          value={proxyName}
                          onChange={(e) => setProxyName(e.target.value)}
                          className="w-full bg-white border border-outline-variant rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-1 focus:ring-blue-500 outline-none font-display"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-widest px-1">หมายเหตุเพิ่มเติม (ไม่บังคับ)</label>
                <textarea
                  placeholder="เช่น กล่องบุบนิดหน่อย, วางไว้ที่ป้อมยาม, ฝากไว้ที่เคาน์เตอร์..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full bg-white border border-outline-variant rounded-2xl px-4 py-3 text-sm focus:ring-1 focus:ring-primary outline-none font-display min-h-[100px] transition-all resize-none"
                />
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setCurrentStep(2)}
                className="flex items-center justify-center gap-2 h-14 flex-1 rounded-2xl font-display font-bold border-2 border-outline-variant text-on-surface-variant hover:bg-surface-container transition-colors"
              >
                ย้อนกลับ
              </button>
              <button
                onClick={() => setIsConfirmDialogOpen(true)}
                disabled={isLoading
                  || (isForwarding && (
                    !forwardSender.trim()
                    || !forwardToBranch
                    || (forwardToBranch === OTHER_BRANCH_VALUE && !customForwardToBranch.trim())
                    || (forwardFromBranch === OTHER_BRANCH_VALUE && !customForwardFromBranch.trim())
                  ))
                  || (isProxy && !proxyName.trim())}
                className="flex items-center justify-center gap-2 h-14 flex-[2] bg-green-600 text-white rounded-2xl font-display font-bold shadow-lg shadow-green-200 hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
              >
                ยืนยันทำรายการ
                <span className="material-symbols-outlined">verified</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <DialogContent showCloseButton={false} className="w-full max-w-[92vw] sm:max-w-2xl rounded-3xl p-0 border-none shadow-2xl bg-white overflow-hidden">
          {/* Header */}
          <div className={`px-6 pt-6 pb-5 flex items-center gap-4 ${
            isForwarding ? 'bg-gradient-to-br from-secondary/15 to-secondary/5' :
            isProxy ? 'bg-gradient-to-br from-blue-500/15 to-blue-500/5' :
            'bg-gradient-to-br from-green-500/15 to-green-500/5'
          }`}>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm ${
              isForwarding ? 'bg-secondary text-white' :
              isProxy ? 'bg-blue-600 text-white' :
              'bg-green-600 text-white'
            }`}>
              <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                {isForwarding ? 'fork_right' : isProxy ? 'account_circle' : 'check_circle'}
              </span>
            </div>
            <div className="flex-1">
              <DialogTitle className="text-lg font-black font-display text-primary leading-tight">
                {isForwarding ? 'ยืนยันส่งต่อพัสดุ' : isProxy ? 'ยืนยันรับแทน' : 'ยืนยันรับพัสดุ'}
              </DialogTitle>
              <p className="text-xs text-on-surface-variant mt-0.5">กรุณาตรวจสอบข้อมูลก่อนยืนยัน</p>
            </div>
            <button
              onClick={() => setIsConfirmDialogOpen(false)}
              className="p-2 rounded-xl text-on-surface-variant/50 hover:bg-black/5 transition-colors shrink-0"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-4">
            {/* Tracking ID row */}
            <div className="flex items-center justify-between bg-surface-container-lowest rounded-2xl px-4 py-3 border border-outline-variant/20">
              <div className="flex items-center gap-2 text-on-surface-variant">
                <span className="material-symbols-outlined text-base">barcode_scanner</span>
                <span className="text-xs font-bold uppercase tracking-wider">หมายเลขติดตาม</span>
              </div>
              <code className="font-mono font-black text-primary text-base tracking-wider">{trackingId}</code>
            </div>

            {/* Forwarding details */}
            {isForwarding && (
              <div className="bg-secondary/5 rounded-2xl p-4 border border-secondary/15 space-y-3">
                <div className="flex items-center gap-2 text-secondary">
                  <span className="material-symbols-outlined text-base">person</span>
                  <span className="text-xs font-bold">ผู้ส่งต่อ: <span className="text-primary">{forwardSender || '-'}</span></span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-white rounded-xl px-3 py-2 border border-outline-variant/20 text-center">
                    <p className="text-[9px] text-on-surface-variant/50 font-bold uppercase tracking-wider mb-0.5">จากสาขา</p>
                    <p className="text-sm font-black text-primary truncate">
                      {forwardFromBranch === OTHER_BRANCH_VALUE ? customForwardFromBranch : forwardFromBranch}
                    </p>
                  </div>
                  <span className="material-symbols-outlined text-outline-variant text-xl shrink-0">arrow_forward</span>
                  <div className="flex-1 bg-white rounded-xl px-3 py-2 border border-outline-variant/20 text-center">
                    <p className="text-[9px] text-on-surface-variant/50 font-bold uppercase tracking-wider mb-0.5">ไปสาขา</p>
                    <p className="text-sm font-black text-primary truncate">
                      {forwardToBranch === OTHER_BRANCH_VALUE ? customForwardToBranch : forwardToBranch}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Proxy details */}
            {isProxy && (
              <div className="bg-blue-50 rounded-2xl px-4 py-3 border border-blue-100 flex items-center gap-3">
                <span className="material-symbols-outlined text-blue-500 text-xl">how_to_reg</span>
                <div>
                  <p className="text-[10px] text-blue-600/70 font-bold uppercase tracking-wider">ผู้รับแทน</p>
                  <p className="font-bold text-blue-900 text-sm">{proxyName || '-'}</p>
                </div>
              </div>
            )}

            {/* Normal receipt */}
            {!isForwarding && !isProxy && (
              <div className="bg-green-50 rounded-2xl px-4 py-3 border border-green-100 flex items-center gap-3">
                <span className="material-symbols-outlined text-green-600 text-xl">verified_user</span>
                <div>
                  <p className="text-[10px] text-green-600/70 font-bold uppercase tracking-wider">ผู้รับ</p>
                  <p className="font-bold text-green-900 text-sm">{checkedParcel?.['ผู้รับ'] || '-'}</p>
                </div>
              </div>
            )}

            {/* Photo preview */}
            {photoPreview && (
              <div className="relative h-48 sm:h-56 rounded-2xl overflow-hidden border border-outline-variant/20 bg-surface-container-lowest group cursor-pointer transition-all hover:border-primary/50" onClick={() => {
                // If user wants to see popup, we can open it in a new window or just rely on object-contain
                const w = window.open();
                if(w) w.document.write(`<body style="margin:0;background:#000;display:flex;align-items:center;justify-content:center;height:100vh;"><img src="${photoPreview}" style="max-width:100%;max-height:100%;object-fit:contain;" /></body>`);
              }}>
                <img src={photoPreview} alt="หลักฐาน" className="w-full h-full object-contain" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                  <div className="flex items-center gap-2 bg-white/20 backdrop-blur-md px-4 py-2 rounded-xl text-white">
                    <span className="material-symbols-outlined">zoom_in</span>
                    <span className="text-sm font-bold tracking-wide">คลิกเพื่อดูภาพขยาย</span>
                  </div>
                </div>
                <div className="absolute bottom-3 left-3 flex items-center gap-1.5 text-white pointer-events-none">
                  <span className="material-symbols-outlined text-base shadow-sm">photo_camera</span>
                  <span className="text-xs font-bold uppercase tracking-wider drop-shadow-md">รูปหลักฐาน</span>
                </div>
              </div>
            )}

            {/* GPS Map Preview */}
            {position && (
              <div className="bg-surface-container-lowest rounded-2xl overflow-hidden border border-outline-variant/20">
                <div className="px-4 py-2 bg-surface-container-low/50 border-b border-outline-variant/20 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-on-surface-variant">
                    <span className="material-symbols-outlined text-sm text-green-600">my_location</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider">พิกัด GPS ที่บันทึก</span>
                  </div>
                  <span className="text-[10px] font-mono text-on-surface-variant/60">
                    {position.latitude.toFixed(6)}, {position.longitude.toFixed(6)}
                  </span>
                </div>
                <div className="h-32 w-full relative pointer-events-none">
                  <MapView 
                    className="w-full h-full" 
                    initialCenter={{ lat: position.latitude, lng: position.longitude }} 
                    initialZoom={16}
                    onMapReady={(map) => {
                      // disable interactions for simple preview
                      map.dragging.disable();
                      map.touchZoom.disable();
                      map.doubleClickZoom.disable();
                      map.scrollWheelZoom.disable();
                      map.boxZoom.disable();
                      map.keyboard.disable();
                      if (map.tap) map.tap.disable();
                      
                      const icon = L.divIcon({
                        className: 'custom-gps-marker',
                        html: `<div style="width:16px;height:16px;background:#16a34a;border:3px solid white;border-radius:50%;box-shadow:0 0 10px rgba(0,0,0,0.3);"></div>`,
                        iconSize: [16, 16],
                        iconAnchor: [8, 8]
                      });
                      L.marker([position.latitude, position.longitude], { icon }).addTo(map);
                    }}
                  />
                  <div className="absolute inset-0 shadow-[inset_0_0_20px_rgba(0,0,0,0.1)] z-[400] pointer-events-none" />
                </div>
              </div>
            )}

            {/* Note */}
            {note && (
              <div className="bg-surface-container-low rounded-2xl px-4 py-3 border border-outline-variant/20">
                <p className="text-[10px] text-on-surface-variant/50 font-bold uppercase tracking-wider mb-1">หมายเหตุ</p>
                <p className="text-sm text-on-surface italic">{note}</p>
              </div>
            )}

            <PinInput pin={pin} setPin={setPin} className="mt-2" />
          </div>

          {/* Footer */}
          <div className="px-6 pb-6 flex gap-3">
            <button
              onClick={() => setIsConfirmDialogOpen(false)}
              className="flex-1 h-12 rounded-2xl font-display font-bold border-2 border-outline-variant text-on-surface-variant hover:bg-surface-container transition-colors"
            >
              แก้ไข
            </button>
            <button
              onClick={executeConfirm}
              disabled={isLoading || pin.length < 4}
              className="flex-[2] flex items-center justify-center gap-2 h-12 bg-primary text-white rounded-2xl font-display font-bold shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
            >
              {isLoading ? (
                <span className="material-symbols-outlined animate-spin">progress_activity</span>
              ) : (
                <>
                  ยืนยันรายการ
                  <span className="material-symbols-outlined text-xl">verified</span>
                </>
              )}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
