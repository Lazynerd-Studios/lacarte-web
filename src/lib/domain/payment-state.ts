import type { MySubscriptionResult, PickupRequestResponse } from '@/types/models';

type PickupPaymentFlags = Pick<
  PickupRequestResponse,
  'status' | 'requiresPayment' | 'isPayGoPaymentFailed'
>;

export function pickupBadgeState(pickup: PickupPaymentFlags) {
  return {
    status: pickup.status,
    requiresPayment: pickup.requiresPayment,
    paymentFailed: pickup.isPayGoPaymentFailed,
  };
}

export function pendingPickupPaymentPollInterval(
  pickups: Pick<PickupRequestResponse, 'requiresPayment'>[],
): number | false {
  return pickups.some((pickup) => pickup.requiresPayment) ? 10_000 : false;
}

export function isSubscriptionPollingConfirmed(
  result: MySubscriptionResult,
): boolean {
  if (result.subscription) {
    return result.subscription.isActive && result.subscription.payment?.isPaid === true;
  }
  return !result.hasDebt;
}
