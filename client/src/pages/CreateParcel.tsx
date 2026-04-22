/**
 * Create Parcel Page
 * สร้างรายการพัสดุใหม่
 * Design: Premium Logistics
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useParcelStore } from '@/hooks/useParcelStore';
import { getBranches } from '@/lib/parcelService';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Copy, Plus, CheckCircle2, User, MapPin, Package, FileText, Printer } from 'lucide-react';

const DOC_TYPES = ['เอกสาร', 'พัสดุ'];
const OTHER_BRANCH_VALUE = '__OTHER_BRANCH__';

export default function CreateParcel() {
  const { createParcel, error } = useParcelStore();
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

  const [createdTrackingId, setCreatedTrackingId] = useState<string | null>(null);
  const [isResultOpen, setIsResultOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const finalSenderBranch = formData.senderBranch === OTHER_BRANCH_VALUE ? customSenderBranch.trim() : formData.senderBranch.trim();
    const finalReceiverBranch = formData.receiverBranch === OTHER_BRANCH_VALUE ? customReceiverBranch.trim() : formData.receiverBranch.trim();

    if (!formData.senderName || !finalSenderBranch || !formData.receiverName || !finalReceiverBranch || !formData.docType) {
      toast.error('กรุณากรอกข้อมูลที่จำเป็นให้ครบ');
      return;
    }

    setIsLoading(true);
    try {
      const trackingId = await createParcel(
        formData.senderName,
        finalSenderBranch,
        formData.receiverName,
        finalReceiverBranch,
        formData.docType,
        formData.description,
        formData.note
      );

      if (trackingId) {
        setCreatedTrackingId(trackingId);
        setIsResultOpen(true);
        toast.success(`สร้างรายการสำเร็จ!`);
        setFormData({
          senderName: '', senderBranch: '', receiverName: '', receiverBranch: '',
          docType: '', description: '', note: '',
        });
        setCustomSenderBranch('');
        setCustomReceiverBranch('');
      } else {
        toast.error(error || 'ไม่สามารถสร้างรายการได้');
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
    <div className="max-w-4xl mx-auto space-y-8 pb-20 animate-in fade-in duration-700">
      <div className="space-y-1">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">สร้างรายการใหม่</h1>
        <p className="text-slate-500">กรอกข้อมูลรายละเอียดของพัสดุเพื่อเริ่มต้นการจัดส่ง</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Sender Section */}
          <Card className="border-none shadow-xl rounded-3xl overflow-hidden bg-white">
            <CardHeader className="bg-slate-50 p-6 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-xl text-primary">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-lg">ข้อมูลผู้ส่ง</CardTitle>
                  <CardDescription>รายละเอียดต้นทาง</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">ชื่อผู้ส่ง *</label>
                <Input name="senderName" value={formData.senderName} onChange={handleInputChange} placeholder="เช่น บริษัท สาขาหลัก" className="rounded-xl border-slate-200" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">สาขาผู้ส่ง *</label>
                <Select value={formData.senderBranch} onValueChange={(v) => handleSelectChange('senderBranch', v)}>
                  <SelectTrigger className="rounded-xl border-slate-200">
                    <SelectValue placeholder="เลือกสาขา" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {branches.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                    <SelectItem value={OTHER_BRANCH_VALUE}>อื่นๆ</SelectItem>
                  </SelectContent>
                </Select>
                {formData.senderBranch === OTHER_BRANCH_VALUE && (
                  <Input value={customSenderBranch} onChange={(e) => setCustomSenderBranch(e.target.value)} placeholder="ระบุสาขาผู้ส่ง" className="mt-2 rounded-xl" />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Receiver Section */}
          <Card className="border-none shadow-xl rounded-3xl overflow-hidden bg-white">
            <CardHeader className="bg-slate-50 p-6 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-xl text-emerald-600">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-lg">ข้อมูลผู้รับ</CardTitle>
                  <CardDescription>รายละเอียดปลายทาง</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">ชื่อผู้รับ *</label>
                <Input name="receiverName" value={formData.receiverName} onChange={handleInputChange} placeholder="เช่น คุณสมชาย" className="rounded-xl border-slate-200" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">สาขาผู้รับ *</label>
                <Select value={formData.receiverBranch} onValueChange={(v) => handleSelectChange('receiverBranch', v)}>
                  <SelectTrigger className="rounded-xl border-slate-200">
                    <SelectValue placeholder="เลือกสาขา" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {branches.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                    <SelectItem value={OTHER_BRANCH_VALUE}>อื่นๆ</SelectItem>
                  </SelectContent>
                </Select>
                {formData.receiverBranch === OTHER_BRANCH_VALUE && (
                  <Input value={customReceiverBranch} onChange={(e) => setCustomReceiverBranch(e.target.value)} placeholder="ระบุสาขาผู้รับ" className="mt-2 rounded-xl" />
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Parcel Details */}
        <Card className="border-none shadow-xl rounded-3xl overflow-hidden bg-white">
          <CardHeader className="bg-slate-50 p-6 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-xl text-amber-600">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-lg">รายละเอียดพัสดุ</CardTitle>
                <CardDescription>ข้อมูลสิ่งที่ส่งและหมายเหตุ</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4 md:col-span-1">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">ประเภท *</label>
                <Select value={formData.docType} onValueChange={(v) => handleSelectChange('docType', v)}>
                  <SelectTrigger className="rounded-xl border-slate-200">
                    <SelectValue placeholder="เลือกประเภท" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {DOC_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">รายละเอียด</label>
                <Input name="description" value={formData.description} onChange={handleInputChange} placeholder="เช่น เอกสาร 1 ชุด, พัสดุ 1 กล่อง" className="rounded-xl border-slate-200" />
              </div>
            </div>
            <div className="space-y-2 md:col-span-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">หมายเหตุ</label>
              <Textarea name="note" value={formData.note} onChange={handleInputChange} placeholder="ห้ามเปิด, ของแตกหักง่าย..." className="rounded-xl border-slate-200 min-h-[105px]" />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-center pt-4">
          <Button type="submit" disabled={isLoading} className="h-16 px-12 rounded-2xl text-lg font-bold shadow-xl shadow-primary/20 active:scale-95 transition-all">
            <Plus className="w-5 h-5 mr-2" />
            {isLoading ? 'กำลังสร้างรายการ...' : 'ยืนยันสร้างรายการ'}
          </Button>
        </div>
      </form>

      {/* Success Dialog */}
      <Dialog open={isResultOpen} onOpenChange={setIsResultOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl p-8 border-none shadow-2xl overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-emerald-500" />
          <DialogHeader className="text-center">
            <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-12 h-12 text-emerald-600" />
            </div>
            <DialogTitle className="text-2xl font-extrabold text-slate-900">สร้างรายการสำเร็จ!</DialogTitle>
            <DialogDescription className="pt-2">คุณสามารถคัดลอกหรือพิมพ์ใบปะหน้าได้ทันที</DialogDescription>
          </DialogHeader>

          <div className="py-6 space-y-6">
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex flex-col items-center gap-4">
              <code className="text-3xl font-mono font-bold text-primary tracking-wider">{createdTrackingId}</code>
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${createdTrackingId}`} 
                className="w-32 h-32 bg-white p-2 rounded-xl border border-slate-100 shadow-sm"
                alt="QR Code"
              />
            </div>
            
            <div className="flex gap-3">
              <Button onClick={handleCopyTrackingId} variant="outline" className="flex-1 h-12 rounded-xl font-bold">
                <Copy className="w-4 h-4 mr-2" /> คัดลอก ID
              </Button>
              <Button onClick={() => {
                const printWindow = window.open('', '', 'width=400,height=500');
                if (printWindow) {
                  printWindow.document.write(`
                    <div style="text-align:center;font-family:sans-serif;padding:40px; border: 2px dashed #000;">
                      <h2 style="margin:0; color:#666;">DocTrack Parcel</h2>
                      <h1 style="font-size: 48px; margin: 20px 0; font-family: monospace;">${createdTrackingId}</h1>
                      <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${createdTrackingId}" style="width:200px; height:200px;" />
                      <div style="margin-top:20px; text-align:left; border-top:1px solid #eee; padding-top:20px;">
                        <p><strong>จาก:</strong> ${formData.senderName} (${formData.senderBranch})</p>
                        <p><strong>ถึง:</strong> ${formData.receiverName} (${formData.receiverBranch})</p>
                      </div>
                      <p style="margin-top:30px; font-size:12px; color:#999;">พิมพ์เมื่อ: ${new Date().toLocaleString()}</p>
                    </div>
                    <script>window.onload = () => { window.print(); window.close(); }</script>
                  `);
                  printWindow.document.close();
                }
              }} className="flex-1 h-12 rounded-xl font-bold gap-2">
                <Printer className="w-4 h-4" /> พิมพ์ใบปะหน้า
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
