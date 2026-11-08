import {
  asBool,
  asDate,
  asDateOr,
  asDouble,
  asDoubleOrNull,
  asInt,
  asIntOrNull,
  asList,
  asMap,
  asStr,
} from '@/lib/json-parse';
import { isPrepaidSubscription } from '@/lib/domain/subscription-display';

// ── Auth & User ──────────────────────────────────────────────────────────────

export interface AppUser {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  image?: string | null;
  createdAt: string;
  updatedAt: string;
  role?: string | null;
  banned?: boolean;
}

export function parseAppUser(json: Record<string, unknown>): AppUser {
  return {
    id: asStr(json.id),
    email: asStr(json.email),
    name: asStr(json.name),
    emailVerified: asBool(json.emailVerified),
    image: json.image ? asStr(json.image) : null,
    createdAt: asDateOr(json.createdAt),
    updatedAt: asDateOr(json.updatedAt),
    role: json.role ? asStr(json.role) : null,
    banned: asBool(json.banned),
  };
}

export interface AppSession {
  token: string;
  user: AppUser;
}

export function parseAppSession(json: Record<string, unknown>): AppSession {
  return {
    token: asStr(json.token),
    user: parseAppUser(asMap(json.user) ?? {}),
  };
}

// ── Zone & CustomerType ──────────────────────────────────────────────────────

export interface Zone {
  id: string;
  name: string;
  color: string;
  isActive?: boolean;
}

export function parseZone(json: Record<string, unknown>): Zone {
  return {
    id: asStr(json.id),
    name: asStr(json.name),
    color: asStr(json.color, '#FFB400'),
    isActive: typeof json.isActive === 'boolean' ? json.isActive : undefined,
  };
}

export interface CustomerTypeQuantity {
  id: string;
  label: string;
  description: string;
  binCount: number | null;
}

export function parseCustomerTypeQuantity(
  json: Record<string, unknown>,
): CustomerTypeQuantity {
  return {
    id: asStr(json.id),
    label: asStr(json.label),
    description: asStr(json.description),
    binCount: asIntOrNull(json.binCount),
  };
}

export interface CustomerType {
  id: string;
  name: string;
  pricingMode: 'per_bin' | 'full_truck';
  estimatedQuantities: CustomerTypeQuantity[];
  requiresEntityName: boolean;
  entityNameLabel: string | null;
  isFullTruck: boolean;
  isPerBin: boolean;
}

export function parseCustomerType(json: Record<string, unknown>): CustomerType {
  const mode =
    asStr(json.pricingMode, 'per_bin') === 'full_truck'
      ? 'full_truck'
      : 'per_bin';
  return {
    id: asStr(json.id),
    name: asStr(json.name),
    pricingMode: mode,
    estimatedQuantities: asList(
      json.estimatedQuantities,
      parseCustomerTypeQuantity,
      'customerTypeQuantities',
    ),
    requiresEntityName: asBool(json.requiresEntityName),
    entityNameLabel: json.entityNameLabel ? asStr(json.entityNameLabel) : null,
    isFullTruck: mode === 'full_truck',
    isPerBin: mode !== 'full_truck',
  };
}

// ── Bins & Rates ─────────────────────────────────────────────────────────────

export interface CustomerBin {
  capacityRateId: string;
  capacityLiters: number;
  quantity: number;
  label: string;
}

export function parseCustomerBin(json: Record<string, unknown>): CustomerBin {
  const nested = asMap(json.capacityRate);
  const capacityRateId = asStr(json.capacityRateId, asStr(nested?.id));
  const capacityLiters = asInt(
    json.capacityLiters,
    asInt(nested?.capacityLiters),
  );
  const quantity = asInt(json.quantity, 1);
  return {
    capacityRateId,
    capacityLiters,
    quantity,
    label: `${capacityLiters} L`,
  };
}

export interface CapacityRate {
  id: string;
  label: string;
  capacityLiters: number;
  prepayRate: number;
  postpayRate: number;
  isActive: boolean;
}

export function parseCapacityRate(json: Record<string, unknown>): CapacityRate {
  const litersRaw = json.capacityLiters;
  const label = asStr(
    json.label,
    litersRaw !== undefined && litersRaw !== null ? `${litersRaw}L` : '',
  );
  const match = String(litersRaw ?? label).match(/\d+/);
  const capacityLiters = match ? Number.parseInt(match[0], 10) : 0;
  return {
    id: asStr(json.id),
    label,
    capacityLiters,
    prepayRate: asDouble(json.prepayRate),
    postpayRate: asDouble(json.postpayRate),
    isActive: asBool(json.isActive, true),
  };
}

export interface TruckLoadRate {
  id: string;
  label: string;
  prepayRate: number;
  postpayRate: number;
  binEquivalent: number | null;
  displayOrder: number;
  isActive: boolean;
}

