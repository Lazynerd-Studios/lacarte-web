'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Truck,
  CalendarPlus,
  Trash2,
  MapPin,
  Clock,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  ShoppingBag,
  CreditCard,
  X,
  Navigation,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '@/providers/app-providers';
import { PickupService, SubscriptionService } from '@/lib/services/api-services';
import { subscribeToPickupTracking } from '@/lib/services/tracking-sse';
import { MapService } from '@/lib/services/map-service';
import { formatGhs } from '@/lib/currency';
import { StatusBadge, NetworkErrorView, PageLoader } from '@/components/ui/common';
import {
  pendingPickupPaymentPollInterval,
  pickupBadgeState,
} from '@/lib/domain/payment-state';

function formatPickupDate(iso: string, opts: Intl.DateTimeFormatOptions): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GH', opts);
}

export default function DashboardPage() {
  const { profile } = useAuth();
  const [dismissBinsBanner, setDismissBinsBanner] = useState(false);
  const [liveEtaText, setLiveEtaText] = useState<string | null>(null);

  const pickupsQuery = useQuery({
    queryKey: ['pickup-requests'],
    queryFn: () => PickupService.getPickupRequests(),
    refetchInterval: (query) =>
      pendingPickupPaymentPollInterval(query.state.data ?? []),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

  const subOptionsQuery = useQuery({
    queryKey: ['subscription-options'],
    queryFn: () => SubscriptionService.getSubscriptionOptions(),
    enabled: Boolean(profile?.customer?.customerType?.isPerBin),
  });

  const subMeQuery = useQuery({
    queryKey: ['my-subscription'],
    queryFn: () => SubscriptionService.getMySubscription(),
  });

  const pickups = pickupsQuery.data || [];
  const now = new Date();

  // Active / upcoming pickup
  const activePickup = pickups.find((p) =>
    ['pending', 'assigned', 'truck_dispatched', 'en_route', 'arrived'].includes(p.status.toLowerCase())
  );

  // Completed pickups this month & Bins picked up this month (fixes the duplicate stat bug in mobile app)
  const completedThisMonth = pickups.filter((p) => {
    const s = p.status.toLowerCase();
    if (s !== 'completed') return false;
    // Dates are ISO strings on the model; resolve the best available one.
    const iso = p.preferredPickupDate || p.updatedAt || p.createdAt;
    if (!iso) return false;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return false;
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const completedPickupsCount = completedThisMonth.length;
  const binsCollectedCount = completedThisMonth.reduce((sum, p) => sum + (p.binCount && p.binCount > 0 ? p.binCount : 1), 0);

  // Check if per_bin customer has bins configured
  const isPerBin = profile?.customer?.customerType?.isPerBin ?? true;
  const profileBins = profile?.customer?.bins || [];
  const calculatedBins = subOptionsQuery.data?.calculated?.bins || [];
  const totalConfiguredBins =
    profileBins.reduce((s, b) => s + b.quantity, 0) ||
    calculatedBins.reduce((s, b) => s + b.quantity, 0);

  const showAddBinsNudge = isPerBin && !subOptionsQuery.isLoading && totalConfiguredBins === 0 && !dismissBinsBanner;

  // Live SSE ETA when truck is en_route or truck_dispatched
  useEffect(() => {
    if (!activePickup) {
      setLiveEtaText(null);
      return;
    }
    const status = activePickup.status.toLowerCase();
    if (status !== 'en_route' && status !== 'truck_dispatched') {
      setLiveEtaText(null);
      return;
    }

    const pickupCustomerLoc = activePickup.customer.location;
    const unsubscribe = subscribeToPickupTracking({
      pickupId: activePickup.id,
      onEvent: (event) => {
        if (event.type !== 'location') return;
        const destLat =
          pickupCustomerLoc?.latitude ?? profile?.customer?.location?.latitude;
        const destLng =
          pickupCustomerLoc?.longitude ?? profile?.customer?.location?.longitude;
        if (destLat != null && destLng != null) {
          void MapService.getRoute(
            [event.latitude, event.longitude],
            [destLat, destLng],
          ).then((route) => {
            if (route.travelTimeSeconds) {
              const mins = Math.max(1, Math.round(route.travelTimeSeconds / 60));
              setLiveEtaText(`Arriving in ~${mins} min`);
            }
          });
        }
      },
    });

    return () => unsubscribe();
  }, [
    activePickup,
    profile?.customer?.location?.latitude,
    profile?.customer?.location?.longitude,
  ]);

  if (pickupsQuery.isLoading) {
    return <PageLoader label="Loading your dashboard..." />;
  }

  if (pickupsQuery.isError) {
    return (
      <NetworkErrorView
        message="Unable to load your dashboard data."
        onRetry={() => pickupsQuery.refetch()}
      />
    );
  }

  const debtAmount = subMeQuery.data?.outstandingDebt?.amount ?? 0;

  return (
    <div className="space-y-6">
      {/* Top Welcome Banner */}
      <div className="bg-[#1B4332] rounded-3xl p-6 sm:p-8 text-white flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-emerald-200 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            {profile?.customer?.customerType?.name || 'Customer'} •{' '}
            {profile?.customer?.subscriptionInfo.paymentPlan === 'subscription'
              ? 'Active Subscriber'
              : 'Pay-As-You-Go'}
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Hello, {String(profile?.user?.name ?? '').split(' ')[0] || 'there'} 👋
          </h1>
          <p className="text-emerald-100/80 text-sm mt-1 flex items-center gap-1.5">
            <MapPin className="w-4 h-4 shrink-0 text-emerald-300" />
            {profile?.customer?.placeName || profile?.customer?.address || 'Set your pickup address'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/pickups/new"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white text-[#1B4332] hover:bg-emerald-50 font-bold text-sm shadow-sm transition"
          >
            <CalendarPlus className="w-4 h-4 text-[#307224]" />
            Schedule Pickup
          </Link>
          <Link
            href="/shop"
            className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm border border-white/15 transition"
          >
            <ShoppingBag className="w-4 h-4" />
            Eco Store
          </Link>
        </div>
      </div>

      {/* Outstanding Postpaid Debt Alert */}
      {debtAmount > 0 && (
        <div className="p-4 sm:p-5 rounded-2xl bg-red-50 border border-red-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-red-900">
                Outstanding Balance: {formatGhs(debtAmount)}
              </h3>
              <p className="text-xs text-red-700 mt-0.5">
                Please settle your outstanding balance to keep scheduling pickups or changing plans.
              </p>
            </div>
          </div>
          <Link
            href="/subscription"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shrink-0"
          >
            Pay Balance <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Add Your Bins Nudge Banner (for per_bin customers with 0 bins) */}
      {showAddBinsNudge && (
        <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative">
          <div className="flex items-start gap-3.5 pr-6">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-700 flex items-center justify-center shrink-0">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-950">Set up your Waste Bin Inventory</h3>
              <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                Add your bin sizes and quantities so we can calculate accurate Pay-As-You-Go and subscription pricing for your household or business.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/account/bins"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition"
            >
              Configure Bins <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <button
              type="button"
              onClick={() => setDismissBinsBanner(true)}
              className="p-2 rounded-lg text-amber-700 hover:bg-amber-100"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Grid: Active Pickup + Monthly Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Next / Active Pickup Card */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-gray-100 shadow-sm p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-[#307224]/10 text-[#307224] flex items-center justify-center">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">Next Scheduled Pickup</h2>
                  <p className="text-xs text-gray-500">Live collection status & driver dispatch</p>
                </div>
              </div>
              {activePickup && <StatusBadge {...pickupBadgeState(activePickup)} />}
            </div>

            {activePickup ? (
              <div className="p-4 rounded-2xl bg-[#FAFBFA] border border-gray-100 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Waste Type
                    </span>
                    <div className="text-sm font-bold text-gray-900">
                      {activePickup.disposableItemType.name || 'General Waste Collection'}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Preferred Date
                    </span>
                    <div className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-[#307224]" />
                      {activePickup.preferredPickupDate
                        ? formatPickupDate(activePickup.preferredPickupDate, {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })
                        : 'Soonest Available'}
                    </div>
                  </div>
                </div>

                {activePickup.customer.address && (
                  <div className="text-xs text-gray-600 flex items-center gap-1.5 pt-2 border-t border-gray-100">
                    <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span className="truncate">{activePickup.customer.address}</span>
                  </div>
                )}

                {liveEtaText && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-800 text-xs font-bold">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                      {liveEtaText}
                    </div>
                    <Link
                      href={`/pickups/${activePickup.id}/track`}
                      className="text-xs font-bold text-[#307224] hover:underline flex items-center gap-1"
                    >
                      Live Map <Navigation className="w-3 h-3" />
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-8 px-4 text-center rounded-2xl bg-gray-50/70 border border-dashed border-gray-200">
                <Truck className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-gray-700">No upcoming pickup scheduled</p>
                <p className="text-xs text-gray-500 mt-0.5 mb-4">
                  Need a waste collection? Book a standard or same-day emergency pickup in seconds.
                </p>
                <Link
                  href="/pickups/new"
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#307224] text-white text-xs font-bold hover:bg-[#25591c] transition"
                >
                  <CalendarPlus className="w-4 h-4" /> Book a Pickup Now
                </Link>
              </div>
            )}
          </div>

          {activePickup && (
            <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between gap-3">
              <Link
                href={`/pickups/${activePickup.id}`}
                className="text-xs font-bold text-gray-700 hover:text-[#307224] flex items-center gap-1"
              >
                View Pickup Details <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              {['assigned', 'truck_dispatched', 'en_route', 'arrived'].includes(
                activePickup.status.toLowerCase()
              ) && (
                <Link
                  href={`/pickups/${activePickup.id}/track`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#307224] text-white text-xs font-bold hover:bg-[#25591c] transition"
                >
                  <Navigation className="w-3.5 h-3.5" /> Track Driver Live
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Monthly Stats & Quick Actions */}
        <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-[#307224] flex items-center justify-center mb-3">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="text-2xl font-extrabold text-gray-900">{completedPickupsCount}</div>
              <div className="text-xs font-semibold text-gray-500 mt-0.5">
                Pickups Completed (This Month)
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-3">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="text-2xl font-extrabold text-gray-900">{binsCollectedCount}</div>
              <div className="text-xs font-semibold text-gray-500 mt-0.5">
                {isPerBin ? 'Bins Picked Up (This Month)' : 'Loads Collected (This Month)'}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">Subscription & Billing</h3>
                <p className="text-xs text-gray-500">
                  {subMeQuery.data?.subscription?.displayName || 'Manage Prepaid, Postpaid & Invoices'}
                </p>
              </div>
            </div>
            <Link
              href="/subscription"
              className="px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold shrink-0 transition"
            >
              Manage
            </Link>
          </div>
        </div>
      </div>

      {/* Recent Pickups Table / List */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-bold text-gray-900">Recent Pickup Requests</h2>
            <p className="text-xs text-gray-500">Your latest scheduled and completed collections</p>
          </div>
          <Link
            href="/pickups"
            className="text-xs font-bold text-[#307224] hover:underline flex items-center gap-1"
          >
            View All ({pickups.length}) <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {pickups.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-500">
            You haven&apos;t made any pickup requests yet.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {pickups.slice(0, 5).map((item) => (
              <Link
                key={item.id}
                href={`/pickups/${item.id}`}
                className="py-3.5 px-3 -mx-3 rounded-2xl hover:bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition"
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gray-100 text-gray-600 flex items-center justify-center shrink-0 mt-0.5">
                    <Truck className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-gray-900 flex items-center gap-2">
                      {item.disposableItemType.name || 'Waste Pickup'}
                      {item.isEmergency && (
                        <span className="px-2 py-0.5 rounded-md bg-red-100 text-red-700 text-[10px] font-bold uppercase">
                          Emergency
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {item.preferredPickupDate
                        ? formatPickupDate(item.preferredPickupDate, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })
                        : 'Standard Schedule'}{' '}
                      • {item.customer.address || 'Saved Location'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 pl-12 sm:pl-0">
                  {item.amount != null && item.amount > 0 && (
                    <span className="text-xs font-bold text-gray-800">
                      {formatGhs(item.amount)}
                    </span>
                  )}
                  <StatusBadge {...pickupBadgeState(item)} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

