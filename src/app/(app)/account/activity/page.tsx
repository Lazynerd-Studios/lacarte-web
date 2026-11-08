'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Activity } from 'lucide-react';
import { ActivityLogService } from '@/lib/services/api-services';
import { NetworkErrorView, PageLoader } from '@/components/ui/common';

/** Mirrors _formatAction in profile_activity_log_screen.dart */
function formatAction(action: string): string {
  return action
    .replace(/[A-Z]/g, (m) => ` ${m}`)
    .replace(/_/g, ' ')
    .split(' ')
    .map((word) =>
      word === ''
        ? ''
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
    )
    .join(' ')
    .trim();
}

/** Mirrors _formatTimestamp in profile_activity_log_screen.dart */
function formatRelative(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);
  if (minutes < 1) return 'Just now';
  if (hours < 1) return `${minutes}m ago`;
  if (days < 1) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

export default function ActivityLogPage() {
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['activity-logs'],
    queryFn: () => ActivityLogService.getMyActivityLogs(1, 50),
  });

  if (isLoading) return <PageLoader label="Loading account activity..." />;
  if (isError) return <NetworkErrorView onRetry={() => refetch()} />;

  const logs = data?.data ?? [];

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
          <h1 className="text-2xl font-extrabold text-gray-900">Activity Log</h1>
          <p className="text-xs text-gray-500">Recent actions performed on your LaCarte account</p>
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-100 p-12 text-center">
          <Activity className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-gray-800">No recent activity</h3>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm divide-y divide-gray-100">
          {logs.map((log) => (
            <div key={log.id} className="p-4 sm:p-5 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-gray-100 text-gray-600 flex items-center justify-center shrink-0 mt-0.5">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-bold text-gray-900">
                    {formatAction(log.action)}
                  </div>
                  {log.description && (
                    <div className="text-xs text-gray-600 mt-0.5">{log.description}</div>
                  )}
                </div>
              </div>
              {log.createdAt && (
                <span className="text-[11px] text-gray-400 whitespace-nowrap">
                  {formatRelative(log.createdAt)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

