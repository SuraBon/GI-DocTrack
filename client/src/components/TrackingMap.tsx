import { useEffect, useRef, useState, useCallback, useMemo, memo } from 'react';
import L from 'leaflet';
import { MapView } from './Map';
import type { TimelineEvent } from '@/types/timeline';

const BRANCH_COORDS: Record<string, { lat: number; lng: number }> = {
  'MS':                   { lat: 13.6863417, lng: 100.5473102 },
  'พระประแดง':            { lat: 13.6316148, lng: 100.5298312 },
  'บางนา':                { lat: 13.6750005, lng: 100.5957341 },
  'มีนบุรี':              { lat: 13.8158352, lng: 100.7511927 },
  'เลียบด่วน':            { lat: 13.7831602, lng: 100.6073732 },
  'เดอะมอลล์บางกะปิ':    { lat: 13.7657541, lng: 100.6421960 },
  'วิภาวดี':              { lat: 13.8079029, lng: 100.5605981 },
  'พิบูลสงคราม':          { lat: 13.8278215, lng: 100.5026199 },
  'พันธุ์สงคราม':         { lat: 13.8278215, lng: 100.5026199 }, // alias
  'เดอะมอลล์บางแค':      { lat: 13.7129595, lng: 100.4079480 },
  'มหาชัย':               { lat: 13.5485480, lng: 100.2621752 },
  'ศาลายา':               { lat: 13.7851938, lng: 100.2716878 },
  'กาญจนา':               { lat: 13.6922140, lng: 100.4081029 },
  'เซ็นทรัล พระราม 2':   { lat: 13.6634845, lng: 100.4375234 },
  'เซ็นทรัลพระราม 2':    { lat: 13.6634845, lng: 100.4375234 }, // alias
};

const DEFAULT_CENTER = BRANCH_COORDS['บางนา'];

/** Escape a string so it is safe to embed in HTML attribute/text context. */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Resolve coordinates for a timeline event — prefer real GPS over branch lookup. */
function resolveCoords(event: TimelineEvent): { lat: number; lng: number } | null {
  // Prefer real GPS coordinates
  if (
    typeof event.latitude === 'number' &&
    typeof event.longitude === 'number' &&
    isFinite(event.latitude) &&
    isFinite(event.longitude)
  ) {
    return { lat: event.latitude, lng: event.longitude };
  }
  // Fallback to branch lookup
  if (event.location && BRANCH_COORDS[event.location]) {
    return BRANCH_COORDS[event.location];
  }
  return null;
}

interface TrackingMapProps {
  events: TimelineEvent[];
}

function TrackingMap({ events }: TrackingMapProps) {
  const mapRef      = useRef<L.Map | null>(null);
  const markersRef  = useRef<L.Marker[]>([]);
  const polylineRef = useRef<L.Polyline | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);

  // Derive the ordered list of coordinate-bearing events from the timeline.
  const { pathEntries, hasUnresolved } = useMemo(() => {
    const entries: { lat: number; lng: number; label: string; isGps: boolean; isLast: boolean; event: TimelineEvent }[] = [];

    for (const e of events) {
      const coords = resolveCoords(e);
      if (coords) {
        const isGps = typeof e.latitude === 'number' && typeof e.longitude === 'number';
        entries.push({
          ...coords,
          label: e.location || (isGps ? 'GPS' : ''),
          isGps,
          isLast: false,
          event: e,
        });
      }

      // Also check for forward destinations in the description
      if (!resolveCoords(e) && e.description?.includes('ไปยังสาขา:')) {
        const match = e.description.match(/ไปยังสาขา:\s*(.*)/);
        const dest = match?.[1]?.trim();
        if (dest && BRANCH_COORDS[dest]) {
          entries.push({
            ...BRANCH_COORDS[dest],
            label: dest,
            isGps: false,
            isLast: false,
            event: e,
          });
        }
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

    const hasUnresolved = events.some(e => e.location && !resolveCoords(e));
    return { pathEntries: deduped, hasUnresolved };
  }, [events]);

  const hasRouteData = pathEntries.length > 0;

  const handleMapReady = useCallback((map: L.Map) => {
    mapRef.current = map;
    setIsMapReady(true);
  }, []);

  // Stable dep key — only changes when the actual path changes
  const pathKey = pathEntries.map(e => `${e.lat},${e.lng}`).join('|');

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
      const safeLabel     = escapeHtml(label || 'GPS');
      const iconName      = isLast ? 'local_shipping' : isGps ? 'my_location' : 'location_on';
      const bgClass       = isLast
        ? 'bg-primary ring-4 ring-primary/20'
        : isGps
          ? 'bg-green-600'
          : 'bg-blue-600';

      const html = `<div class="min-w-[70px] h-10 px-3 rounded-2xl border-2 border-white shadow-xl text-[10px] font-black text-white flex items-center justify-center gap-2 uppercase tracking-tighter ${bgClass}"><span class="material-symbols-outlined text-sm">${iconName}</span><span class="truncate">${safeLabel.slice(0, 10)}</span></div>`;

      const marker = L.marker([lat, lng], {
        icon: L.divIcon({ html, className: 'branch-marker', iconSize: [100, 40], iconAnchor: [50, 20] }),
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
      if (event.timestamp) {
        const time = document.createElement('div');
        time.style.cssText = 'margin-top:6px;font-size:11px;color:#61646b;font-weight:500';
        time.textContent = `🕐 ${event.timestamp}`;
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
      { color: '#ff6b00', opacity: 0.85, weight: 8, lineCap: 'round', lineJoin: 'round', dashArray: '12, 16' },
    ).addTo(map);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasRouteData, isMapReady, pathKey]);

  useEffect(() => {
    if (!mapRef.current) return;
    const frame = requestAnimationFrame(() => {
      mapRef.current?.invalidateSize();
    });
    return () => cancelAnimationFrame(frame);
  }, [isMapReady]);

  const hasGpsMarkers = pathEntries.some(e => e.isGps);

  return (
    <div className="w-full rounded-3xl overflow-hidden border border-outline-variant/30 shadow-md bg-white">
      {!hasRouteData && (
        <div className="px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-secondary bg-secondary-container/10 border-b border-outline-variant/10 flex items-center gap-2">
          <span className="material-symbols-outlined text-base">info</span>
          {hasUnresolved
            ? 'พบสาขาที่ไม่มีพิกัดในระบบ แสดงจุดศูนย์กลางหลัก'
            : 'ยังไม่มีข้อมูลตำแหน่งพัสดุ แสดงจุดศูนย์กลางหลัก'}
        </div>
      )}
      <MapView
        className="h-[250px] sm:h-[300px] md:h-[400px] max-h-[50vh] w-full"
        initialCenter={DEFAULT_CENTER}
        initialZoom={7}
        onMapReady={handleMapReady}
      />
      <div className="px-5 py-3 bg-surface-container-low border-t border-outline-variant/10 text-[10px] font-black text-on-surface-variant/40 uppercase tracking-widest flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-600" /> จุดแวะพัก
          </span>
          {hasGpsMarkers && (
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-600" /> GPS จริง
            </span>
          )}
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
