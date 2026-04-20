/**
 * Timeline Mock Data
 * ข้อมูลตัวอย่างสำหรับการแสดง Timeline
 */

import type { ParcelTimeline } from '@/types/timeline';

export const mockTimelineData: Record<string, ParcelTimeline> = {
  'TRK20260420001': {
    trackingId: 'TRK20260420001',
    currentStatus: 'กำลังจัดส่ง',
    estimatedDelivery: '20 เมษายน 2026',
    events: [
      {
        id: '1',
        status: 'completed',
        title: 'รายการถูกสร้าง',
        description: 'พัสดุถูกบันทึกเข้าระบบ',
        timestamp: '18 เมษายน 2026 09:30',
        location: 'สำนักงานใหญ่',
      },
      {
        id: '2',
        status: 'completed',
        title: 'เตรียมพัสดุ',
        description: 'พัสดุกำลังเตรียมสำหรับการจัดส่ง',
        timestamp: '18 เมษายน 2026 14:15',
        location: 'สำนักงานใหญ่',
      },
      {
        id: '3',
        status: 'completed',
        title: 'ออกจากสาขาต้นทาง',
        description: 'พัสดุถูกส่งออกจากสาขา',
        timestamp: '19 เมษายน 2026 08:00',
        location: 'สำนักงานใหญ่',
      },
      {
        id: '4',
        status: 'completed',
        title: 'ถึงศูนย์กระจาย',
        description: 'พัสดุถึงศูนย์กระจายส่วนกลาง',
        timestamp: '19 เมษายน 2026 16:45',
        location: 'ศูนย์กระจายส่วนกลาง',
      },
      {
        id: '5',
        status: 'current',
        title: 'กำลังจัดส่ง',
        description: 'พัสดุกำลังอยู่ในเส้นทางจัดส่ง',
        timestamp: '20 เมษายน 2026 10:30',
        location: 'สาขาเชียงใหม่',
      },
      {
        id: '6',
        status: 'pending',
        title: 'ส่งถึงสาขาปลายทาง',
        description: 'พัสดุจะถึงสาขาปลายทาง',
        timestamp: '20 เมษายน 2026 (คาดว่า)',
        location: 'สาขาเชียงใหม่',
      },
      {
        id: '7',
        status: 'pending',
        title: 'ส่งถึงผู้รับ',
        description: 'พัสดุจะส่งถึงผู้รับ',
        timestamp: '20 เมษายน 2026 (คาดว่า)',
        location: 'ที่อยู่ผู้รับ',
      },
    ],
  },
  'TRK20260419002': {
    trackingId: 'TRK20260419002',
    currentStatus: 'ส่งถึงแล้ว',
    estimatedDelivery: '19 เมษายน 2026',
    events: [
      {
        id: '1',
        status: 'completed',
        title: 'รายการถูกสร้าง',
        description: 'พัสดุถูกบันทึกเข้าระบบ',
        timestamp: '17 เมษายน 2026 10:00',
        location: 'สาขากรุงเทพ',
      },
      {
        id: '2',
        status: 'completed',
        title: 'เตรียมพัสดุ',
        description: 'พัสดุกำลังเตรียมสำหรับการจัดส่ง',
        timestamp: '17 เมษายน 2026 15:30',
        location: 'สาขากรุงเทพ',
      },
      {
        id: '3',
        status: 'completed',
        title: 'ออกจากสาขาต้นทาง',
        description: 'พัสดุถูกส่งออกจากสาขา',
        timestamp: '18 เมษายน 2026 07:00',
        location: 'สาขากรุงเทพ',
      },
      {
        id: '4',
        status: 'completed',
        title: 'ถึงศูนย์กระจาย',
        description: 'พัสดุถึงศูนย์กระจายส่วนกลาง',
        timestamp: '18 เมษายน 2026 18:00',
        location: 'ศูนย์กระจายส่วนกลาง',
      },
      {
        id: '5',
        status: 'completed',
        title: 'ส่งถึงสาขาปลายทาง',
        description: 'พัสดุถึงสาขาปลายทาง',
        timestamp: '19 เมษายน 2026 09:00',
        location: 'สาขาขอนแก่น',
      },
      {
        id: '6',
        status: 'completed',
        title: 'ส่งถึงผู้รับ',
        description: 'พัสดุส่งถึงผู้รับเรียบร้อย',
        timestamp: '19 เมษายน 2026 14:30',
        location: 'ที่อยู่ผู้รับ',
      },
    ],
  },
  'TRK20260420003': {
    trackingId: 'TRK20260420003',
    currentStatus: 'รอจัดส่ง',
    estimatedDelivery: '22 เมษายน 2026',
    events: [
      {
        id: '1',
        status: 'completed',
        title: 'รายการถูกสร้าง',
        description: 'พัสดุถูกบันทึกเข้าระบบ',
        timestamp: '20 เมษายน 2026 11:00',
        location: 'สาขาขอนแก่น',
      },
      {
        id: '2',
        status: 'current',
        title: 'เตรียมพัสดุ',
        description: 'พัสดุกำลังเตรียมสำหรับการจัดส่ง',
        timestamp: '20 เมษายน 2026 (ปัจจุบัน)',
        location: 'สาขาขอนแก่น',
      },
      {
        id: '3',
        status: 'pending',
        title: 'ออกจากสาขาต้นทาง',
        description: 'พัสดุจะถูกส่งออกจากสาขา',
        timestamp: '21 เมษายน 2026 (คาดว่า)',
        location: 'สาขาขอนแก่น',
      },
      {
        id: '4',
        status: 'pending',
        title: 'ถึงศูนย์กระจาย',
        description: 'พัสดุจะถึงศูนย์กระจายส่วนกลาง',
        timestamp: '21 เมษายน 2026 (คาดว่า)',
        location: 'ศูนย์กระจายส่วนกลาง',
      },
      {
        id: '5',
        status: 'pending',
        title: 'ส่งถึงสาขาปลายทาง',
        description: 'พัสดุจะถึงสาขาปลายทาง',
        timestamp: '22 เมษายน 2026 (คาดว่า)',
        location: 'สาขาเชียงใหม่',
      },
      {
        id: '6',
        status: 'pending',
        title: 'ส่งถึงผู้รับ',
        description: 'พัสดุจะส่งถึงผู้รับ',
        timestamp: '22 เมษายน 2026 (คาดว่า)',
        location: 'ที่อยู่ผู้รับ',
      },
    ],
  },
};

export function getMockTimeline(trackingId: string) {
  return mockTimelineData[trackingId] || null;
}
