'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  MapPin,
  Calendar,
  Zap,
  Truck,
  Trash2,
  CheckCircle2,
  Loader2,
  ArrowLeft,
  AlertTriangle,
} from 'lucide-react';
import { useAuth, useFeedback } from '@/providers/app-providers';
import {
  CustomerService,
  DisposableService,
  PickupService,
  SubscriptionService,
} from '@/lib/services/api-services';
import { MapService, NormalizedPlace } from '@/lib/services/map-service';
import { MapConfig } from '@/lib/config';
import { formatGhs } from '@/lib/currency';
import { ApiException } from '@/lib/api-client';
import { PricePreview } from '@/types/models';
import { PageLoader } from '@/components/ui/common';

export default function SchedulePickupPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const { showToast } = useFeedback();

  const customer = profile?.customer ?? null;
  const isFullTruck = Boolean(customer?.customerType.isFullTruck);
  const isPerBin = !isFullTruck;
  const isPayAsYouGo = customer?.subscriptionInfo.isPayAsYouGo ?? false;

  // Form state. Saved collection point exactly as pickup_screen's
  // _loadProfileLocation(): "address, city". The POST body carries no address
  // (the server owns the customer's saved location), so this field confirms
  // where the truck should come and biases the place search only.
  const savedAddress = [customer?.address ?? '', customer?.city ?? '']
    .filter((s) => s.trim() !== '')
    .join(', ');

  const [locationText, setLocationText] = useState(savedAddress);
  const [coords, setCoords] = useState({
    lat: customer?.location?.latitude ?? MapConfig.defaultLat,
    lng: customer?.location?.longitude ?? MapConfig.defaultLon,
  });
  const [suggestions, setSuggestions] = useState<NormalizedPlace[]>([]);
  const [selectedDisposableId, setSelectedDisposableId] = useState('');
  const [selectedTruckRateId, setSelectedTruckRateId] = useState('');
  const [isEmergency, setIsEmergency] = useState(false);

  // Local YYYY-MM-DD (pickup_screen._formatDate) — toISOString() would shift
  // the day for any non-UTC browser and the value is now sent verbatim.
  const isoDay = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  const tomorrowStr = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return isoDay(d);
  };
  const todayStr = () => isoDay(new Date());

  const [preferredDate, setPreferredDate] = useState(tomorrowStr());
  const [notes, setNotes] = useState('');

  // PAYG Price Preview & Payment Polling state
  const [previewModal, setPreviewModal] = useState<PricePreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pollingPickupId, setPollingPickupId] = useState<string | null>(null);

  const disposablesQuery = useQuery({
    queryKey: ['disposable-items'],
    queryFn: () => DisposableService.getActiveItemTypes(),
  });

  const truckRatesQuery = useQuery({
    queryKey: ['truck-load-rates'],
    queryFn: () => CustomerService.getTruckLoadRates(),
    enabled: isFullTruck,
  });

  const emergencyFeeQuery = useQuery({
    queryKey: ['emergency-fee'],
    queryFn: () => PickupService.getEmergencyFee(),
  });

  const subOptionsQuery = useQuery({
    queryKey: ['subscription-options'],
    queryFn: () => SubscriptionService.getSubscriptionOptions(),
    enabled: isPerBin,
  });

  useEffect(() => {
    if (disposablesQuery.data && disposablesQuery.data.length > 0 && !selectedDisposableId) {
      setSelectedDisposableId(disposablesQuery.data[0].id);
    }
  }, [disposablesQuery.data, selectedDisposableId]);

  useEffect(() => {
    if (truckRatesQuery.data && truckRatesQuery.data.length > 0 && !selectedTruckRateId) {
      setSelectedTruckRateId(truckRatesQuery.data[0].id);
    }
  }, [truckRatesQuery.data, selectedTruckRateId]);

  // Seed the saved address once the profile arrives (pickup_screen
  // .addPostFrameCallback(_loadProfileLocation)).
  useEffect(() => {
    if (savedAddress && locationText.trim() === '') {
      setLocationText(savedAddress);
    }
  }, [savedAddress, locationText]);

  // Only a real server "no slots" answer may disable the toggle. A transport
  // failure yields null, which leaves emergency booking available with generic
  // copy so a blip never blocks the customer.
  const emergencyFeeInfo = emergencyFeeQuery.data ?? null;
  const emergencyDisabled = emergencyFeeInfo?.available === false;

  useEffect(() => {
    if (isEmergency) {
      setPreferredDate(todayStr());
    } else if (preferredDate === todayStr()) {
      setPreferredDate(tomorrowStr());
    }
  }, [isEmergency]);

  // If the server says same-day collection is off, don't submit an emergency
  // request that was already toggled on.
  useEffect(() => {
    if (emergencyDisabled && isEmergency) {
      setIsEmergency(false);
    }
  }, [emergencyDisabled, isEmergency]);

  // Poll payment status for PAYG pickup if created
  useEffect(() => {
    if (!pollingPickupId) return;
    let attempts = 0;
    const timer = setInterval(async () => {
      attempts++;
      try {
        const updated = await PickupService.getPickupRequestById(pollingPickupId);
        const payStatus = (updated.paymentStatus || '').toLowerCase();
        if (payStatus === 'paid' || payStatus === 'completed' || payStatus === 'success') {
          clearInterval(timer);
          showToast('Payment confirmed! Your pickup is scheduled.', 'success');
          queryClient.invalidateQueries({ queryKey: ['pickup-requests'] });
          router.replace(`/pickups/${pollingPickupId}`);
        } else if (attempts >= 24) {
          clearInterval(timer);
          router.replace(`/pickups/${pollingPickupId}`);
        }
      } catch {
        // continue polling
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [pollingPickupId, queryClient, router, showToast]);

  const handleLocationInput = async (val: string) => {
    setLocationText(val);
    if (val.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    const results = await MapService.searchPlaces(val, {
      lat: coords.lat,
      lon: coords.lng,
    });
    setSuggestions(results);
  };

  const configuredBinsCount =
    (profile?.customer?.bins || []).reduce((s, b) => s + b.quantity, 0) ||
    (subOptionsQuery.data?.calculated?.bins || []).reduce((s, b) => s + b.quantity, 0);

  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDisposableId) {
      showToast('Please select a waste type.', 'warning');
      return;
    }
    if (isFullTruck && !selectedTruckRateId) {
      showToast('Please select a truck load size.', 'warning');
      return;
    }
    if (isPerBin && isPayAsYouGo && configuredBinsCount === 0) {
      showToast('Please configure your bin inventory before scheduling a Pay-As-You-Go pickup.', 'warning');
      return;
    }

    // If PAYG or Emergency, show Price Preview first
    if (isPayAsYouGo || isEmergency) {
      setLoadingPreview(true);
      try {
        const preview = await PickupService.getPricePreview({
          isEmergency,
          ...(isFullTruck ? { truckLoadRateId: selectedTruckRateId } : {}),
        });
        setPreviewModal(preview);
      } catch (err) {
        showToast(err instanceof ApiException ? err.message : 'Unable to calculate price preview.', 'error');
      } finally {
        setLoadingPreview(false);
      }
    } else {
      await submitPickupRequest();
    }
  };

  const submitPickupRequest = async () => {
    setSubmitting(true);
    try {
      const created = await PickupService.createPickupRequest({
        disposableItemTypeId: selectedDisposableId,
        // The API takes the plain YYYY-MM-DD preferred date (pickup_screen
        // ._formatDate); the saved address/coords are never part of the body.
        preferredPickupDate: preferredDate,
        isEmergency,
        additionalNotes: notes.trim() || undefined,
        ...(isFullTruck && selectedTruckRateId ? { truckLoadRateId: selectedTruckRateId } : {}),
      });

      setPreviewModal(null);
      queryClient.invalidateQueries({ queryKey: ['pickup-requests'] });

      if (created.isPayAsYouGoPayment || created.quotaExceeded) {
        showToast('Pickup created! Please approve the Mobile Money prompt on your phone.', 'info');
        setPollingPickupId(created.id);
      } else {
        showToast('Pickup scheduled successfully!', 'success');
        router.replace(`/pickups/${created.id}`);
      }
    } catch (err) {
      showToast(err instanceof ApiException ? err.message : 'Failed to schedule pickup.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (disposablesQuery.isLoading) {
    return <PageLoader label="Loading pickup options..." />;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="p-2 rounded-xl bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Schedule a Waste Pickup</h1>
          <p className="text-xs text-gray-500">
            Select waste type, date, and collection preferences
          </p>
        </div>
      </div>

      {/* Warning if per_bin and 0 bins */}
      {isPerBin && configuredBinsCount === 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-xs font-bold text-amber-900">No Bins Configured</h3>
              <p className="text-xs text-amber-800 mt-0.5">
                Add your waste bins first so we can calculate your collection fee accurately.
              </p>
            </div>
          </div>
          <Link
            href="/account/bins"
            className="px-3.5 py-2 rounded-xl bg-amber-600 text-white text-xs font-bold shrink-0"
          >
            Add Bins
          </Link>
        </div>
      )}

      <form onSubmit={handleContinue} className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 sm:p-8 space-y-6">
        {/* 1. Pickup Address */}
        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
            1. Pickup Address
          </label>
          <div className="relative">
            <MapPin className="w-4 h-4 text-[#307224] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              required
              value={locationText}
              onChange={(e) => handleLocationInput(e.target.value)}
              placeholder="Enter street address or landmark"
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#307224]"
            />
          </div>
          {suggestions.length > 0 && (
            <div className="mt-1.5 bg-white border border-gray-200 rounded-2xl shadow-md divide-y divide-gray-100 max-h-48 overflow-y-auto">
              {suggestions.map((s, idx) => {
                // pickup_screen._selectPlace(): short "name, city" label, and
                // ignore results without a real position.
                const label =
                  [s.name, s.city].filter((v) => v.trim() !== '').join(', ') ||
                  s.display_name;
                return (
                  <button
                    key={`${s.display_name}-${idx}`}
                    type="button"
                    onClick={() => {
                      if (s.lat === 0 && s.lon === 0) return;
                      setLocationText(label);
                      setCoords({ lat: s.lat, lng: s.lon });
                      setSuggestions([]);
                    }}
                    className="w-full text-left px-4 py-2.5 text-xs text-gray-700 hover:bg-emerald-50"
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 2. Waste Category (Single-Select Grid) */}
        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
            2. Select Waste Category
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(disposablesQuery.data || []).map((item) => {
              const selected = item.id === selectedDisposableId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedDisposableId(item.id)}
                  className={`p-4 rounded-2xl border text-left transition flex items-start justify-between gap-3 cursor-pointer ${
                    selected
                      ? 'border-[#307224] bg-emerald-50/60 ring-2 ring-[#307224]/15'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div>
                    <div className="text-sm font-bold text-gray-900">{item.name}</div>
                    {item.description && (
                      <div className="text-xs text-gray-500 mt-0.5">{item.description}</div>
                    )}
                  </div>
                  <div
                    className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                      selected ? 'border-[#307224] bg-[#307224] text-white' : 'border-gray-300'
                    }`}
                  >
                    {selected && <CheckCircle2 className="w-3.5 h-3.5" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Truck Load Tier (Only for full_truck customers) */}
        {isFullTruck && (
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
              3. Select Truck Load Capacity
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(truckRatesQuery.data || []).map((rate) => {
                const selected = rate.id === selectedTruckRateId;
                return (
                  <button
                    key={rate.id}
                    type="button"
                    onClick={() => setSelectedTruckRateId(rate.id)}
                    className={`p-4 rounded-2xl border text-left transition cursor-pointer ${
                      selected
                        ? 'border-[#307224] bg-emerald-50/60 ring-2 ring-[#307224]/15'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Truck className="w-5 h-5 text-[#307224] mb-1.5" />
                    <div className="text-sm font-bold text-gray-900">{rate.label}</div>
                    <div className="text-xs font-semibold text-[#307224] mt-1">
                      {formatGhs(isPayAsYouGo ? rate.postpayRate : rate.prepayRate)} / load
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 4. Emergency Same-Day Toggle */}
        <div
          className={`p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 flex items-center justify-between gap-4 ${
            emergencyDisabled ? 'opacity-50' : ''
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-gray-900">Emergency Same-Day Pickup</div>
              <div className="text-xs text-gray-600 mt-0.5">
                {emergencyDisabled
                  ? 'Not available right now'
                  : emergencyFeeInfo?.available && emergencyFeeInfo.fee > 0
                    ? `Priority dispatch today (+${formatGhs(emergencyFeeInfo.fee)})`
                    : 'Priority dispatch today (additional fee applies)'}
              </div>
            </div>
          </div>
          <input
            type="checkbox"
            checked={isEmergency}
            disabled={emergencyDisabled}
            onChange={(e) => setIsEmergency(e.target.checked)}
            className="w-5 h-5 accent-[#307224] rounded cursor-pointer disabled:cursor-not-allowed"
          />
        </div>

        {/* 5. Preferred Date & Notes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Preferred Pickup Date
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="date"
                required
                min={isEmergency ? todayStr() : tomorrowStr()}
                disabled={isEmergency}
                value={preferredDate}
                onChange={(e) => setPreferredDate(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm disabled:bg-gray-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Additional Instructions (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Bins are by the black gate"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loadingPreview || submitting}
          className="w-full py-3.5 px-6 rounded-2xl bg-[#307224] hover:bg-[#25591c] disabled:opacity-60 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
        >
          {loadingPreview || submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Processing...
            </>
          ) : isPayAsYouGo || isEmergency ? (
            'Preview Price & Continue'
          ) : (
            'Confirm Pickup Request'
          )}
        </button>
      </form>

      {/* Price Preview Modal */}
      {previewModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl space-y-5">
            <h3 className="text-lg font-extrabold text-gray-900">Pickup Price Summary</h3>

            <div className="p-4 rounded-2xl bg-gray-50 space-y-2.5 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Base Collection Fee</span>
                <span className="font-semibold text-gray-900">{formatGhs(previewModal.base)}</span>
              </div>
              {previewModal.emergencyFee > 0 && (
                <div className="flex justify-between text-amber-700">
                  <span>Emergency Fee</span>
                  <span className="font-semibold">+{formatGhs(previewModal.emergencyFee)}</span>
                </div>
              )}
              <div className="pt-2.5 border-t border-gray-200 flex justify-between text-base font-extrabold text-gray-900">
                <span>Total Amount</span>
                <span className="text-[#307224]">{formatGhs(previewModal.total)}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setPreviewModal(null)}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={submitPickupRequest}
                className="flex-1 py-3 rounded-xl bg-[#307224] hover:bg-[#25591c] text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm & Book'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PAYG Payment Polling Modal */}
      {pollingPickupId && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 text-center space-y-4 shadow-xl">
            <Loader2 className="w-10 h-10 text-[#307224] animate-spin mx-auto" />
            <h3 className="text-lg font-extrabold text-gray-900">Waiting for Mobile Money Approval</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Please check your phone and enter your Mobile Money PIN to complete the payment for your pickup request.
            </p>
            <button
              type="button"
              onClick={() => router.replace(`/pickups/${pollingPickupId}`)}
              className="w-full py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-bold text-gray-800"
            >
              View Pickup Status Page
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

