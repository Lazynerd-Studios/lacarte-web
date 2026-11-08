'use client';

import React, { useEffect, useRef } from 'react';
import { MapConfig } from '@/lib/config';

export interface MapProps {
  center: [number, number];
  zoom?: number;
  driverLocation?: [number, number] | null;
  routePoints?: [number, number][];
  interactive?: boolean;
  onLocationPick?: (lat: number, lon: number) => void;
  className?: string;
}

/**
 * Client-side Leaflet Map component supporting TomTom raster tiles (with OSM
 * fallback), custom pickup & truck markers, route polylines, and click-to-pick.
 */
export function InteractiveMap({
  center,
  zoom = 14,
  driverLocation,
  routePoints = [],
  interactive = true,
  onLocationPick,
  className = 'h-80 w-full rounded-2xl',
}: MapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<import('leaflet').Map | null>(null);
  const userMarkerRef = useRef<import('leaflet').Marker | null>(null);
  const driverMarkerRef = useRef<import('leaflet').Marker | null>(null);
  const polylineRef = useRef<import('leaflet').Polyline | null>(null);
  const didFitBoundsRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    async function initMap() {
      if (!containerRef.current || mapInstanceRef.current) return;
      const L = (await import('leaflet')).default;

      if (!mounted || !containerRef.current) return;

      const map = L.map(containerRef.current, {
        center,
        zoom,
        zoomControl: interactive,
        dragging: interactive,
        scrollWheelZoom: interactive,
        doubleClickZoom: interactive,
        touchZoom: interactive,
      });

      L.tileLayer(MapConfig.appTileUrl, {
        attribution: MapConfig.tomtomAttribution,
        maxZoom: 18,
      }).addTo(map);

      const userIcon = L.divIcon({
        className: 'lacarte-user-pin',
        html: `<div style="width:36px;height:36px;border-radius:9999px;background:#FFB400;border:3px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,0.25);display:flex;align-items:center;justify-content:center;font-size:16px;">📍</div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      userMarkerRef.current = L.marker(center, { icon: userIcon }).addTo(map);

      if (onLocationPick && interactive) {
        map.on('click', (e: import('leaflet').LeafletMouseEvent) => {
          onLocationPick(e.latlng.lat, e.latlng.lng);
        });
      }

      mapInstanceRef.current = map;
    }

    initMap();

    return () => {
      mounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update user marker & center
  useEffect(() => {
    async function syncMarkers() {
      const map = mapInstanceRef.current;
      if (!map) return;
      const L = (await import('leaflet')).default;

      if (userMarkerRef.current) {
        userMarkerRef.current.setLatLng(center);
      }

      if (driverLocation) {
        const truckIcon = L.divIcon({
          className: 'lacarte-truck-pin',
          html: `<div style="width:40px;height:40px;border-radius:9999px;background:#0A0D12;border:3px solid #FFB400;box-shadow:0 6px 14px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:18px;">🚛</div>`,
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        });

        if (!driverMarkerRef.current) {
          driverMarkerRef.current = L.marker(driverLocation, {
            icon: truckIcon,
          }).addTo(map);
        } else {
          driverMarkerRef.current.setLatLng(driverLocation);
        }

        if (!didFitBoundsRef.current) {
          didFitBoundsRef.current = true;
          const bounds = L.latLngBounds([center, driverLocation]);
          map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
        }
      } else {
        if (driverMarkerRef.current) {
          driverMarkerRef.current.remove();
          driverMarkerRef.current = null;
        }
        map.setView(center, map.getZoom());
      }

      // Update route polyline
      if (polylineRef.current) {
        polylineRef.current.remove();
        polylineRef.current = null;
      }
      if (routePoints.length > 1) {
        polylineRef.current = L.polyline(routePoints, {
          color: '#155DFC',
          weight: 5,
          opacity: 0.85,
        }).addTo(map);
      }
    }
    syncMarkers();
  }, [center, driverLocation, routePoints]);

  return (
    <div
      ref={containerRef}
      className={`${className} overflow-hidden border border-[#E2E4E9] bg-[#E5E7EB] relative z-0`}
    />
  );
}

