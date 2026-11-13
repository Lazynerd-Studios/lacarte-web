'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useRouter, usePathname } from 'next/navigation';
import {
  ApiException,
  authSessionGuard,
  TokenStorage,
} from '@/lib/api-client';
import {
  AuthService,
  StoreService,
} from '@/lib/services/api-services';
import {
  AppUser,
  CustomerBin,
  DeliveryFee,
  StoreCartItem,
  UserProfileData,
} from '@/types/models';
import {
  createCartMutationController,
  type CartMutationResult,
} from '@/lib/domain/cart-mutation-controller';
import { resolveDeliveryFeeState } from '@/lib/domain/delivery-fee';

// ── Toast & Modal Context ────────────────────────────────────────────────────

export interface ToastItem {
  id: string;
  title?: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

export interface StatusModalConfig {
  type: 'success' | 'error' | 'warning';
  title: string;
  message: string;
  buttonLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondaryAction?: () => void;
}

interface UIFeedbackContextValue {
  showToast: (
    message: string,
    type?: ToastItem['type'],
    title?: string,
  ) => void;
  showStatusModal: (config: StatusModalConfig) => void;
  closeStatusModal: () => void;
}

const UIFeedbackContext = createContext<UIFeedbackContextValue | null>(null);

export function useFeedback() {
  const ctx = useContext(UIFeedbackContext);
  if (!ctx) throw new Error('useFeedback must be used within AppProviders');
  return ctx;
}

// ── Auth Context ─────────────────────────────────────────────────────────────

export type AuthStatus =
  | 'initial'
  | 'loading'
  | 'authenticated'
  | 'unauthenticated';

interface AuthContextValue {
  status: AuthStatus;
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AppUser | null;
  profile: UserProfileData | null;
  needsLocation: boolean;
  needsSubscription: boolean;
  needsPayment: boolean;
  hasActiveSubscription: boolean;
  hasPendingSubscription: boolean;
  signIn: (email: string, password: string) => Promise<UserProfileData | null>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<UserProfileData | null>;
  updateCustomerBins: (bins: CustomerBin[]) => void;
  setSessionDirect: (token: string, user: AppUser) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AppProviders');
  return ctx;
}

// ── Cart Context ─────────────────────────────────────────────────────────────

interface CartContextValue {
  items: StoreCartItem[];
  totalCount: number;
  subtotal: number;
  deliveryFee: number;
  freeDeliveryMinQuantity: number | null;
  zoneName: string | null;
  total: number;
  isLoading: boolean;
  isMutating: boolean;
  deliveryFeeState: ReturnType<typeof resolveDeliveryFeeState>;
  refreshDeliveryFees: () => Promise<unknown>;
  isDrawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  addToCart: (productId: string, quantity?: number) => Promise<void>;
  setQuantity: (item: StoreCartItem, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshCart: () => Promise<void>;
}

const CartContext = createContext<CartContextValue | null>(null);

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within AppProviders');
  return ctx;
}

// ── Inner Providers ──────────────────────────────────────────────────────────

function InnerProviders({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();

  // Feedback state
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [modal, setModal] = useState<StatusModalConfig | null>(null);

  const showToast = useCallback(
    (
      message: string,
      type: ToastItem['type'] = 'info',
      title?: string,
    ) => {
      const id = `${Date.now()}-${Math.random()}`;
      setToasts((prev) => [...prev, { id, message, type, title }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4500);
    },
    [],
  );

  const showStatusModal = useCallback((config: StatusModalConfig) => {
    setModal(config);
  }, []);

  const closeStatusModal = useCallback(() => {
    setModal(null);
  }, []);

  // Auth state
  const [status, setStatus] = useState<AuthStatus>('initial');
  const [user, setUser] = useState<AppUser | null>(null);
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const handling401Ref = useRef(false);

  // Cart state
  const [cartItems, setCartItems] = useState<StoreCartItem[]>([]);
  const [serverSubtotal, setServerSubtotal] = useState<number | null>(null);
  const [isCartLoading, setIsCartLoading] = useState(false);
  const [isCartMutating, setIsCartMutating] = useState(false);
  const [isDrawerOpen, setDrawerOpen] = useState(false);
  const cartControllerRef = useRef(createCartMutationController());
  const cartGenerationRef = useRef(0);
  const prevCartTokenScopeRef = useRef<string | null>(null);

  const cartTokenScope = status === 'authenticated' ? TokenStorage.read() : null;
  if (prevCartTokenScopeRef.current !== cartTokenScope) {
    prevCartTokenScopeRef.current = cartTokenScope;
    cartGenerationRef.current += 1;
    cartControllerRef.current.setGeneration(cartGenerationRef.current);
  }

  // Global 401 guard
  useEffect(() => {
    authSessionGuard.onUnauthorized = () => {
      if (handling401Ref.current) return;
      handling401Ref.current = true;
      TokenStorage.delete();
      setUser(null);
      setProfile(null);
      setCartItems([]);
      setServerSubtotal(null);
      setStatus('unauthenticated');
      queryClient.clear();
      showToast(
        'Your session has expired. Please sign in again.',
        'warning',
      );
      router.replace('/sign-in');
      setTimeout(() => {
        handling401Ref.current = false;
      }, 1000);
    };
    return () => {
      authSessionGuard.onUnauthorized = null;
    };
  }, [queryClient, router, showToast]);

  // Initial session check
  useEffect(() => {
    let mounted = true;
    async function checkSession() {
      const token = TokenStorage.read();
      if (!token) {
        if (mounted) setStatus('unauthenticated');
        return;
      }
      try {
        const session = await AuthService.getSession(token);
        if (!session) {
          TokenStorage.delete();
          if (mounted) setStatus('unauthenticated');
          return;
        }
        let prof: UserProfileData | null = null;
        try {
          prof = await AuthService.getUserProfile(token);
        } catch (err) {
          if (err instanceof ApiException && err.statusCode === 401) {
            TokenStorage.delete();
            if (mounted) setStatus('unauthenticated');
            return;
          }
          // Keep valid session even if profile fetch blips
        }
        if (mounted) {
          setUser(session.user);
          setProfile(prof);
          setStatus('authenticated');
        }
      } catch (err) {
        if (err instanceof ApiException && err.statusCode === 401) {
          TokenStorage.delete();
          if (mounted) setStatus('unauthenticated');
          return;
        }
        // Optimistic offline authentication when token exists
        if (mounted) {
          setStatus('authenticated');
        }
      }
    }
    checkSession();
    return () => {
      mounted = false;
    };
  }, []);

  const refreshProfile = useCallback(async (): Promise<UserProfileData | null> => {
    const token = TokenStorage.read();
    if (!token) return null;
    try {
      const prof = await AuthService.getUserProfile(token);
      setProfile(prof);
      return prof;
    } catch {
      return null;
    }
  }, []);

  const signIn = useCallback(
    async (
      email: string,
      password: string,
    ): Promise<UserProfileData | null> => {
      setStatus('loading');
      try {
        const session = await AuthService.signIn(email, password);
        TokenStorage.save(session.token);
        const prof = await AuthService.getUserProfile(session.token);
        setUser(session.user);
        setProfile(prof);
        setStatus('authenticated');
        queryClient.clear();
        return prof;
      } catch (err) {
        setStatus('unauthenticated');
        throw err;
      }
    },
    [queryClient],
  );

  const setSessionDirect = useCallback(
    async (token: string, newUser: AppUser) => {
      TokenStorage.save(token);
      setUser(newUser);
      let prof: UserProfileData | null = null;
      try {
        prof = await AuthService.getUserProfile(token);
      } catch {
        // Ignore profile blip
      }
      setProfile(prof);
      setStatus('authenticated');
      queryClient.clear();
    },
    [queryClient],
  );

  const signOut = useCallback(async () => {
    const token = TokenStorage.read();
    try {
      if (token) {
        await AuthService.signOut(token);
      }
    } catch {
      showToast(
        'Signed out locally (server unreachable).',
        'warning',
      );
    } finally {
      TokenStorage.delete();
      setUser(null);
      setProfile(null);
      setCartItems([]);
      setServerSubtotal(null);
      setStatus('unauthenticated');
      queryClient.clear();
      router.replace('/sign-in');
    }
  }, [queryClient, router, showToast]);

  const updateCustomerBins = useCallback((bins: CustomerBin[]) => {
    setProfile((prev) => {
      if (!prev || !prev.customer) return prev;
      return {
        ...prev,
        customer: {
          ...prev.customer,
          bins,
          hasBins: bins.length > 0,
        },
      };
    });
  }, []);

  // Computed onboarding & subscription flags (matching auth_provider.dart)
  const customer = profile?.customer ?? null;
  const needsLocation = Boolean(customer && !customer.hasLocation);
  const needsSubscription = Boolean(
    customer &&
      customer.subscriptionInfo.paymentPlan !== 'pay_as_you_go' &&
      !customer.hasSubscription,
  );
  const needsPayment = useMemo(() => {
    if (!customer) return false;
    if (customer.subscriptionInfo.paymentPlan === 'pay_as_you_go') return false;
    const sub = customer.subscriptionInfo.subscription;
    if (!sub) return false;
    const payment = sub.payment as Record<string, unknown> | undefined;
    if (!payment) return false;
    return payment.paidAt === null || payment.paidAt === undefined;
  }, [customer]);

  const hasActiveSubscription = Boolean(
    customer &&
      !customer.subscriptionInfo.isPayAsYouGo &&
      customer.hasSubscription &&
      !needsPayment,
  );

  const hasPendingSubscription = Boolean(
    customer?.subscriptionInfo.subscription &&
      String(customer.subscriptionInfo.subscription.status) === 'pending',
  );

  const applyCart = useCallback(
    (cart: { items: StoreCartItem[]; subtotal: number | null }) => {
      setCartItems(cart.items);
      setServerSubtotal(cart.subtotal);
    },
    [],
  );

  const runCartMutation = useCallback(
    async <T,>(
      request: () => Promise<T>,
      apply: (value: T) => void,
      notifyFailure = true,
    ): Promise<CartMutationResult<T>> => {
      setIsCartMutating(true);
      try {
        const result = await cartControllerRef.current.enqueue(request, apply);
        if (result.status === 'failed' && notifyFailure) {
          showToast('Could not update your cart.', 'error');
        }
        return result;
      } finally {
        setIsCartMutating(false);
      }
    },
    [showToast],
  );

  // Load server cart when authenticated
  const refreshCart = useCallback(async () => {
    const token = TokenStorage.read();
    if (!token) return;
    setIsCartLoading(true);
    try {
      await runCartMutation(
        () => StoreService.getCart(),
        applyCart,
        false,
      );
    } finally {
      setIsCartLoading(false);
    }
  }, [applyCart, runCartMutation]);

  useEffect(() => {
    if (cartTokenScope) {
      refreshCart();
    }
  }, [cartTokenScope, refreshCart]);

  // Delivery fee query scoped by customer zone
  const zoneId = customer?.zone.id || undefined;
  const deliveryFeesQuery = useQuery<DeliveryFee[]>({
    queryKey: ['deliveryFees', zoneId],
    queryFn: () => StoreService.getDeliveryFees(zoneId),
    enabled: status === 'authenticated',
    staleTime: 5 * 60 * 1000,
  });
  const deliveryFees = deliveryFeesQuery.data;

  const matchedFeeRule = useMemo(() => {
    if (!deliveryFees || deliveryFees.length === 0 || !customer?.zone) {
      return null;
    }
    const target = customer.zone.name.trim().toLowerCase();
    return (
      deliveryFees.find((f) => f.zoneName.trim().toLowerCase() === target) ??
      deliveryFees[0]
    );
  }, [deliveryFees, customer?.zone]);

  const totalCount = useMemo(
    () => cartItems.reduce((sum, i) => sum + i.quantity, 0),
    [cartItems],
  );

  const subtotal = useMemo(
    () =>
      serverSubtotal ??
      cartItems.reduce((sum, i) => sum + i.lineTotal, 0),
    [serverSubtotal, cartItems],
  );

  const deliveryFeeState = useMemo(
    () =>
      resolveDeliveryFeeState({
        totalCount,
        isLoading:
          deliveryFeesQuery.isLoading ||
          (deliveryFeesQuery.isFetching && !deliveryFeesQuery.data),
        isError: deliveryFeesQuery.isError,
        hasZone: Boolean(customer?.zone),
        matchedFeeRule,
      }),
    [
      customer?.zone,
      deliveryFeesQuery.data,
      deliveryFeesQuery.isError,
      deliveryFeesQuery.isFetching,
      deliveryFeesQuery.isLoading,
      matchedFeeRule,
      totalCount,
    ],
  );

  const deliveryFee = deliveryFeeState.fee ?? 0;
  const total = subtotal + deliveryFee;

  const addToCart = useCallback(
    async (productId: string, quantity = 1) => {
      const result = await runCartMutation(
        () => StoreService.addCartItem(productId, quantity),
        applyCart,
      );
      if (result.status === 'applied') {
        showToast('Added to cart', 'success');
      }
    },
    [applyCart, runCartMutation, showToast],
  );

  const setQuantity = useCallback(
    async (item: StoreCartItem, quantity: number) => {
      await runCartMutation(
        () =>
          quantity <= 0
            ? StoreService.removeCartItem(item.id)
            : StoreService.updateCartItem(item.id, quantity),
        applyCart,
      );
    },
    [applyCart, runCartMutation],
  );

  const removeItem = useCallback(
    async (itemId: string) => {
      await runCartMutation(
        () => StoreService.removeCartItem(itemId),
        applyCart,
      );
    },
    [applyCart, runCartMutation],
  );

  const clearCart = useCallback(async () => {
    await runCartMutation(
      () => StoreService.clearCart(),
      () => {
        setCartItems([]);
        setServerSubtotal(0);
      },
    );
  }, [runCartMutation]);

  // Offline/Online Connectivity Banner
  const [isOffline, setIsOffline] = useState(false);
  const [showBackOnline, setShowBackOnline] = useState(false);

  useEffect(() => {
    setIsOffline(!navigator.onLine);
    let timer: ReturnType<typeof setTimeout> | null = null;

    const handleOffline = () => {
      if (timer) clearTimeout(timer);
      setShowBackOnline(false);
      setIsOffline(true);
    };
    const handleOnline = () => {
      setIsOffline((prevOffline) => {
        if (prevOffline) {
          setShowBackOnline(true);
          timer = setTimeout(() => setShowBackOnline(false), 3000);
        }
        return false;
      });
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      if (timer) clearTimeout(timer);
    };
  }, []);

  // Protect authenticated routes
  useEffect(() => {
    const isAuthRoute =
      pathname.startsWith('/sign-in') ||
      pathname.startsWith('/sign-up') ||
      pathname.startsWith('/verify-otp') ||
      pathname.startsWith('/reset-password') ||
      pathname === '/';

    if (status === 'unauthenticated' && !isAuthRoute) {
      router.replace('/sign-in');
    }
  }, [status, pathname, router]);

  return (
    <UIFeedbackContext.Provider
      value={{ showToast, showStatusModal, closeStatusModal }}
    >
      <AuthContext.Provider
        value={{
          status,
          isAuthenticated: status === 'authenticated',
          isLoading: status === 'initial' || status === 'loading',
          user,
          profile,
          needsLocation,
          needsSubscription,
          needsPayment,
          hasActiveSubscription,
          hasPendingSubscription,
          signIn,
          signOut,
          refreshProfile,
          updateCustomerBins,
          setSessionDirect,
        }}
      >
        <CartContext.Provider
          value={{
            items: cartItems,
            totalCount,
            subtotal,
            deliveryFee,
            freeDeliveryMinQuantity:
              deliveryFeeState.status === 'ready'
                ? (matchedFeeRule?.freeDeliveryMinQuantity ?? null)
                : null,
            zoneName: customer?.zone.name ?? null,
            total,
            isLoading: isCartLoading,
            isMutating: isCartMutating,
            deliveryFeeState,
            refreshDeliveryFees: deliveryFeesQuery.refetch,
            isDrawerOpen,
            setDrawerOpen,
            addToCart,
            setQuantity,
            removeItem,
            clearCart,
            refreshCart,
          }}
        >
          {/* Global Offline / Back Online Banner */}
          {(isOffline || showBackOnline) && (
            <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] pointer-events-none">
              <div
                className={`px-5 py-2.5 rounded-full shadow-lg flex items-center gap-2 text-xs font-semibold text-white transition-all ${
                  isOffline ? 'bg-[#0A0D12]' : 'bg-[#10B981]'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                {isOffline ? 'No internet connection' : 'Back online'}
              </div>
            </div>
          )}

          {children}

          {/* Toast Stack */}
          <div className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-[95] flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 md:px-0">
            {toasts.map((t) => (
              <div
                key={t.id}
                className={`pointer-events-auto rounded-2xl px-4 py-3.5 shadow-xl border text-sm font-medium flex items-start justify-between gap-3 transition-all ${
                  t.type === 'error'
                    ? 'bg-[#FEF2F2] border-[#FECACA] text-[#B42318]'
                    : t.type === 'success'
                      ? 'bg-[#ECFDF5] border-[#A7F3D0] text-[#065F46]'
                      : t.type === 'warning'
                        ? 'bg-[#FFFBEB] border-[#FDE68A] text-[#92400E]'
                        : 'bg-[#0A0D12] border-[#181D27] text-white'
                }`}
              >
                <div>
                  {t.title && <div className="font-bold mb-0.5">{t.title}</div>}
                  <div>{t.message}</div>
                </div>
                <button
                  onClick={() =>
                    setToasts((prev) => prev.filter((item) => item.id !== t.id))
                  }
                  className="opacity-60 hover:opacity-100 text-xs font-bold"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {/* Global Status Modal (matches showStatusModal in Flutter) */}
          {modal && (
            <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#E2E4E9] text-center animate-in fade-in zoom-in-95 duration-150">
                <div
                  className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center text-2xl font-bold ${
                    modal.type === 'success'
                      ? 'bg-[#DCFCE7] text-[#10B981]'
                      : modal.type === 'warning'
                        ? 'bg-[#FFFAEB] text-[#FDB022]'
                        : 'bg-[#FEE2E2] text-[#B42318]'
                  }`}
                >
                  {modal.type === 'success'
                    ? '✓'
                    : modal.type === 'warning'
                      ? '!'
                      : '✕'}
                </div>
                <h3 className="text-lg font-bold text-[#0A0D12] mb-2">
                  {modal.title}
                </h3>
                <p className="text-sm text-[#4A5565] whitespace-pre-line mb-6 leading-relaxed">
                  {modal.message}
                </p>
                <div className="flex flex-col sm:flex-row gap-2.5">
                  {modal.secondaryLabel && (
                    <button
                      onClick={() => {
                        const fn = modal.onSecondaryAction;
                        setModal(null);
                        fn?.();
                      }}
                      className="flex-1 py-3 px-4 rounded-full border border-[#E2E4E9] text-sm font-semibold text-[#4A5565] hover:bg-[#F3F4F6] transition"
                    >
                      {modal.secondaryLabel}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      const fn = modal.onAction;
                      setModal(null);
                      fn?.();
                    }}
                    className="flex-1 py-3 px-6 rounded-full bg-[#FFB400] hover:bg-[#e5a200] text-sm font-bold text-[#0A0D12] transition cursor-pointer"
                  >
                    {modal.buttonLabel || 'OK'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </CartContext.Provider>
      </AuthContext.Provider>
    </UIFeedbackContext.Provider>
  );
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <InnerProviders>{children}</InnerProviders>
    </QueryClientProvider>
  );
}

