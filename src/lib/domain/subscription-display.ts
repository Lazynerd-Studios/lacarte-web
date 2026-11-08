export function isPrepaidSubscription({
  planType,
  paymentType,
}: {
  planType: string | null | undefined;
  paymentType: string | null | undefined;
}): boolean {
  if (planType) return planType === 'prepaid';
  return paymentType !== 'postpaid';
}