export function parseTruckLoadRate(
  json: Record<string, unknown>,
): TruckLoadRate {
  return {
    id: asStr(json.id),
    label: asStr(json.label),
    prepayRate: asDouble(json.prepayRate),
    postpayRate: asDouble(json.postpayRate),
    binEquivalent: asIntOrNull(json.binEquivalent),
    displayOrder: asInt(json.displayOrder, 0),
    isActive: asBool(json.isActive, true),
  };
}

// ── Profile ──────────────────────────────────────────────────────────────────

export interface CustomerLocation {
  latitude: number;
  longitude: number;
}

export function parseCustomerLocation(
  json: Record<string, unknown>,
): CustomerLocation {
  return {
    latitude: asDouble(json.latitude),
    longitude: asDouble(json.longitude),
  };
}

export interface SubscriptionInfo {
  paymentPlan: string;
  subscription: Record<string, unknown> | null;
  hasSubscription: boolean;
  isPayAsYouGo: boolean;
}

export function parseSubscriptionInfo(
  json: Record<string, unknown>,
): SubscriptionInfo {
  const subscription = asMap(json.subscription);
  const paymentPlan =
    subscription === null
      ? 'pay_as_you_go'
      : asStr(json.paymentPlan, 'pay_as_you_go');
  return {
    paymentPlan,
    subscription,
    hasSubscription: subscription !== null,
    isPayAsYouGo: paymentPlan === 'pay_as_you_go',
  };
}

export interface CustomerProfile {
  id: string;
  phoneNumber: string;
  bins: CustomerBin[];
  entityName: string | null;
  displayName: string;
  status: string;
  address: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string;
  placeName: string | null;
  locationUpdatedAt: string | null;
  location: CustomerLocation | null;
  createdAt: string;
  updatedAt: string;
  customerType: CustomerType;
  zone: Zone;
  subscriptionInfo: SubscriptionInfo;
  hasLocation: boolean;
  hasSubscription: boolean;
  hasBins: boolean;
  needsEntityName: boolean;
}

export function parseCustomerProfile(
  json: Record<string, unknown>,
): CustomerProfile {
  const locationMap = asMap(json.location);
  const customerTypeMap = asMap(json.customerType);
  const zoneMap = asMap(json.zone);
  const subInfoMap = asMap(json.subscriptionInfo);

  const address = json.address ? asStr(json.address) : null;
  const city = json.city ? asStr(json.city) : null;
  const entityName = json.entityName ? asStr(json.entityName) : null;
  const bins = asList(json.bins, parseCustomerBin, 'bins');
  const customerType = customerTypeMap
    ? parseCustomerType(customerTypeMap)
    : parseCustomerType({ id: '', name: '' });
  const subscriptionInfo = subInfoMap
    ? parseSubscriptionInfo(subInfoMap)
    : parseSubscriptionInfo({ paymentPlan: 'pay_as_you_go' });

  return {
    id: asStr(json.id),
    phoneNumber: asStr(json.phoneNumber),
    bins,
    entityName,
    displayName: asStr(json.displayName),
    status: asStr(json.status),
    address,
    city,
    region: json.region ? asStr(json.region) : null,
    postalCode: json.postalCode ? asStr(json.postalCode) : null,
    country: asStr(json.country, 'Ghana'),
    placeName: json.placeName ? asStr(json.placeName) : null,
    locationUpdatedAt: asDate(json.locationUpdatedAt),
    location: locationMap ? parseCustomerLocation(locationMap) : null,
    createdAt: asDateOr(json.createdAt),
    updatedAt: asDateOr(json.updatedAt),
    customerType,
    zone: zoneMap
      ? parseZone(zoneMap)
      : { id: '', name: '', color: '#FFB400' },
    subscriptionInfo,
    hasLocation: Boolean(address && city),
    hasSubscription: subscriptionInfo.hasSubscription,
    hasBins: bins.length > 0,
    needsEntityName:
      customerType.requiresEntityName && (!entityName || entityName.trim() === ''),
  };
}

export interface UserProfileData {
  userRole: string;
  user: Record<string, unknown>;
  customer: CustomerProfile | null;
}

export function parseUserProfileResponse(
  json: Record<string, unknown>,
): UserProfileData {
  const data = asMap(json.data) ?? json;
  const customer = asMap(data.customer);
  return {
    userRole: asStr(data.userRole),
    user: asMap(data.user) ?? {},
    customer: customer ? parseCustomerProfile(customer) : null,
  };
}

// ── Pickups & Disposables ────────────────────────────────────────────────────

export interface DisposableItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  isActive: boolean;
}

export function parseDisposableItem(
  json: Record<string, unknown>,
): DisposableItem {
  return {
    id: asStr(json.id),
    name: asStr(json.name),
    description: asStr(json.description),
    icon: asStr(json.icon),
    isActive: asBool(json.isActive, true),
  };
}

export interface DisposableQuantity {
  id: string;
  label: string;
  description: string;
  binCount: number | null;
  isActive: boolean;
}

