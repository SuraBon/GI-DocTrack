/**
 * Confirm Receipt Page
 * ยืนยันการรับพัสดุด้วยรูปภาพ
 * Design: Minimalist Logistics
n */

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useParcelStore } from '@/hooks/useParcelStore';
import { toast } from 'sonner';
import { Upload, Search, Camera } from 'lucide-react';

export default function ConfirmReceipt() {
  const { confirmReceipt } = useParcelStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [trackingId, setTrackingId] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('กรุณาเลือกไฟล์รูปภาพ');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('ขนาดไฟล์ต้องไม่เกิน 5MB');
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      const preview = e.target?.result as string;
      setPhotoPreview(preview);
      // In a real app, you would upload this to a server
      // For now, we'll use the data URL
      setPhotoUrl(preview);
      toast.success('เลือกรูปภาพสำเร็จ');
    };
    reader.readAsDataURL(file);
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
      const file = files[0];
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const preview = event.target?.result as string;
          setPhotoPreview(preview);
          setPhotoUrl(preview);
          toast.success('เลือกรูปภาพสำเร็จ');
        };
        reader.readAsDataURL(file);
      } else {
        toast.error('กรุณาลากไฟล์รูปภาพ');
      }
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

    setIsLoading(true);
    try {
      const success = await confirmReceipt(trackingId, photoUrl, note);
      if (success) {
        toast.success('ยืนยันการรับสำเร็จ');
        setTrackingId('');
        setPhotoUrl('');
        setPhotoPreview(null);
        setNote('');
      } else {
        toast.error('ไม่สามารถยืนยันการรับได้');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">ยืนยันการรับพัสดุ</h1>
        <p className="text-sm text-muted-foreground mt-1">อัปโหลดรูปภาพเพื่อยืนยันการรับพัสดุ</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>ยืนยันการรับ</CardTitle>
              <CardDescription>กรอก Tracking ID และอัปโหลดรูปภาพหลักฐาน</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Tracking ID */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Tracking ID <span className="text-red-500">*</span>
                  </label>
                  <Input
                    placeholder="เช่น TRK20260420001"
                    value={trackingId}
                    onChange={(e) => setTrackingId(e.target.value)}
                  />
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
                    <p className="text-xs text-muted-foreground mt-2">ไฟล์ต้องเป็นรูปภาพ และไม่เกิน 5MB</p>
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
                    {isLoading ? 'กำลังส่ง...' : 'ยืนยันการรับ'}
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
