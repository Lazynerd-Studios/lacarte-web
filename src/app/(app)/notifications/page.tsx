'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, ArrowRight } from 'lucide-react';
import { NotificationService } from '@/lib/services/api-services';
import { AppNotification } from '@/types/models';
import { useFeedback } from '@/providers/app-providers';
import { NetworkErrorView, PageLoader } from '@/components/ui/common';

export default function NotificationsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useFeedback();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => NotificationService.getCustomerNotifications(1, 50),
  });

  const notifications = data?.data ?? [];
  // Server-supplied unread count; 0 while loading or on error.
  const unreadCount = data?.unreadCount ?? 0;

  const handleMarkAllRead = async () => {
    try {
      await NotificationService.markAllAsRead();
      showToast('All notifications marked as read.', 'success');
      await refetch();
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    } catch {
      showToast('Failed to mark all as read.', 'error');
    }
  };

  const handleNotificationClick = async (n: AppNotification) => {
    if (!n.isRead) {
      try {
        await NotificationService.markAsRead(n.id);
        queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
        refetch();
      } catch {
        // ignore
      }
    }

    const t = n.type.toLowerCase();
    const entityId = n.referenceId;
    if (t.includes('pickup') && entityId) {
      router.push(`/pickups/${entityId}`);
    } else if (t.includes('order') && entityId) {
      router.push(`/orders/${entityId}`);
    } else if (t.includes('subscription')) {
      router.push('/subscription');
    } else if (t.includes('billing') || t.includes('invoice')) {
      router.push('/billing');
    }
  };

  if (isLoading) return <PageLoader label="Loading notifications..." />;
  if (isError) return <NetworkErrorView onRetry={() => refetch()} />;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Notifications</h1>
          <p className="text-xs text-gray-500">
            Real-time alerts on truck dispatch, payments, and store deliveries
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 text-xs font-bold text-[#307224] cursor-pointer"
          >
            <CheckCheck className="w-4 h-4" /> Mark All Read ({unreadCount})
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-100 p-12 text-center">
          <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-gray-800">All caught up!</h3>
          <p className="text-xs text-gray-500 mt-1">You have no notifications right now.</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm divide-y divide-gray-100">
          {notifications.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => handleNotificationClick(n)}
              className={`w-full text-left p-5 flex items-start justify-between gap-4 hover:bg-gray-50 transition cursor-pointer ${
                !n.isRead ? 'bg-emerald-50/40' : ''
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                    !n.isRead ? 'bg-[#307224] text-white' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    {n.title}
                    {!n.isRead && (
                      <span className="w-2 h-2 rounded-full bg-[#307224]" />
                    )}
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{n.message}</p>
                  {n.createdAt && (
                    <span className="text-[11px] text-gray-400 mt-1 block">
                      {new Date(n.createdAt).toLocaleString('en-GH', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  )}
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-300 shrink-0 mt-2" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

