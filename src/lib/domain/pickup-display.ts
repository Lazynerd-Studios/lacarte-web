/**
 * Ports the button matrix from view_pickup_screen.dart (_buildActionButton /
 * _buildCompletePaymentButton). Status is lowercased before matching, and the
 * pay action renders above the status action rather than replacing it.
 */

export type PickupStatus =
  | 'pending'
  | 'assigned'
  | 'scheduled'
  | 'en_route'
  | 'truck_dispatched'
  | 'completed'
  | 'cancelled'
  | 'expired';

const CANCELLABLE = new Set(['pending', 'assigned', 'scheduled']);

export interface PickupActions {
  pay: boolean;
  reschedule: boolean;
  cancel: boolean;
  track: boolean;
  /** Terminal or unmapped states show a disabled label instead of an action. */
  disabledLabel: string | null;
}

export function pickupActions(input: {
  status: string;
  requiresPayment: boolean;
}): PickupActions {
  const status = (input.status || '').toLowerCase();
  const none = {
    pay: input.requiresPayment,
    reschedule: false,
    cancel: false,
    track: false,
    disabledLabel: null,
  };

  switch (status) {
    case 'pending':
      return { ...none, reschedule: true, cancel: true };
    case 'assigned':
    case 'scheduled':
      return { ...none, cancel: true };
    case 'en_route':
    case 'truck_dispatched':
      return { ...none, track: true };
    case 'completed':
      return { ...none, disabledLabel: 'Completed' };
    case 'cancelled':
      return { ...none, disabledLabel: 'Cancelled' };
    case 'expired':
      return { ...none, disabledLabel: 'Expired' };
    default:
      return { ...none, disabledLabel: 'No Action Available' };
  }
}

/**
 * Reschedule is offered for `pending` only. The picker window is tomorrow
 * through tomorrow + 29 days; the server rejects a change once dispatch starts.
 */
export function canReschedule(status: string): boolean {
  return (status || '').toLowerCase() === 'pending';
}

export function rescheduleWindow(today = new Date()): {
  minDate: Date;
  maxDate: Date;
} {
  const minDate = new Date(today);
  minDate.setDate(minDate.getDate() + 1);
  const maxDate = new Date(minDate);
  maxDate.setDate(maxDate.getDate() + 29);
  return { minDate, maxDate };
}
