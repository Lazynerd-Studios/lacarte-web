import { apiRequest, apiRequestBlob, ApiException } from '@/lib/api-client';
import {
  asBool,
  asDouble,
  asInt,
  asList,
  asMap,
  asStr,
  extractList,
} from '@/lib/json-parse';
import {
  ActivityLogItem,
  ActiveSubscription,
  AppNotification,
  AppSession,
  AppUser,
  CancelSubscriptionResult,
  CapacityRate,
  CustomerBin,
  CustomerType,
  DeliveryFee,
  DisposableItem,
  DisposableQuantity,
  EmergencyFeeInfo,
  Invoice,
  InvoiceDetail,
  MySubscriptionResult,
  PaginationMeta,
  PickupRequestCreate,
  PickupRequestResponse,
  PricePreview,
  StoreAddress,
  StoreCart,
  StoreCategory,
  StoreOrder,
  StoreOrderDetails,
  StoreOrderSummary,
  SubscriptionOptions,
  SupportTicket,
  TicketCategoryValue,
  TicketMessage,
  TicketPriorityValue,
  TruckLoadRate,
  UserProfileData,
  Zone,
  parseActivityLogItem,
  parseActiveSubscription,
  parseAppNotification,
  parseAppSession,
  parseAppUser,
  parseCancelSubscriptionResult,
  parseCapacityRate,
  parseCustomerBin,
  parseCustomerType,
  parseDeliveryFee,
  parseDisposableItem,
  parseDisposableQuantity,
  parseEmergencyFeeInfo,
  parseInvoice,
  parseInvoiceDetail,
  parsePaginationMeta,
  parsePickupRequest,
  parsePricePreview,
  parseStoreAddress,
  parseStoreCart,
  parseStoreCategory,
  parseStoreOrder,
  parseStoreOrderDetails,
  parseStoreOrderSummary,
  parseStoreProduct,
  parseSubscriptionOptions,
  parseSupportTicket,
  parseTicketMessage,
  parseTruckLoadRate,
  parseUserProfileResponse,
  parseZone,
} from '@/types/models';

// ── Auth Service ─────────────────────────────────────────────────────────────

export const AuthService = {
  async signIn(email: string, password: string): Promise<AppSession> {
    const res = await apiRequest<Record<string, unknown>>(
      'POST',
      '/api/auth/sign-in/email',
      {
        body: { email, password, rememberMe: true },
        triggerUnauthorizedGuard: false,
      },
    );
    return parseAppSession(res);
  },

  async signOut(token?: string | null): Promise<void> {
    await apiRequest('POST', '/api/auth/sign-out', { token });
  },

  async getSession(token: string): Promise<AppSession | null> {
    try {
      const res = await apiRequest<Record<string, unknown>>(
        'GET',
        '/api/auth/get-session',
        { token, timeoutMs: 8000 },
      );
      const userMap = asMap(res.user);
      if (!userMap) return null;
      return { token, user: parseAppUser(userMap) };
    } catch (err) {
      if (err instanceof ApiException && err.statusCode === 401) {
        return null;
      }
      throw err;
    }
  },

  async sendOtp(email: string): Promise<void> {
    await apiRequest('POST', '/api/auth/email-otp/send-verification-otp', {
      body: { email, type: 'email-verification' },
      triggerUnauthorizedGuard: false,
    });
  },

  async checkOtp(email: string, otp: string): Promise<boolean> {
    const res = await apiRequest<Record<string, unknown>>(
      'POST',
      '/api/auth/email-otp/check-verification-otp',
      {
        body: { email, otp, type: 'email-verification' },
        triggerUnauthorizedGuard: false,
      },
    );
    return asBool(res.success, false);
  },

  async verifyEmail(email: string, otp: string): Promise<AppSession | null> {
    const res = await apiRequest<Record<string, unknown>>(
      'POST',
      '/api/auth/email-otp/verify-email',
      {
        body: { email, otp },
        triggerUnauthorizedGuard: false,
      },
    );
    const token = res.token ? asStr(res.token) : '';
    const userMap = asMap(res.user);
    if (!token || !userMap) return null;
    return { token, user: parseAppUser(userMap) };
  },

  async getUserProfile(token?: string | null): Promise<UserProfileData> {
    const res = await apiRequest<Record<string, unknown>>(
      'GET',
      '/api/user/profile',
      { token },
    );
    return parseUserProfileResponse(res);
  },

  async saveLocation(params: {
    address: string;
    city: string;
    latitude: number;
    longitude: number;
    region?: string;
    postalCode?: string;
    country?: string;
    placeName?: string;
    placeId?: string;
  }): Promise<void> {
    await apiRequest('POST', '/api/location/', {
      body: {
        address: params.address,
        city: params.city,
        latitude: params.latitude,
        longitude: params.longitude,
        ...(params.region ? { region: params.region } : {}),
        ...(params.postalCode ? { postalCode: params.postalCode } : {}),
        country: params.country || 'Ghana',
        ...(params.placeName ? { placeName: params.placeName } : {}),
        ...(params.placeId ? { placeId: params.placeId } : {}),
      },
    });
  },

  async changeEmail(newEmail: string): Promise<AppUser> {
    const res = await apiRequest<Record<string, unknown>>(
      'POST',
      '/api/auth/change-email',
      { body: { newEmail } },
    );
    return parseAppUser(asMap(res.user) ?? {});
  },

  async changePassword(params: {
    currentPassword: string;
    newPassword: string;
    revokeOtherSessions?: boolean;
  }): Promise<AppSession> {
    const res = await apiRequest<Record<string, unknown>>(
      'POST',
      '/api/auth/change-password',
      { body: params },
    );
    return parseAppSession(res);
  },

  async requestPasswordReset(email: string): Promise<void> {
    await apiRequest('POST', '/api/auth/email-otp/request-password-reset', {
      body: { email },
      triggerUnauthorizedGuard: false,
    });
  },

  async verifyPasswordResetOtp(email: string, otp: string): Promise<void> {
    await apiRequest('POST', '/api/auth/email-otp/check-verification-otp', {
      body: { email, type: 'forget-password', otp },
      triggerUnauthorizedGuard: false,
    });
  },

  async resetPassword(params: {
    email: string;
    otp: string;
    password: string;
  }): Promise<void> {
    await apiRequest('POST', '/api/auth/email-otp/reset-password', {
      body: params,
      triggerUnauthorizedGuard: false,
    });
  },
};

