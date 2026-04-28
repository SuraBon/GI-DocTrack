import { useEffect, useRef, useState, useCallback, memo } from 'react';
import L from 'leaflet';
import { MapView } from './Map';
import type { TimelineEvent } from '@/types/timeline';

// Master Data: พิกัดของแต่ละสาขา
const BRANCH_COORDS: Record<string, { lat: number; lng: number }> = {
  "MS": { lat: 13.6863417, lng: 100.5473102 },
  "พระประแดง": { lat: 13.6316148, lng: 100.5298312 },
  "บางนา": { lat: 13.6750005, lng: 100.5957341 },
  "มีนบุรี": { lat: 13.8158352, lng: 100.7511927 },
  "เลียบด่วน": { lat: 13.7831602, lng: 100.6073732 },
  "เดอะมอลล์บางกะปิ": { lat: 13.7657541, lng: 100.6421960 },
  "วิภาวดี": { lat: 13.8079029, lng: 100.5605981 },
  "พิบูลสงคราม": { lat: 13.8278215, lng: 100.5026199 },
  "พันธุ์สงคราม": { lat: 13.8278215, lng: 100.5026199 }, // alias รองรับข้อมูลเก่า
  "เดอะมอลล์บางแค": { lat: 13.7129595, lng: 100.4079480 },
  "มหาชัย": { lat: 13.5485480, lng: 100.2621752 },
  "ศาลายา": { lat: 13.7851938, lng: 100.2716878 },
  "กาญจนา": { lat: 13.6922140, lng: 100.4081029 },
  "เซ็นทรัล พระราม 2": { lat: 13.6634845, lng: 100.4375234 },
  "เซ็นทรัลพระราม 2": { lat: 13.6634845, lng: 100.4375234 }, // alias รองรับข้อมูลเก่า
};

interface TrackingMapProps {
  events: TimelineEvent[];
}

const DEFAULT_CENTER = BRANCH_COORDS['บางนา'];

function TrackingMap({ events }: TrackingMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const polylineRef = useRef<L.Polyline | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);

  // ดึงสาขาที่มีพิกัดออกมาจาก Timeline และดึงสาขาปลายทางจากการส่งต่อ
  const locations: string[] = [];
  events.forEach((e) => {
    if (e.location && BRANCH_COORDS[e.location]) {
      locations.push(e.location);
    }
    if (e.description && e.description.includes('ไปยังสาขา:')) {
      const match = e.description.match(/ไปยังสาขา:\s*(.*)/);
      if (match && match[1]) {
        const dest = match[1].trim();
        if (BRANCH_COORDS[dest]) locations.push(dest);
      }
    }
  });

  // กรองเฉพาะสถานที่ที่ไม่ซ้ำกันติดกัน (กันกรณีอยู่สาขาเดิม)
  const pathBranches = locations.filter((loc, index, arr) => index === 0 || loc !== arr[index - 1]);
  const missingCoords = events.some((event) => event.location && !BRANCH_COORDS[event.location]);
  const hasRouteData = pathBranches.length > 0;

  const handleMapReady = useCallback((map: L.Map) => {
    mapRef.current = map;
    setIsMapReady(true);
  }, []);

  useEffect(() => {
    if (!mapRef.current || !isMapReady) return;
    const map = mapRef.current;

    // เคลียร์หมุดและเส้นเก่า
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];
    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }

    if (!hasRouteData) {
      map.setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], 7);
      return;
    }

    const pathCoordinates = pathBranches.map(branch => BRANCH_COORDS[branch]);

    // สร้างหมุด (Markers)
    pathCoordinates.forEach((coord, index) => {
      const isLast = index === pathCoordinates.length - 1;

      // สร้างหมุดแบบไอคอน + ชื่อย่อสาขา
      const markerDiv = document.createElement('div');
      const branchLabel = pathBranches[index];
      const isDestination = index === pathCoordinates.length - 1;

      markerDiv.className = [
        'min-w-[70px] h-10 px-3 rounded-2xl border-2 border-white shadow-xl',
        'text-[10px] font-black font-display text-white flex items-center justify-center gap-2 uppercase tracking-tighter transition-transform hover:scale-110',
        isDestination ? 'bg-primary ring-4 ring-primary/20' : 'bg-blue-600',
      ].join(' ');
      
      const icon = isLast ? 'local_shipping' : 'location_on';
      markerDiv.innerHTML = `<span class="material-symbols-outlined text-sm font-bold">${icon}</span><span class="truncate">${branchLabel.slice(0, 10)}</span>`;

      const marker = L.marker([coord.lat, coord.lng], {
        icon: L.divIcon({
          html: markerDiv.outerHTML,
          className: 'branch-marker',
          iconSize: [100, 40],
          iconAnchor: [50, 20],
        }),
      });
      marker.bindPopup(`
        <div style="padding: 12px; font-family: 'Manrope', sans-serif; min-width: 220px;">
          <div style="font-weight: 800; color: #091426; font-size: 14px; text-transform: uppercase;">${branchLabel}</div>
          <div style="color: #61646b; margin-top: 6px; font-size: 12px; font-weight: 500;">${isDestination ? 'จุดล่าสุดของพัสดุ' : 'จุดแวะพักระหว่างทาง'}</div>
          <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #f0f0f0; font-size: 11px; color: #fea619; font-weight: 700;">LOGITRACK NETWORK</div>
        </div>
      `, { autoPanPadding: [20, 20], className: 'logitrack-popup' });
      marker.addTo(map);

      markersRef.current.push(marker);
    });

    // วาดเส้นทาง (Polyline)
    polylineRef.current = L.polyline(
      pathCoordinates.map((coord) => [coord.lat, coord.lng] as [number, number]),
      {
        color: '#ff6b00',
        opacity: 0.85,
        weight: 8,
        lineCap: 'round',
        lineJoin: 'round',
        dashArray: '12, 16',
      }
    );
    polylineRef.current.addTo(map);

    if (pathCoordinates.length > 1) {
      const bounds = L.latLngBounds(pathCoordinates.map((coord) => [coord.lat, coord.lng] as [number, number]));
      map.fitBounds(bounds, { padding: [40, 40] });
      if (map.getZoom() > 14) map.setZoom(14);
    } else if (pathCoordinates.length === 1) {
      map.setView([pathCoordinates[0].lat, pathCoordinates[0].lng], 13);
    }

    return () => {
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current = [];
      if (polylineRef.current) {
        polylineRef.current.remove();
        polylineRef.current = null;
      }
    };
  }, [hasRouteData, isMapReady, pathBranches.join(',')]);

  useEffect(() => {
    if (!mapRef.current) return;
    setTimeout(() => {
      mapRef.current?.invalidateSize();
    }, 100);
  }, [isMapReady]);

  return (
    <div className="w-full rounded-3xl overflow-hidden border border-outline-variant/30 shadow-md bg-white">
      {!hasRouteData && (
        <div className="px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-secondary bg-secondary-container/10 border-b border-outline-variant/10 flex items-center gap-2">
          <span className="material-symbols-outlined text-base">info</span>
          {!missingCoords ? 'ยังไม่มีข้อมูลตำแหน่งพัสดุ แสดงจุดศูนย์กลางหลัก' : 'พบสาขาที่ไม่มีพิกัดในระบบ แสดงจุดศูนย์กลางหลัก'}
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
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-600"></span> จุดแวะพัก</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span> จุดล่าสุด</span>
        </div>
        <span className="text-secondary">LogiTrack Maps v2.0</span>
      </div>
    </div>
  );
}

export default memo(TrackingMap);
