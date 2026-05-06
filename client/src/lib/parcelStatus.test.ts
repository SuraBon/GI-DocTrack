import { describe, expect, it } from 'vitest';
import { applyDerivedStatus, summarizeParcels } from './parcelStatus';
import type { Parcel } from '@/types/parcel';

const baseParcel: Parcel = {
  TrackingID: 'TRK1',
  'วันที่สร้าง': '1 มกราคม 2569',
  'ผู้ส่ง': 'A',
  'สาขาผู้ส่ง': 'ศูนย์ใหญ่บางนา',
  'ผู้รับ': 'B',
  'สาขาผู้รับ': 'มีนบุรี',
  'ประเภทเอกสาร': 'เอกสาร',
  'สถานะ': 'ส่งสำเร็จ',
};

describe('parcelStatus', () => {
  it('keeps delivered when final note is receive', () => {
    const parcel = applyDerivedStatus({
      ...baseParcel,
      'หมายเหตุ': '[รับพัสดุเรียบร้อย เมื่อ: 1 มกราคม 2569]',
    });
    expect(parcel['สถานะ']).toBe('ส่งสำเร็จ');
  });

  it('changes to transit when last note is forwarding', () => {
    const parcel = applyDerivedStatus({
      ...baseParcel,
      'หมายเหตุ': '[รับพัสดุเรียบร้อย เมื่อ: 1 มกราคม 2569] [ส่งต่อโดย: x จากสาขา: a ไปสาขา: b เมื่อ: 2 มกราคม 2569]',
    });
    expect(parcel['สถานะ']).toBe('กำลังจัดส่ง');
  });

  it('summarizes statuses correctly', () => {
    const summary = summarizeParcels([
      { ...baseParcel, TrackingID: '1', 'สถานะ': 'รอสถานะจัดส่ง' },
      { ...baseParcel, TrackingID: '2', 'สถานะ': 'กำลังจัดส่ง' },
      { ...baseParcel, TrackingID: '3', 'สถานะ': 'ส่งสำเร็จ' },
    ]);
    expect(summary).toEqual({ total: 3, pending: 1, transit: 1, delivered: 1 });
  });
});
