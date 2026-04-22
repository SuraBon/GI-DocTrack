/**
 * Confirm Receipt Page
 * ยืนยันการรับพัสดุด้วยรูปภาพ
 * Design: Premium Stepper UI
 */

import { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useParcelStore } from '@/hooks/useParcelStore';
import { getBranches, getParcel } from '@/lib/parcelService';
import { toast } from 'sonner';
import { Upload, Search, Camera, ClipboardPaste, ArrowRight, ArrowLeft, CheckCircle2, Package, User, MapPin } from 'lucide-react';
import type { Parcel } from '@/types/parcel';

const OTHER_BRANCH_VALUE = '__OTHER_BRANCH__';

export default function ConfirmReceipt() {
  const { confirmReceipt } = useParcelStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const branches = getBranches();

  // Steps: 1 (Check), 2 (Photo), 3 (Confirm)
  const [currentStep, setCurrentStep] = useState(1);
  const [trackingId, setTrackingId] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [note, setNote] = useState('');
  
  const [isForwarding, setIsForwarding] = useState(false);
  const [forwardSender, setForwardSender] = useState('');
  const [forwardFromBranch, setForwardFromBranch] = useState('');
  const [forwardToBranch, setForwardToBranch] = useState('');
  const [isProxy, setIsProxy] = useState(false);
  const [proxyName, setProxyName] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [parcelDest, setParcelDest] = useState<string | null>(null);
  const [checkedParcel, setCheckedParcel] = useState<Parcel | null>(null);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);

  const [customForwardFromBranch, setCustomForwardFromBranch] = useState('');
  const [customForwardToBranch, setCustomForwardToBranch] = useState('');
  const [isDelivered, setIsDelivered] = useState(false);

  const handleCheckParcel = async () => {
    if (!trackingId.trim()) {
      toast.error('กรุณากรอก Tracking ID ก่อนตรวจสอบ');
      return;
    }
    
    setIsChecking(true);
    try {
      const res = await getParcel(trackingId.trim());
      if (res.success && res.parcel) {
        const p = res.parcel;
        
        let currentBranch = p['สาขาผู้ส่ง'];
        const note = p['หมายเหตุ'] || '';
        const forwardRegex = /\[ส่งต่อโดย:\s*(.*?)\s*จากสาขา:\s*(.*?)\s*ไปสาขา:\s*(.*?)\s*เมื่อ:\s*(.*?)\]/g;
        let match;
        while ((match = forwardRegex.exec(note)) !== null) {
          currentBranch = match[3];
        }
        
        setForwardFromBranch(branches.includes(currentBranch) ? currentBranch : OTHER_BRANCH_VALUE);
        if (!branches.includes(currentBranch)) {
          setCustomForwardFromBranch(currentBranch);
        }
        
        setParcelDest(p['สาขาผู้รับ']);
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
        }
      } else {
        toast.error('ไม่พบข้อมูลพัสดุ หรือ Tracking ID ไม่ถูกต้อง');
      }
    } catch (e: any) {
      toast.error(`เกิดข้อผิดพลาดในการตรวจสอบ`);
    } finally {
      setIsChecking(false);
    }
  };

  const handlePasteTrackingID = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setTrackingId(text.trim().toUpperCase());
        toast.success('วาง Tracking ID เรียบร้อย');
      }
    } catch (e) {
      toast.error('ไม่สามารถวางข้อมูลได้');
    }
  };

  const processImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('กรุณาเลือกไฟล์รูปภาพ');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
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
      let finalNote = note;
      const additionalNotes = [];
      const nowStr = new Date().toLocaleString('th-TH');
      const finalForwardFromBranch = forwardFromBranch === OTHER_BRANCH_VALUE ? customForwardFromBranch.trim() : forwardFromBranch.trim();
      const finalForwardToBranch = forwardToBranch === OTHER_BRANCH_VALUE ? customForwardToBranch.trim() : forwardToBranch.trim();
      
      if (isForwarding && finalForwardToBranch) {
        additionalNotes.push(`[ส่งต่อโดย: ${forwardSender} จากสาขา: ${finalForwardFromBranch} ไปสาขา: ${finalForwardToBranch} เมื่อ: ${nowStr} รูปภาพ: |IMAGE_URL|]`);
      }
      if (isProxy && proxyName) {
        additionalNotes.push(`[รับแทนโดย: ${proxyName} เมื่อ: ${nowStr} รูปภาพ: |IMAGE_URL|]`);
      }
      if (!isForwarding && !isProxy) {
        additionalNotes.push(`[รับพัสดุเรียบร้อย เมื่อ: ${nowStr} รูปภาพ: |IMAGE_URL|]`);
      }

      if (additionalNotes.length > 0) {
        finalNote = additionalNotes.join(' ') + (note ? ` ${note}` : '');
      }

      const response = await confirmReceipt(trackingId, photoUrl, finalNote);
      if (response && response.success) {
        toast.success('ยืนยันรายการสำเร็จ');
        // Reset
        setCurrentStep(1);
        setTrackingId('');
        setPhotoUrl('');
        setPhotoPreview(null);
        setNote('');
        setIsForwarding(false);
        setIsProxy(false);
        setCheckedParcel(null);
      } else {
        toast.error(`เกิดข้อผิดพลาด: ${response?.error}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const StepIndicator = () => (
    <div className="flex items-center justify-center mb-8">
      {[1, 2, 3].map((step) => (
        <div key={step} className="flex items-center">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
            currentStep === step 
              ? 'bg-primary text-white shadow-lg scale-110' 
              : currentStep > step 
                ? 'bg-emerald-500 text-white' 
                : 'bg-slate-100 text-slate-400'
          }`}>
            {currentStep > step ? <CheckCircle2 className="w-6 h-6" /> : step}
          </div>
          {step < 3 && (
            <div className={`w-12 h-1 mx-2 rounded ${
              currentStep > step ? 'bg-emerald-500' : 'bg-slate-100'
            }`} />
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20 animate-in fade-in duration-500">
      <div className="text-center space-y-2 mb-8">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">ยืนยันรับพัสดุ</h1>
        <p className="text-slate-500">ทำตามขั้นตอนเพื่อยืนยันการรับหรือส่งต่อพัสดุ</p>
      </div>

      <StepIndicator />

      {/* Step 1: Check Tracking ID */}
      {currentStep === 1 && (
        <Card className="border-none shadow-xl rounded-3xl overflow-hidden animate-in slide-in-from-right-4 duration-300">
          <CardHeader className="bg-slate-50/50 p-8 border-b border-slate-100 text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-primary" />
            </div>
            <CardTitle>ระบุ Tracking ID</CardTitle>
            <CardDescription>กรอกเลขที่พัสดุเพื่อเริ่มต้นทำรายการ</CardDescription>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            <div className="space-y-4">
              <div className="relative group">
                <Input
                  placeholder="เช่น TRK20260420001"
                  value={trackingId}
                  onChange={(e) => setTrackingId(e.target.value.toUpperCase())}
                  className="h-14 text-lg font-mono tracking-widest pl-5 pr-14 rounded-2xl border-slate-200 focus:ring-primary/20 transition-all"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handlePasteTrackingID}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-xl text-slate-400 hover:text-primary hover:bg-slate-100 transition-all"
                >
                  <ClipboardPaste className="w-5 h-5" />
                </button>
              </div>

              {checkedParcel && isDelivered && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-900 text-sm flex items-start gap-3">
                  <span className="text-xl shrink-0">🚫</span>
                  <div>
                    <p className="font-bold">พัสดุนี้ถูกส่งถึงที่หมายแล้ว</p>
                    <p className="opacity-80">ไม่สามารถยืนยันซ้ำได้ กรุณาตรวจสอบ ID อีกครั้ง</p>
                  </div>
                </div>
              )}
            </div>

            <Button 
              onClick={handleCheckParcel} 
              disabled={isChecking || !trackingId || isDelivered} 
              className="w-full h-14 rounded-2xl text-lg font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all"
            >
              {isChecking ? 'กำลังตรวจสอบ...' : 'ตรวจสอบพัสดุ'}
              {!isChecking && <ArrowRight className="w-5 h-5 ml-2" />}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Photo Evidence */}
      {currentStep === 2 && (
        <Card className="border-none shadow-xl rounded-3xl overflow-hidden animate-in slide-in-from-right-4 duration-300">
          <CardHeader className="bg-slate-50/50 p-8 border-b border-slate-100 text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Camera className="w-8 h-8 text-primary" />
            </div>
            <CardTitle>ถ่ายรูปหลักฐาน</CardTitle>
            <CardDescription>อัปโหลดรูปภาพพัสดุหรือหลักฐานการรับ</CardDescription>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            {!photoPreview ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center cursor-pointer hover:border-primary hover:bg-slate-50 transition-all group"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <Camera className="w-10 h-10 text-slate-400 group-hover:text-primary" />
                </div>
                <p className="text-lg font-bold text-slate-700">คลิกเพื่อเปิดกล้อง / เลือกรูป</p>
                <p className="text-slate-400 mt-2 text-sm">รูปภาพจะถูกปรับขนาดให้อัตโนมัติ</p>
              </div>
            ) : (
              <div className="relative rounded-3xl overflow-hidden border border-slate-100 shadow-inner group">
                <img src={photoPreview} alt="Preview" className="w-full aspect-[4/3] object-cover" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                  <Button variant="secondary" className="rounded-xl font-bold" onClick={() => setPhotoPreview(null)}>
                    ถ่ายใหม่
                  </Button>
                </div>
              </div>
            )}

            <div className="flex gap-4">
              <Button variant="outline" onClick={() => setCurrentStep(1)} className="h-14 flex-1 rounded-2xl font-bold border-slate-200">
                <ArrowLeft className="w-5 h-5 mr-2" /> ย้อนกลับ
              </Button>
              <Button 
                onClick={() => setCurrentStep(3)} 
                disabled={!photoPreview} 
                className="h-14 flex-[2] rounded-2xl font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all"
              >
                ถัดไป <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Final Details & Confirm */}
      {currentStep === 3 && (
        <Card className="border-none shadow-xl rounded-3xl overflow-hidden animate-in slide-in-from-right-4 duration-300">
          <CardHeader className="bg-slate-50/50 p-8 border-b border-slate-100 text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-primary" />
            </div>
            <CardTitle>ข้อมูลเพิ่มเติมและยืนยัน</CardTitle>
            <CardDescription>ระบุรายละเอียดการรับพัสดุให้ครบถ้วน</CardDescription>
          </CardHeader>
          <CardContent className="p-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl text-sm">
              <div className="flex items-center gap-2 text-slate-600">
                <Package className="w-4 h-4" />
                <span>Tracking ID: <b className="text-slate-900 font-mono">{trackingId}</b></span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <User className="w-4 h-4" />
                <span>ผู้รับ: <b className="text-slate-900">{checkedParcel?.['ผู้รับ']}</b></span>
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-4">
                <div className={`p-4 rounded-2xl border transition-all ${isForwarding ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-100'}`}>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="isForwarding" checked={isForwarding} onCheckedChange={(v) => setIsForwarding(!!v)} className="w-5 h-5" />
                    <label htmlFor="isForwarding" className="text-sm font-bold cursor-pointer select-none flex-1">ต้องการส่งต่อพัสดุไปสาขาอื่น</label>
                  </div>
                  {isForwarding && (
                    <div className="mt-4 space-y-3 animate-in fade-in duration-300">
                      <Input placeholder="ชื่อผู้ส่งต่อ" value={forwardSender} onChange={(e) => setForwardSender(e.target.value)} className="rounded-xl border-amber-200 bg-white" />
                      <div className="grid grid-cols-2 gap-2">
                        <Select value={forwardFromBranch} onValueChange={setForwardFromBranch}>
                          <SelectTrigger className="rounded-xl border-amber-200 bg-white">
                            <SelectValue placeholder="จากสาขา" />
                          </SelectTrigger>
                          <SelectContent>
                            {branches.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                            <SelectItem value={OTHER_BRANCH_VALUE}>อื่นๆ</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select value={forwardToBranch} onValueChange={setForwardToBranch}>
                          <SelectTrigger className="rounded-xl border-amber-200 bg-white">
                            <SelectValue placeholder="ไปสาขา" />
                          </SelectTrigger>
                          <SelectContent>
                            {branches.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                            <SelectItem value={OTHER_BRANCH_VALUE}>อื่นๆ</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>

                <div className={`p-4 rounded-2xl border transition-all ${isProxy ? 'bg-sky-50 border-sky-200' : 'bg-white border-slate-100'}`}>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="isProxy" checked={isProxy} onCheckedChange={(v) => setIsProxy(!!v)} className="w-5 h-5" />
                    <label htmlFor="isProxy" className="text-sm font-bold cursor-pointer select-none flex-1">มีผู้รับแทน (Proxy)</label>
                  </div>
                  {isProxy && (
                    <div className="mt-4 animate-in fade-in duration-300">
                      <Input placeholder="ระบุชื่อผู้รับแทน" value={proxyName} onChange={(e) => setProxyName(e.target.value)} className="rounded-xl border-sky-200 bg-white" />
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">หมายเหตุ (ไม่บังคับ)</label>
                <Textarea placeholder="เช่น กล่องบุบนิดหน่อย, วางไว้ที่ป้อมยาม..." value={note} onChange={(e) => setNote(e.target.value)} className="rounded-2xl border-slate-200 min-h-[80px]" />
              </div>
            </div>

            <div className="flex gap-4">
              <Button variant="outline" onClick={() => setCurrentStep(2)} className="h-14 flex-1 rounded-2xl font-bold border-slate-200">
                ย้อนกลับ
              </Button>
              <Button 
                onClick={() => setIsConfirmDialogOpen(true)} 
                disabled={isLoading || (isForwarding && (!forwardSender || !forwardToBranch)) || (isProxy && !proxyName)}
                className="h-14 flex-[2] rounded-2xl font-bold bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-200 active:scale-95 transition-all"
              >
                ยืนยันการทำรายการ <CheckCircle2 className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Success Modal */}
      <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl p-8 border-none shadow-2xl">
          <DialogHeader className="text-center">
            <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-12 h-12 text-emerald-600" />
            </div>
            <DialogTitle className="text-2xl font-extrabold text-slate-900">ยืนยันข้อมูลอีกครั้ง?</DialogTitle>
            <DialogDescription className="text-slate-500 pt-2">
              ตรวจสอบข้อมูลทั้งหมดให้เรียบร้อยก่อนกดยืนยัน ข้อมูลจะไม่สามารถแก้ไขได้
            </DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-slate-50">
              <span className="text-slate-400 font-medium">Tracking ID:</span>
              <span className="font-mono font-bold text-primary">{trackingId}</span>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-slate-50">
              <span className="text-slate-400 font-medium">การดำเนินการ:</span>
              <span className="font-bold">
                {isForwarding ? '📦 ส่งต่อพัสดุ' : isProxy ? '👤 รับพัสดุแทน' : '✅ รับพัสดุสำเร็จ'}
              </span>
            </div>
          </div>
          <DialogFooter className="flex gap-3">
            <Button variant="outline" onClick={() => setIsConfirmDialogOpen(false)} className="flex-1 rounded-xl h-12">ยกเลิก</Button>
            <Button onClick={executeConfirm} disabled={isLoading} className="flex-1 rounded-xl h-12 bg-primary font-bold shadow-lg shadow-primary/20">
              {isLoading ? 'กำลังประมวลผล...' : 'ใช่, ยืนยันข้อมูล'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
