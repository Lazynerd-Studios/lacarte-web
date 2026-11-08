type FeeRule = {
  fee: number;
  freeDeliveryMinQuantity: number | null;
};

export function resolveDeliveryFeeState({
  totalCount,
  isLoading,
  isError,
  hasZone,
  matchedFeeRule,
}: {
  totalCount: number;
  isLoading: boolean;
  isError: boolean;
  hasZone: boolean;
  matchedFeeRule: FeeRule | null;
}) {
  if (totalCount === 0) {
    return { status: 'empty' as const, fee: 0, isFree: false };
  }
  if (isLoading) {
    return { status: 'loading' as const, fee: null, isFree: false };
  }
  if (isError) {
    return { status: 'error' as const, fee: null, isFree: false };
  }
  if (!hasZone || !matchedFeeRule) {
    return { status: 'unavailable' as const, fee: null, isFree: false };
  }

  const isFree =
    matchedFeeRule.freeDeliveryMinQuantity !== null &&
    totalCount >= matchedFeeRule.freeDeliveryMinQuantity;

  return {
    status: 'ready' as const,
    fee: isFree ? 0 : matchedFeeRule.fee,
    isFree,
  };
}