// ── Customer Service ─────────────────────────────────────────────────────────

export const CustomerService = {
  async signUp(params: {
    email: string;
    password: string;
    name: string;
    phoneNumber: string;
    customerTypeId: string;
    zoneId: string;
    entityName?: string | null;
  }): Promise<{ id: string; userId: string; user: AppUser }> {
    const body: Record<string, unknown> = {
      email: params.email,
      password: params.password,
      name: params.name,
      phoneNumber: params.phoneNumber,
      customerTypeId: params.customerTypeId,
      zoneId: params.zoneId,
    };
    if (params.entityName && params.entityName.trim() !== '') {
      body.entityName = params.entityName.trim();
    }
    const res = await apiRequest<Record<string, unknown>>(
      'POST',
      '/api/customer/sign-up',
      { body, triggerUnauthorizedGuard: false },
    );
    return {
      id: asStr(res.id),
      userId: asStr(res.userId),
      user: parseAppUser(asMap(res.user) ?? {}),
    };
  },

  async updateCustomer(params: { entityName?: string }): Promise<void> {
    const body: Record<string, unknown> = {};
    if (params.entityName !== undefined) {
      body.entityName = params.entityName;
    }
    if (Object.keys(body).length === 0) return;
    await apiRequest('PATCH', '/api/customer/me', { body });
  },

  async getCustomerTypes(): Promise<CustomerType[]> {
    const res = await apiRequest('GET', '/api/customer/types', {
      triggerUnauthorizedGuard: false,
    });
    return asList(extractList(res), parseCustomerType, 'customerTypes');
  },

  async getActiveZones(): Promise<Zone[]> {
    const res = await apiRequest('GET', '/api/zone/public/list', {
      triggerUnauthorizedGuard: false,
    });
    return asList(extractList(res), parseZone, 'zones');
  },

  async getCapacityRates(): Promise<CapacityRate[]> {
    const res = await apiRequest('GET', '/api/rates/capacity');
    return asList(extractList(res), parseCapacityRate, 'capacityRates');
  },

  async getTruckLoadRates(): Promise<TruckLoadRate[]> {
    const res = await apiRequest('GET', '/api/rates/truck-loads');
    return asList(extractList(res), parseTruckLoadRate, 'truckLoadRates');
  },

  async updateBins(
    bins: { capacityRateId: string; quantity: number }[],
  ): Promise<CustomerBin[]> {
    const res = await apiRequest('PUT', '/api/customer/me/bins', {
      body: { bins },
    });
    return asList(
      extractList(res, ['data', 'bins']),
      parseCustomerBin,
      'updateBins',
    );
  },
};

