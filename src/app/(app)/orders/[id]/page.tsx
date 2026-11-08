'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Download,
  XCircle,
  CheckCircle2,
  Package,
  Truck,
  MapPin,
  Loader2,
} from 'lucide-react';
import { StoreService } from '@/lib/services/api-services';
import { formatGhs } from '@/lib/currency';
import { ApiException } from '@/lib/api-client';
import { useFeedback } from '@/providers/app-providers';
import { StatusBadge, NetworkErrorView, PageLoader } from '@/components/ui/common';

const STEPS = ['Order Taken', 'Processing', 'On the Way', 'Delivered'];

export default function StoreOrderDetailPage() {
  const { id: orderId } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useFeedback();

  const [downloading, setDownloading] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const { data: order, isLoading, isError, refetch } = useQuery({
    queryKey: ['store-order', orderId],
    queryFn: () => StoreService.getOrderDetails(orderId),
    enabled: Boolean(orderId),
  });

  if (isLoading) return <PageLoader label="Loading order details..." />;
  if (isError || !order) return <NetworkErrorView onRetry={() => refetch()} />;

  const deliveryStatusLower = (order.deliveryStatus || '').toLowerCase();
  const paymentStatusLower = (order.paymentStatus || '').toLowerCase();
  const activeStepIndex = deliveryStatusLower.includes('deliver')
    ? 3
    : deliveryStatusLower.includes('out_for_delivery') ||
        deliveryStatusLower.includes('ship') ||
        deliveryStatusLower.includes('transit') ||
        deliveryStatusLower.includes('way')
      ? 2
      : deliveryStatusLower.includes('process') || paymentStatusLower === 'paid'
        ? 1
        : 0;

  const canCancel = deliveryStatusLower === 'pending';

  const handleCancelOrder = async () => {
    if (!window.confirm('Are you sure you want to cancel this order?')) return;
    setCancelling(true);
    try {
      await StoreService.cancelOrder(order.id);
      showToast('Order cancelled.', 'info');
      await refetch();
      queryClient.invalidateQueries({ queryKey: ['store-orders'] });
    } catch (err) {
      showToast(err instanceof ApiException ? err.message : 'Unable to cancel order.', 'error');
    } finally {
      setCancelling(false);
    }
  };

  const handleDownloadInvoice = async () => {
    setDownloading(true);
    try {
      await StoreService.downloadOrderInvoicePdf(order.id, order.orderNumber);
      showToast('Order invoice PDF downloaded.', 'success');
    } catch {
      showToast('Unable to download order invoice.', 'error');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
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
              Order #{order.orderNumber || order.id.slice(0, 8)}
            </h1>
            <p className="text-xs text-gray-500">
              Placed on{' '}
              {order.createdAt
                ? new Date(order.createdAt).toLocaleDateString('en-GH')
                : '—'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <StatusBadge status={order.deliveryStatus} />
          <StatusBadge status={order.paymentStatus} />
          <button
            type="button"
            disabled={downloading}
            onClick={handleDownloadInvoice}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#307224] text-white text-xs font-bold cursor-pointer"
          >
            {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            Invoice PDF
          </button>
        </div>
      </div>

      {/* 4-Step Delivery Tracker */}
      {deliveryStatusLower !== 'cancelled' && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Truck className="w-4 h-4 text-[#307224]" /> Delivery Progress
          </h2>
          <div className="grid grid-cols-4 gap-2">
            {STEPS.map((label, idx) => {
              const done = idx <= activeStepIndex;
              return (
                <div key={label} className="flex flex-col items-center text-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold mb-2 ${
                      done ? 'bg-[#307224] text-white' : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {done ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                  </div>
                  <span className={`text-xs font-bold ${done ? 'text-gray-900' : 'text-gray-400'}`}>
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Items & Totals */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-5">
        <h3 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
          <Package className="w-4 h-4 text-[#307224]" /> Ordered Items
        </h3>

        <div className="divide-y divide-gray-100">
          {order.items.map((item, idx) => (
            <div key={`${item.productName}-${idx}`} className="py-3 flex items-center justify-between text-sm">
              <div>
                <div className="font-bold text-gray-900">{item.productName}</div>
                <div className="text-xs text-gray-500">
                  Qty: {item.quantity} × {formatGhs(item.unitPrice)}
                </div>
              </div>
              <div className="font-bold text-gray-900">{formatGhs(item.lineTotal)}</div>
            </div>
          ))}
        </div>

        <div className="pt-4 border-t border-gray-100 space-y-2 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>Subtotal</span>
            <span>{formatGhs(order.subtotal)}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Delivery</span>
            <span>Paid separately</span>
          </div>
          {order.tax > 0 && (
            <div className="flex justify-between text-gray-600">
              <span>Tax</span>
              <span>{formatGhs(order.tax)}</span>
            </div>
          )}
          <div className="pt-2 border-t border-gray-100 flex justify-between text-base font-extrabold text-gray-900">
            <span>Total</span>
            <span className="text-[#307224]">{formatGhs(order.total)}</span>
          </div>
        </div>

        {order.deliveryAddress && order.deliveryAddress.display !== '' && (
          <div className="pt-4 border-t border-gray-100 flex items-start gap-2.5 text-xs text-gray-600">
            <MapPin className="w-4 h-4 text-[#307224] shrink-0 mt-0.5" />
            <div>
              <strong className="text-gray-900 block">Delivery Address</strong>
              {order.deliveryAddress.display}
            </div>
          </div>
        )}

        {canCancel && (
          <div className="pt-4 border-t border-gray-100">
            <button
              type="button"
              disabled={cancelling}
              onClick={handleCancelOrder}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-red-200 hover:bg-red-50 text-xs font-bold text-red-600 cursor-pointer"
            >
              <XCircle className="w-4 h-4" /> Cancel Order
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

