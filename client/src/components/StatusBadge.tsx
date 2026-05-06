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
        return 'bg-amber-100 text-amber-900 border border-amber-200/60 shadow-[0_1px_4px_rgba(245,158,11,0.16)]';
      case 'กำลังจัดส่ง':
        return 'bg-blue-100 text-blue-900 border border-blue-200/60 shadow-[0_1px_4px_rgba(37,99,235,0.16)]';
      case 'ส่งถึงแล้ว':
        return 'bg-emerald-100 text-emerald-900 border border-emerald-200/60 shadow-[0_1px_4px_rgba(16,185,129,0.16)]';
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
      className={`inline-flex h-7 w-[104px] items-center justify-center gap-1.5 rounded-full px-2.5 text-[11px] font-display font-black leading-none whitespace-nowrap transition-all duration-300 ${getStatusStyles(status)} ${className}`}
    >
      {isDelivered ? (
        <span className="material-symbols-outlined text-[14px] leading-none text-emerald-600" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
      ) : (
        <span className={`inline-block h-1.5 w-1.5 rounded-full ${getStatusDot(status)} ${status === 'กำลังจัดส่ง' ? 'animate-pulse' : ''}`} />
      )}
      <span className="leading-none">{status}</span>
    </span>
  );
}
