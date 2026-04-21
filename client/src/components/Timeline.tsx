/**
 * Timeline Component
 * แสดงเส้นเวลาการจัดส่งพัสดุแบบทีละขั้นตอน
 * Design: Minimalist Logistics
 */

import type { TimelineEvent } from '@/types/timeline';
import { CheckCircle2, Circle, Clock } from 'lucide-react';
import ImagePopup from '@/components/ImagePopup';

interface TimelineProps {
  events: TimelineEvent[];
  className?: string;
}

export default function Timeline({ events, className = '' }: TimelineProps) {
  const getStatusIcon = (status: TimelineEvent['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />;
      case 'current':
        return <Circle className="w-6 h-6 text-blue-600 flex-shrink-0 animate-pulse" />;
      case 'pending':
        return <Circle className="w-6 h-6 text-gray-300 flex-shrink-0" />;
      default:
        return <Circle className="w-6 h-6 text-gray-300 flex-shrink-0" />;
    }
  };

  const getStatusColor = (status: TimelineEvent['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 border-green-200';
      case 'current':
        return 'bg-blue-50 border-blue-200';
      case 'pending':
        return 'bg-gray-50 border-gray-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const getLineColor = (status: TimelineEvent['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-green-200';
      case 'current':
        return 'bg-blue-200';
      case 'pending':
        return 'bg-gray-200';
      default:
        return 'bg-gray-200';
    }
  };

  return (
    <div className={`space-y-0 ${className}`}>
      {events.map((event, index) => (
        <div key={event.id} className="flex gap-4 pb-6 relative">
          {/* Vertical Line */}
          {index < events.length - 1 && (
            <div className="absolute left-3 top-10 w-0.5 h-12 bg-gray-200" />
          )}

          {/* Icon */}
          <div className="relative z-10 pt-0.5">
            {getStatusIcon(event.status)}
          </div>

          {/* Content */}
          <div className={`flex-1 p-4 rounded-lg border ${getStatusColor(event.status)}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <h4 className="font-semibold text-foreground text-sm md:text-base">{event.title}</h4>
                {event.description && (
                  <p className="text-sm text-muted-foreground mt-1">{event.description}</p>
                )}
              </div>
              {event.status === 'current' && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-200 text-blue-800 text-xs font-medium whitespace-nowrap">
                  <Clock className="w-3 h-3" />
                  ปัจจุบัน
                </span>
              )}
            </div>

            {/* Metadata */}
            <div className="mt-3 flex flex-col md:flex-row md:items-center gap-2 text-xs text-muted-foreground">
              <time className="font-mono">{event.timestamp}</time>
              {event.location && (
                <>
                  <span className="hidden md:inline">•</span>
                  <span>📍 {event.location}</span>
                </>
              )}
            </div>
            
            {/* Image */}
            {event.imageUrl && (
              <div className="mt-4">
                <p className="text-xs font-medium text-muted-foreground mb-2">รูปภาพหลักฐาน:</p>
                <ImagePopup url={event.imageUrl} />
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
