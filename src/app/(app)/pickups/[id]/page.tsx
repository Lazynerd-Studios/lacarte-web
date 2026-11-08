'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  MapPin,
  Calendar,
  FileText,
  Navigation,
  XCircle,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { PickupService } from '@/lib/services/api-services';
import { formatGhs } from '@/lib/currency';
import { ApiException } from '@/lib/api-client';
import {
  canReschedule,
  pickupActions,
  rescheduleWindow,
} from '@/lib/domain/pickup-display';
import { pickupBadgeState } from '@/lib/domain/payment-state';
import { useFeedback } from '@/providers/app-providers';
import { StatusBadge, NetworkErrorView, PageLoader } from '@/components/ui/common';

const isoDay = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export default function PickupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useFeedback();

  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const { data: pickup, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['pickup-request', id],
    queryFn: () => PickupService.getPickupRequestById(id),
    enabled: Boolean(id),
  });

  if (isLoading) return <PageLoader label="Loading pickup details..." />;
  if (isError || !pickup)
    return <NetworkErrorView error={error} onRetry={() => refetch()} />;

  // Action matrix ported from view_pickup_screen.dart (_buildActionButton /
  // _buildCompletePaymentButton): the pay action is additive, terminal states
  // render a disabled label.
  const actions = pickupActions({
    status: pickup.status,
    requiresPayment: pickup.requiresPayment,
  });
  const canRescheduleDate = canReschedule(pickup.status);
  const dateWindow = rescheduleWindow();
  const pickupAddress = [pickup.customer.address, pickup.customer.city]
    .filter((s) => s.trim() !== '')
    .join(', ');

  // Mirrors view_pickup_screen's picker seed: keep the current date when it
  // already falls inside the allowed window, else jump to the earliest day.
  // ISO (YYYY-MM-DD) strings compare correctly lexicographically, so the
  // window check needs no Date parsing.
  const openRescheduleModal = () => {
    const minIso = isoDay(dateWindow.minDate);
    const maxIso = isoDay(dateWindow.maxDate);
    const currentIso = (pickup.preferredPickupDate || '').slice(0, 10);
    const usable =
      /^\d{4}-\d{2}-\d{2}$/.test(currentIso) &&
      currentIso >= minIso &&
      currentIso <= maxIso;
    setNewDate(usable ? currentIso : minIso);
    setRescheduleOpen(true);
  };

  const handleReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDate) return;
    setActionLoading(true);
    try {
      // PATCH takes the YYYY-MM-DD date string only — the backend owns the
      // notes on an existing request.
      await PickupService.reschedulePickupRequest(pickup.id, newDate);
      showToast(
        `Pickup rescheduled to ${new Date(newDate).toLocaleDateString('en-GH', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}`,
        'success',
      );
      setRescheduleOpen(false);
      setNewDate('');
      await refetch();
      queryClient.invalidateQueries({ queryKey: ['pickup-requests'] });
    } catch (err) {
      showToast(err instanceof ApiException ? err.message : 'Unable to reschedule pickup.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckPayment = async () => {
    setActionLoading(true);
    try {
      await queryClient.refetchQueries({ queryKey: ['pickup-request', id] });
      await queryClient.refetchQueries({ queryKey: ['pickup-requests'] });
      showToast('Payment status refreshed.', 'info');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('Are you sure you want to cancel this pickup request?')) return;
    setActionLoading(true);
    try {
      await PickupService.cancelPickupRequest(pickup.id);
      showToast('Pickup request cancelled.', 'info');
      await refetch();
      queryClient.invalidateQueries({ queryKey: ['pickup-requests'] });
    } catch (err) {
      showToast(err instanceof ApiException ? err.message : 'Failed to cancel pickup.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
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
            <h1 className="text-xl font-extrabold text-gray-900">
              {pickup.disposableItemType.name || 'Waste Pickup Request'}
            </h1>
            <p className="text-xs text-gray-400 font-mono">ID: {pickup.id}</p>
          </div>
        </div>
        <StatusBadge {...pickupBadgeState(pickup)} />
      </div>

      {/* Live Tracking Callout — only once the truck is on the way */}
      {actions.track && (
        <div className="p-5 rounded-3xl bg-[#1B4332] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
              <Navigation className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h3 className="text-base font-bold">Collection Truck Assigned</h3>
              <p className="text-xs text-emerald-100/80">
                Watch your driver&apos;s real-time GPS location and estimated arrival time on the map.
              </p>
            </div>
          </div>
          <Link
            href={`/pickups/${pickup.id}/track`}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-white text-[#1B4332] font-bold text-xs shrink-0 shadow-sm"
          >
            <Navigation className="w-4 h-4 text-[#307224]" /> Open Live Map
          </Link>
        </div>
      )}

      {/* Details Card */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-gray-50">
            <div className="text-xs text-gray-400 font-semibold uppercase">Preferred Pickup Date</div>
            <div className="text-sm font-bold text-gray-900 mt-1 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#307224]" />
              {pickup.preferredPickupDate
                ? new Date(pickup.preferredPickupDate).toLocaleDateString('en-GH', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })
                : 'Standard Schedule'}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-gray-50">
            <div className="text-xs text-gray-400 font-semibold uppercase">Collection Fee & Payment</div>
            <div className="text-sm font-bold text-gray-900 mt-1 flex items-center justify-between">
              <span>
                {pickup.amount != null && pickup.amount > 0
                  ? formatGhs(pickup.amount)
                  : 'Subscription Pickup'}
              </span>
              {pickup.paymentStatus && <StatusBadge status={pickup.paymentStatus} />}
            </div>
          </div>
        </div>

        <div className="space-y-3 pt-2 border-t border-gray-100 text-sm">
          <div className="flex items-start gap-3">
            <MapPin className="w-4 h-4 text-gray-400 shrink-0 mt-1" />
            <div>
              <span className="text-xs font-semibold text-gray-400 uppercase block">Location</span>
              <span className="text-gray-800 font-medium">{pickupAddress || 'Saved Customer Location'}</span>
            </div>
          </div>

          {pickup.additionalNotes && (
            <div className="flex items-start gap-3">
              <FileText className="w-4 h-4 text-gray-400 shrink-0 mt-1" />
              <div>
                <span className="text-xs font-semibold text-gray-400 uppercase block">Additional Notes</span>
                <span className="text-gray-800">{pickup.additionalNotes}</span>
              </div>
            </div>
          )}
        </div>

        {/* Actions — pickupActions() matrix from view_pickup_screen.dart */}
        {(actions.pay ||
          canRescheduleDate ||
          actions.cancel ||
          actions.disabledLabel) && (
          <div className="pt-4 border-t border-gray-100 flex flex-wrap items-center gap-3">
            {actions.pay && (
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleCheckPayment}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#FFB400] hover:bg-[#e6a200] disabled:opacity-60 text-xs font-bold text-gray-900 cursor-pointer"
              >
                {actionLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                Check Status
              </button>
            )}
            {canRescheduleDate && (
              <button
                type="button"
                onClick={openRescheduleModal}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-xs font-bold text-gray-800 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Reschedule Date
              </button>
            )}
            {actions.cancel && (
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleCancel}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-red-200 hover:bg-red-50 disabled:opacity-60 text-xs font-bold text-red-600 cursor-pointer"
              >
                <XCircle className="w-3.5 h-3.5" /> Cancel Pickup
              </button>
            )}
            {actions.disabledLabel && (
              <span className="inline-flex items-center px-4 py-2.5 rounded-xl bg-gray-100 text-xs font-bold text-gray-500">
                {actions.disabledLabel}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Reschedule Modal */}
      {rescheduleOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleReschedule}
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl space-y-4"
          >
            <h3 className="text-lg font-extrabold text-gray-900">Reschedule Pickup</h3>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">
                New Preferred Date
              </label>
              <input
                type="date"
                required
                min={isoDay(dateWindow.minDate)}
                max={isoDay(dateWindow.maxDate)}
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm"
              />
              <p className="text-[11px] text-gray-500 mt-1.5">
                Pick any date from{' '}
                {dateWindow.minDate.toLocaleDateString('en-GH', { month: 'short', day: 'numeric' })} to{' '}
                {dateWindow.maxDate.toLocaleDateString('en-GH', { month: 'short', day: 'numeric' })}. Notes stay
                as saved on this request.
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRescheduleOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="flex-1 py-2.5 rounded-xl bg-[#307224] text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save New Date'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

