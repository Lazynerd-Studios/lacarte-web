'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  User,
  MapPin,
  Trash2,
  CreditCard,
  Receipt,
  Package,
  Shield,
  Activity,
  LifeBuoy,
  Building2,
  ArrowRight,
  Check,
  Loader2,
} from 'lucide-react';
import { useAuth, useFeedback } from '@/providers/app-providers';
import { CustomerService } from '@/lib/services/api-services';
import { ApiException } from '@/lib/api-client';

/** `profile.user` is a loose record, so account fields need narrowing. */
function asText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return '';
  return String(value);
}

export default function ProfileOverviewPage() {
  const { profile, refreshProfile } = useAuth();
  const { showToast } = useFeedback();

  const customer = profile?.customer;
  const user = profile?.user;
  const userName = asText(user?.name);
  const userEmail = asText(user?.email);
  const isPerBin = customer?.customerType?.isPerBin ?? true;
  const requiresEntityName = Boolean(customer?.customerType?.requiresEntityName);

  const [editingEntity, setEditingEntity] = useState(false);
  const [entityNameVal, setEntityNameVal] = useState(customer?.entityName || '');
  const [savingEntity, setSavingEntity] = useState(false);

  const handleSaveEntityName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityNameVal.trim()) return;
    setSavingEntity(true);
    try {
      await CustomerService.updateCustomer({ entityName: entityNameVal.trim() });
      await refreshProfile();
      setEditingEntity(false);
      showToast('Organization name updated!', 'success');
    } catch (err) {
      showToast(err instanceof ApiException ? err.message : 'Unable to update organization name.', 'error');
    } finally {
      setSavingEntity(false);
    }
  };

  const quickLinks = [
    ...(isPerBin
      ? [
          {
            href: '/account/bins',
            icon: Trash2,
            title: 'My Waste Bins',
            desc: 'Configure your bin capacities & quantities for accurate pricing',
          },
        ]
      : []),
    {
      href: '/onboarding/location',
      icon: MapPin,
      title: 'Pickup GPS Location',
      desc: customer?.address || 'Update your saved street address & map pin',
    },
    {
      href: '/subscription',
      icon: CreditCard,
      title: 'Subscription Plan',
      desc: 'Switch between Pay-As-You-Go, Prepaid, or Postpaid plans',
    },
    {
      href: '/billing',
      icon: Receipt,
      title: 'Billing & Invoices',
      desc: 'View payment history and download official PDF statements',
    },
    {
      href: '/orders',
      icon: Package,
      title: 'Eco Store Orders',
      desc: 'Track bin & supply deliveries and download receipts',
    },
    {
      href: '/account/security',
      icon: Shield,
      title: 'Account Security',
      desc: 'Update your email address or account password',
    },
    {
      href: '/account/activity',
      icon: Activity,
      title: 'Activity Log',
      desc: 'Audit trail of account logins, bookings, and changes',
    },
    {
      href: '/support',
      icon: LifeBuoy,
      title: 'Help & Support Tickets',
      desc: 'Chat with LaCarte customer care and track ticket status',
    },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Card */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-[#307224] text-white flex items-center justify-center text-2xl font-extrabold shrink-0">
            {(userName || 'C').charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-gray-900">{userName || 'Customer'}</h1>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-[#307224] text-xs font-bold">
                {customer?.customerType?.name || 'Residential'}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {userEmail} {customer?.phoneNumber ? `• ${customer.phoneNumber}` : ''}
            </p>
            {customer?.zone?.name && (
              <p className="text-xs font-semibold text-[#307224] mt-1">
                Service Zone: {customer.zone.name}
              </p>
            )}
          </div>
        </div>

        {(requiresEntityName || customer?.entityName) && (
          <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 min-w-[240px]">
            <div className="flex items-center justify-between gap-2 text-xs text-gray-500 font-semibold uppercase">
              <span className="flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-[#307224]" /> Organization
              </span>
              {!editingEntity && (
                <button
                  type="button"
                  onClick={() => {
                    setEntityNameVal(customer?.entityName || '');
                    setEditingEntity(true);
                  }}
                  className="text-[#307224] hover:underline font-bold cursor-pointer"
                >
                  Edit
                </button>
              )}
            </div>
            {editingEntity ? (
              <form onSubmit={handleSaveEntityName} className="mt-2 flex items-center gap-2">
                <input
                  type="text"
                  required
                  value={entityNameVal}
                  onChange={(e) => setEntityNameVal(e.target.value)}
                  className="flex-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs bg-white"
                />
                <button
                  type="submit"
                  disabled={savingEntity}
                  className="p-1.5 rounded-lg bg-[#307224] text-white"
                >
                  {savingEntity ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                </button>
              </form>
            ) : (
              <div className="text-sm font-bold text-gray-900 mt-1">
                {customer?.entityName || 'Not set'}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {quickLinks.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 hover:border-[#307224]/40 flex items-center justify-between gap-4 transition group"
            >
              <div className="flex items-start gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-[#307224]/10 text-[#307224] flex items-center justify-center shrink-0 group-hover:bg-[#307224] group-hover:text-white transition">
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">{item.title}</h3>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{item.desc}</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-[#307224] shrink-0" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}

