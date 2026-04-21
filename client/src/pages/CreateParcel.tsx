/**
 * Create Parcel Page
 * สร้างรายการพัสดุใหม่
 * Design: Minimalist Logistics
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
import { Copy, Plus } from 'lucide-react';

const DOC_TYPES = ['เอกสาร', 'พัสดุ'];
const OTHER_BRANCH_VALUE = '__OTHER_BRANCH__';
const OTHER_DOC_TYPE_VALUE = '__OTHER_DOC_TYPE__';

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
  const [customDocType, setCustomDocType] = useState('');

  const [createdTrackingId, setCreatedTrackingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const senderBranchSelectValue = formData.senderBranch || (customSenderBranch ? OTHER_BRANCH_VALUE : '');
  const receiverBranchSelectValue = formData.receiverBranch || (customReceiverBranch ? OTHER_BRANCH_VALUE : '');
  const docTypeSelectValue = formData.docType || (customDocType ? OTHER_DOC_TYPE_VALUE : '');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const finalSenderBranch = senderBranchSelectValue === OTHER_BRANCH_VALUE ? customSenderBranch.trim() : formData.senderBranch.trim();
    const finalReceiverBranch = receiverBranchSelectValue === OTHER_BRANCH_VALUE ? customReceiverBranch.trim() : formData.receiverBranch.trim();
    const finalDocType = docTypeSelectValue === OTHER_DOC_TYPE_VALUE ? customDocType.trim() : formData.docType.trim();

    if (senderBranchSelectValue === OTHER_BRANCH_VALUE && !finalSenderBranch) {
      toast.error('กรุณาระบุสาขาผู้ส่ง');
      return;
    }
    if (receiverBranchSelectValue === OTHER_BRANCH_VALUE && !finalReceiverBranch) {
      toast.error('กรุณาระบุสาขาผู้รับ');
      return;
    }
    if (docTypeSelectValue === OTHER_DOC_TYPE_VALUE && !finalDocType) {
      toast.error('กรุณาระบุประเภทเอกสาร/พัสดุ');
      return;
    }

    if (!formData.senderName || !finalSenderBranch || !formData.receiverName || !finalReceiverBranch || !finalDocType) {
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
        finalDocType,
        formData.description,
        formData.note
      );

      if (trackingId) {
        setCreatedTrackingId(trackingId);
        toast.success(`สร้างรายการสำเร็จ! ID: ${trackingId}`);
        setFormData({
          senderName: '',
          senderBranch: '',
          receiverName: '',
          receiverBranch: '',
          docType: '',
          description: '',
          note: '',
        });
        setCustomSenderBranch('');
        setCustomReceiverBranch('');
        setCustomDocType('');
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
      toast.success(`คัดลอกแล้ว: ${createdTrackingId}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">สร้างรายการพัสดุใหม่</h1>
        <p className="text-sm text-muted-foreground mt-1">กรอกข้อมูลรายละเอียดของพัสดุที่ต้องการจัดส่ง</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>ข้อมูลพัสดุ</CardTitle>
              <CardDescription>กรอกข้อมูลผู้ส่ง ผู้รับ และรายละเอียดพัสดุ</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Sender Section */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-foreground">ข้อมูลผู้ส่ง</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">
                        ชื่อผู้ส่ง <span className="text-red-500">*</span>
                      </label>
                      <Input
                        name="senderName"
                        value={formData.senderName}
                        onChange={handleInputChange}
                        placeholder="เช่น บริษัท ABC"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">
                        สาขาผู้ส่ง <span className="text-red-500">*</span>
                      </label>
                      <Select
                        value={senderBranchSelectValue}
                        onValueChange={(value) => {
                          if (value === OTHER_BRANCH_VALUE) {
                            handleSelectChange('senderBranch', '');
                          } else {
                            setCustomSenderBranch('');
                            handleSelectChange('senderBranch', value);
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="เลือกสาขา" />
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
                      {senderBranchSelectValue === OTHER_BRANCH_VALUE && (
                        <Input
                          value={customSenderBranch}
                          onChange={(e) => setCustomSenderBranch(e.target.value)}
                          placeholder="ระบุสาขาผู้ส่ง"
                          className="mt-2"
                          required
                        />
                      )}
                    </div>
                  </div>
                </div>

                {/* Receiver Section */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-foreground">ข้อมูลผู้รับ</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">
                        ชื่อผู้รับ <span className="text-red-500">*</span>
                      </label>
                      <Input
                        name="receiverName"
                        value={formData.receiverName}
                        onChange={handleInputChange}
                        placeholder="เช่น บริษัท XYZ"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">
                        สาขาผู้รับ <span className="text-red-500">*</span>
                      </label>
                      <Select
                        value={receiverBranchSelectValue}
                        onValueChange={(value) => {
                          if (value === OTHER_BRANCH_VALUE) {
                            handleSelectChange('receiverBranch', '');
                          } else {
                            setCustomReceiverBranch('');
                            handleSelectChange('receiverBranch', value);
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="เลือกสาขา" />
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
                      {receiverBranchSelectValue === OTHER_BRANCH_VALUE && (
                        <Input
                          value={customReceiverBranch}
                          onChange={(e) => setCustomReceiverBranch(e.target.value)}
                          placeholder="ระบุสาขาผู้รับ"
                          className="mt-2"
                          required
                        />
                      )}
                    </div>
                  </div>
                </div>

                {/* Document Type */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    ประเภทเอกสาร/พัสดุ <span className="text-red-500">*</span>
                  </label>
                  <Select
                    value={docTypeSelectValue}
                    onValueChange={(value) => {
                      if (value === OTHER_DOC_TYPE_VALUE) {
                        handleSelectChange('docType', '');
                      } else {
                        setCustomDocType('');
                        handleSelectChange('docType', value);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="เลือกประเภท" />
                    </SelectTrigger>
                    <SelectContent>
                      {DOC_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                      <SelectItem value={OTHER_DOC_TYPE_VALUE}>อื่นๆ (ระบุเอง)</SelectItem>
                    </SelectContent>
                  </Select>
                  {docTypeSelectValue === OTHER_DOC_TYPE_VALUE && (
                    <Input
                      value={customDocType}
                      onChange={(e) => setCustomDocType(e.target.value)}
                      placeholder="ระบุประเภทเอกสาร/พัสดุ"
                      className="mt-2"
                      required
                    />
                  )}
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">รายละเอียด</label>
                  <Textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="เช่น ใบสั่งซื้อ #12345, 10 กล่อง"
                    rows={3}
                  />
                </div>

                {/* Note */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">หมายเหตุ</label>
                  <Textarea
                    name="note"
                    value={formData.note}
                    onChange={handleInputChange}
                    placeholder="เช่น ห้ามเปิด, เอกสารสำคัญ"
                    rows={2}
                  />
                </div>

                {/* Submit Button */}
                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <Button type="submit" disabled={isLoading} className="gap-2 flex-1">
                    <Plus className="w-4 h-4" />
                    {isLoading ? 'กำลังสร้าง...' : 'สร้างรายการ'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Result Card */}
        {createdTrackingId && (
          <div className="lg:col-span-1">
            <Card className="border-green-200 bg-green-50">
              <CardHeader>
                <CardTitle className="text-green-900">สร้างสำเร็จ!</CardTitle>
                <CardDescription className="text-green-700">Tracking ID ของคุณ</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-white p-4 rounded border border-green-200">
                  <code className="text-lg font-mono font-bold text-primary">{createdTrackingId}</code>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button onClick={handleCopyTrackingId} variant="outline" className="flex-1 gap-2">
                    <Copy className="w-4 h-4" />
                    คัดลอก
                  </Button>
                  <Button onClick={() => {
                    const printWindow = window.open('', '', 'width=400,height=300');
                    if (printWindow) {
                      printWindow.document.write(`<div style="text-align:center;font-family:sans-serif;padding:20px;"><h2>Messenger Tracker</h2><h1>${createdTrackingId}</h1><p>Date: ${new Date().toLocaleDateString()}</p><button onclick="window.print()" style="padding:10px;margin-top:20px;">Print</button></div>`);
                      printWindow.document.close();
                    }
                  }} variant="outline" className="flex-1 gap-2">
                    🖨️ พิมพ์
                  </Button>
                </div>
                <p className="text-sm text-green-700">
                  ✓ บันทึกหรือแชร์ Tracking ID นี้เพื่อติดตามสถานะการจัดส่ง
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
