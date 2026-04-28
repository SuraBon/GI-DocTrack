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

interface TrackingMapProps {
  events: TimelineEvent[];
}

function TrackingMap({ events }: TrackingMapProps) {
  const mapRef      = useRef<L.Map | null>(null);
  const markersRef  = useRef<L.Marker[]>([]);
  const polylineRef = useRef<L.Polyline | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);

  // Derive the ordered list of known-coordinate branches from the timeline.
  // Memoised so it only recomputes when events change.
  const { pathBranches, hasUnknownBranch } = useMemo(() => {
    const locations: string[] = [];
    for (const e of events) {
      if (e.location && BRANCH_COORDS[e.location]) {
        locations.push(e.location);
      }
      if (e.description?.includes('ไปยังสาขา:')) {
        const match = e.description.match(/ไปยังสาขา:\s*(.*)/);
        const dest = match?.[1]?.trim();
        if (dest && BRANCH_COORDS[dest]) locations.push(dest);
      }
    }
    // Deduplicate consecutive identical branches
    const path = locations.filter((loc, i, arr) => i === 0 || loc !== arr[i - 1]);
    const hasUnknown = events.some(e => e.location && !BRANCH_COORDS[e.location]);
    return { pathBranches: path, hasUnknownBranch: hasUnknown };
  }, [events]);

  const hasRouteData = pathBranches.length > 0;

  const handleMapReady = useCallback((map: L.Map) => {
    mapRef.current = map;
    setIsMapReady(true);
  }, []);

  // Stable dep key — only changes when the actual path changes
  const pathKey = pathBranches.join('|');

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

    const pathCoords = pathBranches.map(b => BRANCH_COORDS[b]);

    pathCoords.forEach((coord, index) => {
      const isLast        = index === pathCoords.length - 1;
      const branchLabel   = pathBranches[index];
      const safeLabel     = escapeHtml(branchLabel);
      const iconName      = isLast ? 'local_shipping' : 'location_on';
      const bgClass       = isLast ? 'bg-primary ring-4 ring-primary/20' : 'bg-blue-600';

      const html = `<div class="min-w-[70px] h-10 px-3 rounded-2xl border-2 border-white shadow-xl text-[10px] font-black text-white flex items-center justify-center gap-2 uppercase tracking-tighter ${bgClass}"><span class="material-symbols-outlined text-sm">${iconName}</span><span class="truncate">${safeLabel.slice(0, 10)}</span></div>`;

      const marker = L.marker([coord.lat, coord.lng], {
        icon: L.divIcon({ html, className: 'branch-marker', iconSize: [100, 40], iconAnchor: [50, 20] }),
      });

      // Safe popup — use textContent via DOM, not innerHTML
      const popupEl = document.createElement('div');
      popupEl.style.cssText = 'padding:12px;font-family:Manrope,sans-serif;min-width:220px';

      const title = document.createElement('div');
      title.style.cssText = 'font-weight:800;color:#091426;font-size:14px;text-transform:uppercase';
      title.textContent = branchLabel;

      const sub = document.createElement('div');
      sub.style.cssText = 'color:#61646b;margin-top:6px;font-size:12px;font-weight:500';
      sub.textContent = isLast ? 'จุดล่าสุดของพัสดุ' : 'จุดแวะพักระหว่างทาง';

      const footer = document.createElement('div');
      footer.style.cssText = 'margin-top:10px;padding-top:10px;border-top:1px solid #f0f0f0;font-size:11px;color:#fea619;font-weight:700';
      footer.textContent = 'LOGITRACK NETWORK';

      popupEl.append(title, sub, footer);
      marker.bindPopup(popupEl, { autoPanPadding: [20, 20], className: 'logitrack-popup' });
      marker.addTo(map);
      markersRef.current.push(marker);
    });

    polylineRef.current = L.polyline(
      pathCoords.map(c => [c.lat, c.lng] as [number, number]),
      { color: '#ff6b00', opacity: 0.85, weight: 8, lineCap: 'round', lineJoin: 'round', dashArray: '12, 16' },
    ).addTo(map);

    if (pathCoords.length > 1) {
      const bounds = L.latLngBounds(pathCoords.map(c => [c.lat, c.lng] as [number, number]));
      map.fitBounds(bounds, { padding: [40, 40] });
      if (map.getZoom() > 14) map.setZoom(14);
    } else {
      map.setView([pathCoords[0].lat, pathCoords[0].lng], 13);
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
    const id = setTimeout(() => mapRef.current?.invalidateSize(), 100);
    return () => clearTimeout(id);
  }, [isMapReady]);

  return (
    <div className="w-full rounded-3xl overflow-hidden border border-outline-variant/30 shadow-md bg-white">
      {!hasRouteData && (
        <div className="px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-secondary bg-secondary-container/10 border-b border-outline-variant/10 flex items-center gap-2">
          <span className="material-symbols-outlined text-base">info</span>
          {hasUnknownBranch
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
