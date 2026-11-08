'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Truck, CalendarPlus, Search, MapPin, Clock, ArrowRight } from 'lucide-react';
import { PickupService } from '@/lib/services/api-services';
import { formatGhs } from '@/lib/currency';
import type { PickupRequestResponse } from '@/types/models';
import { StatusBadge, NetworkErrorView, PageLoader } from '@/components/ui/common';
import { pickupBadgeState } from '@/lib/domain/payment-state';

const TABS = [
  { id: 'all', label: 'All Pickups' },
  { id: 'upcoming', label: 'Upcoming & Active' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
] as const;

export default function PickupsListPage() {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]['id']>('all');
  const [search, setSearch] = useState('');

  const { data: pickups = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['pickup-requests'],
    queryFn: () => PickupService.getPickupRequests(),
  });

  if (isLoading) return <PageLoader label="Loading pickup history..." />;
  if (isError) return <NetworkErrorView onRetry={() => refetch()} />;

  const pickupAddress = (p: PickupRequestResponse) =>
    [p.customer.address, p.customer.city].filter((s) => s.trim() !== '').join(', ');

  const filtered = pickups.filter((p) => {
    const s = p.status.toLowerCase();
    if (activeTab === 'upcoming' && !['pending', 'assigned', 'scheduled', 'truck_dispatched', 'en_route'].includes(s)) {
      return false;
    }
    if (activeTab === 'completed' && s !== 'completed') return false;
    if (activeTab === 'cancelled' && s !== 'cancelled') return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      const matchType = (p.disposableItemType.name || '').toLowerCase().includes(q);
      const matchLoc = pickupAddress(p).toLowerCase().includes(q);
      const matchId = p.id.toLowerCase().includes(q);
      return matchType || matchLoc || matchId;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Pickup Requests</h1>
          <p className="text-sm text-gray-500">Track active dispatches or review past waste collections</p>
        </div>
        <Link
          href="/pickups/new"
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-[#307224] hover:bg-[#25591c] text-white font-bold text-sm shadow-sm transition"
        >
          <CalendarPlus className="w-4 h-4" />
          Schedule New Pickup
        </Link>
      </div>

      {/* Filters & Search */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                activeTab === t.id
                  ? 'bg-[#307224] text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search waste type or address..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:border-[#307224]"
          />
        </div>
      </div>

      {/* Pickup Cards */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-100 p-12 text-center">
          <Truck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-gray-800">No matching pickup requests</h3>
          <p className="text-xs text-gray-500 mt-1 mb-5">
            Try switching filter tabs or schedule a new waste pickup.
          </p>
          <Link
            href="/pickups/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#307224] text-white text-xs font-bold"
          >
            <CalendarPlus className="w-4 h-4" /> Schedule Pickup
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((item) => (
            <Link
              key={item.id}
              href={`/pickups/${item.id}`}
              className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 hover:border-[#307224]/40 transition flex flex-col justify-between gap-4"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-[#307224]/10 text-[#307224] flex items-center justify-center shrink-0">
                      <Truck className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                        {item.disposableItemType.name || 'Waste Pickup'}
                        {item.isEmergency && (
                          <span className="px-2 py-0.5 rounded-md bg-red-100 text-red-700 text-[10px] font-bold uppercase">
                            Emergency
                          </span>
                        )}
                      </h3>
                      <p className="text-[11px] text-gray-400 font-mono">#{item.id.slice(0, 8)}</p>
                    </div>
                  </div>
                  <StatusBadge {...pickupBadgeState(item)} />
                </div>

                <div className="space-y-1.5 text-xs text-gray-600">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span>
                      Preferred Date:{' '}
                      <strong className="text-gray-800">
                        {item.preferredPickupDate
                          ? new Date(item.preferredPickupDate).toLocaleDateString('en-GH', {
                              weekday: 'short',
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })
                          : 'Flexible'}
                      </strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span className="truncate">{pickupAddress(item) || 'Default saved address'}</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                <div className="text-xs font-bold text-gray-800">
                  {item.amount != null && item.amount > 0
                    ? formatGhs(item.amount)
                    : 'Covered by Subscription'}
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-[#307224]">
                  Details <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

