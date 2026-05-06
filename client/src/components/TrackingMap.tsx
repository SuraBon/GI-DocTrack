import { useEffect, useRef, useState, useCallback, useMemo, memo } from 'react';
import L from 'leaflet';
import { MapView } from './Map';
import type { TimelineEvent } from '@/types/timeline';
import { formatThaiDateTime } from '@/lib/dateUtils';

const DEFAULT_CENTER = { lat: 13.7563, lng: 100.5018 }; // กรุงเทพฯ

/** Escape a string so it is safe to embed in HTML attribute/text context. */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface TrackingMapProps {
  events: TimelineEvent[];
  className?: string;
  mapClassName?: string;
}

function TrackingMap({ events, className = '', mapClassName = 'h-[250px] sm:h-[300px] md:h-[400px] max-h-[50vh]' }: TrackingMapProps) {
  const mapRef      = useRef<L.Map | null>(null);
  const markersRef  = useRef<L.Marker[]>([]);
  const polylineRef = useRef<L.Polyline | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);

  // Derive the ordered list of coordinate-bearing events from the timeline.
  // ใช้เฉพาะ GPS จริงจาก events — ไม่ fallback ไปหา branch coordinates
  const { pathEntries, hasUnresolved } = useMemo(() => {
    const entries: { lat: number; lng: number; label: string; isGps: boolean; isLast: boolean; event: TimelineEvent }[] = [];

    for (const e of events) {
      // ใช้เฉพาะ GPS จริงเท่านั้น
      if (
        typeof e.latitude === 'number' &&
        typeof e.longitude === 'number' &&
        isFinite(e.latitude) &&
        isFinite(e.longitude)
      ) {
        entries.push({
          lat: e.latitude,
          lng: e.longitude,
          label: e.location || 'GPS',
          isGps: true,
          isLast: false,
          event: e,
        });
      }
    }

    // Deduplicate consecutive identical coordinates
    const deduped = entries.filter((entry, i, arr) => {
      if (i === 0) return true;
      const prev = arr[i - 1];
      return entry.lat !== prev.lat || entry.lng !== prev.lng;
    });

    // Mark the last entry
    if (deduped.length > 0) {
      deduped[deduped.length - 1].isLast = true;
    }

    // hasUnresolved = มี event ที่ไม่มี GPS (แสดงเพื่อ inform user)
    const hasUnresolved = events.some(e =>
      e.title !== 'รับพัสดุเข้าระบบ' &&
      e.status === 'completed' &&
      (typeof e.latitude !== 'number' || typeof e.longitude !== 'number')
    );

    return { pathEntries: deduped, hasUnresolved };
  }, [events]);

  const hasRouteData = pathEntries.length > 0;

  const handleMapReady = useCallback((map: L.Map) => {
    mapRef.current = map;
    setIsMapReady(true);
  }, []);

  useEffect(() => {
    if (!mapRef.current || !isMapReady) return;
    const map = mapRef.current;

    // Clear previous markers and polyline
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    polylineRef.current?.remove();
    polylineRef.current = null;

    if (!hasRouteData) {
      map.setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], 7);
      return;
    }

    pathEntries.forEach((entry) => {
      const { lat, lng, label, isGps, isLast, event } = entry;
      const eventDate = event.timestamp ? formatThaiDateTime(event.timestamp) : '';
      const safeLabel     = escapeHtml(label || 'GPS');
      const iconName      = isLast ? 'local_shipping' : isGps ? 'my_location' : 'location_on';
      const bgClass       = isLast
        ? 'bg-primary ring-4 ring-primary/20'
        : isGps
          ? 'bg-green-600'
          : 'bg-blue-600';

      const html = `<div class="min-w-[80px] h-auto px-2 py-1.5 rounded-xl border-2 border-white shadow-xl flex flex-col items-center justify-center uppercase tracking-tighter ${bgClass}">
        <div class="flex items-center gap-1 text-white font-black text-[10px]">
          <span class="material-symbols-outlined text-xs">${iconName}</span>
          <span class="truncate max-w-[80px]">${safeLabel}</span>
        </div>
        ${eventDate ? `<div class="text-[8px] text-white/90 font-bold mt-0.5 whitespace-nowrap">${escapeHtml(eventDate)}</div>` : ''}
      </div>`;

      const marker = L.marker([lat, lng], {
        icon: L.divIcon({ html, className: 'branch-marker bg-transparent', iconSize: [100, 46], iconAnchor: [50, 23] }),
      });

      // Safe popup — use textContent via DOM, not innerHTML
      const popupEl = document.createElement('div');
      popupEl.style.cssText = 'padding:12px;font-family:Manrope,sans-serif;min-width:220px';

      const title = document.createElement('div');
      title.style.cssText = 'font-weight:800;color:#091426;font-size:14px;text-transform:uppercase';
      title.textContent = label || 'GPS Location';

      const sub = document.createElement('div');
      sub.style.cssText = 'color:#61646b;margin-top:6px;font-size:12px;font-weight:500';
      if (isGps) {
        sub.textContent = `📍 ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      } else {
        sub.textContent = isLast ? 'จุดล่าสุดของพัสดุ' : 'จุดแวะพักระหว่างทาง';
      }

      popupEl.append(title, sub);

      // Show image if available
      if (event.imageUrl) {
        const img = document.createElement('img');
        img.src = event.imageUrl;
        img.style.cssText = 'width:100%;max-height:120px;object-fit:cover;border-radius:8px;margin-top:8px';
        img.alt = 'หลักฐาน';
        popupEl.appendChild(img);
      }

      // Show timestamp if available
      if (eventDate) {
        const time = document.createElement('div');
        time.style.cssText = 'margin-top:6px;font-size:11px;color:#61646b;font-weight:500';
        time.textContent = eventDate;
        popupEl.appendChild(time);
      }

      const footer = document.createElement('div');
      footer.style.cssText = 'margin-top:10px;padding-top:10px;border-top:1px solid #f0f0f0;font-size:11px;color:#fea619;font-weight:700';
      footer.textContent = isGps ? 'GPS REAL-TIME LOCATION' : 'LOGITRACK NETWORK';

      popupEl.appendChild(footer);
      marker.bindPopup(popupEl, { autoPanPadding: [20, 20], className: 'logitrack-popup' });
      marker.addTo(map);
      markersRef.current.push(marker);
    });

    const coords = pathEntries.map(e => [e.lat, e.lng] as [number, number]);
    polylineRef.current = L.polyline(
      coords,
      { color: '#ff6b00', opacity: 0.85, weight: 6, lineCap: 'round', lineJoin: 'round', dashArray: '10, 12' },
    ).addTo(map);

    // Draw directional arrows along the path
    for (let i = 0; i < pathEntries.length - 1; i++) {
      const p1 = pathEntries[i];
      const p2 = pathEntries[i + 1];

      // Calculate midpoint
      const midLat = (p1.lat + p2.lat) / 2;
      const midLng = (p1.lng + p2.lng) / 2;

      // Calculate bearing (angle)
      const dLng = p2.lng - p1.lng;
      const dLat = p2.lat - p1.lat;
      const angle = (Math.atan2(dLng, dLat) * 180) / Math.PI;

      const arrowHtml = `<div style="transform: rotate(${angle}deg); display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;">
        <span class="material-symbols-outlined" style="color: #ff6b00; font-size: 20px; font-weight: 900; text-shadow: 1px 1px 0 #fff, -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 0px 2px 4px rgba(0,0,0,0.3);">navigation</span>
      </div>`;

      const arrowMarker = L.marker([midLat, midLng], {
        icon: L.divIcon({ html: arrowHtml, className: 'bg-transparent border-none', iconSize: [24, 24], iconAnchor: [12, 12] }),
        interactive: false,
        keyboard: false
      });
      arrowMarker.addTo(map);
      markersRef.current.push(arrowMarker);
    }

    if (coords.length > 1) {
      const bounds = L.latLngBounds(coords);
      map.fitBounds(bounds, { padding: [40, 40] });
      if (map.getZoom() > 14) map.setZoom(14);
    } else {
      map.setView(coords[0], 13);
    }

    return () => {
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      polylineRef.current?.remove();
      polylineRef.current = null;
    };
  }, [hasRouteData, isMapReady, pathEntries]);

  useEffect(() => {
    if (!mapRef.current) return;
    const frame = requestAnimationFrame(() => {
      mapRef.current?.invalidateSize();
    });
    return () => cancelAnimationFrame(frame);
  }, [isMapReady]);

  const hasGpsMarkers = pathEntries.some(e => e.isGps);

  return (
    <div className={`flex w-full flex-col overflow-hidden rounded-3xl border border-outline-variant/30 bg-white shadow-md ${className}`}>
      {!hasRouteData && (
        <div className="px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-secondary bg-secondary-container/10 border-b border-outline-variant/10 flex items-center gap-2">
          <span className="material-symbols-outlined text-base">info</span>
          ยังไม่มีข้อมูล GPS — แผนที่จะแสดงเมื่อมีการยืนยันรับพัสดุ
        </div>
      )}
      {hasRouteData && hasUnresolved && (
        <div className="px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-amber-700 bg-amber-50 border-b border-amber-200 flex items-center gap-2">
          <span className="material-symbols-outlined text-base">warning</span>
          บางจุดไม่มีข้อมูล GPS จึงไม่แสดงบนแผนที่
        </div>
      )}
      <MapView
        className={`${mapClassName} w-full flex-1`}
        initialCenter={DEFAULT_CENTER}
        initialZoom={7}
        onMapReady={handleMapReady}
      />
      <div className="px-5 py-3 bg-surface-container-low border-t border-outline-variant/10 text-[10px] font-black text-on-surface-variant/40 uppercase tracking-widest flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-600" /> GPS จริง
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" /> จุดล่าสุด
          </span>
        </div>
        <span className="text-secondary">LogiTrack Maps</span>
      </div>
    </div>
  );
}

export default memo(TrackingMap);
