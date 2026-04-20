/**
 * Settings Page
 * ตั้งค่า Google Apps Script URL และสาขา
 * Design: Minimalist Logistics
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { getBranches, setBranches } from '@/lib/parcelService';
import { Save, AlertCircle } from 'lucide-react';

export default function Settings() {
  const [branches, setBranchesState] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setBranchesState(getBranches().join('\n'));
  }, []);

  const handleSave = async () => {

    const branchList = branches
      .split('\n')
      .map((b) => b.trim())
      .filter(Boolean);

    if (branchList.length === 0) {
      toast.error('กรุณากรอกชื่อสาขาอย่างน้อย 1 สาขา');
      return;
    }

    setIsLoading(true);
    try {
      setBranches(branchList);
      toast.success('บันทึกการตั้งค่าแล้ว');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">การตั้งค่า</h1>
        <p className="text-sm text-muted-foreground mt-1">ตั้งค่า Google Apps Script URL และรายชื่อสาขา</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="lg:col-span-2 space-y-6">

          {/* Branches */}
          <Card>
            <CardHeader>
              <CardTitle>รายชื่อสาขา</CardTitle>
              <CardDescription>กรอกชื่อสาขาแต่ละสาขาในบรรทัดใหม่</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">สาขา</label>
                <Textarea
                  placeholder="สำนักงานใหญ่\nสาขากรุงเทพ\nสาขาเชียงใหม่\nสาขาขอนแก่น"
                  value={branches}
                  onChange={(e) => setBranchesState(e.target.value)}
                  rows={6}
                />
                <p className="text-xs text-muted-foreground">
                  กรอกชื่อสาขาแต่ละสาขาในบรรทัดใหม่ (ไม่ต้องมีเครื่องหมายลำดับ)
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <Button onClick={handleSave} disabled={isLoading} className="gap-2 w-full md:w-auto">
            <Save className="w-4 h-4" />
            {isLoading ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
          </Button>
        </div>

        {/* Info Card */}
        <div className="lg:col-span-1">
          <Card className="bg-amber-50 border-amber-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-900">
                <AlertCircle className="w-5 h-5" />
                ข้อมูลสำคัญ
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-amber-800">
              <div>
                <p className="font-medium mb-1">🏢 ชื่อสาขา</p>
                <p className="text-xs">ชื่อสาขาต้องตรงกับชื่อในระบบ Google Sheet</p>
              </div>
              <div>
                <p className="font-medium mb-1">🔒 ความปลอดภัย</p>
                <p className="text-xs">ข้อมูลการตั้งค่าจะบันทึกในเบราว์เซอร์ของคุณเท่านั้น</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