export function parseDisposableQuantity(
  json: Record<string, unknown>,
): DisposableQuantity {
  return {
    id: asStr(json.id),
    label: asStr(json.label),
    description: asStr(json.description),
    binCount: asIntOrNull(json.binCount),
    isActive: asBool(json.isActive, true),
  };
}

export interface EmergencyFeeInfo {
  available: boolean;
  fee: number;
  currency: string;
  reason?: string | null;
}

export function parseEmergencyFeeInfo(
  json: Record<string, unknown>,
): EmergencyFeeInfo {
  const data = asMap(json.data) ?? json;
  return {
    available: asBool(data.available, false),
    fee: asDouble(data.fee, 0),
    currency: asStr(data.currency, 'GHS'),
    reason: data.reason ? asStr(data.reason) : null,
  };
}

export interface PricePreviewBinItem {
  capacityRateId: string;
  capacityLiters: number;
  quantity: number;
  unitRate: number;
  subtotal: number;
}

export interface PricePreview {
  pricingMode: 'per_bin' | 'full_truck';
  base: number;
  emergencyFee: number;
  total: number;
  currency: string;
  isEmergency: boolean;
  binCount: number | null;
  bins: PricePreviewBinItem[];
  truckLoadRateLabel: string | null;
}

export function parsePricePreview(json: Record<string, unknown>): PricePreview {
  const data = asMap(json.data) ?? json;
  const mode =
    asStr(data.pricingMode, 'per_bin') === 'full_truck'
      ? 'full_truck'
      : 'per_bin';
  const bins = asList(
    data.bins,
    (b) => ({
      capacityRateId: asStr(b.capacityRateId),
      capacityLiters: asInt(b.capacityLiters),
      quantity: asInt(b.quantity, 1),
      unitRate: asDouble(b.unitRate, asDouble(b.rate)),
      subtotal: asDouble(b.subtotal, asDouble(b.amount)),
    }),
    'pricePreviewBins',
  );
  const truckObj = asMap(data.truckLoadRate);
  return {
    pricingMode: mode,
    base: asDouble(data.base, asDouble(data.baseAmount)),
    emergencyFee: asDouble(data.emergencyFee),
    total: asDouble(data.total, asDouble(data.amount)),
    currency: asStr(data.currency, 'GHS'),
    isEmergency: asBool(data.isEmergency),
    binCount: asIntOrNull(data.binCount),
    bins,
    truckLoadRateLabel: truckObj
      ? asStr(truckObj.label)
      : data.truckLoadRateLabel
        ? asStr(data.truckLoadRateLabel)
        : null,
  };
}

export interface PickupRequestCreate {
  disposableItemTypeId: string;
  preferredPickupDate: string; // YYYY-MM-DD
  additionalNotes?: string;
  truckLoadRateId?: string;
  isEmergency?: boolean;
}

export interface PickupRequestResponse {
  id: string;
  customerId: string;
  preferredPickupDate: string;
  additionalNotes: string | null;
  status: string;
  paymentType: string;
  quotaExceeded: boolean;
  createdAt: string;
  updatedAt: string;
  disposableItemType: {
    id: string;
    name: string;
    description: string;
    icon: string;
  };
  estimatedQuantity: {
    id: string;
    label: string;
    description: string;
  };
  customer: {
    id: string;
    phoneNumber: string;
    address: string;
    city: string;
    location: CustomerLocation | null;
  };
  amount: number | null;
  currency: string | null;
  paymentStatus: string | null;
  isEmergency: boolean;
  emergencyFee: number | null;
  binCount: number | null;
  // Computed flags
  isPayAsYouGoPayment: boolean;
  isSubscriptionPayment: boolean;
  isPayGoPaymentPending: boolean;
  isPayGoPaymentFailed: boolean;
  isPayGoPaymentResolved: boolean;
  requiresPayment: boolean;
}

