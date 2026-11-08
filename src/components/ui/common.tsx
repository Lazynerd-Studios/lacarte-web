'use client';

import React from 'react';
import { WifiOff, AlertCircle, RefreshCw, Loader2 } from 'lucide-react';
import { ApiException } from '@/lib/api-client';

export function NetworkErrorView({
  error,
  message,
  onRetry,
}: {
  error?: unknown;
  message?: string;
  onRetry?: () => void;
}) {
  const isOffline =
    (error instanceof ApiException &&
      (error.statusCode === 0 ||
        error.message.toLowerCase().includes('no internet'))) ||
    String(error).toLowerCase().includes('no internet');

  const displayMsg = isOffline
    ? 'Check your internet connection and try again.'
    : error instanceof ApiException && error.message
      ? error.message
      : message || "We couldn't load this right now.";

  return (
    <div className="flex flex-col items-center justify-center text-center p-8 bg-white rounded-2xl border border-[#E2E4E9]">
      <div className="w-16 h-16 rounded-full bg-[#F3F4F6] flex items-center justify-center text-[#6A7282] mb-4">
        {isOffline ? (
          <WifiOff className="w-7 h-7" />
        ) : (
          <AlertCircle className="w-7 h-7" />
        )}
      </div>
      <h3 className="text-base font-semibold text-[#0A0D12] mb-1.5">
        {isOffline ? "You're offline" : 'Something went wrong'}
      </h3>
      <p className="text-sm text-[#6A7282] max-w-sm mb-5">{displayMsg}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-7 py-2.5 rounded-full bg-[#FFB400] hover:bg-[#e6a200] text-sm font-bold text-[#0A0D12] transition cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      )}
    </div>
  );
}

export function PageLoader({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-[#6A7282]">
      <Loader2 className="w-8 h-8 animate-spin text-[#FFB400] mb-3" />
      <p className="text-sm font-medium">{label}</p>
    </div>
  );
}

export function StatusBadge({
  status,
  requiresPayment,
  paymentFailed,
}: {
  status: string;
  requiresPayment?: boolean;
  paymentFailed?: boolean;
}) {
  if (paymentFailed) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#F2F4F7] text-[#667085]">
        Payment invalidated
      </span>
    );
  }
  if (requiresPayment) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#FEE2E2] text-[#B42318]">
        Payment Pending
      </span>
    );
  }

  const s = status.toLowerCase();
  switch (s) {
    case 'completed':
    case 'paid':
    case 'active':
    case 'delivered':
    case 'resolved':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#DCFCE7] text-[#10B981]">
          {status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
        </span>
      );
    case 'assigned':
    case 'processing':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#FFB400]/15 text-[#B54708]">
          {status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
        </span>
      );
    case 'scheduled':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#F9F5FF] text-[#6941C6]">
          Scheduled
        </span>
      );
    case 'en_route':
    case 'truck_dispatched':
    case 'shipped':
    case 'in_progress':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#DCEEFB] text-[#155DFC]">
          {s === 'en_route' ? 'En Route' : status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
        </span>
      );
    case 'pending':
    case 'open':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#FFFAEB] text-[#D97706]">
          {status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
        </span>
      );
    case 'cancelled':
    case 'failed':
    case 'overdue':
    case 'suspended':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#FEE2E2] text-[#B42318]">
          {status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#F2F4F7] text-[#667085]">
          {status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || 'Unknown'}
        </span>
      );
  }
}

