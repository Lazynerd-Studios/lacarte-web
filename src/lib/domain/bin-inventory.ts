type BinRate = { id: string; isActive: boolean };
type SavedBin = { capacityRateId: string; quantity: number };

export function mergeBinSources<T extends SavedBin>(
  primary: T[],
  fallback: T[],
): T[] {
  const merged = new Map<string, T>();

  for (const bin of fallback) {
    merged.set(bin.capacityRateId, bin);
  }
  for (const bin of primary) {
    merged.set(bin.capacityRateId, bin);
  }

  return Array.from(merged.values());
}

export function buildBinSavePayload<T extends SavedBin>({
  rates,
  savedBins,
  quantities,
}: {
  rates: BinRate[];
  savedBins: T[];
  quantities: Record<string, number>;
}) {
  const activeRates = rates.filter((rate) => rate.isActive);
  const activeIds = new Set(activeRates.map((rate) => rate.id));

  const activePayload = activeRates
    .map((rate) => ({
      capacityRateId: rate.id,
      quantity: quantities[rate.id] ?? 0,
    }))
    .filter((entry) => entry.quantity > 0);

  const preservedPayload = savedBins
    .filter((bin) => !activeIds.has(bin.capacityRateId) && bin.quantity > 0)
    .map((bin) => ({
      capacityRateId: bin.capacityRateId,
      quantity: bin.quantity,
    }));

  return [...activePayload, ...preservedPayload];
}
