import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SubscriptionService, PickupService, StoreService } from '@/lib/services/api-services';
import { TokenStorage } from '@/lib/api-client';

function sentBody(): Record<string, unknown> | null {
  const call = vi
    .mocked(fetch)
    .mock.calls.find(([input]) => String(input).includes('/api/'));
  if (!call) return null;
  const init = call[1] as RequestInit;
  return init?.body ? JSON.parse(String(init.body)) : null;
}

beforeEach(() => {
  TokenStorage.save('test-token');
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      Promise.resolve({
        status: 200,
        ok: true,
        text: async () => JSON.stringify({}),
      }),
    ),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * The backend treats "" and null alike for optional UUIDs and answers
 * 422 "Expected string to match uuid". `21c1ef2` / `17b1b6e` in the Flutter
 * app fixed exactly this, so the key must be ABSENT.
 */
describe('optional keys are omitted, never null or empty (spec §6.4)', () => {
  it('omits truckLoadRateId for a per_bin subscribe', async () => {
    await SubscriptionService.subscribeCalculated({
      frequency: 'weekly',
      billingCycle: 'monthly',
      paymentType: 'prepaid',
      truckLoadRateId: null,
    });
    const body = sentBody()!;
    expect(body).not.toHaveProperty('truckLoadRateId');
    expect(body.frequency).toBe('weekly');
    expect(body.paymentType).toBe('prepaid');
  });

  it('treats an empty-string tier as absent rather than sending ""', async () => {
    await SubscriptionService.subscribeCalculated({
      frequency: 'weekly',
      billingCycle: 'monthly',
      truckLoadRateId: '',
    });
    expect(sentBody()).not.toHaveProperty('truckLoadRateId');
  });

  it('sends truckLoadRateId when the account is truck-based', async () => {
    await SubscriptionService.subscribeCalculated({
      frequency: 'weekly',
      billingCycle: 'monthly',
      truckLoadRateId: 'tier-half',
    });
    expect(sentBody()).toMatchObject({ truckLoadRateId: 'tier-half' });
  });

  it('omits isEmergency when false and never sends estimatedQuantityId', async () => {
    await PickupService.createPickupRequest({
      disposableItemTypeId: 'type-1',
      preferredPickupDate: '2026-11-06',
      isEmergency: false,
    });
    const body = sentBody()!;
    expect(body).not.toHaveProperty('isEmergency');
    expect(body).not.toHaveProperty('estimatedQuantityId');
    expect(body).not.toHaveProperty('truckLoadRateId');
  });

  it('drops blank free-text notes instead of sending an empty string', async () => {
    await PickupService.createPickupRequest({
      disposableItemTypeId: 'type-1',
      preferredPickupDate: '2026-11-06',
      additionalNotes: '   ',
    });
    expect(sentBody()).not.toHaveProperty('additionalNotes');
  });

  it('omits postalCode from an address when it was not provided', async () => {
    await StoreService.createAddress({
      street: '12 Oxford St',
      city: 'Accra',
      region: 'Greater Accra',
      postalCode: '',
    });
    const body = sentBody()!;
    expect(body).not.toHaveProperty('postalCode');
    expect(body.country).toBe('Ghana');
  });
});
