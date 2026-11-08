import { describe, expect, it } from 'vitest';
import { resolveDeliveryFeeState } from './delivery-fee';

describe('resolveDeliveryFeeState', () => {
  it('does not report free delivery while the zone fee is loading', () => {
    expect(
      resolveDeliveryFeeState({
        totalCount: 1,
        isLoading: true,
        isError: false,
        hasZone: true,
        matchedFeeRule: null,
      }),
    ).toMatchObject({ status: 'loading', fee: null, isFree: false });
  });

  it('does not report free delivery when the zone fee request fails', () => {
    expect(
      resolveDeliveryFeeState({
        totalCount: 1,
        isLoading: false,
        isError: true,
        hasZone: true,
        matchedFeeRule: null,
      }),
    ).toMatchObject({ status: 'error', fee: null, isFree: false });
  });

  it('does not report free delivery without a zone fee rule', () => {
    expect(
      resolveDeliveryFeeState({
        totalCount: 1,
        isLoading: false,
        isError: false,
        hasZone: true,
        matchedFeeRule: null,
      }),
    ).toMatchObject({ status: 'unavailable', fee: null, isFree: false });
  });

  it('reports a resolved delivery fee', () => {
    expect(
      resolveDeliveryFeeState({
        totalCount: 1,
        isLoading: false,
        isError: false,
        hasZone: true,
        matchedFeeRule: { fee: 75, freeDeliveryMinQuantity: null },
      }),
    ).toEqual({ status: 'ready', fee: 75, isFree: false });
  });

  it('reports free delivery only when the rule threshold is met', () => {
    expect(
      resolveDeliveryFeeState({
        totalCount: 3,
        isLoading: false,
        isError: false,
        hasZone: true,
        matchedFeeRule: { fee: 75, freeDeliveryMinQuantity: 3 },
      }),
    ).toEqual({ status: 'ready', fee: 0, isFree: true });
  });
});
