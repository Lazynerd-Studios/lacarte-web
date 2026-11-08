'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Receipt, ArrowRight, Calendar } from 'lucide-react';
import { SubscriptionService } from '@/lib/services/api-services';
import { formatGhs } from '@/lib/currency';
import { StatusBadge, NetworkErrorView, PageLoader } from '@/components/ui/common';

/** Invoice type literals as delivered by the API (compared lowercased). */
function invoiceTypeLabel(type: string): string {
  switch (type.toLowerCase()) {
    case 'subscription':
      return 'Subscription';
    case 'pay_as_you_go':
    case 'paygo':
      return 'Pay As You Go';
    default:
      return type;
  }
}

/** Date fields on the models are ISO strings (or null), never Date objects. */
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

export default function InvoicesListPage() {
  const router = useRouter();
  const { data: invoices = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['billing-history'],
    queryFn: () => SubscriptionService.getBillingHistory(),
  });

  if (isLoading) return <PageLoader label="Loading billing history..." />;
  if (isError) return <NetworkErrorView onRetry={() => refetch()} />;

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
          <h1 className="text-2xl font-extrabold text-gray-900">Billing & Invoices</h1>
          <p className="text-xs text-gray-500">Download official PDF receipts and review past statements</p>
        </div>
      </div>

      {invoices.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-100 p-12 text-center">
          <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-gray-800">No invoices yet</h3>
          <p className="text-xs text-gray-500 mt-1">
            Your subscription invoices and payment receipts will appear here.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm divide-y divide-gray-100">
          {invoices.map((inv) => (
            <Link
              key={inv.id}
              href={`/billing/${inv.id}`}
              className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50 transition"
            >
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-[#307224]/10 text-[#307224] flex items-center justify-center shrink-0">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-gray-900">
                    {`Invoice #${inv.invoiceNumber || inv.id.slice(0, 8)}`}
                  </div>
                  <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                    <span>{invoiceTypeLabel(inv.type) || 'Statement'}</span>
                    <Calendar className="w-3.5 h-3.5 text-gray-400" />
                    {formatDate(inv.issueDate) ?? 'Recent Statement'}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-4">
                <div className="text-sm font-extrabold text-gray-900">{formatGhs(inv.totalAmount)}</div>
                <StatusBadge status={inv.status} />
                <ArrowRight className="w-4 h-4 text-gray-400" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

