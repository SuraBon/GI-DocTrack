/**
 * Create Parcel Page
 * สร้างรายการพัสดุใหม่
 * Design: Premium Logistics
 */

import { useState } from 'react';
import { useParcelStore } from '@/hooks/useParcelStore';
import { getBranches } from '@/lib/parcelService';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

const DOC_TYPES = ['เอกสาร', 'พัสดุ'];
const OTHER_BRANCH_VALUE = '__OTHER_BRANCH__';

export default function CreateParcel() {
  const { createParcel } = useParcelStore();
  const branches = getBranches();

  const [formData, setFormData] = useState({
    senderName: '',
    senderBranch: '',
    receiverName: '',
    receiverBranch: '',
    docType: '',
    description: '',
    note: '',
  });

  const [customSenderBranch, setCustomSenderBranch] = useState('');
  const [customReceiverBranch, setCustomReceiverBranch] = useState('');
  const [customDocType, setCustomDocType] = useState('');

  const [createdTrackingId, setCreatedTrackingId] = useState<string | null>(null);
  const [isResultOpen, setIsResultOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  /** Resolves the final submitted values, replacing OTHER_BRANCH_VALUE with custom inputs. */
  const getFinalValues = () => ({
    senderName:     formData.senderName.trim(),
    senderBranch:   formData.senderBranch   === OTHER_BRANCH_VALUE ? customSenderBranch.trim()   : formData.senderBranch.trim(),
    receiverName:   formData.receiverName.trim(),
    receiverBranch: formData.receiverBranch === OTHER_BRANCH_VALUE ? customReceiverBranch.trim() : formData.receiverBranch.trim(),
    docType:        formData.docType        === OTHER_BRANCH_VALUE ? customDocType.trim()        : formData.docType.trim(),
    description:    formData.description.trim(),
    note:           formData.note.trim(),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = getFinalValues();

    // ✅ FIX: Proper validation with specific messages
    if (!v.senderName || v.senderName.length < 2) {
      toast.error('กรุณากรอกชื่อผู้ส่งอย่างน้อย 2 ตัวอักษร');
      return;
    }
    if (!v.senderBranch || v.senderBranch.length < 1) {
      toast.error('กรุณาเลือกหรือระบุสาขาผู้ส่ง');
      return;
    }
    if (!v.receiverName || v.receiverName.length < 2) {
      toast.error('กรุณากรอกชื่อผู้รับอย่างน้อย 2 ตัวอักษร');
      return;
    }
    if (!v.receiverBranch || v.receiverBranch.length < 1) {
      toast.error('กรุณาเลือกหรือระบุสาขาผู้รับ');
      return;
    }
    if (!v.docType || v.docType.length < 1) {
      toast.error('กรุณาเลือกหรือระบุประเภทพัสดุ');
      return;
    }
    setIsConfirmOpen(true);
  };

  const handleConfirmSubmit = async () => {
    setIsConfirmOpen(false);
    setIsLoading(true);
    const v = getFinalValues();
    try {
      const trackingId = await createParcel(
        v.senderName, v.senderBranch,
        v.receiverName, v.receiverBranch,
        v.docType, v.description, v.note,
      );
      if (trackingId) {
        setCreatedTrackingId(trackingId);
        setIsResultOpen(true);
        setFormData({ senderName: '', senderBranch: '', receiverName: '', receiverBranch: '', docType: '', description: '', note: '' });
        setCustomSenderBranch('');
        setCustomReceiverBranch('');
        setCustomDocType('');
      } else {
        toast.error('ไม่สามารถสร้างรายการได้');
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
                    className="w-full bg-white border border-outline-variant rounded-lg pl-10 pr-4 py-2.5 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none font-display transition-all"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-widest px-1">สาขาผู้ส่ง *</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 text-lg">apartment</span>
                  <select
                    name="senderBranch"
                    value={formData.senderBranch}
                    onChange={handleInputChange}
                    className="w-full bg-white border border-outline-variant rounded-lg pl-10 pr-4 py-2.5 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none font-display appearance-none cursor-pointer"
                  >
                    <option value="" disabled>เลือกสาขา</option>
                    {branches.map(b => <option key={b} value={b}>{b}</option>)}
                    <option value={OTHER_BRANCH_VALUE}>อื่นๆ (ระบุเอง)</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 text-lg pointer-events-none">expand_more</span>
                </div>
                {formData.senderBranch === OTHER_BRANCH_VALUE && (
                  <div className="mt-3 animate-in slide-in-from-top-2 duration-200">
                    <input
                      value={customSenderBranch}
                      onChange={(e) => setCustomSenderBranch(e.target.value)}
                      placeholder="ระบุชื่อสาขาผู้ส่ง"
                      maxLength={100}
                      className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-4 py-2.5 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none font-display"
                    />
                  </div>
                )}
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
                    className="w-full bg-white border border-outline-variant rounded-lg pl-10 pr-4 py-2.5 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none font-display transition-all"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-widest px-1">สาขาผู้รับ *</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 text-lg">home_pin</span>
                  <select
                    name="receiverBranch"
                    value={formData.receiverBranch}
                    onChange={handleInputChange}
                    className="w-full bg-white border border-outline-variant rounded-lg pl-10 pr-4 py-2.5 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none font-display appearance-none cursor-pointer"
                  >
                    <option value="" disabled>เลือกสาขา</option>
                    {branches.map(b => <option key={b} value={b}>{b}</option>)}
                    <option value={OTHER_BRANCH_VALUE}>อื่นๆ (ระบุเอง)</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 text-lg pointer-events-none">expand_more</span>
                </div>
                {formData.receiverBranch === OTHER_BRANCH_VALUE && (
                  <div className="mt-3 animate-in slide-in-from-top-2 duration-200">
                    <input
                      value={customReceiverBranch}
                      onChange={(e) => setCustomReceiverBranch(e.target.value)}
                      placeholder="ระบุชื่อสาขาผู้รับ"
                      maxLength={100}
                      className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-4 py-2.5 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none font-display"
                    />
                  </div>
                )}
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
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 text-lg">category</span>
                  <select
                    name="docType"
                    value={formData.docType}
                    onChange={handleInputChange}
                    className="w-full bg-white border border-outline-variant rounded-lg pl-10 pr-4 py-2.5 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none font-display appearance-none cursor-pointer"
                  >
                    <option value="" disabled>เลือกประเภท</option>
                    {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    <option value={OTHER_BRANCH_VALUE}>อื่นๆ (ระบุเอง)</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 text-lg pointer-events-none">expand_more</span>
                </div>
                {formData.docType === OTHER_BRANCH_VALUE && (
                  <div className="mt-3 animate-in slide-in-from-top-2 duration-200">
                    <input
                      value={customDocType}
                      onChange={(e) => setCustomDocType(e.target.value)}
                      placeholder="ระบุประเภทพัสดุเอง"
                      maxLength={100}
                      className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-4 py-2.5 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none font-display"
                    />
                  </div>
                )}
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
                    className="w-full bg-white border border-outline-variant rounded-lg pl-10 pr-4 py-2.5 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none font-display transition-all"
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
                className="w-full bg-white border border-outline-variant rounded-lg px-4 py-3 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none font-display min-h-[110px] transition-all resize-none"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-center pt-2">
          <button
            type="submit"
            disabled={isLoading}
            className="group flex items-center gap-3 h-13 px-10 text-white rounded-2xl font-display font-bold shadow-lg hover:shadow-xl hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
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
        <DialogContent className="w-full max-w-[92vw] sm:max-w-3xl rounded-3xl p-0 border-none shadow-2xl bg-background overflow-hidden max-h-[90vh] md:max-h-[85vh]">
          <div className="flex flex-col h-full max-h-[90vh] md:max-h-[85vh]">
            {/* Header (Fixed) */}
            <div className="bg-primary p-6 text-white text-center relative shrink-0">
            <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/20">
              <span className="material-symbols-outlined text-4xl text-secondary-container">fact_check</span>
            </div>
            <DialogTitle className="text-2xl font-bold font-display">ตรวจสอบข้อมูล</DialogTitle>
            <p className="text-primary-fixed-dim text-xs mt-1 uppercase tracking-wider font-medium">กรุณายืนยันความถูกต้องก่อนบันทึก</p>
          </div>

          <div className="p-4 md:p-6 space-y-6 bg-surface-container-lowest overflow-y-auto">
            {/* Ticket Style Container */}
            <div className="bg-white rounded-3xl border border-outline-variant/40 shadow-sm overflow-hidden relative">
              {/* Decorative top edge */}
              <div className="h-2 w-full bg-primary" />
              
              <div className="p-4 sm:p-6 space-y-6">
                {/* Routing Flow */}
                <div className="flex flex-col sm:flex-row items-center justify-between relative gap-4 sm:gap-0">
                  {/* Sender */}
                  <div className="w-full sm:flex-1 flex flex-row sm:flex-col items-center sm:text-center z-10 gap-4 sm:gap-0 bg-surface-container-lowest sm:bg-transparent p-3 sm:p-0 rounded-2xl">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-full flex shrink-0 items-center justify-center text-primary sm:mb-3">
                      <span className="material-symbols-outlined text-xl sm:text-2xl">person_pin_circle</span>
                    </div>
                    <div className="flex-1 text-left sm:text-center">
                      <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest mb-0.5 sm:mb-1">ผู้ส่งต้นทาง</p>
                      <p className="text-sm sm:text-base font-bold text-on-surface leading-tight mb-0.5 sm:mb-1">{formData.senderName}</p>
                      <p className="text-xs text-on-surface-variant sm:max-w-[120px] truncate">
                        {formData.senderBranch === OTHER_BRANCH_VALUE ? customSenderBranch : formData.senderBranch}
                      </p>
                    </div>
                  </div>

                  {/* Connecting Line (Hidden on mobile) */}
                  <div className="hidden sm:flex flex-1 flex-col items-center justify-center px-2 relative z-0">
                    <div className="w-full border-t-2 border-dashed border-outline-variant/50 absolute top-1/2 -translate-y-1/2" />
                    <div className="bg-white px-3 relative z-10 text-primary">
                      <span className="material-symbols-outlined text-3xl">local_shipping</span>
                    </div>
                  </div>

                  <div className="sm:hidden flex items-center justify-center w-full py-1 text-outline-variant">
                     <span className="material-symbols-outlined">south</span>
                  </div>

                  {/* Receiver */}
                  <div className="w-full sm:flex-1 flex flex-row sm:flex-col items-center sm:text-center z-10 gap-4 sm:gap-0 bg-surface-container-lowest sm:bg-transparent p-3 sm:p-0 rounded-2xl">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-secondary/10 rounded-full flex shrink-0 items-center justify-center text-secondary sm:mb-3">
                      <span className="material-symbols-outlined text-xl sm:text-2xl">location_on</span>
                    </div>
                    <div className="flex-1 text-left sm:text-center">
                      <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest mb-0.5 sm:mb-1">ผู้รับปลายทาง</p>
                      <p className="text-sm sm:text-base font-bold text-on-surface leading-tight mb-0.5 sm:mb-1">{formData.receiverName}</p>
                      <p className="text-xs text-on-surface-variant sm:max-w-[120px] truncate">
                        {formData.receiverBranch === OTHER_BRANCH_VALUE ? customReceiverBranch : formData.receiverBranch}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border-t border-dashed border-outline-variant/40" />

                {/* Parcel Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-surface-container-low/50 p-4 rounded-2xl">
                    <div className="flex items-center gap-2 mb-2 text-primary opacity-80">
                      <span className="material-symbols-outlined text-sm">category</span>
                      <p className="text-[10px] font-bold uppercase tracking-widest">ประเภทพัสดุ</p>
                    </div>
                    <p className="text-sm font-bold text-on-surface">
                      {formData.docType === OTHER_BRANCH_VALUE ? customDocType : formData.docType}
                    </p>
                  </div>
                  <div className="bg-surface-container-low/50 p-4 rounded-2xl">
                    <div className="flex items-center gap-2 mb-2 text-primary opacity-80">
                      <span className="material-symbols-outlined text-sm">description</span>
                      <p className="text-[10px] font-bold uppercase tracking-widest">รายละเอียด</p>
                    </div>
                    <p className="text-sm font-bold text-on-surface">{formData.description || '-'}</p>
                  </div>
                </div>

                {/* Note */}
                {formData.note && (
                  <div className="bg-tertiary-container/30 p-4 rounded-2xl border border-tertiary/10">
                    <div className="flex items-center gap-2 mb-1 text-tertiary">
                      <span className="material-symbols-outlined text-sm">edit_note</span>
                      <p className="text-[10px] font-bold uppercase tracking-widest">หมายเหตุเพิ่มเติม</p>
                    </div>
                    <p className="text-sm text-on-surface italic">{formData.note}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer (Fixed) */}
          <div className="p-4 md:p-6 bg-surface-container-lowest border-t border-outline-variant/20 shrink-0">
            <div className="flex gap-4">
              <button
                onClick={() => setIsConfirmOpen(false)}
                className="flex-1 h-14 rounded-2xl font-display font-bold border-2 border-outline-variant text-on-surface-variant hover:bg-surface-container transition-colors text-base"
              >
                แก้ไข
              </button>
              <button
                onClick={handleConfirmSubmit}
                disabled={isLoading}
                className="flex-[2] flex items-center justify-center gap-2 h-14 bg-primary text-white rounded-2xl font-display font-bold shadow-lg shadow-primary/20 hover:scale-[1.01] active:scale-95 transition-all text-base"
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
            className="w-full max-w-[92vw] sm:max-w-3xl rounded-3xl p-0 border-none shadow-2xl bg-background flex flex-col justify-center items-center" 
          >
          <div className="bg-primary p-8 text-white text-center relative">
            <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/20">
              <span className="material-symbols-outlined text-4xl text-secondary-container">check_circle</span>
            </div>
            <DialogTitle className="text-2xl font-bold font-display">สร้างรายการสำเร็จ!</DialogTitle>
            <p className="text-primary-fixed-dim text-sm mt-1">บันทึกข้อมูลพัสดุเรียบร้อยแล้ว</p>
          </div>

          <div className="p-8 space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-outline-variant/30 flex flex-col items-center gap-5 shadow-sm">
              <div className="flex flex-col items-center gap-1">
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.2em]">หมายเลขติดตาม</span>
                <code className="text-3xl font-mono font-black text-primary">{createdTrackingId}</code>
              </div>
              <div className="bg-surface-container-low p-3 rounded-2xl border border-outline-variant/20">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${createdTrackingId}`}
                  className="w-32 h-32 mix-blend-multiply"
                  alt="คิวอาร์โค้ด"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCopyTrackingId}
                className="flex-1 flex items-center justify-center gap-2 h-12 bg-surface-container-high text-primary border border-outline-variant/20 rounded-xl font-display font-bold hover:bg-surface-container transition-colors"
              >
                <span className="material-symbols-outlined text-xl">content_copy</span>
                คัดลอก ID
              </button>
              <button
                onClick={() => {
                  const printWindow = window.open('', '', 'width=400,height=500');
                  if (printWindow) {
                    const v = getFinalValues();
                    printWindow.document.write(`
                      <div style="text-align:center;font-family:sans-serif;padding:40px;border:4px solid #091426;border-radius:20px;max-width:400px;margin:auto;">
                        <div style="background:#091426;color:#fff;padding:15px;border-radius:12px;margin-bottom:20px;">
                          <h2 style="margin:0;font-size:24px;">LogiTrack</h2>
                        </div>
                        <h1 style="font-size:42px;margin:10px 0;font-family:monospace;letter-spacing:2px;">${createdTrackingId}</h1>
                        <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${createdTrackingId}" style="width:180px;height:180px;margin:20px 0;" />
                        <div style="margin-top:20px;text-align:left;border-top:2px solid #eee;padding-top:20px;">
                          <div style="margin-bottom:10px;">
                            <p style="margin:0;font-size:10px;color:#666;text-transform:uppercase;font-weight:bold;">ผู้ส่ง</p>
                            <p style="margin:0;font-weight:bold;">${v.senderName} (${v.senderBranch})</p>
                          </div>
                          <div>
                            <p style="margin:0;font-size:10px;color:#666;text-transform:uppercase;font-weight:bold;">ผู้รับ</p>
                            <p style="margin:0;font-weight:bold;">${v.receiverName} (${v.receiverBranch})</p>
                          </div>
                        </div>
                        <p style="margin-top:30px;font-size:10px;color:#999;font-style:italic;">สร้างเมื่อ: ${new Date().toLocaleString('th-TH')}</p>
                      </div>
                      <script>window.onload = () => { window.print(); window.close(); }</script>
                    `);
                    printWindow.document.close();
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
