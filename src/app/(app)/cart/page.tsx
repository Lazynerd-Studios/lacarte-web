'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Trash2,
  Plus,
  Minus,
  ShoppingBag,
  ArrowRight,
  Truck,
} from 'lucide-react';
import { useCart } from '@/providers/app-providers';
import { formatGhs } from '@/lib/currency';

export default function CartPage() {
  const router = useRouter();
  const {
    items,
    totalCount,
    subtotal,
    freeDeliveryMinQuantity,
    total,
    setQuantity,
    removeItem,
    clearCart,
    isMutating,
    deliveryFeeState,
  } = useCart();

  const isFreeDelivery =
    items.length > 0 &&
    deliveryFeeState.status === 'ready' &&
    deliveryFeeState.isFree;
  const itemsToFreeDelivery =
    freeDeliveryMinQuantity !== null
      ? Math.max(freeDeliveryMinQuantity - totalCount, 0)
      : null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="p-2 rounded-xl bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900">Your Shopping Cart</h1>
            <p className="text-xs text-gray-500">Review your items before checkout</p>
          </div>
        </div>

        {items.length > 0 && (
          <button
            type="button"
            onClick={clearCart}
            disabled={isMutating}
            className="text-xs font-bold text-red-600 hover:underline flex items-center gap-1 cursor-pointer disabled:cursor-wait disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" /> Clear Cart
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-100 p-12 text-center space-y-4">
          <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto" />
          <h3 className="text-base font-bold text-gray-800">Your cart is empty</h3>
          <p className="text-xs text-gray-500">
            Browse our Eco Store for waste bins, liners, and sanitation products.
          </p>
          <Link
            href="/shop"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-[#307224] text-white text-xs font-bold"
          >
            Explore Eco Store
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Items List */}
          <div className="lg:col-span-8 bg-white rounded-3xl border border-gray-100 shadow-sm divide-y divide-gray-100">
            {items.map((item) => (
              <div key={item.id} className="p-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-gray-100 overflow-hidden shrink-0">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.productName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300">
                        <ShoppingBag className="w-6 h-6" />
                      </div>
                    )}
                  </div>
                  <div>
                    <Link
                      href={`/shop/${item.productId}`}
                      className="text-sm font-bold text-gray-900 hover:text-[#307224]"
                    >
                      {item.productName}
                    </Link>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {formatGhs(item.unitPrice)} each
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="inline-flex items-center gap-2 bg-gray-100 rounded-xl px-2.5 py-1">
                    <button
                      type="button"
                      onClick={() => setQuantity(item, item.quantity - 1)}
                      disabled={isMutating}
                      className="p-1 text-gray-700 cursor-pointer disabled:cursor-wait disabled:opacity-50"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-xs font-bold text-gray-900 min-w-[20px] text-center">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantity(item, item.quantity + 1)}
                      disabled={isMutating}
                      className="p-1 text-gray-700 cursor-pointer disabled:cursor-wait disabled:opacity-50"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="text-sm font-extrabold text-gray-900 min-w-[80px] text-right">
                    {formatGhs(item.lineTotal)}
                  </div>

                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    disabled={isMutating}
                    className="p-1.5 text-gray-400 hover:text-red-600 cursor-pointer disabled:cursor-wait disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Summary Box */}
          <div className="lg:col-span-4 bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-4 self-start">
            <h3 className="text-base font-extrabold text-gray-900">Order Summary</h3>

            {freeDeliveryMinQuantity !== null && freeDeliveryMinQuantity > 0 && (
              <div className="p-3 rounded-xl bg-emerald-50 text-xs text-emerald-900 flex items-start gap-2">
                <Truck className="w-4 h-4 text-[#307224] shrink-0 mt-0.5" />
                <span>
                  {isFreeDelivery
                    ? 'Free delivery unlocked!'
                    : `Add ${itemsToFreeDelivery} more item(s) for free delivery.`}
                </span>
              </div>
            )}

            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span className="font-semibold text-gray-900">{formatGhs(subtotal)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Delivery Fee</span>
                <span className="font-semibold text-gray-900">
                  {deliveryFeeState.status === 'loading' && 'Calculating…'}
                  {(deliveryFeeState.status === 'error' ||
                    deliveryFeeState.status === 'unavailable') &&
                    'Unavailable'}
                  {deliveryFeeState.status === 'ready' &&
                    (deliveryFeeState.isFree
                      ? 'FREE'
                      : formatGhs(deliveryFeeState.fee ?? 0))}
                </span>
              </div>
              <div className="pt-3 border-t border-gray-100 flex justify-between text-base font-extrabold text-gray-900">
                <span>Estimated Total</span>
                <span className="text-[#307224]">
                  {deliveryFeeState.status === 'ready'
                    ? formatGhs(total)
                    : formatGhs(subtotal)}
                </span>
              </div>
            </div>

            <Link
              href="/checkout"
              className="w-full py-3.5 px-5 rounded-2xl bg-[#307224] hover:bg-[#25591c] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition"
            >
              Proceed to Checkout <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

