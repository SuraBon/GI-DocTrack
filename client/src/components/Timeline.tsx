/**
 * Timeline Component
 * แสดงเส้นเวลาการจัดส่งพัสดุแบบทีละขั้นตอน
 * Design: Premium Minimalist Logistics
 */

import type { TimelineEvent } from '@/types/timeline';
import { CheckCircle2, Circle, Clock, MapPin, Sparkles, Package, Truck, Home } from 'lucide-react';
import ImagePopup from '@/components/ImagePopup';
import { formatThaiDateTime } from '@/lib/dateUtils';

interface TimelineProps {
  events: TimelineEvent[];
  className?: string;
}

export default function Timeline({ events, className = '' }: TimelineProps) {
  const isDelivered = events.some((event) => event.title.includes('ส่งถึงแล้ว'));
  const currentEvent = events.find(e => e.status === 'current') || events[0];
  const isTransit = currentEvent?.title.includes('จัดส่ง') || currentEvent?.title.includes('เดินทาง') || currentEvent?.title.includes('ส่งต่อ');
  const isPending = currentEvent?.title.includes('รับพัสดุ') || currentEvent?.title.includes('เข้าระบบ');
  
  const headerStyle = isDelivered 
    ? { icon: 'home_app_logo', color: 'bg-emerald-600', shadow: 'shadow-emerald-200', badge: 'bg-emerald-100 text-emerald-800 border-emerald-200', text: 'จัดส่งสำเร็จเรียบร้อย', sub: 'พัสดุของคุณถูกจัดส่งถึงที่หมายแล้ว ขอบคุณที่ใช้บริการ', badgeText: 'Delivered' }
    : isTransit
      ? { icon: 'local_shipping', color: 'bg-blue-600', shadow: 'shadow-blue-200', badge: 'bg-blue-100 text-blue-800 border-blue-200', text: 'พัสดุกำลังเดินทาง', sub: 'พัสดุของคุณกำลังอยู่ระหว่างการจัดส่งไปยังปลายทาง', badgeText: 'In Transit' }
      : { icon: 'pending_actions', color: 'bg-amber-500', shadow: 'shadow-amber-200', badge: 'bg-amber-100 text-amber-800 border-amber-200', text: 'รับพัสดุเข้าระบบ', sub: 'พัสดุของคุณถูกรับเข้าสู่ระบบและรอคิวจัดส่ง', badgeText: 'In Process' };

  const getStatusIcon = (status: TimelineEvent['status'], title: string) => {
    switch (status) {
      case 'completed':
        return (
          <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-primary text-white shadow-lg shadow-primary/20">
            <span className="material-symbols-outlined text-lg font-bold">check</span>
          </div>
        );
      case 'current':
        return (
          <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-secondary text-primary shadow-lg shadow-secondary/30">
            <div className="absolute inset-0 rounded-full bg-secondary animate-ping opacity-25"></div>
            <span className="material-symbols-outlined text-lg font-bold">
              {title.includes('ส่งต่อ') ? 'local_shipping' : 'radio_button_checked'}
            </span>
          </div>
        );
      case 'pending':
        return (
          <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-surface-container border-2 border-outline-variant">
            <span className="material-symbols-outlined text-lg text-outline-variant">pending</span>
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 rounded-full bg-surface-container border border-outline-variant"></div>
        );
    }
  };

  const getCardStyle = (status: TimelineEvent['status'], title: string) => {
    switch (status) {
      case 'completed':
        return 'bg-white border-outline-variant/30 hover:border-primary/20 hover:bg-surface-container-low/20';
      case 'current':
        const isTransit = title.includes('จัดส่ง') || title.includes('เดินทาง');
        const colorClass = isTransit ? 'border-blue-500 shadow-blue-500/5 ring-blue-500/10' : 'border-secondary shadow-secondary/5 ring-secondary/10';
        return `bg-white ${colorClass} shadow-xl ring-1`;
      case 'pending':
        return 'bg-surface-container-lowest border-outline-variant/20 opacity-70';
      default:
        return 'bg-white border-outline-variant/30';
    }
  };

  const getLineStyle = (status: TimelineEvent['status'], nextStatus?: TimelineEvent['status']) => {
    if (status === 'completed' && nextStatus === 'completed') return 'bg-primary';
    if (status === 'completed' && nextStatus === 'current') return 'bg-gradient-to-b from-primary to-secondary';
    if (status === 'current') return 'bg-gradient-to-b from-secondary to-outline-variant';
    return 'bg-outline-variant';
  };

  return (
    <div className={`relative px-1 ${className}`}>
      {/* Header Summary */}
      <div className="mb-10 rounded-3xl border border-outline-variant/20 bg-white p-6 shadow-md flex items-center gap-4">
        <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${headerStyle.color} text-white ${headerStyle.shadow} shadow-lg`}>
          <span className="material-symbols-outlined text-xl">
            {headerStyle.icon}
          </span>
        </div>
        <div className="flex-1">
          <h3 className="font-display font-black text-primary text-xl leading-tight uppercase tracking-tight">
            {headerStyle.text}
          </h3>
          <p className="text-sm text-on-surface-variant/70 mt-1 font-medium">
            {headerStyle.sub}
          </p>
        </div>
        <div className={`text-[11px] uppercase tracking-widest px-4 py-2 rounded-full font-black shadow-sm border ${headerStyle.badge}`}>
          {headerStyle.badgeText}
        </div>
      </div>

      <div className="relative space-y-0">
        {events.map((event, index) => {
          const nextEvent = events[index + 1];
          return (
            <div
              key={event.id}
              className="pb-10 relative group"
            >
              {/* Event Card */}
              <div className={`p-6 rounded-3xl border transition-all duration-300 ${getCardStyle(event.status, event.title)}`}>
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <h4 className={`font-display font-black text-lg leading-tight ${event.status === 'pending' ? 'text-on-surface-variant/40' : 'text-primary'}`}>
                        {event.title}
                      </h4>
                      {event.status === 'current' && (
                        <div className="flex gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-secondary animate-ping" />
                          <span className="h-1.5 w-1.5 rounded-full bg-secondary" />
                        </div>
                      )}
                    </div>
                    {event.description && (
                      <p className={`text-sm leading-relaxed font-medium ${event.status === 'pending' ? 'text-on-surface-variant/40' : 'text-on-surface-variant/70'}`}>
                        {event.description}
                      </p>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    {getStatusIcon(event.status, event.title)}
                  </div>
                </div>
                
                <div className="mt-4 space-y-4">
                  {event.status === 'current' && (
                    <div>
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black border uppercase tracking-widest ${
                        event.title.includes('จัดส่ง') || event.title.includes('เดินทาง') 
                          ? 'bg-blue-50 text-blue-700 border-blue-100' 
                          : 'bg-secondary/10 text-primary border-secondary/20'
                      }`}>
                        <span className="material-symbols-outlined text-sm">
                          {event.title.includes('จัดส่ง') || event.title.includes('เดินทาง') ? 'local_shipping' : 'auto_awesome'}
                        </span>
                        {event.title.includes('จัดส่ง') || event.title.includes('เดินทาง') ? 'In Transit' : 'In Process'}
                      </span>
                    </div>
                  )}

                  {/* Metadata Row */}
                  <div className="flex flex-wrap items-center gap-4 border-t border-outline-variant/10 pt-4">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-on-surface-variant/60">
                      <span className="material-symbols-outlined text-base">schedule</span>
                      <time className="tracking-tight uppercase">{event.timestamp ? formatThaiDateTime(event.timestamp) : '-'}</time>
                    </div>
                    {event.location && (
                      <div className="flex items-center gap-1.5 text-xs font-bold text-on-surface-variant/40">
                        <span className="material-symbols-outlined text-base text-secondary">location_on</span>
                        <span className="tracking-tight text-on-surface-variant/60">{event.location}</span>
                      </div>
                    )}
                  </div>

                  {/* Proof Image */}
                  {event.imageUrl && (
                    <div className="p-1 bg-surface-container-low rounded-2xl inline-block border border-outline-variant/30 overflow-hidden group/img transition-transform hover:scale-[1.02]">
                      <div className="relative">
                        <ImagePopup url={event.imageUrl} className="rounded-xl overflow-hidden" />
                        <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover/img:opacity-100 transition-opacity pointer-events-none" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
