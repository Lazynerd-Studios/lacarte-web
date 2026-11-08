'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Trash2, Plus, Minus, CheckCircle2, Loader2 } from 'lucide-react';
import { CustomerService, SubscriptionService } from '@/lib/services/api-services';
import { useAuth, useFeedback } from '@/providers/app-providers';
import {
  buildBinSavePayload,
  mergeBinSources,
} from '@/lib/domain/bin-inventory';
import { formatGhs } from '@/lib/currency';
import { ApiException } from '@/lib/api-client';
import { NetworkErrorView, PageLoader } from '@/components/ui/common';

export default function BinInventoryPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { profile, updateCustomerBins, refreshProfile } = useAuth();
  const { showToast } = useFeedback();

  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [seeded, setSeeded] = useState(false);

  const ratesQuery = useQuery({
    queryKey: ['capacity-rates'],
    queryFn: () => CustomerService.getCapacityRates(),
  });

  const subOptionsQuery = useQuery({
    queryKey: ['subscription-options'],
    queryFn: () => SubscriptionService.getSubscriptionOptions(),
  });

  const allRates = useMemo(() => ratesQuery.data ?? [], [ratesQuery.data]);

  // Only ACTIVE capacity tiers may be edited.
  const rates = useMemo(
    () => allRates.filter((rate) => rate.isActive),
    [allRates]
  );

  // Seed source: union the profile and subscription-options bins so an
  // inactive tier can never be dropped from the replace-all payload.
  const profileBins = profile?.customer?.bins ?? [];
  const optionsBins = subOptionsQuery.data?.calculated.bins ?? [];
  const savedBins = useMemo(
    () => mergeBinSources(profileBins, optionsBins),
    [profileBins, optionsBins]
  );
  const seedSettled =
    savedBins.length > 0 || subOptionsQuery.isSuccess || subOptionsQuery.isError;

  useEffect(() => {
    if (seeded || !ratesQuery.data || !seedSettled) return;
    const initial: Record<string, number> = {};
    for (const rate of rates) {
      const match = savedBins.find(
        (b) => b.capacityRateId === rate.id || b.capacityLiters === rate.capacityLiters
      );
      initial[rate.id] = match ? match.quantity : 0;
    }
    setQuantities(initial);
    setSeeded(true);
  }, [seeded, ratesQuery.data, seedSettled, rates, savedBins]);

  if (ratesQuery.isLoading) return <PageLoader label="Loading bin capacity rates..." />;
  if (ratesQuery.isError) return <NetworkErrorView onRetry={() => ratesQuery.refetch()} />;
  if (!seeded) return <PageLoader label="Loading your bin inventory..." />;

  const adjustQty = (rateId: string, delta: number) => {
    setQuantities((prev) => ({
      ...prev,
      [rateId]: Math.max(0, (prev[rateId] || 0) + delta),
    }));
  };

  const estimatedPerPickup = rates.reduce(
    (sum, r) => sum + (quantities[r.id] || 0) * r.prepayRate,
    0
  );

  const totalBins = Object.values(quantities).reduce((a, b) => a + b, 0);

  const handleSave = async () => {
    // REPLACE-ALL: send edited active inventory plus all existing inventory
    // that is inactive or absent from the current catalogue, preserving it.
    const payload = buildBinSavePayload({
      rates: allRates,
      savedBins,
      quantities,
    });

    if (payload.length === 0) {
      showToast('Please select at least 1 waste bin.', 'warning');
      return;
    }

    setSaving(true);
    try {
      const savedBinsResult = await CustomerService.updateBins(payload);
      updateCustomerBins(savedBinsResult);
      await queryClient.invalidateQueries({ queryKey: ['subscription-options'] });
      await refreshProfile();
      showToast('Waste bin inventory updated!', 'success');
      router.push('/account');
    } catch (err) {
      if (err instanceof ApiException && err.statusCode === 400) {
        // A deactivated tier: refetch the catalogue but keep local edits.
        if (err.message.toLowerCase().includes('tier')) {
          queryClient.invalidateQueries({ queryKey: ['capacity-rates'] });
        }
        showToast(err.message || 'Could not save bins.', 'error');
      } else {
        showToast(err instanceof ApiException ? err.message : 'Failed to save bin inventory.', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

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
          <h1 className="text-2xl font-extrabold text-gray-900">My Waste Bin Inventory</h1>
          <p className="text-xs text-gray-500">
            Select how many bins of each size you have for accurate pickup and subscription quotes
          </p>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm divide-y divide-gray-100">
        {rates.map((rate) => {
          const qty = quantities[rate.id] || 0;
          return (
            <div key={rate.id} className="p-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-[#307224]/10 text-[#307224] flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-gray-900">{rate.label}</div>
                  <div className="text-xs text-gray-500">
                    {formatGhs(rate.prepayRate)} per pickup / bin
                  </div>
                </div>
              </div>

              <div className="inline-flex items-center gap-3 bg-gray-100 rounded-2xl px-3 py-1.5">
                <button
                  type="button"
                  onClick={() => adjustQty(rate.id, -1)}
                  disabled={qty === 0}
                  className="p-1 text-gray-700 hover:bg-white rounded-lg cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="text-sm font-extrabold text-gray-900 min-w-[24px] text-center">
                  {qty}
                </span>
                <button
                  type="button"
                  onClick={() => adjustQty(rate.id, 1)}
                  className="p-1 text-gray-700 hover:bg-white rounded-lg cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs text-gray-500 font-semibold uppercase">
            Total Configured ({totalBins} bin{totalBins === 1 ? '' : 's'})
          </div>
          <div className="text-xl font-extrabold text-[#307224]">
            {formatGhs(estimatedPerPickup)} <span className="text-xs font-normal text-gray-500">/ pickup</span>
          </div>
        </div>

        <button
          type="button"
          disabled={saving || totalBins === 0}
          onClick={handleSave}
          className="px-6 py-3.5 rounded-2xl bg-[#307224] hover:bg-[#25591c] disabled:opacity-60 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" /> Save Bin Inventory
            </>
          )}
        </button>
      </div>
    </div>
  );
}

