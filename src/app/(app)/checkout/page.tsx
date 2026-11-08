'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  MapPin,
  Phone,
  Plus,
  CheckCircle2,
  Loader2,
  CreditCard,
} from 'lucide-react';
import { StoreService } from '@/lib/services/api-services';
import { useAuth, useCart, useFeedback } from '@/providers/app-providers';
import { formatGhs } from '@/lib/currency';
import { ApiException } from '@/lib/api-client';
import { PageLoader } from '@/components/ui/common';

const MAX_POLL_ATTEMPTS = 60; // ~5 minutes at 5-second intervals
const POLL_INTERVAL_MS = 5000;

export default function CheckoutPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const {
    items,
    subtotal,
    total,
    clearCart,
    isMutating,
    deliveryFeeState,
    refreshDeliveryFees,
  } = useCart();
  const { showToast } = useFeedback();

  const canConfirmDeliveryFee =
    items.length === 0 || deliveryFeeState.status === 'ready';

  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [phoneNumber, setPhoneNumber] = useState(
    profile?.customer?.phoneNumber || '',
  );
  const [submitting, setSubmitting] = useState(false);
  const [pollingOrderId, setPollingOrderId] = useState<string | null>(null);

  // New Address Modal State — street/city/region/postalCode are the only
  // fields the addresses API accepts.
  const [showNewAddrModal, setShowNewAddrModal] = useState(false);
  const [addrStreet, setAddrStreet] = useState(profile?.customer?.address || '');
  const [addrCity, setAddrCity] = useState(profile?.customer?.city || '');
  const [addrRegion, setAddrRegion] = useState(profile?.customer?.region || '');
  const [addrPostalCode, setAddrPostalCode] = useState(
    profile?.customer?.postalCode || '',
  );
  const [savingAddr, setSavingAddr] = useState(false);

  const addressesQuery = useQuery({
    queryKey: ['store-addresses'],
    queryFn: () => StoreService.getAddresses(),
  });

  useEffect(() => {
    if (addressesQuery.data && addressesQuery.data.length > 0 && !selectedAddressId) {
      const def = addressesQuery.data.find((a) => a.isDefault) || addressesQuery.data[0];
      setSelectedAddressId(def.id);
    }
  }, [addressesQuery.data, selectedAddressId]);

  // Poll the order's payment status after checkout
  useEffect(() => {
    if (!pollingOrderId) return;
    const orderId = pollingOrderId;
    let attempts = 0;
    const timer = setInterval(async () => {
      attempts++;
      try {
        const details = await StoreService.getOrderDetails(orderId);
        const payStatus = (details.paymentStatus || '').toLowerCase();
        if (payStatus === 'paid' || payStatus === 'completed') {
          clearInterval(timer);
          showToast('Order payment confirmed!', 'success');
          router.replace(`/orders/${orderId}`);
        } else if (payStatus === 'failed') {
          clearInterval(timer);
          showToast(
            'Payment was not completed. You can find this order in Order History.',
            'error',
          );
          router.replace(`/orders/${orderId}`);
        } else if (attempts >= MAX_POLL_ATTEMPTS) {
          clearInterval(timer);
          showToast(
            'Payment verification timed out. Check your order history for the latest status.',
            'warning',
          );
          router.replace(`/orders/${orderId}`);
        }
        // Anything else (e.g. "pending") keeps polling.
      } catch {
        // continue polling on transient errors
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [pollingOrderId, router, showToast]);

  const handleCreateAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    const street = addrStreet.trim();
    const city = addrCity.trim();
    const region = addrRegion.trim();
    if (!street || !city || !region) return;
    setSavingAddr(true);
    try {
      const created = await StoreService.createAddress({
        street,
        city,
        region,
        postalCode: addrPostalCode.trim() || undefined,
        // The first saved address becomes the default one.
        isDefault: (addressesQuery.data || []).length === 0,
      });
      await addressesQuery.refetch();
      setSelectedAddressId(created.id);
      setShowNewAddrModal(false);
      showToast('Delivery address saved.', 'success');
    } catch (err) {
      showToast(err instanceof ApiException ? err.message : 'Failed to save address.', 'error');
    } finally {
      setSavingAddr(false);
    }
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAddressId) {
      showToast('Please add a delivery address', 'warning');
      return;
    }
    const mobileNumber = phoneNumber.trim();
    if (mobileNumber.replace(/\D/g, '').length < 10) {
      showToast('Please enter your Mobile Money phone number.', 'warning');
      return;
    }

    if (!canConfirmDeliveryFee) {
      showToast(
        'Delivery fee is still loading or unavailable. Please retry before placing the order.',
        'warning',
      );
      return;
    }

    setSubmitting(true);
    try {
      // useCart() mirrors the server cart, so there is nothing to re-sync here.
      const order = await StoreService.checkout({
        deliveryAddressId: selectedAddressId,
        mobileNumber,
      });

      try {
        await clearCart();
      } catch {
        // Checkout already consumes the server cart; keep the local copy empty.
      }
      queryClient.invalidateQueries({ queryKey: ['store-orders'] });
      showToast('Order placed! Approve the Mobile Money prompt on your phone.', 'info');
      setPollingOrderId(order.id);
    } catch (err) {
      showToast(err instanceof ApiException ? err.message : 'Checkout failed. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (addressesQuery.isLoading) return <PageLoader label="Preparing checkout..." />;

  const addresses = addressesQuery.data || [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="p-2 rounded-xl bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Checkout</h1>
          <p className="text-xs text-gray-500">Select delivery address and complete payment via Mobile Money</p>
        </div>
      </div>

      <form onSubmit={handleCheckout} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-6">
          {/* 1. Delivery Address */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#307224]" /> 1. Delivery Address
              </h2>
              <button
                type="button"
                onClick={() => setShowNewAddrModal(true)}
                className="inline-flex items-center gap-1 text-xs font-bold text-[#307224] hover:underline cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Address
              </button>
            </div>

            {addresses.length === 0 ? (
              <div className="p-6 rounded-2xl bg-gray-50 text-center space-y-3">
                <p className="text-xs text-gray-600">No saved delivery addresses yet.</p>
                <button
                  type="button"
                  onClick={() => setShowNewAddrModal(true)}
                  className="px-4 py-2 rounded-xl bg-[#307224] text-white text-xs font-bold"
                >
                  + Add Delivery Address
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {addresses.map((addr) => {
                  const selected = addr.id === selectedAddressId;
                  return (
                    <button
                      key={addr.id}
                      type="button"
                      onClick={() => setSelectedAddressId(addr.id)}
                      className={`w-full p-4 rounded-2xl border text-left flex items-start justify-between gap-3 transition cursor-pointer ${
                        selected
                          ? 'border-[#307224] bg-emerald-50/50 ring-2 ring-[#307224]/15'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div>
                        <div className="text-sm font-bold text-gray-900 flex items-center gap-2">
                          <span>{addr.street}</span>
                          {addr.isDefault && (
                            <span className="px-2 py-0.5 rounded-full bg-[#307224]/10 text-[#307224] text-[10px] font-bold uppercase">
                              Default
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-600 mt-0.5">{addr.summary}</div>
                      </div>
                      {selected && <CheckCircle2 className="w-5 h-5 text-[#307224] shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 2. Mobile Money Payment */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-4">
            <h2 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-[#307224]" /> 2. Mobile Money Number
            </h2>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">
                MoMo Phone Number (MTN / Telecel / AT)
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  required
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="024 123 4567"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Summary */}
        <div className="lg:col-span-5 bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-5 self-start">
          <h3 className="text-base font-extrabold text-gray-900">Order Review ({items.length} items)</h3>

          <div className="divide-y divide-gray-100 max-h-60 overflow-y-auto">
            {items.map((item) => (
              <div key={item.id} className="py-2.5 flex justify-between text-xs">
                <span className="text-gray-700 font-medium">
                  {item.quantity}× {item.productName}
                </span>
                <span className="font-bold text-gray-900">{formatGhs(item.lineTotal)}</span>
              </div>
            ))}
          </div>

          <div className="space-y-2 pt-3 border-t border-gray-100 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span className="font-semibold text-gray-900">{formatGhs(subtotal)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Delivery Fee</span>
              <span className="font-semibold text-gray-900 inline-flex items-center gap-2">
                {deliveryFeeState.status === 'loading' && (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Calculating…
                  </>
                )}
                {deliveryFeeState.status === 'error' && (
                  <>
                    Unavailable
                    <button
                      type="button"
                      onClick={() => refreshDeliveryFees()}
                      className="text-xs font-bold text-[#307224] hover:underline"
                    >
                      Retry
                    </button>
                  </>
                )}
                {deliveryFeeState.status === 'unavailable' &&
                  'Not available'}
                {deliveryFeeState.status === 'ready' &&
                  (deliveryFeeState.isFree ? (
                    'FREE'
                  ) : (
                    formatGhs(deliveryFeeState.fee ?? 0)
                  ))}
              </span>
            </div>
            <div className="pt-2.5 border-t border-gray-100 flex justify-between text-base font-extrabold text-gray-900">
              <span>Total Payable</span>
              <span className="text-[#307224]">
                {canConfirmDeliveryFee ? formatGhs(total) : formatGhs(subtotal)}
              </span>
            </div>
          </div>

          <button
            type="submit"
            disabled={
              submitting ||
              items.length === 0 ||
              isMutating ||
              !canConfirmDeliveryFee
            }
            className="w-full py-3.5 px-6 rounded-2xl bg-[#307224] hover:bg-[#25591c] disabled:opacity-60 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            {submitting || isMutating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : !canConfirmDeliveryFee ? (
              'Confirming delivery fee…'
            ) : (
              `Pay ${formatGhs(total)} & Place Order`
            )}
          </button>
        </div>
      </form>

      {/* New Address Modal */}
      {showNewAddrModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateAddress}
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl space-y-4"
          >
            <h3 className="text-lg font-extrabold text-gray-900">Add Delivery Address</h3>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Street Address *
              </label>
              <input
                type="text"
                required
                value={addrStreet}
                onChange={(e) => setAddrStreet(e.target.value)}
                placeholder="12, New Street, Libya Quarters"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">City *</label>
                <input
                  type="text"
                  required
                  value={addrCity}
                  onChange={(e) => setAddrCity(e.target.value)}
                  placeholder="e.g. Accra"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Region *</label>
                <input
                  type="text"
                  required
                  value={addrRegion}
                  onChange={(e) => setAddrRegion(e.target.value)}
                  placeholder="e.g. Greater Accra"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Postal Code (Optional)
              </label>
              <input
                type="text"
                value={addrPostalCode}
                onChange={(e) => setAddrPostalCode(e.target.value)}
                placeholder="e.g. GA-123-4567"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs"
              />
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowNewAddrModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingAddr}
                className="flex-1 py-2.5 rounded-xl bg-[#307224] text-white text-xs font-bold cursor-pointer"
              >
                {savingAddr ? 'Saving...' : 'Save Address'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Payment Polling Modal */}
      {pollingOrderId && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 text-center space-y-4 shadow-xl">
            <Loader2 className="w-10 h-10 text-[#307224] animate-spin mx-auto" />
            <h3 className="text-lg font-extrabold text-gray-900">Waiting for Mobile Money PIN</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Approve the prompt on your mobile phone to complete your Eco Store order.
            </p>
            <button
              type="button"
              onClick={() => router.replace(`/orders/${pollingOrderId}`)}
              className="w-full py-2.5 rounded-xl bg-gray-100 text-xs font-bold text-gray-800"
            >
              View Order Details
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

