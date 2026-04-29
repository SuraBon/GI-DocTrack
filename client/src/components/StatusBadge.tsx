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
        return 'bg-amber-100 text-amber-900 border border-amber-200/50 shadow-sm';
      case 'กำลังจัดส่ง':
        return 'bg-blue-100 text-blue-900 border border-blue-200/50 shadow-sm';
      case 'ส่งถึงแล้ว':
        return 'bg-emerald-100 text-emerald-900 border border-emerald-200/50 shadow-sm pl-3';
      default:
        return 'bg-slate-100 text-slate-700 border border-slate-200/50';
    }
  };

  const getStatusDot = (status: ParcelStatus) => {
    switch (status) {
      case 'รอจัดส่ง':
        return 'bg-amber-500';
      case 'กำลังจัดส่ง':
        return 'bg-blue-500';
      case 'ส่งถึงแล้ว':
        return 'bg-emerald-500';
      default:
        return 'bg-slate-400';
    }
  };

  const isDelivered = status === 'ส่งถึงแล้ว';

  return (
    <span
      className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-display font-bold transition-all duration-300 ${getStatusStyles(status)} ${className}`}
    >
      {isDelivered ? (
        <span className="material-symbols-outlined text-sm text-emerald-600" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
      ) : (
        <span className={`inline-block w-2 h-2 rounded-full ${getStatusDot(status)} ${status === 'กำลังจัดส่ง' ? 'animate-pulse' : ''}`} />
      )}
      {status}
    </span>
  );
}
