'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, LifeBuoy, Plus, MessageSquare, ArrowRight, Loader2 } from 'lucide-react';
import { SupportService } from '@/lib/services/api-services';
import {
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TicketCategoryValue,
  TicketPriorityValue,
} from '@/types/models';
import { useFeedback } from '@/providers/app-providers';
import { ApiException } from '@/lib/api-client';
import { StatusBadge, NetworkErrorView, PageLoader } from '@/components/ui/common';

const categoryLabel = (value: string) =>
  TICKET_CATEGORIES.find((c) => c.value === value)?.label ?? value;

const priorityLabel = (value: string) =>
  TICKET_PRIORITIES.find((p) => p.value === value)?.label ?? value;

export default function SupportTicketsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useFeedback();

  const [statusFilter, setStatusFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<TicketCategoryValue | ''>('');
  const [priority, setPriority] = useState<TicketPriorityValue>('medium');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['support-tickets', statusFilter],
    queryFn: () =>
      SupportService.getMyTickets({
        status: statusFilter || undefined,
        limit: 30,
      }),
  });

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (subject.trim().length < 3) {
      showToast('Subject must be at least 3 characters', 'warning');
      return;
    }
    if (!category) {
      showToast('Please select a category', 'warning');
      return;
    }
    if (description.trim().length < 5) {
      showToast('Message must be at least 5 characters', 'warning');
      return;
    }
    setCreating(true);
    try {
      const created = await SupportService.createTicket({
        subject: subject.trim(),
        category,
        priority,
        message: description.trim(),
      });
      setModalOpen(false);
      setSubject('');
      setDescription('');
      setCategory('');
      await queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
      showToast('Support ticket submitted!', 'success');
      if (created.id) {
        router.push(`/support/${created.id}`);
      }
    } catch (err) {
      showToast(err instanceof ApiException ? err.message : 'Failed to create ticket.', 'error');
    } finally {
      setCreating(false);
    }
  };

  if (isLoading) return <PageLoader label="Loading support tickets..." />;
  if (isError) return <NetworkErrorView onRetry={() => refetch()} />;

  const tickets = data?.data ?? [];

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
            <h1 className="text-2xl font-extrabold text-gray-900">Help & Support</h1>
            <p className="text-xs text-gray-500">Open a ticket or reply to our customer care team</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#307224] hover:bg-[#25591c] text-white text-xs font-bold cursor-pointer"
        >
          <Plus className="w-4 h-4" /> New Support Ticket
        </button>
      </div>

      {/* Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto">
        {[
          { id: '', label: 'All Tickets' },
          { id: 'open', label: 'Open' },
          { id: 'in_progress', label: 'In Progress' },
          { id: 'resolved', label: 'Resolved' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setStatusFilter(tab.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              statusFilter === tab.id
                ? 'bg-[#307224] text-white'
                : 'bg-white border border-gray-200 text-gray-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {tickets.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-100 p-12 text-center space-y-3">
          <LifeBuoy className="w-12 h-12 text-gray-300 mx-auto" />
          <h3 className="text-base font-bold text-gray-800">No support tickets found</h3>
          <p className="text-xs text-gray-500">
            Have an issue with a pickup, subscription, or order? Create a ticket and we will help right away.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm divide-y divide-gray-100">
          {tickets.map((t) => (
            <Link
              key={t.id}
              href={`/support/${t.id}`}
              className="p-5 flex items-center justify-between gap-4 hover:bg-gray-50 transition"
            >
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-[#307224]/10 text-[#307224] flex items-center justify-center shrink-0 mt-0.5">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-gray-900">{t.subject}</div>
                  <div className="text-xs text-gray-500 line-clamp-1 mt-0.5">
                    Ticket #{t.ticketNumber}
                    {t.createdAt
                      ? ` • ${new Date(t.createdAt).toLocaleDateString('en-GH', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}`
                      : ''}
                  </div>
                  <div className="text-[11px] text-gray-400 mt-1">
                    Category: {categoryLabel(t.category)} • Priority: {priorityLabel(t.priority)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <StatusBadge status={t.status} />
                <ArrowRight className="w-4 h-4 text-gray-400" />
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Create Ticket Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateTicket}
            className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-xl space-y-4"
          >
            <h3 className="text-lg font-extrabold text-gray-900">New Support Ticket</h3>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Subject</label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Brief summary of your issue"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) =>
                    setCategory(e.target.value as TicketCategoryValue | '')
                  }
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white"
                >
                  <option value="">Select a category</option>
                  {TICKET_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Priority</label>
                <select
                  value={priority}
                  onChange={(e) =>
                    setPriority(e.target.value as TicketPriorityValue)
                  }
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white"
                >
                  {TICKET_PRIORITIES.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Description
              </label>
              <textarea
                rows={4}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe how we can help..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm"
              />
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating}
                className="flex-1 py-2.5 rounded-xl bg-[#307224] text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit Ticket'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

