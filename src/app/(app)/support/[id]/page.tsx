'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Send, Loader2 } from 'lucide-react';
import { SupportService } from '@/lib/services/api-services';
import {
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  SupportTicket,
} from '@/types/models';
import { useFeedback } from '@/providers/app-providers';
import { ApiException } from '@/lib/api-client';
import { StatusBadge, NetworkErrorView, PageLoader } from '@/components/ui/common';

export default function SupportTicketDetailPage() {
  const { id: ticketId } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useFeedback();

  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  const { data: ticket, isLoading, isError, refetch } = useQuery({
    queryKey: ['support-ticket', ticketId],
    queryFn: () => SupportService.getTicketById(ticketId),
    enabled: Boolean(ticketId),
  });

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    const message = replyText.trim();
    if (!message || !ticket || sending) return;
    setSending(true);
    try {
      const newMessage = await SupportService.replyToTicket(ticket.id, message);

      // Replying re-opens a resolved/closed ticket — update the cache
      // optimistically instead of refetching.
      const oldStatus = ticket.status;
      const newStatus =
        oldStatus === 'resolved' || oldStatus === 'closed' ? 'open' : oldStatus;

      queryClient.setQueryData<SupportTicket>(
        ['support-ticket', ticketId],
        (prev) =>
          prev
            ? {
                ...prev,
                status: newStatus,
                messages: [...prev.messages, newMessage],
              }
            : prev,
      );
      setReplyText('');
      showToast('Reply sent.', 'success');
    } catch (err) {
      showToast(err instanceof ApiException ? err.message : 'Failed to send reply.', 'error');
    } finally {
      setSending(false);
    }
  };

  if (isLoading) return <PageLoader label="Loading conversation..." />;
  if (isError || !ticket) return <NetworkErrorView onRetry={() => refetch()} />;

  const categoryLabel =
    TICKET_CATEGORIES.find((c) => c.value === ticket.category)?.label ?? ticket.category;
  const priorityLabel =
    TICKET_PRIORITIES.find((p) => p.value === ticket.priority)?.label ?? ticket.priority;

  // The opening message of the thread is the original request.
  const [opening, ...thread] = ticket.messages;

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
            <h1 className="text-xl font-extrabold text-gray-900">{ticket.subject}</h1>
            <p className="text-xs text-gray-500">
              Category: {categoryLabel} • Priority: {priorityLabel}
            </p>
          </div>
        </div>
        <StatusBadge status={ticket.status} />
      </div>

      {/* Original Issue + Thread */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-4">
        {opening && (
          <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
            <div className="text-xs font-bold text-gray-500 uppercase mb-1">Original Request</div>
            <p className="text-sm text-gray-800 whitespace-pre-line">{opening.message}</p>
          </div>
        )}

        <div className="space-y-3 pt-2">
          {thread.map((msg) => {
            const isCustomer = msg.authorType === 'customer';
            return (
              <div
                key={msg.id}
                className={`p-4 rounded-2xl max-w-[85%] ${
                  isCustomer
                    ? 'bg-[#307224] text-white ml-auto'
                    : 'bg-emerald-50 border border-emerald-100 mr-auto'
                }`}
              >
                <div
                  className={`text-[11px] font-bold mb-1 ${
                    isCustomer ? 'text-emerald-100' : 'text-[#307224]'
                  }`}
                >
                  {msg.authorName || (isCustomer ? 'You' : 'LaCarte Support')}
                </div>
                <p className="text-xs leading-relaxed whitespace-pre-line">{msg.message}</p>
              </div>
            );
          })}
        </div>

        {ticket.status.toLowerCase() !== 'closed' && (
          <form onSubmit={handleSendReply} className="pt-4 border-t border-gray-100 flex gap-2">
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Write a reply..."
              className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#307224]"
            />
            <button
              type="submit"
              disabled={sending || !replyText.trim()}
              className="px-5 py-3 rounded-xl bg-[#307224] hover:bg-[#25591c] disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

