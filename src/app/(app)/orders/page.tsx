'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Package, ArrowRight, ShoppingBag } from 'lucide-react';
import { StoreService } from '@/lib/services/api-services';
import { formatGhs } from '@/lib/currency';
import { StatusBadge, NetworkErrorView, PageLoader } from '@/components/ui/common';

export default function StoreOrdersListPage() {
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['store-orders'],
    queryFn: () => StoreService.getMyOrders(1, 30),
  });

  if (isLoading) return <PageLoader label="Loading your store orders..." />;
  if (isError) return <NetworkErrorView onRetry={() => refetch()} />;

  const orders = data?.data || [];

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
            <h1 className="text-2xl font-extrabold text-gray-900">My Store Orders</h1>
            <p className="text-xs text-gray-500">Track delivery status and download order receipts</p>
          </div>
        </div>
        <Link
          href="/shop"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#307224] text-white text-xs font-bold"
        >
          <ShoppingBag className="w-4 h-4" /> Continue Shopping
        </Link>
      </div>

      {orders.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-100 p-12 text-center space-y-3">
          <Package className="w-12 h-12 text-gray-300 mx-auto" />
          <h3 className="text-base font-bold text-gray-800">No store orders yet</h3>
          <p className="text-xs text-gray-500">Orders placed in the Eco Store will appear here.</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm divide-y divide-gray-100">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/orders/${order.id}`}
              className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50 transition"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-[#307224]/10 text-[#307224] flex items-center justify-center shrink-0">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-gray-900">
                    Order #{order.orderNumber || order.id.slice(0, 8)}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {order.itemCount} item(s) •{' '}
                    {order.createdAt
                      ? new Date(order.createdAt).toLocaleDateString('en-GH')
                      : 'Recent'}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-4">
                <span className="text-sm font-extrabold text-gray-900">{formatGhs(order.total)}</span>
                <StatusBadge status={order.deliveryStatus} />
                <ArrowRight className="w-4 h-4 text-gray-400" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

