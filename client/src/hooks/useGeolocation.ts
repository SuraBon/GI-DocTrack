/**
 * useGeolocation Hook
 * ขอพิกัด GPS แบบ real-time ผ่าน Geolocation API
 */

import { useState, useCallback } from 'react';

export interface GeoPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export type GeoStatus = 'idle' | 'loading' | 'success' | 'denied' | 'error';

export interface UseGeolocationReturn {
  position: GeoPosition | null;
  status: GeoStatus;
  errorMessage: string | null;
  requestLocation: () => void;
  reset: () => void;
}

export function useGeolocation(): UseGeolocationReturn {
  const [position, setPosition] = useState<GeoPosition | null>(null);
  const [status, setStatus] = useState<GeoStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus('error');
      setErrorMessage('เบราว์เซอร์ของคุณไม่รองรับ GPS');
      return;
    }

    setStatus('loading');
    setErrorMessage(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        setStatus('success');
        setErrorMessage(null);
      },
      (err) => {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setStatus('denied');
            setErrorMessage('กรุณาเปิด GPS (Location Services) เพื่อดำเนินการต่อ');
            break;
          case err.POSITION_UNAVAILABLE:
            setStatus('error');
            setErrorMessage('ไม่สามารถระบุตำแหน่งได้ กรุณาลองใหม่');
            break;
          case err.TIMEOUT:
            setStatus('error');
            setErrorMessage('หมดเวลาในการระบุตำแหน่ง กรุณาลองใหม่');
            break;
          default:
            setStatus('error');
            setErrorMessage('เกิดข้อผิดพลาดในการระบุตำแหน่ง');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000,
      },
    );
  }, []);

  const reset = useCallback(() => {
    setPosition(null);
    setStatus('idle');
    setErrorMessage(null);
  }, []);

  return { position, status, errorMessage, requestLocation, reset };
}
