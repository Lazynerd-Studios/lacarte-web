import { describe, it, expect } from 'vitest';
import type {
  CalculatedQuote,
  CustomerBin,
  SubscriptionOptions,
  TruckLoadRate,
} from '@/types/models';
import {
  billingCycleLabel,
  defaultTierId,
  frequencyLabel,
  isTruckPresentation,
  pricingUnavailableMessage,
  quotesForSelection,
  quotesForTier,
  resolveHasBins,
  showAddBinsCta,
} from './pricing-mode';

function quote(
  frequency: string,
  billingCycle: string,
  tierId: string | null,
  amount: number,
): CalculatedQuote {
  return {
    frequency,
    billingCycle,
    truckLoadRateId: tierId,
    perPickupRate: amount,
    pickupsPerCycle: 4,
    amountPerCycle: amount,
    currency: 'GHS',
  };
}

function tier(id: string, label = id): TruckLoadRate {
  return {
    id,
    label,
    prepayRate: 100,
    postpayRate: 100,
    binEquivalent: 200,
    displayOrder: 0,
    isActive: true,
  };
}

function bin(quantity: number): CustomerBin {
  return {
    capacityRateId: `rate-${quantity}`,
    capacityLiters: 60,
    quantity,
    label: '60L',
  };
}

function options(
  overrides: Partial<SubscriptionOptions> & {
    quotes?: CalculatedQuote[];
    rates?: TruckLoadRate[];
  } = {},
): SubscriptionOptions {
  const { rates = [], quotes = [], ...rest } = overrides;
  return {
    pricingMode: 'per_bin',
    plans: [],
    calculated: {
      available: true,
      message: null,
      bins: [],
      truckLoadRates: rates,
      quotes,
    },
    isFullTruck: rest.pricingMode === 'full_truck',
    ...rest,
  } as SubscriptionOptions;
}

describe('quotesForTier', () => {
  const quotes = [
    quote('weekly', 'monthly', 't-half', 2400),
    quote('weekly', 'monthly', 't-full', 4400),
    quote('monthly', 'quarterly', null, 900),
  ];

  it('filters to exactly one quote per frequency/cycle cell for a tier', () => {
    expect(quotesForTier(quotes, 't-half')).toHaveLength(1);
    expect(quotesForTier(quotes, 't-half')[0].amountPerCycle).toBe(2400);
    expect(quotesForTier(quotes, 't-full')[0].amountPerCycle).toBe(4400);
  });

  it('uses strict equality so a null-tier quote is never swept into a tier', () => {
    expect(quotesForTier(quotes, null)).toEqual([quotes[2]]);
    expect(quotesForTier(quotes, '')).toHaveLength(0);
  });

  it('returns empty for an unknown tier rather than falling back to all quotes', () => {
    expect(quotesForTier(quotes, 'nope')).toHaveLength(0);
  });
});

describe('truck presentation degradation', () => {
  it('treats full_truck with no delivered tiers as the per-bin presentation', () => {
    const o = options({ pricingMode: 'full_truck', rates: [], quotes: [quote('weekly', 'monthly', null, 500)] });
    expect(isTruckPresentation(o)).toBe(false);
    expect(quotesForSelection(o, null)).toHaveLength(1);
  });

  it('defaults the tier picker to the first rate in API order, not displayOrder', () => {
    const o = options({
      pricingMode: 'full_truck',
      rates: [tier('t-second'), tier('t-first')],
      quotes: [quote('weekly', 'monthly', 't-first', 1), quote('weekly', 'monthly', 't-second', 2)],
    });
    expect(defaultTierId(o)).toBe('t-second');
    expect(quotesForSelection(o, null)[0].amountPerCycle).toBe(2);
  });

  it('reduces a tiers x 6 matrix to the 6 cells of the selected tier', () => {
    const cells = ['weekly', 'biweekly', 'monthly'];
    const cycles = ['monthly', 'quarterly'];
    const quotes = [
      ...cells.flatMap((f) => cycles.map((c) => quote(f, c, 't-half', 10))),
      ...cells.flatMap((f) => cycles.map((c) => quote(f, c, 't-full', 20))),
    ];
    const o = options({ pricingMode: 'full_truck', rates: [tier('t-half'), tier('t-full')], quotes });
    expect(quotesForSelection(o, 't-half')).toHaveLength(6);
    expect(quotesForSelection(o, 't-full')).toHaveLength(6);
  });
});

describe('add-bins CTA and unavailable pricing', () => {
  it('suppresses the CTA for full-truck accounts, including the unavailable path', () => {
    const o = options({ pricingMode: 'full_truck' });
    expect(showAddBinsCta(o)).toBe(false);
  });

  it('shows the CTA for per-bin accounts', () => {
    expect(showAddBinsCta(options())).toBe(true);
  });

  it('falls back to the documented copy when the server sends no message', () => {
    const o = options({ pricingMode: 'full_truck' });
    o.calculated.available = false;
    o.calculated.message = null;
    expect(pricingUnavailableMessage(o)).toBe(
      'Personalized pricing is not available for your account yet.',
    );
    o.calculated.message = 'No active truck tiers are configured.';
    expect(pricingUnavailableMessage(o)).toBe('No active truck tiers are configured.');
  });
});

describe('labels', () => {
  it('maps frequencies and passes unknown values through', () => {
    expect(frequencyLabel('weekly')).toBe('Weekly');
    expect(frequencyLabel('biweekly')).toBe('Bi-weekly');
    expect(frequencyLabel('monthly')).toBe('Monthly');
    expect(frequencyLabel('fortnightly_x')).toBe('fortnightly_x');
  });

  it('uses the lowercase cycle nouns the quote cards render', () => {
    expect(billingCycleLabel('monthly')).toBe('month');
    expect(billingCycleLabel('quarterly')).toBe('quarter');
    expect(billingCycleLabel('yearly')).toBe('yearly');
  });
});

describe('resolveHasBins', () => {
  it('is unknown until at least one signal has loaded', () => {
    expect(resolveHasBins(null, null)).toBeNull();
  });

  it('reports true from either signal alone', () => {
    expect(resolveHasBins([bin(2)], null)).toBe(true);
    expect(resolveHasBins(null, [bin(1)])).toBe(true);
  });

  it('stays unknown while one signal is loaded-empty and the other is pending', () => {
    expect(resolveHasBins([], null)).toBeNull();
    expect(resolveHasBins(null, [])).toBeNull();
  });

  it('reports false only when both signals have loaded empty', () => {
    expect(resolveHasBins([], [])).toBe(false);
  });
});
