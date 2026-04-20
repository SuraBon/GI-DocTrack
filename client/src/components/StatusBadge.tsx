/**
 * Status Badge Component
 * แสดงสถานะของพัสดุด้วยสี
 */

import type { ParcelStatus } from '@/types/parcel';

interface StatusBadgeProps {
  status: ParcelStatus;
  className?: string;
}

export default function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const getStatusStyles = (status: ParcelStatus) => {
    switch (status) {
      case 'รอจัดส่ง':
        return 'bg-amber-100 text-amber-800';
      case 'กำลังจัดส่ง':
        return 'bg-blue-100 text-blue-800';
      case 'ส่งถึงแล้ว':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusDot = (status: ParcelStatus) => {
    switch (status) {
      case 'รอจัดส่ง':
        return 'bg-amber-500';
      case 'กำลังจัดส่ง':
        return 'bg-blue-500';
      case 'ส่งถึงแล้ว':
        return 'bg-green-500';
      default:
        return 'bg-gray-400';
    }
  };

  return (
    <span
      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${getStatusStyles(status)} ${className}`}
    >
      <span className={`inline-block w-2 h-2 rounded-full ${getStatusDot(status)}`} />
      {status}
    </span>
  );
}
