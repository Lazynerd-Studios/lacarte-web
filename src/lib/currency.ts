/**
 * Currency formatting utilities for Ghana Cedi (GHS).
 * Matches lib/utils/currency_formatter.dart.
 */
const ghsFormatter = new Intl.NumberFormat('en-GH', {
  style: 'currency',
  currency: 'GHS',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatGhs(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return 'GHS —';
  }
  return ghsFormatter.format(amount);
}

export function formatGhsFromString(raw: string | number | null | undefined): string {
  if (raw === null || raw === undefined) return 'GHS —';
  if (typeof raw === 'number') return formatGhs(raw);
  const cleaned = raw.replace(/[^0-9.-]/g, '');
  const value = Number.parseFloat(cleaned);
  if (Number.isNaN(value)) return 'GHS —';
  return formatGhs(value);
}

