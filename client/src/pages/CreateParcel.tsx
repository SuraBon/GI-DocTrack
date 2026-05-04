/**
 * Create Parcel Page
 * สร้างรายการพัสดุใหม่
 * Design: Premium Logistics
 */

import { useState, useEffect } from 'react';
import { useParcelStore } from '@/hooks/useParcelStore';
import { getBranches } from '@/lib/parcelService';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { formatThaiDateTime } from '@/lib/dateUtils';
import NativeSelect, { resolveSelectValue } from '@/components/NativeSelect';
import QRCode from 'qrcode';
import { sanitizeTextInput, validateRequiredText } from '@/lib/validation';
import { useGeolocation } from '@/hooks/useGeolocation';

const DOC_TYPES = ['เอกสาร', 'พัสดุ'];

type CreatedParcelDetails = {
  senderName: string;
  senderBranch: string;
  receiverName: string;
  receiverBranch: string;
  createdAt: string;
};

export default function CreateParcel() {
  const { createParcel } = useParcelStore();
  const branches = getBranches();
  const { position, status: geoStatus, errorMessage: geoError, requestLocation } = useGeolocation();

  const [formData, setFormData] = useState({
    senderName: '',
    senderBranch: '',
    receiverName: '',
    receiverBranch: '',
    docType: '',
    description: '',
    note: '',
  });

  const [createdTrackingId, setCreatedTrackingId] = useState<string | null>(null);
  const [createdParcelDetails, setCreatedParcelDetails] = useState<CreatedParcelDetails | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [isResultOpen, setIsResultOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Generate QR code locally whenever a new tracking ID is created
  useEffect(() => {
    if (!createdTrackingId) { setQrDataUrl(null); return; }
    QRCode.toDataURL(createdTrackingId, { width: 256, margin: 1 })
      .then(url => setQrDataUrl(url))
      .catch(() => setQrDataUrl(null));
  }, [createdTrackingId]);

  useEffect(() => {
    if (geoStatus === 'idle') requestLocation();
  }, [geoStatus, requestLocation]);

  useEffect(() => {
    if (!isLoading) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isLoading]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  /** Resolves the final submitted values, replacing OTHER_VALUE with custom inputs. */
  const getFinalValues = () => ({
    senderName:     sanitizeTextInput(formData.senderName, 200),
    senderBranch:   sanitizeTextInput(resolveSelectValue(formData.senderBranch), 100),
    receiverName:   sanitizeTextInput(formData.receiverName, 200),
    receiverBranch: sanitizeTextInput(resolveSelectValue(formData.receiverBranch), 100),
    docType:        sanitizeTextInput(resolveSelectValue(formData.docType), 100),
    description:    sanitizeTextInput(formData.description, 200),
    note:           sanitizeTextInput(formData.note, 2000),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = getFinalValues();

    // ✅ FIX: Proper validation with specific messages
    const validationError =
      validateRequiredText(v.senderName, 'ชื่อผู้ส่ง', 2, 200) ||
      validateRequiredText(v.senderBranch, 'สาขาผู้ส่ง', 1, 100) ||
      validateRequiredText(v.receiverName, 'ชื่อผู้รับ', 2, 200) ||
      validateRequiredText(v.receiverBranch, 'สาขาผู้รับ', 1, 100) ||
      validateRequiredText(v.docType, 'ประเภทพัสดุ', 1, 100) ||
      (v.description && validateRequiredText(v.description, 'รายละเอียด', 0, 200)) ||
      (v.note && validateRequiredText(v.note, 'หมายเหตุ', 0, 2000));
    if (validationError) {
      toast.error(validationError);
      return;
    }
    if (!position) {
      toast.error('กรุณาอนุญาต GPS เพื่อบันทึกจุดเริ่มต้นก่อนสร้างรายการ');
      if (geoStatus !== 'loading') requestLocation();
      return;
    }
    setIsConfirmOpen(true);
  };

  const handleConfirmSubmit = async () => {
    if (isLoading) return;
    if (!position) {
      toast.error('กรุณาอนุญาต GPS เพื่อบันทึกจุดเริ่มต้นก่อนสร้างรายการ');
      if (geoStatus !== 'loading') requestLocation();
      return;
    }
    setIsConfirmOpen(false);
    setIsLoading(true);
    const v = getFinalValues();
    try {
      const result = await createParcel(
        v.senderName, v.senderBranch,
        v.receiverName, v.receiverBranch,
        v.docType, v.description, v.note,
        position.latitude,
        position.longitude,
      );
      if (result.trackingId) {
        setCreatedTrackingId(result.trackingId);
        setCreatedParcelDetails({
          senderName: v.senderName,
          senderBranch: v.senderBranch,
          receiverName: v.receiverName,
          receiverBranch: v.receiverBranch,
          createdAt: new Date().toISOString(),
        });
        setIsResultOpen(true);
        setFormData({ senderName: '', senderBranch: '', receiverName: '', receiverBranch: '', docType: '', description: '', note: '' });
      } else {
        toast.error(result.error || 'ไม่สามารถสร้างรายการได้');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyTrackingId = () => {
    if (createdTrackingId) {
      navigator.clipboard.writeText(createdTrackingId);
      toast.success(`คัดลอก ID เรียบร้อย`);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-2">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-black text-primary mb-0.5">สร้างรายการใหม่</h1>
          <p className="text-xs sm:text-sm text-on-surface-variant">กรอกข้อมูลรายละเอียดของพัสดุหรือเอกสารเพื่อเริ่มต้นการจัดส่ง</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Sender Section */}
          <div className="bg-white/90 backdrop-blur-sm border border-outline-variant/40 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            <div className="p-5 border-b border-outline-variant/10"
              style={{ background: 'linear-gradient(135deg, rgba(9,20,38,0.04) 0%, rgba(9,20,38,0.01) 100%)' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-sm"
                  style={{ background: 'linear-gradient(135deg, #091426 0%, #1e3a5f 100%)' }}>
                  <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>person</span>
                </div>
                <div>
                  <h2 className="font-display font-bold text-primary text-sm">ข้อมูลผู้ส่ง</h2>
                  <p className="text-[10px] text-on-surface-variant/50 uppercase font-bold tracking-wider">รายละเอียดต้นทาง</p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-widest px-1">ชื่อผู้ส่ง *</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 text-lg">person_edit</span>
                  <input
                    name="senderName"
                    value={formData.senderName}
                    onChange={handleInputChange}
                    placeholder="ระบุชื่อบริษัท หรือ ผู้ส่ง"
                    className="w-full bg-white border border-outline-variant rounded-2xl pl-10 pr-4 py-2.5 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none font-display transition-all"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-widest px-1">สาขาผู้ส่ง *</label>
                <NativeSelect
                  value={formData.senderBranch}
                  onChange={v => setFormData(p => ({ ...p, senderBranch: v }))}
                  options={branches}
                  placeholder="เลือกสาขา"
                  icon="apartment"
                  otherPlaceholder="ระบุชื่อสาขาผู้ส่ง"
                />
              </div>
              <div className={`rounded-2xl border p-3 text-xs ${
                geoStatus === 'success' ? 'border-green-200 bg-green-50 text-green-800' :
                geoStatus === 'denied' || geoStatus === 'error' ? 'border-error/20 bg-error-container/25 text-error' :
                'border-outline-variant/30 bg-surface-container-lowest text-on-surface-variant'
              }`}>
                <div className="flex items-start gap-2.5">
                  <span className={`material-symbols-outlined text-lg ${geoStatus === 'loading' ? 'animate-spin' : ''}`}>
                    {geoStatus === 'success' ? 'my_location' :
                     geoStatus === 'loading' ? 'progress_activity' :
                     geoStatus === 'denied' || geoStatus === 'error' ? 'location_disabled' : 'location_searching'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">
                      {geoStatus === 'success' ? 'บันทึก GPS จุดเริ่มต้นแล้ว' :
                       geoStatus === 'loading' ? 'กำลังดึง GPS จุดเริ่มต้น...' :
                       geoStatus === 'denied' ? 'ไม่ได้รับอนุญาต GPS' :
                       geoStatus === 'error' ? 'ยังไม่ได้ GPS จุดเริ่มต้น' : 'รอการดึง GPS จุดเริ่มต้น'}
                    </p>
                    <p className="mt-0.5 opacity-80">
                      {geoStatus === 'success' && position
                        ? `${position.latitude.toFixed(6)}, ${position.longitude.toFixed(6)}`
                        : geoError || 'พิกัดนี้จะใช้แสดงจุดเริ่มต้นบนแผนที่'}
                    </p>
                    {(geoStatus === 'error' || geoStatus === 'denied') && (
                      <button
                        type="button"
                        onClick={requestLocation}
                        className="mt-1 font-bold underline underline-offset-2"
                      >
                        ลองดึง GPS อีกครั้ง
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Receiver Section */}
          <div className="bg-white/90 backdrop-blur-sm border border-outline-variant/40 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            <div className="p-5 border-b border-outline-variant/10"
              style={{ background: 'linear-gradient(135deg, rgba(133,83,0,0.05) 0%, rgba(133,83,0,0.01) 100%)' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-sm"
                  style={{ background: 'linear-gradient(135deg, #855300 0%, #fea619 100%)' }}>
                  <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>location_on</span>
                </div>
                <div>
                  <h2 className="font-display font-bold text-primary text-sm">ข้อมูลผู้รับ</h2>
                  <p className="text-[10px] text-on-surface-variant/50 uppercase font-bold tracking-wider">รายละเอียดปลายทาง</p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-widest px-1">ชื่อผู้รับ *</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 text-lg">person</span>
                  <input
                    name="receiverName"
                    value={formData.receiverName}
                    onChange={handleInputChange}
                    placeholder="ระบุชื่อผู้รับ"
                    className="w-full bg-white border border-outline-variant rounded-2xl pl-10 pr-4 py-2.5 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none font-display transition-all"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-widest px-1">สาขาผู้รับ *</label>
                <NativeSelect
                  value={formData.receiverBranch}
                  onChange={v => setFormData(p => ({ ...p, receiverBranch: v }))}
                  options={branches}
                  placeholder="เลือกสาขา"
                  icon="home_pin"
                  otherPlaceholder="ระบุชื่อสาขาผู้รับ"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Parcel Details */}
        <div className="bg-white/90 backdrop-blur-sm border border-outline-variant/40 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
          <div className="p-5 border-b border-outline-variant/10"
            style={{ background: 'linear-gradient(135deg, rgba(0,25,14,0.04) 0%, rgba(0,25,14,0.01) 100%)' }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-sm"
                style={{ background: 'linear-gradient(135deg, #005236 0%, #00a472 100%)' }}>
                <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>inventory_2</span>
              </div>
              <div>
                <h2 className="font-display font-bold text-primary text-sm">รายละเอียดพัสดุ</h2>
                <p className="text-[10px] text-on-surface-variant/50 uppercase font-bold tracking-wider">ข้อมูลสิ่งที่ส่งและหมายเหตุ</p>
              </div>
            </div>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-widest px-1">ประเภท *</label>
                <NativeSelect
                  value={formData.docType}
                  onChange={v => setFormData(p => ({ ...p, docType: v }))}
                  options={DOC_TYPES}
                  placeholder="เลือกประเภท"
                  icon="category"
                  otherPlaceholder="ระบุประเภทพัสดุเอง"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-widest px-1">รายละเอียดเพิ่มเติม</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 text-lg">description</span>
                  <input
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="เช่น เอกสาร 1 ชุด, พัสดุ 1 กล่อง"
                    className="w-full bg-white border border-outline-variant rounded-2xl pl-10 pr-4 py-2.5 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none font-display transition-all"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-widest px-1">หมายเหตุ (ถ้ามี)</label>
              <textarea
                name="note"
                value={formData.note}
                onChange={handleInputChange}
                placeholder="ห้ามเปิด, ของแตกหักง่าย, เร่งด่วน..."
                className="w-full bg-white border border-outline-variant rounded-2xl px-4 py-3 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none font-display min-h-[110px] transition-all resize-none"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-center pt-2">
          <button
            type="submit"
            disabled={isLoading}
            className="group flex items-center gap-3 h-14 px-10 text-white rounded-2xl font-display font-bold shadow-lg hover:shadow-xl hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #091426 0%, #1e3a5f 100%)' }}
          >
            <span className={`material-symbols-outlined ${isLoading ? 'animate-spin' : ''}`}>
              {isLoading ? 'progress_activity' : 'add_circle'}
            </span>
            {isLoading ? 'กำลังสร้างรายการ...' : 'ยืนยันสร้างรายการ'}
          </button>
        </div>
      </form>

      {/* Confirmation Modal */}
      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-xl max-h-[92vh] rounded-3xl p-0 border-none bg-white shadow-2xl overflow-hidden">
          <div className="flex max-h-[92vh] flex-col">
            {/* Header */}
            <div className="relative overflow-hidden bg-primary px-5 py-4 text-white sm:px-6">
              <div className="relative flex items-center gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-secondary-container text-primary shadow-sm">
                  <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>fact_check</span>
                </div>
                <div className="min-w-0 text-left">
                  <DialogTitle className="font-display text-xl font-black leading-tight sm:text-2xl">ตรวจสอบข้อมูล</DialogTitle>
                  <p className="mt-0.5 text-xs font-semibold text-white/65">ยืนยันรายละเอียดก่อนสร้างรายการพัสดุ</p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-surface-container-lowest p-4 sm:p-5">
              <div className="space-y-3">
                {/* Route summary */}
                <div className="rounded-2xl border border-outline-variant/25 bg-white p-4 shadow-sm">
                  <div className="relative space-y-4">
                    <div className="absolute bottom-10 left-[21px] top-10 w-px bg-outline-variant/30" />
                    <div className="relative flex min-w-0 gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>person_pin_circle</span>
                      </div>
                      <div className="min-w-0 flex-1 pt-0.5">
                        <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/50">ผู้ส่งต้นทาง</p>
                        <p className="truncate font-display text-lg font-black leading-tight text-primary">{formData.senderName}</p>
                        <p className="truncate text-xs font-semibold text-on-surface-variant/70">{resolveSelectValue(formData.senderBranch)}</p>
                      </div>
                    </div>

                    <div className="relative flex min-w-0 gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-secondary/15 text-secondary">
                        <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>location_on</span>
                      </div>
                      <div className="min-w-0 flex-1 pt-0.5">
                        <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/50">ผู้รับปลายทาง</p>
                        <p className="truncate font-display text-lg font-black leading-tight text-primary">{formData.receiverName}</p>
                        <p className="truncate text-xs font-semibold text-on-surface-variant/70">{resolveSelectValue(formData.receiverBranch)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Parcel Details */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-outline-variant/25 bg-white p-4 shadow-sm">
                    <div className="mb-2 flex items-center gap-2 text-primary">
                      <span className="material-symbols-outlined text-lg">category</span>
                      <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/55">ประเภทพัสดุ</p>
                    </div>
                    <p className="font-display text-base font-black text-primary">{resolveSelectValue(formData.docType)}</p>
                  </div>
                  <div className="rounded-2xl border border-outline-variant/25 bg-white p-4 shadow-sm">
                    <div className="mb-2 flex items-center gap-2 text-primary">
                      <span className="material-symbols-outlined text-lg">description</span>
                      <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/55">รายละเอียด</p>
                    </div>
                    <p className="break-words font-display text-base font-black text-primary">{formData.description || '-'}</p>
                  </div>
                </div>

                {position && (
                  <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-green-800 shadow-sm">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="material-symbols-outlined text-lg">my_location</span>
                      <p className="text-[10px] font-black uppercase tracking-widest">GPS จุดเริ่มต้น</p>
                    </div>
                    <p className="font-mono text-sm font-black">
                      {position.latitude.toFixed(6)}, {position.longitude.toFixed(6)}
                    </p>
                  </div>
                )}

                {/* Note */}
                {formData.note && (
                  <div className="rounded-2xl border border-tertiary/10 bg-tertiary-container/25 p-4">
                    <div className="mb-1 flex items-center gap-2 text-tertiary">
                      <span className="material-symbols-outlined text-lg">edit_note</span>
                      <p className="text-[10px] font-black uppercase tracking-widest">หมายเหตุเพิ่มเติม</p>
                    </div>
                    <p className="break-words text-sm font-medium leading-relaxed text-on-surface">{formData.note}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-outline-variant/15 bg-white p-4 sm:p-5">
              <div className="flex flex-col-reverse gap-3 sm:flex-row">
                <button
                  onClick={() => setIsConfirmOpen(false)}
                  className="h-12 flex-1 rounded-2xl border border-outline-variant/50 font-display font-bold text-on-surface-variant transition-colors hover:bg-surface-container sm:h-13"
                >
                  แก้ไข
                </button>
                <button
                  onClick={handleConfirmSubmit}
                  disabled={isLoading}
                  className="flex h-12 flex-[2] items-center justify-center gap-2 rounded-2xl bg-primary font-display font-bold text-white shadow-lg shadow-primary/20 transition-all hover:opacity-95 active:scale-[0.98] disabled:opacity-50 sm:h-13"
                >
                  {isLoading ? (
                    <span className="material-symbols-outlined animate-spin">progress_activity</span>
                  ) : (
                    <>
                      ยืนยันสร้างรายการ
                      <span className="material-symbols-outlined text-xl">verified</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <Dialog open={isResultOpen} onOpenChange={setIsResultOpen}>
        <DialogContent 
            className="w-[calc(100vw-2rem)] max-w-md rounded-3xl p-0 border-none shadow-2xl bg-background overflow-hidden"
          >
          <div className="w-full bg-primary p-7 text-white text-center relative">
            <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/20">
              <span className="material-symbols-outlined text-4xl text-secondary-container">check_circle</span>
            </div>
            <DialogTitle className="text-2xl font-bold font-display">สร้างรายการสำเร็จ!</DialogTitle>
            <p className="text-primary-fixed-dim text-sm mt-1">บันทึกข้อมูลพัสดุเรียบร้อยแล้ว</p>
          </div>

          <div className="w-full p-6 space-y-5">
            <div className="bg-white p-6 rounded-2xl border border-outline-variant/30 flex flex-col items-center gap-5 shadow-sm">
              <div className="flex flex-col items-center gap-1">
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.2em]">หมายเลขติดตาม</span>
                <code className="text-3xl font-mono font-black text-primary">{createdTrackingId}</code>
              </div>
              <div className="bg-surface-container-low p-3 rounded-2xl border border-outline-variant/20">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    className="w-32 h-32 mix-blend-multiply"
                    alt="คิวอาร์โค้ด"
                  />
                ) : (
                  <div className="w-32 h-32 flex flex-col items-center justify-center text-on-surface-variant/40 text-center">
                    <span className="material-symbols-outlined text-3xl mb-1">qr_code</span>
                    <span className="text-[10px]">กำลังสร้าง QR...</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                onClick={handleCopyTrackingId}
                className="flex-1 flex items-center justify-center gap-2 h-12 bg-surface-container-high text-primary border border-outline-variant/20 rounded-xl font-display font-bold hover:bg-surface-container transition-colors"
              >
                <span className="material-symbols-outlined text-xl">content_copy</span>
                คัดลอก ID
              </button>
              <button
                onClick={async () => {
                  const printWindow = window.open('', '', 'width=400,height=500');
                  if (printWindow) {
                    const labelDetails = createdParcelDetails ?? {
                      ...getFinalValues(),
                      createdAt: new Date().toISOString(),
                    };
                    const trackingId = createdTrackingId ?? '';
                    // Generate QR locally for print
                    let printQrSrc = '';
                    try {
                      printQrSrc = await QRCode.toDataURL(trackingId, { width: 200, margin: 1 });
                    } catch { /* fallback: no QR */ }
                    printWindow.document.write(`
                      <!doctype html>
                      <html>
                      <head>
                        <meta charset="utf-8" />
                        <title>LogiTrack Label</title>
                      </head>
                      <body>
                      <div style="text-align:center;font-family:sans-serif;padding:40px;border:4px solid #091426;border-radius:20px;max-width:400px;margin:auto;">
                        <div style="background:#091426;color:#fff;padding:15px;border-radius:12px;margin-bottom:20px;">
                          <h2 style="margin:0;font-size:24px;">LogiTrack</h2>
                        </div>
                        <h1 id="tracking-id" style="font-size:42px;margin:10px 0;font-family:monospace;letter-spacing:2px;"></h1>
                        <img id="qr-code" alt="QR code" style="width:180px;height:180px;margin:20px 0;" />
                        <div style="margin-top:20px;text-align:left;border-top:2px solid #eee;padding-top:20px;">
                          <div style="margin-bottom:10px;">
                            <p style="margin:0;font-size:10px;color:#666;text-transform:uppercase;font-weight:bold;">ผู้ส่ง</p>
                            <p id="sender-info" style="margin:0;font-weight:bold;"></p>
                          </div>
                          <div>
                            <p style="margin:0;font-size:10px;color:#666;text-transform:uppercase;font-weight:bold;">ผู้รับ</p>
                            <p id="receiver-info" style="margin:0;font-weight:bold;"></p>
                          </div>
                        </div>
                        <p id="created-at" style="margin-top:30px;font-size:10px;color:#999;font-style:italic;"></p>
                      </div>
                      </body>
                      </html>
                    `);
                    const doc = printWindow.document;
                    doc.getElementById('tracking-id')!.textContent = trackingId;
                    doc.getElementById('sender-info')!.textContent = `${labelDetails.senderName} (${labelDetails.senderBranch})`;
                    doc.getElementById('receiver-info')!.textContent = `${labelDetails.receiverName} (${labelDetails.receiverBranch})`;
                    doc.getElementById('created-at')!.textContent = `สร้างเมื่อ: ${formatThaiDateTime(labelDetails.createdAt)}`;
                    if (printQrSrc) {
                      doc.getElementById('qr-code')!.setAttribute('src', printQrSrc);
                    }
                    printWindow.document.close();
                    printWindow.onload = () => {
                      printWindow.print();
                      printWindow.close();
                    };
                  }
                }}
                className="flex-1 flex items-center justify-center gap-2 h-12 bg-primary text-white rounded-xl font-display font-bold shadow-lg shadow-primary/20 hover:opacity-90 transition-opacity"
              >
                <span className="material-symbols-outlined text-xl">print</span>
                พิมพ์ใบปะหน้า
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
