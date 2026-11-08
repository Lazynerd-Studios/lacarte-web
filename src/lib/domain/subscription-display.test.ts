import { describe, expect, it } from 'vitest';
import { isPrepaidSubscription } from './subscription-display';

describe('isPrepaidSubscription', () => {
  it('uses the payment type when a calculated subscription has no plan', () => {
    expect(
      isPrepaidSubscription({ planType: null, paymentType: 'postpaid' }),
    ).toBe(false);
  });

  it('keeps the plan type authoritative when a plan exists', () => {
    expect(
      isPrepaidSubscription({ planType: 'postpaid', paymentType: 'prepaid' }),
    ).toBe(false);
  });

  it('defaults unknown payments to prepaid', () => {
    expect(
      isPrepaidSubscription({ planType: null, paymentType: null }),
    ).toBe(true);
  });
});
