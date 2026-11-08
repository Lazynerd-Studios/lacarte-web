import type {
  CalculatedQuote,
  CustomerBin,
  SubscriptionOptions,
} from '@/types/models';

/**
 * Mirrors `quotesForTier` in lib/models/subscription_options.dart — plain
 * equality on a nullable id, so a quote with `truckLoadRateId: null` matches
 * only a `null` argument. A full-truck quote missing its tier id silently
 * drops out of the grid rather than erroring.
 */
export function quotesForTier(
  quotes: CalculatedQuote[],
  truckLoadRateId: string | null,
): CalculatedQuote[] {
  return quotes.filter((q) => q.truckLoadRateId === truckLoadRateId);
}

/**
 * Truck presentation needs both signals: the account is full_truck AND tiers
 * were delivered. `full_truck` with no tiers degrades to the per-bin
 * presentation, matching calculated_pricing_section.dart.
 */
export function isTruckPresentation(options: SubscriptionOptions): boolean {
  return (
    options.pricingMode === 'full_truck' &&
    options.calculated.truckLoadRates.length > 0
  );
}

export function quotesForSelection(
  options: SubscriptionOptions,
  selectedTierId: string | null,
): CalculatedQuote[] {
  if (!isTruckPresentation(options)) return options.calculated.quotes;
  const tierId = selectedTierId ?? defaultTierId(options);
  if (tierId === null) return options.calculated.quotes;
  return quotesForTier(options.calculated.quotes, tierId);
}

/** Selection order as delivered by the API — displayOrder is parsed but never sorted on. */
export function defaultTierId(options: SubscriptionOptions): string | null {
  return options.calculated.truckLoadRates[0]?.id ?? null;
}

/** The add-bins CTA is suppressed for every full-truck account, including the unavailable-pricing path. */
export function showAddBinsCta(options: SubscriptionOptions): boolean {
  return options.pricingMode !== 'full_truck';
}

export function pricingUnavailableMessage(
  options: SubscriptionOptions,
): string {
  return (
    options.calculated.message ??
    'Personalized pricing is not available for your account yet.'
  );
}

export function frequencyLabel(frequency: string): string {
  switch (frequency) {
    case 'weekly':
      return 'Weekly';
    case 'biweekly':
      return 'Bi-weekly';
    case 'monthly':
      return 'Monthly';
    default:
      return frequency;
  }
}

export function billingCycleLabel(cycle: string): string {
  switch (cycle) {
    case 'monthly':
      return 'month';
    case 'quarterly':
      return 'quarter';
    default:
      return cycle;
  }
}

/**
 * `GET /api/customer/me` does not reliably carry `bins`, so "has bins" merges
 * two signals and stays `null` (unknown) while either is still loading.
 * `null` must hide an add-bins nudge — treating unknown as false would nag
 * customers who already have bins.
 */
export function resolveHasBins(
  profileBins: CustomerBin[] | null,
  optionsBins: CustomerBin[] | null,
): boolean | null {
  if (profileBins === null && optionsBins === null) return null;
  if (profileBins?.length) return true;
  if (optionsBins?.length) return true;
  if (profileBins === null || optionsBins === null) return null;
  return false;
}