export function parsePickupRequest(
  json: Record<string, unknown>,
): PickupRequestResponse {
  const itemType = asMap(json.disposableItemType) ?? {};
  const estQty = asMap(json.estimatedQuantity) ?? {};
  const cust = asMap(json.customer) ?? {};
  const loc = asMap(cust.location);

  const paymentType = asStr(json.paymentType);
  const paymentStatus = json.paymentStatus ? asStr(json.paymentStatus) : null;
  const isPayAsYouGoPayment = paymentType === 'pay_as_you_go';
  const isSubscriptionPayment = paymentType === 'subscription';
  const isPayGoPaymentPending =
    isPayAsYouGoPayment &&
    paymentStatus !== 'paid' &&
    paymentStatus !== 'active_plan' &&
    paymentStatus !== 'failed';
  const isPayGoPaymentFailed =
    isPayAsYouGoPayment && paymentStatus === 'failed';
  const isPayGoPaymentResolved =
    isPayAsYouGoPayment &&
    (paymentStatus === 'paid' || paymentStatus === 'active_plan');

  return {
    id: asStr(json.id),
    customerId: asStr(json.customerId),
    preferredPickupDate: asDateOr(json.preferredPickupDate),
    additionalNotes: json.additionalNotes ? asStr(json.additionalNotes) : null,
    status: asStr(json.status),
    paymentType,
    quotaExceeded: asBool(json.quotaExceeded),
    createdAt: asDateOr(json.createdAt),
    updatedAt: asDateOr(json.updatedAt),
    disposableItemType: {
      id: asStr(itemType.id),
      name: asStr(itemType.name),
      description: asStr(itemType.description),
      icon: asStr(itemType.icon),
    },
    estimatedQuantity: {
      id: asStr(estQty.id),
      label: asStr(estQty.label),
      description: asStr(estQty.description),
    },
    customer: {
      id: asStr(cust.id),
      phoneNumber: asStr(cust.phoneNumber),
      address: asStr(cust.address),
      city: asStr(cust.city),
      location: loc ? parseCustomerLocation(loc) : null,
    },
    amount: asDoubleOrNull(json.amount),
    currency: json.currency ? asStr(json.currency) : null,
    paymentStatus,
    isEmergency: asBool(json.isEmergency),
    emergencyFee: asDoubleOrNull(json.emergencyFee),
    binCount: asIntOrNull(json.binCount),
    isPayAsYouGoPayment,
    isSubscriptionPayment,
    isPayGoPaymentPending,
    isPayGoPaymentFailed,
    isPayGoPaymentResolved,
    requiresPayment: isPayGoPaymentPending,
  };
}

// ── Subscriptions & Invoices ─────────────────────────────────────────────────

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string | null;
  type: string;
  pickups: number;
  bins: number;
  billingCycle: string;
  price: string;
  badgeColor: string;
  gracePeriodDays: number | null;
}

export function parseSubscriptionPlan(
  json: Record<string, unknown>,
): SubscriptionPlan {
  return {
    id: asStr(json.id),
    name: asStr(json.name),
    description: json.description ? asStr(json.description) : null,
    type: asStr(json.type),
    pickups: asInt(json.pickups),
    bins: asInt(json.bins),
    billingCycle: asStr(json.billingCycle),
    price: asStr(json.price, '0'),
    badgeColor: asStr(json.badgeColor, '#FFB400'),
    gracePeriodDays: asIntOrNull(json.gracePeriodDays),
  };
}

export interface SubscriptionPayment {
  id: string;
  amount: string;
  currency: string;
  paymentType: string;
  status: string;
  provider: string | null;
  providerRef: string | null;
  paidAt: string | null;
  billingPeriodStart: string | null;
  billingPeriodEnd: string | null;
  createdAt: string;
  isPending: boolean;
  isPaid: boolean;
  isFailed: boolean;
}

export function parseSubscriptionPayment(
  json: Record<string, unknown>,
): SubscriptionPayment {
  const status = asStr(json.status);
  return {
    id: asStr(json.id),
    amount: asStr(json.amount, '0'),
    currency: asStr(json.currency, 'GHS'),
    paymentType: asStr(json.paymentType),
    status,
    provider: json.provider ? asStr(json.provider) : null,
    providerRef: json.providerRef ? asStr(json.providerRef) : null,
    paidAt: asDate(json.paidAt),
    billingPeriodStart: asDate(json.billingPeriodStart),
    billingPeriodEnd: asDate(json.billingPeriodEnd),
    createdAt: asDateOr(json.createdAt),
    isPending: status === 'pending',
    isPaid: status === 'paid',
    isFailed: status === 'failed',
  };
}

export interface ActiveSubscription {
  id: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  plan: SubscriptionPlan | null;
  payment: SubscriptionPayment | null;
  frequency: string | null;
  pickupsPerCycle: number | null;
  amountPerCycle: number | null;
  pricingSource: string | null;
  outstandingBalance: number | null;
  truckLoadRateId: string | null;
  truckLoadRateLabel: string | null;
  truckBinEquivalent: number | null;
  // Computed display helpers
  isActive: boolean;
  isCancelled: boolean;
  isExpired: boolean;
  isCalculated: boolean;
  isTruckBased: boolean;
  displayTierLabel: string;
  displayName: string;
  displayPrice: string;
  displayBillingCycle: string;
  displayPickups: number;
  displayBins: number;
  isPrepaid: boolean;
}

