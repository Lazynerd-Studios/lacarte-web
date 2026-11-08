import { describe, expect, it } from 'vitest';
import {
  isSubscriptionPollingConfirmed,
  pendingPickupPaymentPollInterval,
  pickupBadgeState,
} from './payment-state';

describe('pickupBadgeState', () => {
  it('marks a pending PAYG pickup as payment pending', () => {
    expect(
      pickupBadgeState({
        status: 'pending',
        requiresPayment: true,
        isPayGoPaymentFailed: false,
      }),
    ).toEqual({
      status: 'pending',
      requiresPayment: true,
      paymentFailed: false,
    });
  });

  it('prioritizes a failed payment over the lifecycle status', () => {
    expect(
      pickupBadgeState({
        status: 'expired',
        requiresPayment: false,
        isPayGoPaymentFailed: true,
      }),
    ).toEqual({
      status: 'expired',
      requiresPayment: false,
      paymentFailed: true,
    });
  });

  it('leaves an ordinary status badge untouched', () => {
    expect(
      pickupBadgeState({
        status: 'completed',
        requiresPayment: false,
        isPayGoPaymentFailed: false,
      }),
    ).toEqual({
      status: 'completed',
      requiresPayment: false,
      paymentFailed: false,
    });
  });
});

describe('pendingPickupPaymentPollInterval', () => {
  it('polls every 10 seconds while a pickup requires payment', () => {
    expect(
      pendingPickupPaymentPollInterval([
        { requiresPayment: false },
        { requiresPayment: true },
      ]),
    ).toBe(10_000);
  });

  it('stops polling when no pickup requires payment', () => {
    expect(
      pendingPickupPaymentPollInterval([{ requiresPayment: false }]),
    ).toBe(false);
  });
});

describe('isSubscriptionPollingConfirmed', () => {
  it('confirms an active subscription payment', () => {
    expect(
      isSubscriptionPollingConfirmed({
        subscription: { isActive: true, payment: { isPaid: true } },
        outstandingDebt: null,
        hasDebt: false,
      } as never),
    ).toBe(true);
  });

  it('does not confirm while an active subscription payment is pending', () => {
    expect(
      isSubscriptionPollingConfirmed({
        subscription: { isActive: true, payment: { isPaid: false } },
        outstandingDebt: null,
        hasDebt: false,
      } as never),
    ).toBe(false);
  });

  it('confirms cancelled-subscription debt settlement once no debt remains', () => {
    expect(
      isSubscriptionPollingConfirmed({
        subscription: null,
        outstandingDebt: null,
        hasDebt: false,
      }),
    ).toBe(true);
  });

  it('does not confirm cancelled-subscription debt settlement while debt remains', () => {
    expect(
      isSubscriptionPollingConfirmed({
        subscription: null,
        outstandingDebt: { subscriptionId: 'old-sub', amount: 42 },
        hasDebt: true,
      }),
    ).toBe(false);
  });
});