// ── Disposable & Pickup Service ──────────────────────────────────────────────

export const DisposableService = {
  async getActiveItemTypes(customerTypeId?: string): Promise<DisposableItem[]> {
    const res = await apiRequest('GET', '/api/disposable/item-types/active', {
      queryParams: customerTypeId ? { customerTypeId } : undefined,
    });
    return asList(extractList(res), parseDisposableItem, 'disposableItems');
  },

  async getActiveQuantities(
    customerTypeId?: string,
  ): Promise<DisposableQuantity[]> {
    const res = await apiRequest('GET', '/api/disposable/quantities/active', {
      queryParams: customerTypeId ? { customerTypeId } : undefined,
    });
    return asList(
      extractList(res),
      parseDisposableQuantity,
      'disposableQuantities',
    );
  },
};

export const PickupService = {
  async getPickupRequests(): Promise<PickupRequestResponse[]> {
    const res = await apiRequest('GET', '/api/pickup-requests/');
    return asList(extractList(res), parsePickupRequest, 'pickups');
  },

  async getPickupRequestById(id: string): Promise<PickupRequestResponse> {
    const res = await apiRequest<Record<string, unknown>>(
      'GET',
      `/api/pickup-requests/${id}`,
    );
    return parsePickupRequest(res);
  },

  async createPickupRequest(
    request: PickupRequestCreate,
  ): Promise<PickupRequestResponse> {
    const body: Record<string, unknown> = {
      disposableItemTypeId: request.disposableItemTypeId,
      preferredPickupDate: request.preferredPickupDate,
    };
    if (request.additionalNotes && request.additionalNotes.trim()) {
      body.additionalNotes = request.additionalNotes.trim();
    }
    if (request.truckLoadRateId) {
      body.truckLoadRateId = request.truckLoadRateId;
    }
    if (request.isEmergency) {
      body.isEmergency = true;
    }
    const res = await apiRequest<Record<string, unknown>>(
      'POST',
      '/api/pickup-requests/',
      { body },
    );
    return parsePickupRequest(res);
  },

  /**
   * `null` means "we could not find out", which is different from the server
   * answering `available: false`. Booking must not be blocked by a failed
   * lookup, so callers keep the toggle enabled and fall back to generic copy.
   */
  async getEmergencyFee(): Promise<EmergencyFeeInfo | null> {
    try {
      const res = await apiRequest<Record<string, unknown>>(
        'GET',
        '/api/pickup-requests/emergency-fee',
      );
      return parseEmergencyFeeInfo(res);
    } catch {
      return null;
    }
  },

  async getPricePreview(params: {
    estimatedQuantityId?: string;
    truckLoadRateId?: string;
    isEmergency?: boolean;
  }): Promise<PricePreview> {
    const res = await apiRequest<Record<string, unknown>>(
      'GET',
      '/api/pickup-requests/price-preview',
      {
        queryParams: {
          estimatedQuantityId: params.estimatedQuantityId,
          truckLoadRateId: params.truckLoadRateId,
          isEmergency: params.isEmergency ? 'true' : undefined,
        },
      },
    );
    return parsePricePreview(res);
  },

  async cancelPickupRequest(id: string): Promise<void> {
    await apiRequest('DELETE', `/api/pickup-requests/${id}`);
  },

  async reschedulePickupRequest(
    id: string,
    preferredPickupDate: string,
  ): Promise<PickupRequestResponse> {
    const res = await apiRequest<Record<string, unknown>>(
      'PATCH',
      `/api/pickup-requests/${id}`,
      { body: { preferredPickupDate } },
    );
    return parsePickupRequest(res);
  },
};

// ── Subscription & Billing Service ───────────────────────────────────────────

