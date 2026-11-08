'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Download, Receipt, Loader2 } from 'lucide-react';
import { SubscriptionService } from '@/lib/services/api-services';
import { formatGhs } from '@/lib/currency';
import { useFeedback } from '@/providers/app-providers';
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

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { showToast } = useFeedback();
  const [downloading, setDownloading] = useState(false);

  const { data: invoice, isLoading, isError, refetch } = useQuery({
    queryKey: ['invoice-detail', id],
    queryFn: () => SubscriptionService.getInvoiceDetail(id),
    enabled: Boolean(id),
  });

  const handleDownloadPdf = async () => {
    if (!invoice) return;
    setDownloading(true);
    try {
      // The service fetches the blob and triggers the browser download itself.
      await SubscriptionService.downloadInvoicePdf(invoice.id, invoice.invoiceNumber);
      showToast('Invoice PDF downloaded.', 'success');
    } catch {
      showToast('Unable to download invoice PDF.', 'error');
    } finally {
      setDownloading(false);
    }
  };

  if (isLoading) return <PageLoader label="Loading invoice statement..." />;
  if (isError || !invoice) return <NetworkErrorView onRetry={() => refetch()} />;

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
              Invoice #{invoice.invoiceNumber || invoice.id.slice(0, 8)}
            </h1>
            <p className="text-xs text-gray-500">
              {invoiceTypeLabel(invoice.type) || 'Subscription Statement'}
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={downloading}
          onClick={handleDownloadPdf}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#307224] hover:bg-[#25591c] text-white text-xs font-bold cursor-pointer"
        >
          {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Download PDF
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 sm:p-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#307224]/10 text-[#307224] flex items-center justify-center">
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs text-gray-400 font-semibold uppercase">Total Billed</div>
              <div className="text-2xl font-extrabold text-gray-900">{formatGhs(invoice.totalAmount)}</div>
            </div>
          </div>
          <StatusBadge status={invoice.status} />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <span className="text-gray-400 font-semibold uppercase block">Customer</span>
            <span className="font-bold text-gray-900 mt-0.5 block">
              {invoice.customer?.displayName || invoice.customer?.name || 'LaCarte Customer'}
            </span>
          </div>
          <div>
            <span className="text-gray-400 font-semibold uppercase block">Issued Date</span>
            <span className="font-bold text-gray-900 mt-0.5 block">
              {formatDate(invoice.issueDate) ?? '—'}
            </span>
          </div>
          <div>
            <span className="text-gray-400 font-semibold uppercase block">Payment Method</span>
            <span className="font-bold text-gray-900 mt-0.5 block capitalize">
              {invoice.paymentMethod || 'Mobile Money'}
            </span>
          </div>
        </div>

        {invoice.items.length > 0 && (
          <div className="pt-4 border-t border-gray-100">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
              Line Items
            </h3>
            <div className="divide-y divide-gray-100">
              {invoice.items.map((item, idx) => (
                <div key={idx} className="py-3 flex items-center justify-between text-sm">
                  <div>
                    <div className="font-semibold text-gray-900">{item.description}</div>
                    <div className="text-xs text-gray-500">
                      Qty: {item.quantity} × {formatGhs(item.unitPrice)}
                    </div>
                  </div>
                  <div className="font-bold text-gray-900">{formatGhs(item.amount)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

