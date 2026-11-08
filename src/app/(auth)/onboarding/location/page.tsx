'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Search, Navigation, CheckCircle2, Loader2, ArrowLeft } from 'lucide-react';
import { InteractiveMap } from '@/components/map/interactive-map';
import { MapService, NormalizedPlace } from '@/lib/services/map-service';
import { AuthService } from '@/lib/services/api-services';
import { MapConfig } from '@/lib/config';
import { useAuth, useFeedback } from '@/providers/app-providers';
import { ApiException } from '@/lib/api-client';

export default function LocationOnboardingPage() {
  const router = useRouter();
  const { profile, refreshProfile, needsLocation } = useAuth();
  const { showToast } = useFeedback();

  const [coords, setCoords] = useState<{ lat: number; lng: number }>({
    lat: profile?.customer?.location?.latitude || MapConfig.defaultLat,
    lng: profile?.customer?.location?.longitude || MapConfig.defaultLon,
  });
  const [address, setAddress] = useState(
    profile?.customer?.placeName || profile?.customer?.address || 'Accra, Ghana',
  );
  const [place, setPlace] = useState<NormalizedPlace | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<NormalizedPlace[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const customer = profile?.customer;
    if (customer?.location?.latitude && customer?.location?.longitude) {
      setCoords({
        lat: customer.location.latitude,
        lng: customer.location.longitude,
      });
      const saved = customer.placeName || customer.address;
      if (saved) {
        setAddress(saved);
      }
    }
  }, [profile]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await MapService.searchPlaces(q, {
          lat: coords.lat,
          lon: coords.lng,
        });
        setSuggestions(results);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery, coords.lat, coords.lng]);

  const handleMapClick = async (lat: number, lng: number) => {
    setCoords({ lat, lng });
    const resolved = await MapService.reverseGeocode(lat, lng);
    if (resolved) {
      setPlace(resolved);
      setAddress(resolved.display_name);
    }
  };

  const handleSelectSuggestion = (item: NormalizedPlace) => {
    setCoords({ lat: item.lat, lng: item.lon });
    setPlace(item);
    setAddress(item.display_name);
    setSearchQuery('');
    setSuggestions([]);
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      showToast('Geolocation is not supported by your browser.', 'error');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCoords({ lat, lng });
        const resolved = await MapService.reverseGeocode(lat, lng);
        if (resolved) {
          setPlace(resolved);
          setAddress(resolved.display_name);
        }
        setLocating(false);
      },
      () => {
        showToast('Unable to retrieve your current location. Please search or click on the map.', 'warning');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSaveLocation = async () => {
    // (0,0) / empty pin rejection
    if (!address.trim() || (coords.lat === 0 && coords.lng === 0)) {
      showToast('Please select a location on the map', 'warning');
      return;
    }
    // Reject a selection outside Ghana's bounding box
    if (
      coords.lat < 4.5 ||
      coords.lat > 11.0 ||
      coords.lng < -4.5 ||
      coords.lng > 1.0
    ) {
      showToast('Selected location is outside Ghana', 'warning');
      return;
    }

    setSaving(true);
    try {
      await AuthService.saveLocation({
        address: address.trim(),
        city: place?.city || address.split(',')[0].trim(),
        latitude: coords.lat,
        longitude: coords.lng,
        region: place?.region,
        postalCode: place?.postalCode,
        country: place?.country || 'Ghana',
        placeName: address.trim(),
      });
      await refreshProfile();
      showToast('Pickup location saved!', 'success');
      router.replace('/dashboard');
    } catch (e) {
      showToast(e instanceof ApiException ? e.message : 'Failed to save location.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFBFA] flex flex-col">
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {profile && !needsLocation && (
            <button
              type="button"
              onClick={() => router.back()}
              className="p-2 rounded-xl hover:bg-gray-100 text-gray-600"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <img src="/images/logo-icon.png" alt="LaCarte" className="w-8 h-8 object-contain" />
          <div>
            <h1 className="text-base font-bold text-gray-900">Set Your Pickup Location</h1>
            <p className="text-xs text-gray-500">Click anywhere on the map or search for your street/landmark</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleUseCurrentLocation}
          disabled={locating}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-xs font-semibold text-gray-700 cursor-pointer"
        >
          {locating ? <Loader2 className="w-4 h-4 animate-spin text-[#307224]" /> : <Navigation className="w-4 h-4 text-[#307224]" />}
          Use My GPS
        </button>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 p-4 sm:p-6 max-w-7xl w-full mx-auto">
        {/* Left Search & Address Panel */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-5">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                Search Street or Landmark
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="e.g. East Legon, Osu Oxford Street, Kumasi..."
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#307224]"
                />
                {searching && (
                  <Loader2 className="w-4 h-4 animate-spin text-gray-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                )}
              </div>

              {suggestions.length > 0 && (
                <div className="mt-2 bg-white border border-gray-200 rounded-2xl shadow-lg divide-y divide-gray-100 max-h-60 overflow-y-auto">
                  {suggestions.map((item, idx) => (
                    <button
                      key={`${item.lat}-${item.lon}-${idx}`}
                      type="button"
                      onClick={() => handleSelectSuggestion(item)}
                      className="w-full text-left px-4 py-3 hover:bg-emerald-50/60 flex items-start gap-2.5 transition"
                    >
                      <MapPin className="w-4 h-4 text-[#307224] shrink-0 mt-0.5" />
                      <span className="text-xs text-gray-800 font-medium leading-relaxed">{item.display_name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-[#307224] shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="text-xs font-semibold text-[#307224] uppercase tracking-wider">
                    Selected Pickup Address
                  </div>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full mt-1 bg-white px-3 py-2 rounded-xl border border-emerald-200 text-sm font-medium text-gray-900 focus:outline-none focus:border-[#307224]"
                  />
                  <div className="text-[11px] text-gray-500 mt-1.5">
                    GPS: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSaveLocation}
              disabled={saving}
              className="w-full py-3.5 px-5 rounded-xl bg-[#307224] hover:bg-[#25591c] disabled:opacity-60 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Saving Location...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" /> Confirm Pickup Location
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Interactive Map */}
        <div className="lg:col-span-7 min-h-[380px] lg:min-h-[540px] bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <InteractiveMap
            center={[coords.lat, coords.lng]}
            zoom={15}
            onLocationPick={handleMapClick}
            className="w-full h-full min-h-[380px] lg:min-h-[540px]"
          />
        </div>
      </div>
    </div>
  );
}

