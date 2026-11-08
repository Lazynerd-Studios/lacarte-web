'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Truck, Navigation, Clock, Wifi, WifiOff } from 'lucide-react';
import { PickupService } from '@/lib/services/api-services';
import { subscribeToPickupTracking, type TrackingEvent } from '@/lib/services/tracking-sse';
import { MapService } from '@/lib/services/map-service';
import { InteractiveMap } from '@/components/map/interactive-map';
import { MapConfig } from '@/lib/config';
import { useAuth } from '@/providers/app-providers';
import { StatusBadge, PageLoader } from '@/components/ui/common';
import { pickupBadgeState } from '@/lib/domain/payment-state';

type TruckPosition = { lat: number; lon: number };

export default function LivePickupTrackingPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();

  const [connected, setConnected] = useState(false);
  const [truckPosition, setTruckPosition] = useState<TruckPosition | null>(null);
  // Driver name and truck plate exist only on the live SSE stream — the pickup
  // payload carries no driver fields (track_screen.dart reads them off events).
  const [driverName, setDriverName] = useState<string | null>(null);
  const [truckPlate, setTruckPlate] = useState<string | null>(null);
  const [routePolyline, setRoutePolyline] = useState<[number, number][]>([]);
  const [etaMinutes, setEtaMinutes] = useState<number | null>(null);

  const { data: pickup, isLoading } = useQuery({
    queryKey: ['pickup-request', id],
    queryFn: () => PickupService.getPickupRequestById(id),
    enabled: Boolean(id),
    refetchInterval: 15000,
  });

  const pickupPoint =
    pickup?.customer.location ?? profile?.customer?.location ?? null;

  const destination = useMemo<[number, number]>(
    () => [
      pickupPoint?.latitude ?? MapConfig.defaultLat,
      pickupPoint?.longitude ?? MapConfig.defaultLon,
    ],
    [pickupPoint?.latitude, pickupPoint?.longitude],
  );

  const addressLabel = useMemo(() => {
    if (!pickup) return 'Your Pickup Location';
    const joined = [pickup.customer.address, pickup.customer.city]
      .filter((s) => s.trim() !== '')
      .join(', ');
    return joined || 'Your Pickup Location';
  }, [pickup]);

  const handleEvent = useCallback(
    (event: TrackingEvent) => {
      setConnected(true);
      if (event.driverName) setDriverName(event.driverName);
      if (event.truckPlate) setTruckPlate(event.truckPlate);
      if (event.type !== 'location') return;

      const position = { lat: event.latitude, lon: event.longitude };
      setTruckPosition(position);

      // Server-supplied drive time first, so an ETA appears even without routing.
      if (event.durationSeconds != null) {
        setEtaMinutes(Math.max(1, Math.round(event.durationSeconds / 60)));
      }

      void (async () => {
        try {
          const route = await MapService.getRoute(
            [position.lat, position.lon],
            destination,
          );
          if (route.points.length > 0) {
            setRoutePolyline(route.points);
          }
          if (route.travelTimeSeconds != null) {
            setEtaMinutes(Math.max(1, Math.round(route.travelTimeSeconds / 60)));
          }
        } catch {
          // Routing is a nicety — keep the raw GPS fix if TomTom is unreachable.
        }
      })();
    },
    [destination],
  );

  useEffect(() => {
    if (!id) return;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let unsubscribe: (() => void) | null = null;
    let cancelled = false;

    const connect = () => {
      unsubscribe = subscribeToPickupTracking({
        pickupId: id,
        onEvent: (event) => {
          if (cancelled) return;
          handleEvent(event);
        },
        onError: () => {
          if (cancelled) return;
          setConnected(false);
          reconnectTimer = setTimeout(connect, 5000);
        },
      });
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      unsubscribe?.();
    };
  }, [id, handleEvent]);

  if (isLoading) return <PageLoader label="Connecting to live truck telemetry..." />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="p-2 rounded-xl bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-extrabold text-gray-900">Live Collection Tracking</h1>
            <p className="text-xs text-gray-500">
              {pickup?.disposableItemType.name || 'Waste Pickup'} • {addressLabel}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
              connected ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
            }`}
          >
            {connected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            {connected ? 'Live GPS Stream' : 'Waiting for GPS Signal'}
          </span>
          {pickup && <StatusBadge {...pickupBadgeState(pickup)} />}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Telemetry Panel */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-[#307224]/10 text-[#307224] flex items-center justify-center shrink-0">
                <Truck className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs font-semibold text-gray-400 uppercase">Assigned Driver</div>
                <div className="text-base font-extrabold text-gray-900">
                  {driverName || 'LaCarte Dispatch Crew'}
                </div>
                {truckPlate && (
                  <div className="text-xs font-semibold text-[#307224]">Truck: {truckPlate}</div>
                )}
              </div>
            </div>

            {etaMinutes != null ? (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Clock className="w-5 h-5 text-[#307224]" />
                  <div>
                    <div className="text-xs font-semibold text-emerald-800">Estimated Arrival</div>
                    <div className="text-lg font-extrabold text-[#1B4332]">~{etaMinutes} mins away</div>
                  </div>
                </div>
                <Navigation className="w-5 h-5 text-[#307224]" />
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-gray-50 text-xs text-gray-600">
                As soon as the collection truck starts broadcasting GPS coordinates, the live route and ETA will appear on the map.
              </div>
            )}

            <div className="p-3 rounded-xl bg-gray-50 text-[11px] leading-relaxed text-gray-500">
              Driver name and truck plate come from the collection
              truck&apos;s live GPS feed. LaCarte does not publish a driver phone
              number.
            </div>
          </div>
        </div>

        {/* Right Interactive Map */}
        <div className="lg:col-span-8 min-h-[450px] bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <InteractiveMap
            center={destination}
            zoom={14}
            driverLocation={
              truckPosition ? [truckPosition.lat, truckPosition.lon] : null
            }
            routePoints={routePolyline}
            className="w-full h-full min-h-[450px]"
          />
        </div>
      </div>
    </div>
  );
}