export function parseActiveSubscription(
  json: Record<string, unknown>,
): ActiveSubscription {
  const planMap = asMap(json.plan);
  const paymentMap = asMap(json.payment);
  const truckRateMap = asMap(json.truckLoadRate);

  const plan = planMap ? parseSubscriptionPlan(planMap) : null;
  const payment = paymentMap ? parseSubscriptionPayment(paymentMap) : null;
  const status = asStr(json.status);
  const frequency = json.frequency ? asStr(json.frequency) : null;
  const pickupsPerCycle = asIntOrNull(json.pickupsPerCycle);
  const amountPerCycle = asDoubleOrNull(json.amountPerCycle);
  const pricingSource = json.pricingSource ? asStr(json.pricingSource) : null;
  const truckLoadRateId = json.truckLoadRateId
    ? asStr(json.truckLoadRateId)
    : null;
  const tierLabel = truckRateMap
    ? asStr(truckRateMap.label)
    : asStr(json.truckLoadRateLabel);
  const truckLoadRateLabel = tierLabel || null;
  const truckBinEquivalent = truckRateMap
    ? asIntOrNull(truckRateMap.binEquivalent)
    : asIntOrNull(json.truckBinEquivalent);

  const isTruckBased = Boolean(truckLoadRateId || truckLoadRateLabel);
  const displayTierLabel =
    truckLoadRateLabel ||
    (truckBinEquivalent !== null ? `${truckBinEquivalent} L truck` : 'Truck load');

  const displayName =
    plan?.name ||
    (frequency ? `Custom plan (${frequency})` : 'Custom plan');

  const displayPrice =
    plan?.price ??
    (amountPerCycle !== null ? amountPerCycle.toFixed(2) : '0');

  return {
    id: asStr(json.id),
    status,
    startDate: asDate(json.startDate),
    endDate: asDate(json.endDate),
    createdAt: asDate(json.createdAt),
    updatedAt: asDate(json.updatedAt),
    plan,
    payment,
    frequency,
    pickupsPerCycle,
    amountPerCycle,
    pricingSource,
    outstandingBalance: asDoubleOrNull(json.outstandingBalance),
    truckLoadRateId,
    truckLoadRateLabel,
    truckBinEquivalent,
    isActive: status === 'active',
    isCancelled: status === 'cancelled',
    isExpired: status === 'expired',
    isCalculated: pricingSource === 'calculated' || plan === null,
    isTruckBased,
    displayTierLabel,
    displayName,
    displayPrice,
    displayBillingCycle: plan?.billingCycle || frequency || 'cycle',
    displayPickups: plan?.pickups ?? pickupsPerCycle ?? 0,
    displayBins: plan?.bins ?? 0,
    isPrepaid: isPrepaidSubscription({
      planType: plan?.type,
      paymentType: payment?.paymentType,
    }),
  };
}

export interface OutstandingDebt {
  subscriptionId: string;
  amount: number;
}

export interface MySubscriptionResult {
  subscription: ActiveSubscription | null;
  outstandingDebt: OutstandingDebt | null;
  hasDebt: boolean;
}

export interface CalculatedQuote {
  frequency: string;
  billingCycle: string;
  truckLoadRateId: string | null;
  perPickupRate: number;
  pickupsPerCycle: number;
  amountPerCycle: number;
  currency: string;
}

export function parseCalculatedQuote(
  json: Record<string, unknown>,
): CalculatedQuote {
  return {
    frequency: asStr(json.frequency),
    billingCycle: asStr(json.billingCycle),
    truckLoadRateId: json.truckLoadRateId ? asStr(json.truckLoadRateId) : null,
    perPickupRate: asDouble(json.perPickupRate),
    pickupsPerCycle: asInt(json.pickupsPerCycle),
    amountPerCycle: asDouble(json.amountPerCycle),
    currency: asStr(json.currency, 'GHS'),
  };
}

export interface CalculatedOptions {
  available: boolean;
  message: string | null;
  bins: CustomerBin[];
  truckLoadRates: TruckLoadRate[];
  quotes: CalculatedQuote[];
}

export interface SubscriptionOptions {
  pricingMode: 'per_bin' | 'full_truck';
  plans: SubscriptionPlan[];
  calculated: CalculatedOptions;
  isFullTruck: boolean;
}

export function parseSubscriptionOptions(
  json: Record<string, unknown>,
): SubscriptionOptions {
  const data = asMap(json.data) ?? json;
  const calcMap = asMap(data.calculated) ?? {};
  const mode =
    asStr(data.pricingMode, 'per_bin') === 'full_truck'
      ? 'full_truck'
      : 'per_bin';

  return {
    pricingMode: mode,
    plans: asList(data.plans, parseSubscriptionPlan, 'plans'),
    calculated: {
      available: asBool(calcMap.available),
      message: calcMap.message ? asStr(calcMap.message) : null,
      bins: asList(calcMap.bins, parseCustomerBin, 'calculatedBins'),
      truckLoadRates: asList(
        calcMap.truckLoadRates,
        parseTruckLoadRate,
        'calculatedTruckRates',
      ),
      quotes: asList(calcMap.quotes, parseCalculatedQuote, 'calculatedQuotes'),
    },
    isFullTruck: mode === 'full_truck',
  };
}

export interface CancelSettlement {
  outstandingBalance: number;
  paymentId: string | null;
  promptSent: boolean;
}

