/**
 * Timeline Types
 * ประเภทข้อมูลสำหรับเส้นเวลาการจัดส่ง
 */

export type TimelineStatus = 'completed' | 'current' | 'pending';

export interface TimelineEvent {
  id: string;
  status: TimelineStatus;
  title: string;
  description?: string;
  timestamp: string;
  location?: string;
  icon?: string;
}

export interface ParcelTimeline {
  trackingId: string;
  events: TimelineEvent[];
  currentStatus: string;
  estimatedDelivery?: string;
}
