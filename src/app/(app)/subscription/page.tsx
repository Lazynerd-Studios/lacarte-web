'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  RefreshCw,
  Trash2,
  Truck,
  XCircle,
  Loader2,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { SubscriptionService } from '@/lib/services/api-services';
import { useAuth, useFeedback } from '@/providers/app-providers';
import { formatGhs, formatGhsFromString } from '@/lib/currency';
import { ApiException } from '@/lib/api-client';
import type { CalculatedQuote, SubscriptionOptions } from '@/types/models';
import {
  billingCycleLabel,
  defaultTierId,
  frequencyLabel,
  isTruckPresentation,
  pricingUnavailableMessage,
  quotesForSelection,
  showAddBinsCta,
} from '@/lib/domain/pricing-mode';
import { StatusBadge, NetworkErrorView, PageLoader } from '@/components/ui/common';
import { isSubscriptionPollingConfirmed } from '@/lib/domain/payment-state';

/** Every date on the models is an ISO string (or null), never a Date object. */
function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-GH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}


export default function SubscriptionsPage() {
  const queryClient = useQueryClient();
  const { profile, refreshProfile } = useAuth();
  const { showToast, showStatusModal } = useFeedback();

  const [paymentType, setPaymentType] = useState<'prepaid' | 'postpaid'>('prepaid');
  // Truck tiers are keyed by their own id; null means "the first tier the
  // server delivered", which quotesForSelection resolves via defaultTierId.
  const [selectedTierId, setSelectedTierId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [pollingPayment, setPollingPayment] = useState(false);

  const subMeQuery = useQuery({
    queryKey: ['my-subscription'],
    queryFn: () => SubscriptionService.getMySubscription(),
  });

  const subOptionsQuery = useQuery({
    queryKey: ['subscription-options'],
    queryFn: () => SubscriptionService.getSubscriptionOptions(),
  });

  // Poll subscription payment status when prepaid payment is initiated
  useEffect(() => {
    if (!pollingPayment) return;
    let attempts = 0;
    const timer = setInterval(async () => {
      attempts++;
      try {
        const res = await SubscriptionService.getMySubscription();
        if (isSubscriptionPollingConfirmed(res)) {
          clearInterval(timer);
          setPollingPayment(false);
          showToast(
            res.subscription
              ? 'Subscription payment confirmed and active!'
              : 'Outstanding balance settled.',
            'success',
          );
          queryClient.invalidateQueries({ queryKey: ['my-subscription'] });
          await refreshProfile();
        } else if (attempts >= 24) {
          clearInterval(timer);
          setPollingPayment(false);
          queryClient.invalidateQueries({ queryKey: ['my-subscription'] });
        }
      } catch {
        // continue polling
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [pollingPayment, queryClient, refreshProfile, showToast]);

  if (subMeQuery.isLoading || subOptionsQuery.isLoading) {
    return <PageLoader label="Loading subscription plans and pricing..." />;
  }

  if (subMeQuery.isError && subOptionsQuery.isError) {
    return (
      <NetworkErrorView
        onRetry={() => {
          subMeQuery.refetch();
          subOptionsQuery.refetch();
        }}
      />
    );
  }

  const options: SubscriptionOptions | null = subOptionsQuery.data ?? null;
  const calculated = options?.calculated ?? null;
  const currentSub = subMeQuery.data?.subscription ?? null;
  // Durable exit debt left behind by a previous subscription — a different
  // banner from the running balance on the live subscription, never merged.
  const exitDebt = subMeQuery.data?.outstandingDebt ?? null;
  const exitDebtAmount = exitDebt?.amount ?? 0;

  // getMySubscription normalises pay_as_you_go to `subscription: null`; the
  // profile flag is the second signal for the same state.
  const isPayAsYouGo = profile?.customer?.subscriptionInfo.isPayAsYouGo === true;

  const pricingMode =
    options?.pricingMode ?? profile?.customer?.customerType.pricingMode ?? 'per_bin';
  // The tier picker only exists when the account is full_truck AND tiers arrived.
  const showTruckTiers = options ? isTruckPresentation(options) : false;
  const effectiveTierId = options ? (selectedTierId ?? defaultTierId(options)) : null;
  const activeQuotes: CalculatedQuote[] = options
    ? quotesForSelection(options, selectedTierId)
    : [];
  const pricingAvailable = calculated?.available === true;
  const bins = calculated?.bins ?? [];
  const basePerPickupRate = activeQuotes[0]?.perPickupRate ?? null;

  const handleSubscribeCalculated = async (quote: CalculatedQuote) => {
    setActionLoading(true);
    try {
      const result = await SubscriptionService.subscribeCalculated({
        frequency: quote.frequency,
        billingCycle: quote.billingCycle,
        paymentType,
        // Only full_truck quotes carry a tier id; per_bin must omit the key
        // entirely (the API rejects both "" and null as invalid uuids).
        ...(quote.truckLoadRateId ? { truckLoadRateId: quote.truckLoadRateId } : {}),
      });

      if (!result.subscription) {
        showToast('Subscription could not be created. Please try again.', 'error');
        return;
      }

      await subMeQuery.refetch();
      await refreshProfile();

      if (paymentType === 'postpaid') {
        // Postpaid initiates no MoMo payment — no pending/polling state at all.
        showToast('Postpaid subscription activated immediately!', 'success');
      } else {
        showToast('Subscription created! Please approve the Mobile Money prompt on your phone.', 'info');
        setPollingPayment(true);
      }
    } catch (err) {
      if (err instanceof ApiException) {
        if (err.statusCode === 409) {
          showStatusModal({
            type: 'warning',
            title: 'Active Subscription Exists',
            message: err.message || 'You already have an active subscription. Cancel or manage your current plan first.',
          });
          return;
        }
        if (err.statusCode === 402) {
          showStatusModal({
            type: 'error',
            title: 'Outstanding Balance Required',
            message: err.message || 'Please settle your outstanding balance before subscribing to a new plan.',
          });
          return;
        }
        if (err.statusCode === 400 && err.message.toLowerCase().includes('bin')) {
          showToast('Please configure your bin capacities first.', 'warning');
          return;
        }
        showToast(err.message, 'error');
      } else {
        showToast('Unable to start subscription. Please try again.', 'error');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handlePayBalance = async () => {
    setActionLoading(true);
    try {
      await SubscriptionService.payBalance();
      showToast('Payment prompt sent to your phone. Please enter your MoMo PIN.', 'info');
      setPollingPayment(true);
      await subMeQuery.refetch();
    } catch (err) {
      showToast(err instanceof ApiException ? err.message : 'Unable to initiate balance payment.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRetryPayment = async () => {
    setActionLoading(true);
    try {
      const message = await SubscriptionService.retryPendingPayment();
      showToast(message || 'Payment prompt resent! Please check your phone.', 'info');
      setPollingPayment(true);
    } catch (err) {
      showToast(err instanceof ApiException ? err.message : 'Unable to retry payment.', 'error');
      // 400 (already paid) and 404 (nothing pending) both mean the state moved on.
      await subMeQuery.refetch();
    } finally {
      setActionLoading(false);
    }
  };

  const handleRenew = async () => {
    setActionLoading(true);
    try {
      const renewed = await SubscriptionService.renewSubscription();
      await subMeQuery.refetch();
      showToast('Renewal initiated! Approve the Mobile Money prompt on your phone.', 'success');
      // Renewing only creates the pending payment; the cycle extends once it confirms.
      if (renewed) setPollingPayment(true);
    } catch (err) {
      if (err instanceof ApiException && err.statusCode === 409) {
        showToast(
          'Renewal already in progress — complete the MoMo prompt on your phone.',
          'warning',
        );
      } else {
        showToast(err instanceof ApiException ? err.message : 'Unable to renew subscription.', 'error');
      }
      await subMeQuery.refetch();
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    const status = (currentSub?.status ?? '').toLowerCase();
    const isPending = status === 'pending';
    const isPostpaidPlan =
      currentSub !== null &&
      (currentSub.plan
        ? currentSub.plan.type === 'postpaid'
        : currentSub.payment?.paymentType === 'postpaid');

    // Three confirm variants chosen by subscription state.
    const confirmMessage = isPending
      ? 'Are you sure you want to cancel this pending subscription? The awaiting payment will also be invalidated. This action cannot be undone.'
      : isPostpaidPlan
        ? 'Are you sure you want to cancel your subscription? If any pickup was used this cycle, the full cycle fee is billed (no pro-rating), plus any accrued over-quota or emergency charges. The total is settled via Mobile Money. This action cannot be undone.'
        : 'Are you sure you want to cancel your subscription? This action cannot be undone.';

    if (!window.confirm(confirmMessage)) return;
    setActionLoading(true);
    try {
      const result = await SubscriptionService.cancelSubscription();
      await subMeQuery.refetch();
      await refreshProfile();

      // Exit settlement: the cancel succeeded but a balance is still owed.
      if (result.hasSettlementDebt && result.settlement) {
        const settlement = result.settlement;
        // promptSent false means the MoMo prompt could not be started.
        const promptFailed = !settlement.promptSent;
        showStatusModal({
          type: 'error',
          title: `You owe ${formatGhs(settlement.outstandingBalance)}`,
          message: promptFailed
            ? 'Your subscription has been cancelled. The settlement payment prompt could not be started — pay your balance to settle the outstanding amount.'
            : 'Your subscription has been cancelled. A Mobile Money prompt for the settlement has been sent to your phone — you can also pay now.',
          buttonLabel: 'Pay Balance Now',
          onAction: handlePayBalance,
          ...(promptFailed
            ? { secondaryLabel: 'Resend Prompt', onSecondaryAction: handleRetryPayment }
            : {}),
        });
        return;
      }

      showToast(result.message || 'Subscription cancelled successfully.', 'info');
    } catch (err) {
      showToast(err instanceof ApiException ? err.message : 'Failed to cancel subscription.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const subStatus = (currentSub?.status ?? '').toLowerCase();
  const hasPendingPayment = currentSub?.payment?.isPending === true;
  const canManage = currentSub !== null && (currentSub.isActive || subStatus === 'pending');
  const runningBalance = currentSub?.outstandingBalance ?? null;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Subscriptions & Billing</h1>
          <p className="text-sm text-gray-500">
            Choose between flexible Prepaid or Postpaid waste collection plans tailored to your capacity
          </p>
        </div>
        <Link
          href="/billing"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white border border-gray-200 hover:bg-gray-50 text-xs font-bold text-gray-800 shadow-2xs"
        >
          <Receipt className="w-4 h-4 text-[#307224]" />
          Billing & Invoices
        </Link>
      </div>

      {/* Durable exit debt banner — renders even when there is no subscription */}
      {exitDebtAmount > 0 && (
        <div className="p-5 rounded-3xl bg-red-50 border border-red-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <AlertTriangle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-base font-extrabold text-red-950">
                Outstanding Balance: {formatGhs(exitDebtAmount)}
              </h3>
              <p className="text-xs text-red-800 mt-0.5">
                A previous subscription left an unpaid balance. Settle it via Mobile Money to unlock new subscriptions.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={actionLoading}
            onClick={handlePayBalance}
            className="px-5 py-3 rounded-2xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shrink-0 cursor-pointer"
          >
            Pay {formatGhs(exitDebtAmount)} Now
          </button>
        </div>
      )}

      {/* Current Subscription Card — hidden entirely for pay_as_you_go / no subscription */}
      {currentSub && !isPayAsYouGo && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 sm:p-8 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#307224]/10 text-[#307224] flex items-center justify-center">
                <CreditCard className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-extrabold text-gray-900">
                    {currentSub.displayName}
                  </h2>
                  <StatusBadge status={currentSub.status} />
                </div>
                <p className="text-xs text-gray-500 mt-0.5 capitalize">
                  {currentSub.isPrepaid ? 'Prepaid' : 'Postpaid'} •{' '}
                  {frequencyLabel(currentSub.frequency ?? 'weekly')} Collection •{' '}
                  {billingCycleLabel(currentSub.displayBillingCycle)} Billing
                </p>
              </div>
            </div>

            <div className="text-right">
              <div className="text-2xl font-extrabold text-[#307224]">
                {formatGhsFromString(currentSub.displayPrice)}
              </div>
              <div className="text-[11px] text-gray-400">
                per {currentSub.displayBillingCycle}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 rounded-lg bg-gray-50 text-[11px] font-bold text-gray-600">
              {currentSub.displayPickups} pickups per {currentSub.displayBillingCycle}
            </span>
            {currentSub.isTruckBased ? (
              <span className="px-3 py-1 rounded-lg bg-gray-50 text-[11px] font-bold text-gray-600 inline-flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5" />
                {currentSub.displayTierLabel}
              </span>
            ) : (
              <span className="px-3 py-1 rounded-lg bg-gray-50 text-[11px] font-bold text-gray-600">
                {currentSub.displayBins} bins
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="p-3.5 rounded-2xl bg-gray-50">
              <span className="text-[11px] font-semibold text-gray-400 uppercase block">Start Date</span>
              <span className="text-xs font-bold text-gray-800">
                {formatDate(currentSub.startDate) ?? '—'}
              </span>
            </div>
            <div className="p-3.5 rounded-2xl bg-gray-50">
              <span className="text-[11px] font-semibold text-gray-400 uppercase block">Renewal / End Date</span>
              <span className="text-xs font-bold text-gray-800">
                {formatDate(currentSub.endDate) ?? 'Auto-Renewing'}
              </span>
            </div>
            <div className="p-3.5 rounded-2xl bg-gray-50">
              <span className="text-[11px] font-semibold text-gray-400 uppercase block">Payment Status</span>
              <span className="text-xs font-bold text-gray-800 capitalize">
                {currentSub.payment?.status || (currentSub.isPrepaid ? 'Paid' : 'Postpaid Cycle')}
              </span>
            </div>
          </div>

          {/* Running balance accrued on the live subscription — its own banner */}
          {runningBalance !== null && runningBalance > 0 && (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-extrabold text-red-950">
                    Outstanding Balance: {formatGhs(runningBalance)}
                  </div>
                  <p className="text-[11px] text-red-800 mt-0.5">
                    {subStatus === 'suspended'
                      ? 'Your subscription has been suspended — pay your balance to restore service.'
                      : 'Pay your balance to keep your subscription in good standing.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handlePayBalance}
                className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shrink-0 cursor-pointer"
              >
                Pay Outstanding Balance
              </button>
            </div>
          )}

          {canManage && (
            <div className="pt-4 border-t border-gray-100 flex flex-wrap items-center gap-3">
              {hasPendingPayment && (
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={handleRetryPayment}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#307224] text-white text-xs font-bold cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Resend MoMo Prompt
                </button>
              )}
              {currentSub.isPrepaid && !hasPendingPayment && (
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={handleRenew}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-xs font-bold text-gray-800 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Renew Plan
                </button>
              )}
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleCancelSubscription}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-red-200 hover:bg-red-50 text-xs font-bold text-red-600 cursor-pointer"
              >
                <XCircle className="w-3.5 h-3.5" />
                {subStatus === 'pending' ? 'Cancel Pending Subscription' : 'Cancel Subscription'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Calculated Pricing Matrix */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 sm:p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-[#307224] text-xs font-bold mb-2">
              <Sparkles className="w-3.5 h-3.5" /> Personalized Pricing Matrix
            </span>
            <h2 className="text-xl font-extrabold text-gray-900">
              {pricingMode === 'full_truck'
                ? 'Full-Truck Load Subscription Plans'
                : 'Per-Bin Subscription Plans'}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {pricingMode === 'full_truck'
                ? 'Select your truck load capacity and preferred collection frequency'
                : basePerPickupRate !== null
                  ? `Calculated based on your configured bin inventory (${formatGhs(basePerPickupRate)} per pickup)`
                  : 'Calculated based on your configured bin inventory'}
            </p>
          </div>

          {/* Prepaid vs Postpaid Toggle */}
          <div className="inline-flex p-1 rounded-2xl bg-gray-100 self-start">
            <button
              type="button"
              onClick={() => setPaymentType('prepaid')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                paymentType === 'prepaid' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600'
              }`}
            >
              Prepaid (Pay Upfront)
            </button>
            <button
              type="button"
              onClick={() => setPaymentType('postpaid')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                paymentType === 'postpaid' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600'
              }`}
            >
              Postpaid (Bill at Cycle End)
            </button>
          </div>
        </div>

        {!pricingAvailable ? (
          /* Pricing unavailable → the message replaces the whole grid and no
             subscribe button is offered anywhere. */
          <div className="p-6 rounded-2xl bg-amber-50/60 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <p className="text-sm font-bold text-amber-900">
              {options
                ? pricingUnavailableMessage(options)
                : 'Could not load personalized pricing. Please try again.'}
            </p>
            {options && showAddBinsCta(options) && (
              <Link
                href="/account/bins"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-600 text-white text-xs font-bold shrink-0"
              >
                Add Your Bins <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* Truck Tier Selector or Bin Summary */}
            {showTruckTiers && options ? (
              <div className="flex flex-wrap gap-2">
                {options.calculated.truckLoadRates.map((tier) => {
                  const tierPerPickup =
                    quotesForSelection(options, tier.id)[0]?.perPickupRate ?? null;
                  return (
                    <button
                      key={tier.id}
                      type="button"
                      onClick={() => setSelectedTierId(tier.id)}
                      className={`px-4 py-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                        effectiveTierId === tier.id
                          ? 'border-[#307224] bg-emerald-50 text-[#307224]'
                          : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <Truck className="w-4 h-4" />
                      {tier.label}
                      {tierPerPickup !== null && ` (${formatGhs(tierPerPickup)}/pickup)`}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-[#FAFBFA] border border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Trash2 className="w-5 h-5 text-[#307224]" />
                  <div>
                    <div className="text-xs font-bold text-gray-900">
                      Configured Bins:{' '}
                      {bins.length > 0
                        ? bins
                            .map((b) => `${b.quantity}× ${b.capacityLiters ? `${b.capacityLiters}L` : b.label || 'Bin'}`)
                            .join(', ')
                        : 'No bins configured yet'}
                    </div>
                    {basePerPickupRate !== null && (
                      <div className="text-[11px] text-gray-500">
                        Base Rate per Pickup: {formatGhs(basePerPickupRate)}
                      </div>
                    )}
                  </div>
                </div>
                {options && showAddBinsCta(options) && (
                  <Link
                    href="/account/bins"
                    className="text-xs font-bold text-[#307224] hover:underline flex items-center gap-1 shrink-0"
                  >
                    Update Bin Inventory <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>
            )}

            {/* Quote Cards Grid */}
            {activeQuotes.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-amber-50/60 border border-amber-200">
                <p className="text-sm font-bold text-amber-900">
                  Configure your bin inventory first to see personalized subscription quotes.
                </p>
                {options && showAddBinsCta(options) && (
                  <Link
                    href="/account/bins"
                    className="mt-3 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-600 text-white text-xs font-bold"
                  >
                    Configure Bins Now <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeQuotes.map((q, idx) => (
                  <div
                    key={`${q.frequency}-${q.billingCycle}-${q.truckLoadRateId ?? 'bin'}-${idx}`}
                    className="rounded-2xl border border-gray-200 hover:border-[#307224] p-5 flex flex-col justify-between gap-4 transition bg-white"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-[#307224] text-xs font-bold">
                          {frequencyLabel(q.frequency)}
                        </span>
                        <span className="text-xs font-semibold text-gray-400 capitalize">
                          {billingCycleLabel(q.billingCycle)} Billing
                        </span>
                      </div>

                      <div className="mt-3">
                        <div className="text-2xl font-extrabold text-gray-900">
                          {formatGhs(q.amountPerCycle)}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          Includes <strong>{q.pickupsPerCycle} pickups</strong> per{' '}
                          {billingCycleLabel(q.billingCycle)} ({formatGhs(q.perPickupRate)} / pickup)
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleSubscribeCalculated(q)}
                      className="w-full py-3 px-4 rounded-xl bg-[#307224] hover:bg-[#25591c] disabled:opacity-60 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      {actionLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          Subscribe ({paymentType === 'postpaid' ? 'Postpaid' : 'Prepaid'})
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Payment Polling Modal */}
      {pollingPayment && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 text-center space-y-4 shadow-xl">
            <Loader2 className="w-10 h-10 text-[#307224] animate-spin mx-auto" />
            <h3 className="text-lg font-extrabold text-gray-900">Awaiting Mobile Money Confirmation</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Please approve the payment prompt on your mobile phone. This window will update automatically once confirmed.
            </p>
            <button
              type="button"
              onClick={() => setPollingPayment(false)}
              className="w-full py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-bold text-gray-700"
            >
              Close & Check Later
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