export interface CancelSubscriptionResult {
  success: boolean;
  message: string;
  settlement: CancelSettlement | null;
  hasSettlementDebt: boolean;
}

export function parseCancelSubscriptionResult(
  json: Record<string, unknown>,
): CancelSubscriptionResult {
  const settlementMap = asMap(json.settlement);
  const settlement: CancelSettlement | null = settlementMap
    ? {
        outstandingBalance: asDouble(settlementMap.outstandingBalance),
        paymentId: settlementMap.paymentId
          ? asStr(settlementMap.paymentId)
          : null,
        promptSent: asBool(settlementMap.promptSent),
      }
    : null;
  return {
    success: asBool(json.success, true),
    message: asStr(json.message, 'Subscription cancelled successfully'),
    settlement,
    hasSettlementDebt:
      settlement !== null && settlement.outstandingBalance > 0,
  };
}

// ── Invoices ─────────────────────────────────────────────────────────────────

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  type: string;
  status: string;
  issueDate: string | null;
  dueDate: string | null;
  totalAmount: number;
}

export function parseInvoice(json: Record<string, unknown>): Invoice {
  return {
    id: asStr(json.id),
    invoiceNumber: asStr(json.invoiceNumber),
    customerId: asStr(json.customerId),
    type: asStr(json.type),
    status: asStr(json.status),
    issueDate: asDate(json.issueDate),
    dueDate: asDate(json.dueDate),
    totalAmount: asDouble(json.totalAmount),
  };
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface InvoiceDetail {
  id: string;
  invoiceNumber: string;
  customerId: string;
  type: string;
  status: string;
  issueDate: string | null;
  dueDate: string | null;
  paidAt: string | null;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  paymentMethod: string | null;
  notes: string | null;
  items: InvoiceItem[];
  customer: {
    id: string;
    name: string;
    displayName: string;
    email: string | null;
    address: string | null;
    phoneNumber: string | null;
  } | null;
}

export function parseInvoiceDetail(
  json: Record<string, unknown>,
): InvoiceDetail {
  const data = asMap(json.data) ?? json;
  const cust = asMap(data.customer);
  const custName = cust ? asStr(cust.name) : '';
  return {
    id: asStr(data.id),
    invoiceNumber: asStr(data.invoiceNumber),
    customerId: asStr(data.customerId),
    type: asStr(data.type),
    status: asStr(data.status),
    issueDate: asDate(data.issueDate),
    dueDate: asDate(data.dueDate),
    paidAt: asDate(data.paidAt),
    subtotal: asDouble(data.subtotal),
    taxRate: asDouble(data.taxRate),
    taxAmount: asDouble(data.taxAmount),
    totalAmount: asDouble(data.totalAmount),
    currency: asStr(data.currency, 'GHS'),
    paymentMethod: data.paymentMethod ? asStr(data.paymentMethod) : null,
    notes: data.notes ? asStr(data.notes) : null,
    items: asList(
      data.items,
      (i) => ({
        id: asStr(i.id),
        description: asStr(i.description),
        quantity: asInt(i.quantity),
        unitPrice: asDouble(i.unitPrice),
        amount: asDouble(i.amount),
      }),
      'invoiceItems',
    ),
    customer: cust
      ? {
          id: asStr(cust.id),
          name: custName,
          displayName: asStr(cust.displayName, custName),
          email: cust.email ? asStr(cust.email) : null,
          address: cust.address ? asStr(cust.address) : null,
          phoneNumber: cust.phoneNumber ? asStr(cust.phoneNumber) : null,
        }
      : null,
  };
}

// ── Store / Shop ─────────────────────────────────────────────────────────────

export interface StoreCategory {
  id: string;
  name: string;
  description: string | null;
}

export function parseStoreCategory(
  json: Record<string, unknown>,
): StoreCategory {
  return {
    id: asStr(json.id),
    name: asStr(json.name),
    description: json.description ? asStr(json.description) : null,
  };
}

export interface StoreProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  stockQuantity: number;
  images: string[];
  categoryId: string;
  categoryName: string;
  isAvailable: boolean;
}

