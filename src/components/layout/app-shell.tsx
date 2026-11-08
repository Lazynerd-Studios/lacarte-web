'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Home,
  ShoppingBag,
  Clock,
  User,
  Bell,
  Plus,
  ShoppingCart,
  CreditCard,
  Receipt,
  Trash2,
  HeadphonesIcon,
  LogOut,
  MapPin,
  X,
  Minus,
  ArrowRight,
} from 'lucide-react';
import { useAuth, useCart } from '@/providers/app-providers';
import { NotificationService } from '@/lib/services/api-services';
import { formatGhs } from '@/lib/currency';

const DESKTOP_NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: Home },
  { href: '/pickups', label: 'Pickups', icon: Clock },
  { href: '/subscription', label: 'Subscription', icon: CreditCard },
  { href: '/billing', label: 'Billing', icon: Receipt },
  { href: '/shop', label: 'Shop', icon: ShoppingBag },
  { href: '/support', label: 'Support', icon: HeadphonesIcon },
];

const MOBILE_NAV = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/shop', label: 'Shop', icon: ShoppingBag },
  { href: '/pickups', label: 'History', icon: Clock },
  { href: '/account', label: 'Profile', icon: User },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    user,
    profile,
    hasActiveSubscription,
    hasPendingSubscription,
    signOut,
  } = useAuth();
  const {
    items,
    totalCount,
    subtotal,
    freeDeliveryMinQuantity,
    total,
    isDrawerOpen,
    setDrawerOpen,
    setQuantity,
    removeItem,
    isMutating,
    deliveryFeeState,
    refreshDeliveryFees,
  } = useCart();

  const { data: notifData } = useQuery({
    queryKey: ['notifications', 1],
    queryFn: () => NotificationService.getCustomerNotifications(1, 10),
    staleTime: 60 * 1000,
  });

  const unreadCount = notifData?.unreadCount ?? 0;
  const customer = profile?.customer;
  const displayName =
    customer?.displayName ||
    user?.name ||
    (profile?.user?.name as string | undefined) ||
    'Customer';

  const locationText = customer
    ? customer.address && customer.city
      ? `${customer.address}, ${customer.city}`
      : customer.city || customer.placeName || 'No location set'
    : 'No location set';

  const canBookPickup = !hasActiveSubscription && !hasPendingSubscription;

  return (
    <div className="min-h-screen flex bg-[#F9FAFC]">
      {/* ── Desktop Left Sidebar ─────────────────────────────────────────── */}
      <aside className="hidden md:flex md:w-64 lg:w-72 flex-col fixed inset-y-0 left-0 bg-white border-r border-[#E2E4E9] z-30">
        <div className="p-6 flex items-center justify-between border-b border-[#E2E4E9]">
          <Link href="/dashboard" className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/logo.png"
              alt="LaCarte"
              className="h-9 w-auto object-contain"
            />
          </Link>
          {customer?.zone?.name && (
            <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#FFB400]/15 text-[#0A0D12]">
              {customer.zone.name}
            </span>
          )}
        </div>

        {canBookPickup && (
          <div className="px-4 pt-5 pb-2">
            <Link
              href="/pickups/new"
              className="w-full py-3 px-4 rounded-full bg-[#FFB400] hover:bg-[#e5a200] text-[#0A0D12] font-bold text-sm flex items-center justify-center gap-2 shadow-xs transition"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              Schedule Pickup
            </Link>
          </div>
        )}

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {DESKTOP_NAV.map((item) => {
            if (
              item.href === '/account/bins' &&
              customer?.customerType.isFullTruck
            ) {
              return null;
            }
            const Icon = item.icon;
            const active =
              pathname === item.href ||
              (item.href !== '/dashboard' &&
                item.href !== '/subscription' &&
                item.href !== '/account' &&
                pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
                  active
                    ? 'bg-[#0A0D12] text-white font-semibold'
                    : 'text-[#4A5565] hover:bg-[#F3F4F6] hover:text-[#0A0D12]'
                }`}
              >
                <Icon
                  className={`w-4 h-4 ${active ? 'text-[#FFB400]' : 'text-[#6A7282]'}`}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-[#E2E4E9] bg-[#F9FAFC]">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-[#FFB400] text-[#0A0D12] font-bold flex items-center justify-center text-sm shrink-0">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[#0A0D12] truncate">
                {displayName}
              </p>
              <p className="text-xs text-[#6A7282] truncate flex items-center gap-1">
                <MapPin className="w-3 h-3 shrink-0" />
                {locationText}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/account"
              className="flex-1 py-2 px-3 rounded-xl border border-[#E2E4E9] bg-white hover:bg-[#F3F4F6] text-xs font-semibold text-[#0A0D12] flex items-center justify-center gap-2 transition"
            >
              <User className="w-3.5 h-3.5" />
              Account
            </Link>
            <button
              onClick={signOut}
              className="flex-1 py-2 px-3 rounded-xl border border-[#E2E4E9] bg-white hover:bg-[#FEE2E2]/40 hover:border-[#FECACA] text-xs font-semibold text-[#B42318] flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main Content Column ──────────────────────────────────────────── */}
      <div className="flex-1 md:pl-64 lg:pl-72 flex flex-col min-w-0">
        {/* Top Utility Header */}
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-xs border-b border-[#E2E4E9] px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/dashboard" className="md:hidden shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/logo-icon.png"
                alt="LaCarte"
                className="w-9 h-9 rounded-xl object-contain"
              />
            </Link>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-semibold text-[#0A0D12] truncate">
                {displayName}
              </h1>
              <Link
                href="/onboarding/location"
                className="text-xs text-[#4A5565] hover:text-[#0A0D12] flex items-center gap-1 truncate"
              >
                <MapPin className="w-3.5 h-3.5 text-[#FFB400] shrink-0" />
                <span className="truncate">{locationText}</span>
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {canBookPickup && (
              <Link
                href="/pickups/new"
                title="Schedule Pickup"
                className="w-10 h-10 md:w-auto md:px-4 rounded-full bg-[#FFB400] hover:bg-[#e5a200] text-[#0A0D12] font-bold text-xs flex items-center justify-center gap-1.5 transition"
              >
                <Plus className="w-5 h-5 md:w-4 md:h-4" />
                <span className="hidden md:inline">Schedule Pickup</span>
              </Link>
            )}

            {/* Cart Drawer Trigger */}
            <button
              onClick={() => setDrawerOpen(true)}
              className="relative w-10 h-10 rounded-full bg-white border border-[#E2E4E9] hover:bg-[#F3F4F6] flex items-center justify-center text-[#0A0D12] transition cursor-pointer"
              aria-label="Open shopping cart"
            >
              <ShoppingCart className="w-4 h-4" />
              {totalCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-[#FFB400] text-[#0A0D12] text-[11px] font-bold flex items-center justify-center">
                  {totalCount}
                </span>
              )}
            </button>

            {/* Notifications Bell */}
            <Link
              href="/notifications"
              className="relative w-10 h-10 rounded-full bg-white border border-[#E2E4E9] hover:bg-[#F3F4F6] flex items-center justify-center text-[#0A0D12] transition"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-[#FB2C36] ring-2 ring-white" />
              )}
            </Link>
          </div>
        </header>

        {/* Page Body */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-10 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* ── Mobile Bottom Navigation Bar (< md) ──────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-[#E2E4E9] z-30 px-2 py-1.5 flex items-center justify-around">
        {MOBILE_NAV.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl text-xs font-medium transition ${
                active ? 'text-[#0A0D12] font-bold' : 'text-[#6A7282]'
              }`}
            >
              <div
                className={`p-1.5 rounded-full mb-0.5 ${
                  active ? 'bg-[#FFB400]/20 text-[#0A0D12]' : ''
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* ── Slide-over Cart Drawer ───────────────────────────────────────── */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md h-full flex flex-col shadow-2xl">
            <div className="p-5 border-b border-[#E2E4E9] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-[#FFB400]" />
                <h2 className="text-base font-bold text-[#0A0D12]">
                  Your Cart ({totalCount})
                </h2>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-[#F3F4F6] flex items-center justify-center text-[#4A5565] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {items.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <ShoppingBag className="w-12 h-12 text-[#99A1AF] mb-3" />
                <p className="text-base font-semibold text-[#0A0D12] mb-1">
                  Your cart is empty
                </p>
                <p className="text-xs text-[#6A7282] mb-5">
                  Browse bins, liners, and sanitation supplies in the shop.
                </p>
                <button
                  onClick={() => {
                    setDrawerOpen(false);
                    router.push('/shop');
                  }}
                  className="px-6 py-2.5 rounded-full bg-[#FFB400] text-xs font-bold text-[#0A0D12] cursor-pointer"
                >
                  Browse Shop
                </button>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto p-5 space-y-3">
                  {freeDeliveryMinQuantity !== null && (
                    <div className="p-3 rounded-xl bg-[#FFFAEB] border border-[#FDE68A] text-xs text-[#92400E]">
                      {totalCount >= freeDeliveryMinQuantity
                        ? '🎉 You qualify for FREE zone delivery!'
                        : `Add ${freeDeliveryMinQuantity - totalCount} more item(s) to unlock FREE delivery in your zone.`}
                    </div>
                  )}

                  {items.map((item) => (
                    <div
                      key={item.id || item.productId}
                      className="p-3.5 rounded-2xl border border-[#E2E4E9] flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[#0A0D12] truncate">
                          {item.productName}
                        </p>
                        <p className="text-xs text-[#6A7282]">
                          {formatGhs(item.unitPrice)} each
                        </p>
                        <p className="text-xs font-bold text-[#0A0D12] mt-1">
                          {formatGhs(item.lineTotal)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setQuantity(item, item.quantity - 1)}
                          disabled={isMutating}
                          className="w-7 h-7 rounded-full border border-[#E2E4E9] flex items-center justify-center hover:bg-[#F3F4F6] cursor-pointer disabled:cursor-wait disabled:opacity-50"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-sm font-semibold w-6 text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => setQuantity(item, item.quantity + 1)}
                          disabled={isMutating}
                          className="w-7 h-7 rounded-full bg-[#FFB400] flex items-center justify-center text-[#0A0D12] cursor-pointer disabled:cursor-wait disabled:opacity-50"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => removeItem(item.id)}
                          disabled={isMutating}
                          className="ml-1 text-[#B42318] hover:opacity-80 cursor-pointer disabled:cursor-wait disabled:opacity-50"
                          title="Remove"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-5 border-t border-[#E2E4E9] bg-[#F9FAFC] space-y-2.5">
                  <div className="flex justify-between text-xs text-[#4A5565]">
                    <span>Subtotal</span>
                    <span className="font-semibold text-[#0A0D12]">
                      {formatGhs(subtotal)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-[#4A5565]">
                    <span>Zone Delivery Fee</span>
                    <span className="font-semibold text-[#0A0D12]">
                      {deliveryFeeState.status === 'loading' && 'Calculating…'}
                      {(deliveryFeeState.status === 'error' ||
                        deliveryFeeState.status === 'unavailable') &&
                        'Unavailable'}
                      {deliveryFeeState.status === 'ready' &&
                        (deliveryFeeState.isFree
                          ? 'FREE'
                          : formatGhs(deliveryFeeState.fee ?? 0))}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-[#0A0D12] pt-2 border-t border-[#E2E4E9]">
                    <span>Total</span>
                    <span>
                      {deliveryFeeState.status === 'ready'
                        ? formatGhs(total)
                        : formatGhs(subtotal)}
                    </span>
                  </div>
                  <button
                    disabled={isMutating || deliveryFeeState.status !== 'ready'}
                    onClick={() => {
                      setDrawerOpen(false);
                      router.push('/checkout');
                    }}
                    className="w-full mt-2 py-3.5 px-6 rounded-full bg-[#FFB400] hover:bg-[#e5a200] text-sm font-bold text-[#0A0D12] flex items-center justify-center gap-2 transition cursor-pointer disabled:cursor-wait disabled:opacity-60"
                  >
                    {deliveryFeeState.status === 'ready'
                      ? 'Proceed to Checkout'
                      : 'Confirming Delivery Fee…'}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

