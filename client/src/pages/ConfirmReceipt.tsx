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
import { useParcelStore } from '@/hooks/useParcelStore';
import { getBranches, getParcel } from '@/lib/parcelService';
import { toast } from 'sonner';
import { Upload, Search, Camera } from 'lucide-react';
import type { Parcel } from '@/types/parcel';

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
        
        setForwardFromBranch(currentBranch);
        setParcelDest(p['สาขาผู้รับ']);
        setForwardToBranch(''); // Reset
        setCheckedParcel(p);
        
        toast.success(`พบข้อมูลพัสดุ (ปลายทาง: ${p['สาขาผู้รับ']})`);
      } else {
        toast.error('ไม่พบข้อมูลพัสดุ');
        setParcelDest(null);
        setCheckedParcel(null);
      }
    } catch (e) {
      toast.error('เกิดข้อผิดพลาดในการตรวจสอบ');
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

    if (!photoUrl) {
      toast.error('กรุณาเลือกรูปภาพ');
      return;
    }

    if (isForwarding) {
      if (!forwardSender.trim() || !forwardFromBranch || !forwardToBranch) {
        toast.error('กรุณากรอกข้อมูลการส่งต่อให้ครบ (ชื่อผู้ส่ง, สาขาต้นทาง, สาขาปลายทาง)');
        return;
      }
    }

    if (isProxy && !proxyName.trim()) {
      toast.error('กรุณาระบุชื่อผู้รับแทน');
      return;
    }

    if (!window.confirm('คุณแน่ใจหรือไม่ว่าต้องการยืนยันการทำรายการนี้? ข้อมูลจะไม่สามารถแก้ไขได้ภายหลัง')) {
      return;
    }

    setIsLoading(true);
    try {
      let finalNote = note;
      const additionalNotes = [];
      const nowStr = new Date().toLocaleString('th-TH');
      
      if (isForwarding && forwardToBranch) {
        additionalNotes.push(`[ส่งต่อโดย: ${forwardSender} จากสาขา: ${forwardFromBranch} ไปสาขา: ${forwardToBranch} เมื่อ: ${nowStr} รูปภาพ: |IMAGE_URL|]`);
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
        setNote('');
        setIsForwarding(false);
        setForwardSender('');
        setForwardFromBranch('');
        setForwardToBranch('');
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
        <h1 className="text-3xl font-bold text-foreground">ยืนยันการส่งพัสดุ</h1>
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
                  <div className="flex gap-2">
                    <Input
                      placeholder="เช่น TRK20260420001"
                      value={trackingId}
                      onChange={(e) => setTrackingId(e.target.value)}
                      className="flex-1"
                    />
                    <Button 
                      type="button" 
                      variant="secondary" 
                      onClick={handleCheckParcel}
                      disabled={isChecking}
                    >
                      {isChecking ? '⏳' : <Search className="w-4 h-4" />}
                    </Button>
                  </div>
                  
                  {checkedParcel && (
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-md text-sm space-y-1 animate-in fade-in slide-in-from-top-2">
                      <p className="text-blue-900"><span className="font-semibold">ผู้รับ:</span> {checkedParcel['ผู้รับ']}</p>
                      <p className="text-blue-900"><span className="font-semibold">สาขาปลายทาง:</span> {checkedParcel['สาขาผู้รับ']}</p>
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
                        <div className="grid grid-cols-2 gap-2">
                          <Select value={forwardFromBranch} onValueChange={setForwardFromBranch}>
                            <SelectTrigger>
                              <SelectValue placeholder="จากสาขา" />
                            </SelectTrigger>
                            <SelectContent>
                              {branches.map((branch) => (
                                <SelectItem key={branch} value={branch}>
                                  {branch}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          
                          <Select value={forwardToBranch} onValueChange={setForwardToBranch}>
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
                            </SelectContent>
                          </Select>
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
                <div className="flex gap-3 pt-4">
                  <Button type="submit" disabled={isLoading || !photoUrl} className="gap-2 flex-1">
                    <Upload className="w-4 h-4" />
                    {isLoading ? 'กำลังส่ง...' : 'ยืนยันการส่ง'}
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
    </div>
  );
}