export function parseStoreProduct(json: Record<string, unknown>): StoreProduct {
  const data = asMap(json.data) ?? json;
  const cat = asMap(data.category);
  const rawImages = Array.isArray(data.images)
    ? data.images
    : data.imageUrl
      ? [data.imageUrl]
      : [];
  const images = rawImages
    .map((img) => {
      if (typeof img === 'string') return img;
      const m = asMap(img);
      return m ? asStr(m.url || m.imageUrl) : '';
    })
    .filter(Boolean);

  const stock = asInt(data.stockQuantity, asInt(data.stock, 10));
  return {
    id: asStr(data.id),
    name: asStr(data.name),
    description: asStr(data.description),
    price: asDouble(data.price),
    stockQuantity: stock,
    images,
    categoryId: asStr(data.categoryId, asStr(cat?.id)),
    categoryName: asStr(data.categoryName, asStr(cat?.name)),
    isAvailable: asBool(data.isAvailable, stock > 0),
  };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export function parsePaginationMeta(
  json: Record<string, unknown> | null,
): PaginationMeta {
  if (!json) {
    return {
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    };
  }
  const page = asInt(json.page, 1);
  const totalPages = asInt(json.totalPages, 1);
  return {
    page,
    limit: asInt(json.limit, 20),
    total: asInt(json.total, 0),
    totalPages,
    hasNextPage: asBool(json.hasNextPage, page < totalPages),
    hasPreviousPage: asBool(json.hasPreviousPage, page > 1),
  };
}

export interface StoreCartItem {
  id: string;
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  imageUrl?: string | null;
}

export interface StoreCart {
  items: StoreCartItem[];
  subtotal: number;
}

export function parseStoreCart(json: Record<string, unknown>): StoreCart {
  const data = asMap(json.data) ?? asMap(json.cart) ?? json;
  const items = asList(
    data.items,
    (item) => {
      const prod = asMap(item.product);
      const unitPrice = asDouble(item.unitPrice, asDouble(prod?.price));
      const quantity = asInt(item.quantity, 1);
      return {
        id: asStr(item.id),
        productId: asStr(item.productId, asStr(prod?.id)),
        productName: asStr(item.productName, asStr(prod?.name, 'Item')),
        unitPrice,
        quantity,
        lineTotal: asDouble(item.lineTotal, unitPrice * quantity),
        imageUrl: item.imageUrl ? asStr(item.imageUrl) : null,
      };
    },
    'cartItems',
  );
  const computedSub = items.reduce((acc, i) => acc + i.lineTotal, 0);
  return {
    items,
    subtotal: asDouble(data.subtotal, computedSub),
  };
}

export interface DeliveryFee {
  id: string;
  zoneId: string;
  zoneName: string;
  fee: number;
  freeDeliveryMinQuantity: number | null;
}

export function parseDeliveryFee(json: Record<string, unknown>): DeliveryFee {
  const zone = asMap(json.zone);
  return {
    id: asStr(json.id),
    zoneId: asStr(json.zoneId, asStr(zone?.id)),
    zoneName: asStr(json.zoneName, asStr(zone?.name)),
    fee: asDouble(json.fee, asDouble(json.amount)),
    freeDeliveryMinQuantity: asIntOrNull(json.freeDeliveryMinQuantity),
  };
}

export interface StoreAddress {
  id: string;
  street: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
  summary: string;
}

export function parseStoreAddress(json: Record<string, unknown>): StoreAddress {
  const data = asMap(json.data) ?? json;
  const street = asStr(data.street);
  const city = asStr(data.city);
  const region = asStr(data.region);
  const country = asStr(data.country, 'Ghana');
  const summary = [street, city, region, country]
    .filter((s) => s.trim().length > 0)
    .join(', ');
  return {
    id: asStr(data.id),
    street,
    city,
    region,
    postalCode: asStr(data.postalCode),
    country,
    isDefault: asBool(data.isDefault),
    summary,
  };
}

export interface StoreOrder {
  id: string;
  orderNumber: string;
  total: number;
  paymentStatus: string;
}

export function parseStoreOrder(json: Record<string, unknown>): StoreOrder {
  const data = asMap(json.data) ?? asMap(json.order) ?? json;
  return {
    id: asStr(data.id),
    orderNumber: asStr(data.orderNumber),
    total: asDouble(data.total),
    paymentStatus: asStr(data.paymentStatus),
  };
}

export interface StoreOrderSummary {
  id: string;
  orderNumber: string;
  itemCount: number;
  total: number;
  paymentStatus: string;
  deliveryStatus: string;
  createdAt: string | null;
}

export function parseStoreOrderSummary(
  json: Record<string, unknown>,
): StoreOrderSummary {
  return {
    id: asStr(json.id),
    orderNumber: asStr(json.orderNumber),
    itemCount: asInt(json.itemCount),
    total: asDouble(json.total),
    paymentStatus: asStr(json.paymentStatus),
    deliveryStatus: asStr(json.deliveryStatus),
    createdAt: asDate(json.createdAt),
  };
}

export interface StoreOrderDetails {
  id: string;
  orderNumber: string;
  items: {
    productName: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }[];
  deliveryAddress: {
    street: string;
    city: string;
    region: string;
    country: string;
    display: string;
  } | null;
  subtotal: number;
  tax: number;
  total: number;
  paymentStatus: string;
  deliveryStatus: string;
  createdAt: string | null;
}

export function parseStoreOrderDetails(
  json: Record<string, unknown>,
): StoreOrderDetails {
  const data = asMap(json.data) ?? json;
  const addr = asMap(data.deliveryAddress);
  return {
    id: asStr(data.id),
    orderNumber: asStr(data.orderNumber),
    items: asList(
      data.items,
      (i) => ({
        productName: asStr(i.productName),
        quantity: asInt(i.quantity),
        unitPrice: asDouble(i.unitPrice),
        lineTotal: asDouble(i.lineTotal),
      }),
      'orderDetailsItems',
    ),
    deliveryAddress: addr
      ? {
          street: asStr(addr.street),
          city: asStr(addr.city),
          region: asStr(addr.region),
          country: asStr(addr.country),
          display: [
            asStr(addr.street),
            asStr(addr.city),
            asStr(addr.region),
            asStr(addr.country),
          ]
            .filter(Boolean)
            .join(', '),
        }
      : null,
    subtotal: asDouble(data.subtotal),
    tax: asDouble(data.tax),
    total: asDouble(data.total),
    paymentStatus: asStr(data.paymentStatus),
    deliveryStatus: asStr(data.deliveryStatus),
    createdAt: asDate(data.createdAt),
  };
}

// ── Support Tickets (with Resilient Parsing Fix!) ────────────────────────────

export type TicketCategoryValue =
  | 'missed_pickup'
  | 'billing'
  | 'service_request'
  | 'equipment_issue'
  | 'schedule_change'
  | 'other';

export type TicketPriorityValue = 'low' | 'medium' | 'high' | 'urgent';

export const TICKET_CATEGORIES: { value: TicketCategoryValue; label: string }[] = [
  { value: 'missed_pickup', label: 'Missed Pickup' },
  { value: 'billing', label: 'Billing' },
  { value: 'service_request', label: 'Service Request' },
  { value: 'equipment_issue', label: 'Equipment Issue' },
  { value: 'schedule_change', label: 'Schedule Change' },
  { value: 'other', label: 'Other' },
];

export const TICKET_PRIORITIES: { value: TicketPriorityValue; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

export interface TicketMessage {
  id: string;
  ticketId: string;
  authorId: string;
  authorType: string;
  authorName: string;
  message: string;
  createdAt: string | null;
}

export function parseTicketMessage(
  json: Record<string, unknown>,
): TicketMessage {
  return {
    id: asStr(json.id),
    ticketId: asStr(json.ticketId),
    authorId: asStr(json.authorId),
    authorType: asStr(json.authorType),
    authorName: asStr(json.authorName, 'Support'),
    message: asStr(json.message),
    createdAt: asDate(json.createdAt),
  };
}

export interface SupportTicket {
  id: string;
  ticketNumber: number;
  ticketId: string;
  subject: string;
  category: TicketCategoryValue;
  priority: TicketPriorityValue;
  status: string;
  createdAt: string | null;
  updatedAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  messages: TicketMessage[];
}

export function parseSupportTicket(
  json: Record<string, unknown>,
): SupportTicket {
  const data = asMap(json.data) ?? json;
  const rawCat = asStr(data.category, 'other') as TicketCategoryValue;
  const category = TICKET_CATEGORIES.some((c) => c.value === rawCat)
    ? rawCat
    : 'other';
  const rawPrio = asStr(data.priority, 'low') as TicketPriorityValue;
  const priority = TICKET_PRIORITIES.some((p) => p.value === rawPrio)
    ? rawPrio
    : 'low';

  return {
    id: asStr(data.id),
    ticketNumber: asInt(data.ticketNumber),
    ticketId: asStr(data.ticketId, `#${asInt(data.ticketNumber)}`),
    subject: asStr(data.subject),
    category,
    priority,
    status: asStr(data.status, 'open'),
    createdAt: asDate(data.createdAt),
    updatedAt: asDate(data.updatedAt),
    resolvedAt: asDate(data.resolvedAt),
    closedAt: asDate(data.closedAt),
    messages: asList(data.messages, parseTicketMessage, 'ticketMessages'),
  };
}

// ── Notifications & Activity Logs ────────────────────────────────────────────

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  referenceId: string | null;
  isRead: boolean;
  createdAt: string;
}

export function parseAppNotification(
  json: Record<string, unknown>,
): AppNotification {
  const data = asMap(json.data) ?? json;
  return {
    id: asStr(data.id),
    title: asStr(data.title),
    message: asStr(data.message, asStr(data.body)),
    type: asStr(data.type, 'general'),
    referenceId: data.referenceId
      ? asStr(data.referenceId)
      : data.pickupRequestId
        ? asStr(data.pickupRequestId)
        : null,
    isRead: asBool(data.isRead),
    createdAt: asDateOr(data.createdAt),
  };
}

export interface ActivityLogItem {
  id: string;
  action: string;
  description: string;
  createdAt: string;
}

export function parseActivityLogItem(
  json: Record<string, unknown>,
): ActivityLogItem {
  return {
    id: asStr(json.id),
    action: asStr(json.action, asStr(json.type, 'Activity')),
    description: asStr(json.description, asStr(json.message)),
    createdAt: asDateOr(json.createdAt),
  };
}