export const SubscriptionService = {
  async getSubscriptionOptions(): Promise<SubscriptionOptions> {
    const res = await apiRequest<Record<string, unknown>>(
      'GET',
      '/api/subscription/options',
    );
    return parseSubscriptionOptions(res);
  },

  async getMySubscription(): Promise<MySubscriptionResult> {
    try {
      const res = await apiRequest<Record<string, unknown>>(
        'GET',
        '/api/subscription/me',
      );
      const debtMap = asMap(res.outstandingDebt);
      const outstandingDebt = debtMap
        ? {
            subscriptionId: asStr(debtMap.subscriptionId),
            amount: asDouble(debtMap.amount),
          }
        : null;

      if ('paymentPlan' in res) {
        const paymentPlan = asStr(res.paymentPlan);
        const subMap = asMap(res.subscription);
        if (paymentPlan === 'pay_as_you_go' || !subMap) {
          return {
            subscription: null,
            outstandingDebt,
            hasDebt: Boolean(outstandingDebt && outstandingDebt.amount > 0),
          };
        }
        return {
          subscription: parseActiveSubscription(subMap),
          outstandingDebt,
          hasDebt: Boolean(outstandingDebt && outstandingDebt.amount > 0),
        };
      }

      return {
        subscription: parseActiveSubscription(res),
        outstandingDebt,
        hasDebt: Boolean(outstandingDebt && outstandingDebt.amount > 0),
      };
    } catch (err) {
      if (err instanceof ApiException && err.statusCode === 404) {
        return { subscription: null, outstandingDebt: null, hasDebt: false };
      }
      throw err;
    }
  },

  async subscribeCalculated(params: {
    frequency: string;
    billingCycle: string;
    paymentType?: 'prepaid' | 'postpaid';
    truckLoadRateId?: string | null;
  }): Promise<{
    paymentPlan: string;
    subscription: ActiveSubscription | null;
  }> {
    const tier =
      params.truckLoadRateId && params.truckLoadRateId.trim() !== ''
        ? params.truckLoadRateId.trim()
        : undefined;
    const res = await apiRequest<Record<string, unknown>>(
      'POST',
      '/api/subscription/subscribe-calculated',
      {
        body: {
          frequency: params.frequency,
          billingCycle: params.billingCycle,
          paymentType: params.paymentType || 'prepaid',
          ...(tier ? { truckLoadRateId: tier } : {}),
        },
      },
    );
    const subMap = asMap(res.subscription);
    return {
      paymentPlan: asStr(res.paymentPlan),
      subscription: subMap ? parseActiveSubscription(subMap) : null,
    };
  },

  async retryPendingPayment(): Promise<string> {
    const res = await apiRequest<Record<string, unknown>>(
      'POST',
      '/api/subscription/me/payment/retry',
    );
    return asStr(res.message, 'Payment prompt sent to your phone.');
  },

  async payBalance(): Promise<void> {
    await apiRequest('POST', '/api/subscription/me/pay-balance');
  },

  async renewSubscription(): Promise<ActiveSubscription | null> {
    const res = await apiRequest<Record<string, unknown>>(
      'POST',
      '/api/subscription/me/renew',
    );
    const subMap = asMap(res.subscription);
    if (subMap) return parseActiveSubscription(subMap);
    if (res.id && asMap(res.plan)) return parseActiveSubscription(res);
    return null;
  },

  async cancelSubscription(): Promise<CancelSubscriptionResult> {
    const res = await apiRequest<Record<string, unknown>>(
      'DELETE',
      '/api/subscription/me',
    );
    return parseCancelSubscriptionResult(res);
  },

  async getBillingHistory(): Promise<Invoice[]> {
    const res = await apiRequest<Record<string, unknown>>(
      'GET',
      '/api/invoices/me/',
    );
    return asList(extractList(res), parseInvoice, 'invoices');
  },

  async getInvoiceDetail(invoiceId: string): Promise<InvoiceDetail> {
    const res = await apiRequest<Record<string, unknown>>(
      'GET',
      `/api/invoices/me/${invoiceId}`,
    );
    return parseInvoiceDetail(res);
  },

  async downloadInvoicePdf(invoiceId: string, invoiceNumber?: string): Promise<void> {
    const blob = await apiRequestBlob(`/api/invoices/me/${invoiceId}/pdf`);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoice_${invoiceNumber || invoiceId}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};

// ── Store / Shop Service ─────────────────────────────────────────────────────

export const StoreService = {
  async getCategories(): Promise<StoreCategory[]> {
    const res = await apiRequest('GET', '/api/store/customer/categories');
    return asList(extractList(res), parseStoreCategory, 'storeCategories');
  },

  async getProducts(
    page = 1,
    limit = 20,
  ): Promise<{ data: ReturnType<typeof parseStoreProduct>[]; pagination: PaginationMeta }> {
    const res = await apiRequest<Record<string, unknown>>(
      'GET',
      '/api/store/customer/products',
      { queryParams: { page: String(page), limit: String(limit) } },
    );
    return {
      data: asList(extractList(res), parseStoreProduct, 'storeProducts'),
      pagination: parsePaginationMeta(asMap(res.pagination)),
    };
  },

  async getProductById(productId: string) {
    const res = await apiRequest<Record<string, unknown>>(
      'GET',
      `/api/store/customer/products/${productId}`,
    );
    return parseStoreProduct(res);
  },

  async getDeliveryFees(zoneId?: string): Promise<DeliveryFee[]> {
    const res = await apiRequest('GET', '/api/store-orders/delivery-fees', {
      queryParams: zoneId ? { zoneId } : undefined,
    });
    return asList(extractList(res), parseDeliveryFee, 'deliveryFees');
  },

  async getCart(): Promise<StoreCart> {
    const res = await apiRequest<Record<string, unknown>>(
      'GET',
      '/api/store-orders/cart',
    );
    return parseStoreCart(res);
  },

  async resolveCartFromMutation(res: Record<string, unknown>): Promise<StoreCart> {
    const data = asMap(res.data) ?? asMap(res.cart) ?? res;
    if (Array.isArray(data.items) || Array.isArray(data.cartItems)) {
      return parseStoreCart(res);
    }
    return StoreService.getCart();
  },

  async addCartItem(productId: string, quantity = 1): Promise<StoreCart> {
    const res = await apiRequest<Record<string, unknown>>(
      'POST',
      '/api/store-orders/cart/items',
      { body: { productId, quantity } },
    );
    return StoreService.resolveCartFromMutation(res);
  },

  async updateCartItem(itemId: string, quantity: number): Promise<StoreCart> {
    const res = await apiRequest<Record<string, unknown>>(
      'PATCH',
      `/api/store-orders/cart/items/${itemId}`,
      { body: { quantity } },
    );
    return StoreService.resolveCartFromMutation(res);
  },

  async removeCartItem(itemId: string): Promise<StoreCart> {
    const res = await apiRequest<Record<string, unknown>>(
      'DELETE',
      `/api/store-orders/cart/items/${itemId}`,
    );
    return StoreService.resolveCartFromMutation(res);
  },

  async clearCart(): Promise<void> {
    await apiRequest('DELETE', '/api/store-orders/cart/');
  },

  async getAddresses(): Promise<StoreAddress[]> {
    const res = await apiRequest('GET', '/api/store-orders/addresses/');
    return asList(extractList(res), parseStoreAddress, 'addresses');
  },

  async createAddress(params: {
    street: string;
    city: string;
    region: string;
    postalCode?: string;
    country?: string;
    isDefault?: boolean;
  }): Promise<StoreAddress> {
    const res = await apiRequest<Record<string, unknown>>(
      'POST',
      '/api/store-orders/addresses/',
      {
        body: {
          street: params.street,
          city: params.city,
          region: params.region,
          // Optional keys are omitted entirely — sending "" trips backend
          // validation the same way a bad uuid does.
          ...(params.postalCode ? { postalCode: params.postalCode } : {}),
          country: params.country || 'Ghana',
          isDefault: Boolean(params.isDefault),
        },
      },
    );
    return parseStoreAddress(res);
  },

  async checkout(params: {
    deliveryAddressId: string;
    mobileNumber: string;
    paymentMethod?: string;
  }): Promise<StoreOrder> {
    const res = await apiRequest<Record<string, unknown>>(
      'POST',
      '/api/store-orders/orders/checkout',
      {
        body: {
          deliveryAddressId: params.deliveryAddressId,
          mobileNumber: params.mobileNumber,
          paymentMethod: params.paymentMethod || 'blupay',
        },
      },
    );
    return parseStoreOrder(res);
  },

  async getMyOrders(
    page = 1,
    limit = 20,
  ): Promise<{ data: StoreOrderSummary[]; pagination: PaginationMeta }> {
    const res = await apiRequest<Record<string, unknown>>(
      'GET',
      '/api/store-orders/orders/me',
      { queryParams: { page: String(page), limit: String(limit) } },
    );
    return {
      data: asList(extractList(res), parseStoreOrderSummary, 'orders'),
      pagination: parsePaginationMeta(asMap(res.pagination)),
    };
  },

  async getOrderDetails(orderId: string): Promise<StoreOrderDetails> {
    const res = await apiRequest<Record<string, unknown>>(
      'GET',
      `/api/store-orders/orders/${orderId}`,
    );
    return parseStoreOrderDetails(res);
  },

  async cancelOrder(orderId: string): Promise<string> {
    const res = await apiRequest<Record<string, unknown>>(
      'POST',
      `/api/store-orders/orders/${orderId}/cancel`,
    );
    return asStr(res.message, 'Order cancelled');
  },

  async downloadOrderInvoicePdf(orderId: string, orderNumber?: string): Promise<void> {
    const blob = await apiRequestBlob(
      `/api/store-orders/orders/me/${orderId}/invoice/pdf`,
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `order_invoice_${orderNumber || orderId}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};

// ── Support, Notifications & Activity Logs ──────────────────────────────────

export const SupportService = {
  async getMyTickets(params?: {
    page?: number;
    limit?: number;
    status?: string;
    priority?: string;
    category?: string;
    search?: string;
  }): Promise<{ data: SupportTicket[]; pagination: PaginationMeta }> {
    const res = await apiRequest<Record<string, unknown>>(
      'GET',
      '/api/support/customer/tickets',
      {
        queryParams: {
          page: String(params?.page ?? 1),
          limit: String(params?.limit ?? 20),
          status: params?.status,
          priority: params?.priority,
          category: params?.category,
          search: params?.search,
        },
      },
    );
    return {
      data: asList(extractList(res), parseSupportTicket, 'tickets'),
      pagination: parsePaginationMeta(asMap(res.pagination)),
    };
  },

  async createTicket(params: {
    subject: string;
    category: TicketCategoryValue;
    priority: TicketPriorityValue;
    message: string;
  }): Promise<SupportTicket> {
    const res = await apiRequest<Record<string, unknown>>(
      'POST',
      '/api/support/customer/tickets',
      { body: params },
    );
    return parseSupportTicket(res);
  },

  async getTicketById(id: string): Promise<SupportTicket> {
    const res = await apiRequest<Record<string, unknown>>(
      'GET',
      `/api/support/customer/tickets/${id}`,
    );
    return parseSupportTicket(res);
  },

  async replyToTicket(ticketId: string, message: string): Promise<TicketMessage> {
    const res = await apiRequest<Record<string, unknown>>(
      'POST',
      `/api/support/customer/tickets/${ticketId}/messages`,
      { body: { message } },
    );
    return parseTicketMessage(res);
  },
};

export const NotificationService = {
  async getCustomerNotifications(
    page = 1,
    limit = 20,
  ): Promise<{
    data: AppNotification[];
    unreadCount: number;
    pagination: PaginationMeta;
  }> {
    const res = await apiRequest<Record<string, unknown>>(
      'GET',
      '/api/notifications/customer/',
      { queryParams: { page: String(page), limit: String(limit) } },
    );
    return {
      data: asList(extractList(res), parseAppNotification, 'notifications'),
      unreadCount: asInt(res.unreadCount, 0),
      pagination: parsePaginationMeta(asMap(res.pagination)),
    };
  },

  async markAsRead(notificationId: string): Promise<AppNotification> {
    const res = await apiRequest<Record<string, unknown>>(
      'PATCH',
      `/api/notifications/customer/${notificationId}/read`,
    );
    return parseAppNotification(res);
  },

  async markAllAsRead(): Promise<number> {
    const res = await apiRequest<Record<string, unknown>>(
      'PATCH',
      '/api/notifications/customer/read-all',
    );
    return asInt(res.count, 0);
  },
};

export const ActivityLogService = {
  async getMyActivityLogs(
    page = 1,
    limit = 20,
  ): Promise<{ data: ActivityLogItem[]; pagination: PaginationMeta }> {
    const res = await apiRequest<Record<string, unknown>>(
      'GET',
      '/api/activity-logs/me',
      { queryParams: { page: String(page), limit: String(limit) } },
    );
    return {
      data: asList(extractList(res), parseActivityLogItem, 'activityLogs'),
      pagination: parsePaginationMeta(asMap(res.pagination)),
    };
  },
};

