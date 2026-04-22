/**
 * Confirm Receipt Page
 * ยืนยันการรับพัสดุด้วยรูปภาพ
 * Design: Minimalist Logistics
n */

import { useRef, useState } from 'react';
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
import { Upload, Search, Camera } from 'lucide-react';
import type { Parcel } from '@/types/parcel';

const OTHER_BRANCH_VALUE = '__OTHER_BRANCH__';

export default function ConfirmReceipt() {
  const { confirmReceipt } = useParcelStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const branches = getBranches();

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

  // No need for forwardFromSelectValue and forwardToSelectValue anymore

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
        } else {
          setCustomForwardFromBranch('');
        }
        setParcelDest(p['สาขาผู้รับ']);
        setForwardToBranch(''); // Reset
        setCustomForwardToBranch('');
        setCheckedParcel(p);

        // Check if actually delivered
        const currentStatus = p['สถานะ'];
        const noteStr = String(p['หมายเหตุ'] || "");
        let actuallyDelivered = currentStatus === "ส่งถึงแล้ว";
        if (actuallyDelivered) {
          const lastForwardIdx = noteStr.lastIndexOf('[ส่งต่อโดย:');
          const lastProxyIdx = noteStr.lastIndexOf('[รับแทนโดย:');
          const lastNormalIdx = noteStr.lastIndexOf('[รับพัสดุเรียบร้อย');
          const maxIdx = Math.max(lastForwardIdx, lastProxyIdx, lastNormalIdx);
          if (maxIdx >= 0 && maxIdx === lastForwardIdx) {
            actuallyDelivered = false; // it is in transit (forwarded)
          }
        }
        setIsDelivered(actuallyDelivered);
        
        if (actuallyDelivered) {
          toast.warning(`พัสดุนี้ถูกจัดส่งถึงที่หมายเรียบร้อยแล้ว ไม่สามารถยืนยันรับซ้ำได้`);
        } else {
          toast.success(`พบข้อมูลพัสดุ (ปลายทาง: ${p['สาขาผู้รับ']})`);
        }
      } else {
        toast.error(res.error === "Invalid trackingID format" ? "รูปแบบ Tracking ID ไม่ถูกต้อง" : 'ไม่พบข้อมูลพัสดุ หรือ Tracking ID ไม่ถูกต้อง');
        setParcelDest(null);
        setCheckedParcel(null);
        setIsDelivered(false);
      }
    } catch (e: any) {
      console.error('Check Parcel Error:', e);
      toast.error(`เกิดข้อผิดพลาดในการตรวจสอบ: ${e.message || 'ไม่ทราบสาเหตุ'}`);
    } finally {
      setIsChecking(false);
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
        
        // Max dimensions
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
          // Compress to JPEG with 70% quality
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
          setPhotoPreview(compressedDataUrl);
          setPhotoUrl(compressedDataUrl);
          toast.success('เลือกรูปภาพสำเร็จ');
        } else {
          toast.error('ไม่สามารถประมวลผลรูปภาพได้');
        }
      };
      img.onerror = () => {
        toast.error('ไม่สามารถอ่านรูปภาพได้');
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processImageFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processImageFile(files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!trackingId.trim()) {
      toast.error('กรุณากรอก Tracking ID');
      return;
    }

    if (!checkedParcel || checkedParcel.TrackingID !== trackingId.trim()) {
      toast.error('กรุณากดปุ่ม 🔍 เพื่อตรวจสอบ Tracking ID ให้ถูกต้องก่อนทำรายการ');
      return;
    }

    if (isDelivered) {
      toast.error('ไม่สามารถยืนยันรับพัสดุนี้ได้ เนื่องจากถูกจัดส่งเรียบร้อยแล้ว');
      return;
    }

    if (!photoUrl) {
      toast.error('กรุณาเลือกรูปภาพ');
      return;
    }

    if (isForwarding) {
      const finalForwardFromBranch = forwardFromBranch === OTHER_BRANCH_VALUE ? customForwardFromBranch.trim() : forwardFromBranch.trim();
      const finalForwardToBranch = forwardToBranch === OTHER_BRANCH_VALUE ? customForwardToBranch.trim() : forwardToBranch.trim();
      if (!forwardSender.trim() || !finalForwardFromBranch || !finalForwardToBranch) {
        toast.error('กรุณากรอกข้อมูลการส่งต่อให้ครบ (ชื่อผู้ส่ง, สาขาต้นทาง, สาขาปลายทาง)');
        return;
      }
    }

    if (isProxy && !proxyName.trim()) {
      toast.error('กรุณาระบุชื่อผู้รับแทน');
      return;
    }

    setIsConfirmDialogOpen(true);
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
        toast.success('ยืนยันการส่งสำเร็จ');
        setTrackingId('');
        setPhotoUrl('');
        setPhotoPreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        setNote('');
        setIsForwarding(false);
        setForwardSender('');
        setForwardFromBranch('');
        setForwardToBranch('');
        setCustomForwardFromBranch('');
        setCustomForwardToBranch('');
        setParcelDest(null);
        setCheckedParcel(null);
        setIsProxy(false);
        setProxyName('');
      } else {
        toast.error(`ไม่สามารถยืนยันการส่งได้: ${response?.error || 'เกิดข้อผิดพลาดไม่ทราบสาเหตุ'}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">ยืนยันการส่งพัสดุ</h1>
        <p className="text-sm text-muted-foreground mt-1">อัปโหลดรูปภาพเพื่อยืนยันการส่ง/รับพัสดุ</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>ยืนยันการส่ง</CardTitle>
              <CardDescription>กรอก Tracking ID และอัปโหลดรูปภาพหลักฐาน</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Tracking ID */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Tracking ID <span className="text-red-500">*</span>
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      placeholder="เช่น TRK20260420001"
                      value={trackingId}
                      onChange={(e) => setTrackingId(e.target.value.toUpperCase())}
                      className="flex-1"
                    />
                    <Button 
                      type="button" 
                      variant="secondary" 
                      onClick={handleCheckParcel}
                      disabled={isChecking}
                      className="w-full sm:w-auto"
                    >
                      {isChecking ? '⏳' : <Search className="w-4 h-4" />}
                    </Button>
                  </div>
                  
                  {checkedParcel && (
                    <div className={`mt-3 p-3 border rounded-md text-sm space-y-1 animate-in fade-in slide-in-from-top-2 ${isDelivered ? 'bg-red-50 border-red-100' : 'bg-blue-50 border-blue-100'}`}>
                      {isDelivered ? (
                        <div className="flex items-center gap-2 text-red-900 font-bold mb-1">
                          <span className="text-lg">🚫</span>
                          <span>พัสดุนี้ถูกจัดส่งเรียบร้อยแล้ว</span>
                        </div>
                      ) : null}
                      <p className={isDelivered ? 'text-red-900' : 'text-blue-900'}><span className="font-semibold">ผู้รับ:</span> {checkedParcel['ผู้รับ']}</p>
                      <p className={isDelivered ? 'text-red-900' : 'text-blue-900'}><span className="font-semibold">สาขาปลายทาง:</span> {checkedParcel['สาขาผู้รับ']}</p>
                      {isDelivered && (
                        <p className="text-red-700 text-xs mt-2 italic">* ไม่สามารถยืนยันรับพัสดุรายการนี้ซ้ำได้</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Photo Upload */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    รูปภาพหลักฐาน <span className="text-red-500">*</span>
                  </label>
                  <div
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <Camera className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-foreground font-medium">ลากรูปภาพมาที่นี่</p>
                    <p className="text-xs text-muted-foreground mt-1">หรือคลิกเพื่อเลือกไฟล์</p>
                    <p className="text-xs text-muted-foreground mt-2">ไฟล์ต้องเป็นรูปภาพเท่านั้น ระบบจะปรับขนาดอัตโนมัติ</p>
                  </div>
                </div>

                {/* Photo Preview */}
                {photoPreview && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">ตัวอย่างรูปภาพ</label>
                    <div className="relative">
                      <img
                        src={photoPreview}
                        alt="Preview"
                        className="max-w-full rounded border border-border max-h-64 object-cover"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setPhotoPreview(null);
                          setPhotoUrl('');
                        }}
                        className="absolute top-2 right-2"
                      >
                        ✕ ลบ
                      </Button>
                    </div>
                  </div>
                )}

                {/* Additional Options */}
                <div className="space-y-4 pt-2">
                  {/* Forwarding Option */}
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="forwarding" 
                        checked={isForwarding} 
                        onCheckedChange={(checked) => setIsForwarding(checked as boolean)} 
                      />
                      <label 
                        htmlFor="forwarding" 
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        ส่งต่อพัสดุไปสาขาอื่น
                      </label>
                    </div>
                    {isForwarding && (
                      <div className="pl-6 space-y-3 animate-in fade-in slide-in-from-top-2">
                        <Input 
                          placeholder="ชื่อผู้ส่งต่อ (ผู้ส่งใหม่)" 
                          value={forwardSender}
                          onChange={(e) => setForwardSender(e.target.value)}
                        />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          <Select
                            value={forwardFromBranch}
                            onValueChange={(value) => {
                              setForwardFromBranch(value);
                              if (value !== OTHER_BRANCH_VALUE) setCustomForwardFromBranch('');
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="จากสาขา" />
                            </SelectTrigger>
                            <SelectContent>
                              {branches.map((branch) => (
                                <SelectItem key={branch} value={branch}>
                                  {branch}
                                </SelectItem>
                              ))}
                              <SelectItem value={OTHER_BRANCH_VALUE}>อื่นๆ (ระบุเอง)</SelectItem>
                            </SelectContent>
                          </Select>
                          {forwardFromBranch === OTHER_BRANCH_VALUE && (
                            <div className="mt-2">
                              <Input
                                placeholder="ระบุสาขาต้นทาง"
                                value={customForwardFromBranch}
                                onChange={(e) => setCustomForwardFromBranch(e.target.value)}
                              />
                              <p className="text-[11px] text-amber-600 mt-1">* สาขาที่ระบุเองนี้จะไม่แสดงพิกัดบนแผนที่ติดตามพัสดุ</p>
                            </div>
                          )}
                          
                          <Select
                            value={forwardToBranch}
                            onValueChange={(value) => {
                              setForwardToBranch(value);
                              if (value !== OTHER_BRANCH_VALUE) setCustomForwardToBranch('');
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="ไปสาขา" />
                            </SelectTrigger>
                            <SelectContent>
                              {branches.map((branch) => {
                                const isDest = parcelDest === branch;
                                return (
                                  <SelectItem 
                                    key={branch} 
                                    value={branch}
                                    disabled={isDest}
                                    className={isDest ? 'opacity-50' : ''}
                                  >
                                    {branch} {isDest && '(ปลายทาง - ให้กดยืนยันปกติ)'}
                                  </SelectItem>
                                );
                              })}
                              <SelectItem value={OTHER_BRANCH_VALUE}>อื่นๆ (ระบุเอง)</SelectItem>
                            </SelectContent>
                          </Select>
                          {forwardToBranch === OTHER_BRANCH_VALUE && (
                            <div className="mt-2">
                              <Input
                                placeholder="ระบุสาขาปลายทาง"
                                value={customForwardToBranch}
                                onChange={(e) => setCustomForwardToBranch(e.target.value)}
                              />
                              <p className="text-[11px] text-amber-600 mt-1">* สาขาที่ระบุเองนี้จะไม่แสดงพิกัดบนแผนที่ติดตามพัสดุ</p>
                            </div>
                          )}
                        </div>
                        {parcelDest && (
                          <p className="text-xs text-muted-foreground font-medium mt-1 bg-muted/50 p-2 rounded">
                            * หากพัสดุถึงสาขาปลายทาง (<b>{parcelDest}</b>) แล้ว ไม่ต้องติ๊กส่งต่อ ให้กดยืนยันการรับพัสดุได้ตามปกติเลยครับ
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Proxy Receiver Option */}
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="proxy" 
                        checked={isProxy} 
                        onCheckedChange={(checked) => setIsProxy(checked as boolean)} 
                      />
                      <label 
                        htmlFor="proxy" 
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        มีผู้รับแทน
                      </label>
                    </div>
                    {isProxy && (
                      <div className="pl-6 animate-in fade-in slide-in-from-top-2">
                        <Input 
                          placeholder="ระบุชื่อผู้รับแทน" 
                          value={proxyName} 
                          onChange={(e) => setProxyName(e.target.value)} 
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Note */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">หมายเหตุ (ไม่บังคับ)</label>
                  <Textarea
                    placeholder="เช่น สภาพดี, ไม่มีความเสียหาย"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                  />
                </div>

                {/* Submit Button */}
                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <Button type="submit" disabled={isLoading || !photoUrl || isDelivered} className="gap-2 flex-1">
                    <Upload className="w-4 h-4" />
                    {isLoading ? 'กำลังส่ง...' : isDelivered ? 'ไม่สามารถทำรายการได้' : 'ยืนยันการส่ง'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Info Card */}
        <div className="lg:col-span-1">
          <Card className="bg-blue-50 border-blue-200">
            <CardHeader>
              <CardTitle className="text-blue-900">💡 เคล็ดลับ</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-blue-800">
              <div>
                <p className="font-medium mb-1">✓ ถ่ายรูปที่ชัดเจน</p>
                <p>ถ่ายรูปพัสดุในแสงสว่างเพื่อให้เห็นรายละเอียดชัดเจน</p>
              </div>
              <div>
                <p className="font-medium mb-1">✓ แสดงหลักฐาน</p>
                <p>ถ่ายรูปที่แสดงสภาพพัสดุและหลักฐานการรับ</p>
              </div>
              <div>
                <p className="font-medium mb-1">✓ บันทึกหมายเหตุ</p>
                <p>เพิ่มหมายเหตุเกี่ยวกับสภาพพัสดุหากมีความเสียหาย</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>ตรวจสอบข้อมูลก่อนยืนยัน</DialogTitle>
            <DialogDescription>
              โปรดตรวจสอบข้อมูลที่คุณกรอกให้ถูกต้อง ข้อมูลจะไม่สามารถแก้ไขได้ภายหลัง
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-3 items-center gap-4">
              <span className="font-semibold text-sm text-muted-foreground text-right">Tracking ID:</span>
              <span className="col-span-2 font-mono font-bold text-primary">{trackingId}</span>
            </div>
            
            {isForwarding && (
              <div className="bg-amber-50 p-3 rounded-md text-sm border border-amber-200 space-y-2">
                <p className="font-bold text-amber-800">📦 ส่งต่อพัสดุ</p>
                <p className="text-amber-900"><span className="font-semibold">ผู้ส่งต่อ:</span> {forwardSender}</p>
                <p className="text-amber-900"><span className="font-semibold">จากสาขา:</span> {forwardFromBranch === OTHER_BRANCH_VALUE ? customForwardFromBranch : forwardFromBranch} <span className="font-semibold">→ ไปสาขา:</span> {forwardToBranch === OTHER_BRANCH_VALUE ? customForwardToBranch : forwardToBranch}</p>
              </div>
            )}
            
            {!isForwarding && isProxy && (
              <div className="bg-blue-50 p-3 rounded-md text-sm border border-blue-200 space-y-2">
                <p className="font-bold text-blue-800">👤 มีผู้รับแทน</p>
                <p className="text-blue-900"><span className="font-semibold">ชื่อผู้รับแทน:</span> {proxyName}</p>
              </div>
            )}
            
            {!isForwarding && !isProxy && (
              <div className="bg-green-50 p-3 rounded-md text-sm border border-green-200 space-y-2">
                <p className="font-bold text-green-800">✅ ยืนยันการรับพัสดุตามปกติ<br/><span className="text-xs font-normal">(ผู้รับตัวจริง / ถึงปลายทางแล้ว)</span></p>
              </div>
            )}

            {note && (
              <div className="grid grid-cols-3 items-start gap-4">
                <span className="font-semibold text-sm text-muted-foreground text-right">หมายเหตุ:</span>
                <span className="col-span-2 text-sm">{note}</span>
              </div>
            )}

            {photoPreview && (
              <div className="flex flex-col items-center mt-2">
                <span className="font-semibold text-sm text-muted-foreground mb-2">รูปภาพหลักฐาน:</span>
                <img src={photoPreview} alt="Preview" className="w-32 h-32 object-cover rounded-md border border-border shadow-sm" />
              </div>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2 mt-4">
            <Button variant="outline" onClick={() => setIsConfirmDialogOpen(false)} className="flex-1">
              ยกเลิก
            </Button>
            <Button onClick={executeConfirm} disabled={isLoading} className="flex-1 gap-2">
              <Upload className="w-4 h-4" />
              ยืนยันการส่ง
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
