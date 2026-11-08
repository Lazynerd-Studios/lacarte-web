# LaCarte Customer Web Portal — Frontend Specification

**Status:** Draft v1 for review · **Date:** 2026-11-04
**Target:** `lacarte-customer-web` — new sibling repo at `C:\Users\babso\OneDrive\Documents\VIBES\lacarte-customer-web`
**Source of truth for behaviour:** `lacarte-customer` (Flutter, `version: 1.0.0+7`, 139 Dart files, ~38.5k LOC, `flutter analyze` clean)

---

## 0. Decisions locked

| # | Decision | Rationale |
|---|---|---|
| D1 | Next.js + TypeScript | Chosen over Nuxt/Flutter Web. Precedent in-house: `Upload-Portal` runs Next 15.5.23 + React 19 + Tailwind 4 + `next.config.ts`. |
| D2 | Own repo from day one, no extract-later step | `lacarte-customer/.gitignore` has **no** Node entries; root `web/` is Flutter's own web target. Every LaCarte surface is already a sibling repo. |
| D3 | App Router, **no SSR for the portal** | Everything sits behind auth. SSR only earns its cost for public marketing pages, which are out of scope here. |
| D4 | Same-origin proxy + httpOnly cookie session | Avoids CORS config; replaces `flutter_secure_storage` web behaviour (which is `localStorage`, not secure). |
| D5 | Do **not** run blind OpenAPI codegen | See §5.2. The spec's type fidelity is unsafe. |
| D6 | Tailwind 4 with CSS-first `@theme` tokens | Normalizes 94 scattered hex literals into one token layer. |
| D7 | Desktop-first layout, sidebar nav | `app_bottom_nav.dart` is the wrong model above 900px. |

**Out of scope (v1):** push notifications (FCM web needs VAPID + service worker), native app-parity onboarding carousel, dark mode, multi-currency (GHS only — established convention), mobile-web polish below 375px.

---

## 1. Product scope

A logged-in customer portal for a waste-collection service: manage pickup requests, bin inventory, subscriptions, invoices and store orders from a desktop screen.

**Primary users:** existing subscribers who today use the phone app. **Highest-value web jobs:** invoice/billing review, pickup history and tracking, subscription changes, bin inventory management, support tickets — all currently cramped into a 1421-line `view_pickup_screen.dart` on a phone.

**Screen count:** the Flutter app has **42 real screens** (`lib/screens/debug/` is empty). §9 maps each to a web route, a deferred phase, or an explicit drop.

---

## 2. Auth, session & routing state machine

### 2.1 Sign-in contract (verified from `api-1.json` + `auth_service.dart`)

- `POST /api/auth/sign-in/email` → body `{ email, password, callbackURL?, rememberMe? }`. Dart sends `{email, password, rememberMe: true}`.
- Response `200`: `{ redirect: false, token: string, url: string|null, user: User }`. **The token is a top-level `token` field**, not a cookie. The spec contains **zero** `Set-Cookie` occurrences, so any cookie we set is created by our proxy, not returned by the backend.
- `GET /api/auth/get-session` → `{ session, user }` with **no token** — the Flutter client re-sends the token it already stored. Our proxy does the same from the cookie.
- `POST /api/auth/sign-out` → `{ success: boolean }`; clears our cookie.

### 2.2 Proxy design

```
Browser ──/api/*──▶ Next.js ──(Bearer <cookie>)──▶ https://lacarteprod.lazynerdstudios.com/api/*
```

- **Route handlers** (not plain rewrites) for the endpoints that need to mint or destroy the cookie: `POST /api/auth/sign-in/email`, `/api/auth/sign-out`, `/api/auth/get-session`.
- **Catch-all rewrite** for every other `/api/*` path, injecting `Authorization: Bearer <token>` server-side.
- Cookie: name `lc_token`, `httpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, max-age tied to `rememberMe`. Never readable from JS.
- Base URL from `process.env.LACARTE_API_BASE_URL`; the spec declares no `servers`, so nothing is inferred from it.
- Keep the Flutter per-request timeout default of **10s**, with explicit overrides for checkout / payment-retry (which need longer).

### 2.3 Landing route resolution

Port of `splash_screen.dart:68-80` (mirrored at `sign_in_screen.dart:105-160`). Order matters:

```
1. no valid token        → onboardingSeen ? /sign-in : /onboarding
2. hasLocation == false  → /onboarding/location
3. paymentPlan != 'pay_as_you_go' AND !hasSubscription → /onboarding/subscription
4. needsPayment (subscription.payment.paidAt == null)  → /dashboard  + toast
     "complete it from Profile → Subscription"   (deliberately NOT the pending screen)
5. otherwise             → /dashboard
```

### 2.4 Two auth rules that are easy to lose in a rewrite

1. **Offline-tolerant session.** `auth_provider.dart:207-210` keeps the user `authenticated` when the session check fails with any **non-401**. A network blip must never sign anyone out.
2. **Selective 401 teardown.** `ApiClient.checkError` fires forced sign-out only when `triggerUnauthorizedGuard === true`. Anonymous endpoints (wrong password, OTP verify, password reset) surface the error **without** destroying a live session. This is a per-call flag in the client, not a global interceptor.

---

## 3. Information architecture — desktop

### 3.1 Shell

```
┌────────────────────────────────────────────────────────┐
│ TopBar: logo · search · notifications bell · account    │
├──────────┬─────────────────────────────────────────────┤
│ Sidebar  │  Content grid (max-w-[1440px], 12 cols)     │
│ 64 / 240 │  page title 24/600 · gutter 24              │
│ collapsed│                                             │
└──────────┴─────────────────────────────────────────────┘
```

- Sidebar collapses to icon rail below 1280px; becomes a `Sheet` drawer below 1024px.
- Breakpoints: `sm 640 · md 768 · lg 1024 · xl 1280 · 2xl 1440`. **The Flutter app uses zero width breakpoints today** — every layout decision below is new work, not a port.

### 3.2 Tab → sidebar mapping

`NavTab { home, shop, history, profile }` (4 tabs, `currentTabProvider`) expands to a 6-item sidebar:

| Sidebar section | Route | Source screen |
|---|---|---|
| Dashboard | `/dashboard` | `dashboard_screen.dart` |
| Pickups | `/pickups` | merged `history_screen.dart` + `pickup_screen` create action |
| Subscription | `/subscription` | `profile_subscription_screen.dart` |
| Billing | `/billing`, `/billing/[id]` | `billing_history_screen.dart`, `billing_detail_screen.dart` |
| Shop | `/shop`, `/shop/[id]`, `/cart`, `/checkout` | 4 shop screens |
| Support | `/support`, `/support/[id]` | `customer_support_screen.dart`, `help_support_screen.dart` |
| Settings (account header menu) | `/account`, `/account/security`, `/account/bins`, `/account/activity`, `/account/business-name` | 5 profile screens |

Create-pickup is a primary button (`/pickups/new`), not a nav item — in Flutter it is the `+` on dashboard/history.

---

## 4. Design system

### 4.1 Token extraction — real debt to fix, not to copy

`lib/theme/colors.dart` defines **29 named constants**, but the codebase contains **94 distinct hex literals across 411 occurrences**, plus 228 uses of bare `Colors.white`, a duplicate 8-constant palette in `support/ticket_colors.dart` (with `#0A0D14` / `#868C98` that disagree with the theme file) and private colour copies inside `status_modal.dart`. The web port **normalizes** this; it does not replicate it.

### 4.2 `@theme` tokens (Tailwind 4, CSS variables)

```css
/* brand */
--color-brand-500:  #FFB400;  /* appColorOrange — primary CTA, active nav, "Assigned" */
--color-brand-50:   #1AFFB400;/* appColorOrangeBg — badge fill */

/* neutrals */
--color-ink-950: #0A0D12;  --color-ink-900: #181D27;  --color-ink-700: #4A5565;
--color-ink-600: #6A7282;  --color-ink-500: #99A1AF;  --color-ink-200: #E5E7EB;
--color-ink-100: #F3F4F6;  --color-stroke:  #E2E4E9;  --color-surface: #F9FAFC;

/* status semantics — the load-bearing part */
--color-pending:     #FDB022 / bg #FFFAEB;   /* Pending            */
--color-assigned:    #FFB400;                /* Assigned           */
--color-enroute:     #155DFC;                /* En Route           */
--color-scheduled:   #6941C6 / bg #F9F5FF;   /* Scheduled          */
--color-completed:   #10B981 / bg #DCFCE7;   /* Completed, active  */
--color-cancelled:   #B42318;                /* Cancelled          */
--color-paypending:  #FB2C36;                /* Payment Pending, destructive */
```

Unmapped inline hexes found in badge backgrounds — fold into the scale rather than carrying over: `#FEE2E2 #F2F4F7 #667085 #DCEEFB #F5F5F5 #0A0A0A #101828 #B54708`.

### 4.3 Shape, space, type

| Category | Source reality | Web token scale |
|---|---|---|
| Radius | pill (`1000/99/9999`) dominates with **107** uses, then `14×38`, `8×37`, `10×24`, `12×20`, `16×18`, `20×9`, `40×8`, `4×7` | `--radius-md 8` · `--radius-lg 12` · `--radius-xl 16` · `--radius-full 9999` (pills stay for badges only) |
| Spacing | `16` (72×), `24` page gutter (19×), `12`, `10`, `8`; `SizedBox(height:10)` between form fields | 4-pt scale `4/8/12/16/24/32`, gutter `24` |
| Type | **DMSans** (pubspec `fonts:`, weights 300–800). Sizes in use: `14×225`, `16×133`, `12×83`, `13×34`, `24×20` page titles, `18×17`, `11×14`, `20×8`. Weights `w400×150`, `w600×142`, `w500×116`, `w700×91` | `text-xs 12 · sm 13 · base 14 · lg 16 · xl 18 · 2xl 20 · 3xl 24` — body default **14/400**, page title **24/600** |

Note: the repo knowledge card claims "Manrope" typography. The code says **DMSans**. Trust the code.

### 4.4 Shared components → shadcn/ui base

| Web component | Flutter origin | Notes |
|---|---|---|
| `StatusBadge` | inline `Container` + radius 9999 + `_StatusStyle` at `dashboard_screen.dart:1040-1111`, `_statusColor` at `order_history_screen.dart:266`, `profile_subscription_screen.dart:798` | **One** implementation covering 10 pickup states + 3 order states; today it exists 3 times independently |
| `NetworkErrorView` | `network_error_view.dart` | distinguishes offline vs generic + Retry |
| `OfflineBanner` | `offline_banner.dart`, mounted globally via `MaterialApp.builder`, auto-dismiss 3s | becomes a root-layout Toast |
| `StatusModal` | `status_modal.dart`, **27 call-sites** | the app's universal success/error dialog |
| `PaymentPreviewModal` | `payment_preview_modal.dart` (665 lines), incl. `_PriceRow`, `_DashedDivider` | PayGo breakdown; richest table-like surface, deserves a desktop dialog |
| `PlanCard`, `PlanTypeSelector` | `subscription_plan_widgets.dart` | prepaid/postpaid pill + card |
| `QuoteGrid` | `calculated_pricing_section.dart` (`_QuoteCard`, 6 quotes / truck tiers) | |
| `Timeline`, `EtaCard`, `RouteProgress` | `_TimelineStep` (24), `_EtaCard`, `_RouteProgress` in `view_pickup_screen.dart` | 6 steps × 4 variants |
| `DataTable` | history, billing, activity-log, order lists | **new** — no Flutter primitive exists; lists are hand-built |
| `ConfirmSheet` | `cancel_pickup_modal`, `logout_dialog`, `reset_password_dialog`, `shop_order_confirmation_dialog` (+ `_ConfettiPainter`) | confetti is dropped |
| `BinMultiSelect` | `bin_inventory_screen.dart` | |

There is **no shared card primitive** in Flutter — `_NextPickupCard`, `_StatCard`, `_HistoryItem`, `_AddBinsNudge`, `_TicketCard` are all private and inline. The web needs one `Card` + the above.

---

## 5. Data layer

### 5.1 Layering

```
fetch (proxy)  →  typed client (src/api/*)  →  TanStack Query hooks (src/hooks/*)  →  components
```

### 5.2 Why not `openapi-typescript` blindly — verified findings

The spec (`lacarte-atlas-console/apidoc/api-1.json`, OpenAPI 3.0.3, "La Carte API" v0.0.1, **249 paths**) is the right discovery tool and the wrong codegen input:

1. **Money type flips by direction.** `POST /api/pickup-requests/ → 201.amount` and `.emergencyFee` are **`type: string`**, while `GET /price-preview → 200.base/total` and `GET /api/invoices/me/{id}.subtotal/taxRate/totalAmount` are **`type: number`**. Generated types would be wrong for one of the two.
2. **Every integer is a union.** `pickup.binCount`, `PaginationMeta.total`, `cart.itemCount`, `product.stockQuantity`, `plans[].pickups/bins/gracePeriodDays` are `anyOf(string(fmt=integer) | integer) | null`.
3. **Dates are unrepresentable.** `preferredPickupDate` is `anyOf(Date | string(date-time) | string(date) | number)` — `Date` is not a valid OpenAPI type; codegen emits `unknown`.
4. **Read schemas are stale and drop load-bearing fields.** `GET /api/pickup-requests/{id}` and the list item omit `amount`, `emergencyFee`, `currency`, and `quotaExceeded` — which `pickup_request.dart:159-192` treats as **non-nullable**.
5. **`security` annotations are inverted.** Login/OTP/reset are marked `bearerAuth`; genuinely protected paths (`/api/pickup-requests/*`, `/api/invoices/me/*`, `/api/customer/types`, `/api/disposable/*/active`, `/api/support/customer/tickets`) declare none. **Derive auth from the Dart `token:` argument, not the spec.**
6. **The error contract is undocumented.** Spec `ErrorResponse` is `{ message }` only. `statusCode` appears **0 times**; `code` is not a property of any schema; `EMAIL_NOT_VERIFIED` and `USER_BANNED` appear **0 times** — yet Dart branches on both.

**Decision:** use the spec for path/parameter discovery and drift checks; hand-write response schemas in **zod** with a shared coercion vocabulary, mirroring `json_parse.dart`:

```ts
const numericString = z.union([z.string(), z.number()]).nullable().transform(v =>
  v === null || v === '' ? null : Number(v));
const money = numericString;          // GHS only, format via Intl.NumberFormat('en-GH')
const isoDate = z.union([z.string(), z.number()]); // parse lazily, never at the boundary
```

Trailing slashes are meaningful: the spec registers `/api/customer/me/`, `/api/store-orders/cart/`, `/api/notifications/device-tokens/`; Dart calls the slash-less forms and relies on framework redirect. **Use the spec's exact paths.**

### 5.3 Error model

Mirror `api_exception.dart`: `class ApiException extends Error { statusCode: number; message: string; code?: string }`. Preserve Dart's transport mapping — `SocketException`/`ClientException` → `statusCode: 0, 'No internet connection'`; timeout → same. Branch on `code === 'EMAIL_NOT_VERIFIED' | 'USER_BANNED'` only where the Flutter flow does.

### 5.4 Riverpod → TanStack Query

| Flutter provider | Web equivalent |
|---|---|
| `auth_provider` (`StateNotifier<AuthState>`, `AuthStatus` enum, `checkSession/signIn/signOut/sendOtp/…`) | `AuthProvider` context + `useSession()` query; keep `AuthStatus` values 1:1 |
| `token_provider` | disappears — token is an httpOnly cookie, absent from JS |
| `cart_provider` (`NotifierProvider`) | Zustand store (client-only state) |
| `navigation_provider` (`StateProvider<NavTab>`) | the URL — no state |
| `pickup_provider`, `subscription_provider`, `store_provider`, `notification_provider`, `activity_log_provider`, `disposable_provider` | one query hook each, `queryKey` by domain |
| `ref.invalidate(x)` | `queryClient.invalidateQueries({ queryKey })` |
| `invoiceDetailProvider` (family) | `['invoice', id]` |

Keep the **auth-gating** behaviour: async providers currently throw a const `ApiException(401)` when unauthenticated rather than firing the request. Reproduce with `enabled: status === 'authenticated'`.

---

## 6. Realtime & polling

| Mechanism | Flutter today | Web v1 |
|---|---|---|
| Driver tracking | `pickup_tracking_service.dart` — hand-rolled SSE over `_client.send()` + `response.stream`, filters `event: location`, emits `DriverLocation` via a broadcast controller with `onCancel` cleanup | Native `EventSource` on `/api/pickup-requests/{id}/tracking/sse`. Strictly simpler. |
| PayGo payment status | Dashboard polls every **10s** while a payment is pending; two-tier refresh + app-resume one-shot refresh; polling is tab-aware (suspended for hidden tabs) | `refetchInterval: 10_000` gated on `pending` existence + `refetchIntervalInBackground: false` + `refetchOnWindowFocus` |
| Map tiles | TomTom raster (migrated off CARTO in `d739f2e`), cached via `flutter_map_cache` | Same tile URLs and the `--dart-define` injected `TOMTOM_API_KEY` carry over; browser HTTP cache + `dns-prefetch` |

**Known risk requiring a spike:** Next.js rewrites may buffer an SSE response. Plan A is a dedicated route handler that pipes `ReadableStream` through with identity encoding and `X-Accel-Buffering: no`. Verify in Phase 2 before building the tracking UI on top of it; fallback is a client-side `EventSource` pointed at a separately deployed passthrough.

---

## 7. Business rules to port (highest drift risk)

These live inside Dart models and widget trees and are the reason a second frontend can silently disagree with the app. Each must become a **pure, tested function** in `src/lib/domain/`, not an inline JSX condition:

1. `requiresPayment` / `isPayGoPaymentResolved` — the unified badge guard (`pickup_request.dart`). Four separate memory-documented corrections exist for badge consistency across list, detail, dashboard and history.
2. Pricing mode: `pay_as_you_go` vs subscription; prepaid vs postpaid segmentation.
3. Customer type: **per-bin vs truck-based**, incl. the recent fix `17b1b6e` (omit the `truckLoadRateId` key entirely for `per_bin` — not send it as null).
4. `binCount` / `quotaExceeded` blocking: PAYG submit is blocked for customers with no bin inventory (`21c1ef2`), with the "Add Your Bins First" nudge.
5. Emergency same-day pickup fee (`84c5924`) — toggle in create-pickup + `/api/pickup-requests/emergency-fee` quote.
6. `estimatedQuantityId` is **optional and no longer sent** by `PickupRequestCreate` (`6b62d4d`).
7. Onboarding completion targets: skip-subscription routes to dashboard (`needsPayment` → dashboard + toast, §2.3 step 4).
8. QR visibility and the payment/QR button matrix on pickup detail; `qrToken` is the **last 6 chars** of `qrCodeData`.
9. Currency is **GHS only**, everywhere, always.

**Test parity:** translate the existing Dart tests into vitest so both clients prove the same rules — `test/pickup_pricing_mode_test.dart`, `pickup_service_pricing_mode_test.dart`, `truck_subscription_test.dart`, `resilient_deserialization_test.dart`, `api_client_test.dart`, `auth_service_test.dart`.

---

## 8. Forms & validation (exact rules from code)

| Form | Fields & rules |
|---|---|
| **Sign up** | First name · Surname · Email · Phone (`+233` prefix, non-empty only) · Customer Type (from `/api/customer/types`) · Zone (from `/api/zone/public/list`) · Business name (**conditional** on `requiresEntityName`) · Password · Confirm. All-required → "Missing Information". Email `^[\w\.\+\-]+@[\w\-]+\.[a-zA-Z]{2,}$`. Password **8–128**. Confirm must equal. On `400`/`404` stale types → invalidate + re-fetch; `≥500` → retry modal |
| **Sign in** | Email regex, password non-empty; `EMAIL_NOT_VERIFIED` → status modal → OTP |
| **OTP** | 6 single-char digit boxes |
| **Reset / new password** | new ≥ 8, confirm match |
| **Location** | map pin + TomTom search (`countryCode: GH`, `PLACES`, types `POI,Geo,Street,Address`), Nominatim fallback. Errors: "Please select a location on the map", outside-Ghana, offline |
| **Pickup request** | disposal types (≥1 selected), preferred date, location (≥1), truck-load size, emergency toggle, free-text instructions. 4 distinct error toasts (`pickup_screen.dart:254-266`) |
| **Checkout** | delivery address selector + sheet (Street, City, Region, Postal), payment method (MoMo / USSD / bank transfer), order summary with **server-authoritative** live totals |
| **Support ticket** | Category, Priority, Subject **≥3**, Message **≥5** |
| **Profile edits** | change email (valid, ≠ current), login security (current + new), business name |

Web adds what Flutter lacks: `aria-invalid`, inline field errors, `autocomplete` attributes, Enter-to-submit, keyboard-navigable pickers.

---

## 9. Screen → route map

**Build:** `/onboarding/location`, `/sign-in`, `/sign-up`, `/verify-email`, `/reset-password` (+ OTP, + new password), `/dashboard`, `/pickups`, `/pickups/new`, `/pickups/[id]`, `/pickups/[id]/track`, `/history`, `/subscription`, `/billing`, `/billing/[id]`, `/shop`, `/shop/[id]`, `/cart`, `/checkout`, `/account`, `/account/security`, `/account/email`, `/account/bins`, `/account/activity`, `/account/business-name`, `/orders`, `/orders/[id]`, `/support`, `/support/new`, `/support/[id]`, `/notifications`.

**Deferred to a later phase:** `/payg-pending` + `/subscription-pending` (MoMo/USSD status screens — keep polling + allow-exit-while-polling behaviour), `/shop/ussd` (dial instructions — low desktop value), `/track-order` (static 2/5-step tracker, reachable only from the shop confirmation dialog).

**Dropped:** `notification_settings_screen.dart` — **orphaned, no call-site anywhere in the app**; `lib/screens/debug/` (empty); the `_ConfettiPainter` decoration; `onboarding_screen.dart` 3-slide carousel (reassess for desktop).

**Kept disabled:** the "Toll-Free Number" row stays a `Coming soon` badge with no action (`profile_screen.dart:197-200`). Note `coming_soon_overlay.dart` is imported by **zero** files — no screen is overlay-disabled, and Shop is fully live.

---

## 10. Non-functional

- **Accessibility:** WCAG 2.1 AA target. Real `<label>`s (Flutter's forms have none), focus-visible rings, 44px targets, `prefers-reduced-motion`, and announced status-badge text (colour alone currently encodes pickup state — a11y failure if copied).
- **Security:** token never reaches JS; `SameSite=Lax`; no token in logs (Dart already gates response-body logging behind `kDebugMode` — keep the equivalent); proxy must not forward `Authorization` to third-party hosts (TomTom key goes through its own route).
- **Performance budget:** portal LCP < 2.5s on desktop, JS < 300KB gz on first load, map + tracking lazy-loaded only on `/pickups/[id]/track`.
- **i18n:** Flutter has `l10n.yaml` + generated `AppLocalizations`; port to `next-intl` in Phase 4 unless English-only ships (decide before §3 strings are written twice).

---

## 11. Delivery plan

| Phase | Scope | Exit criteria |
|---|---|---|
| **0. Repo + toolchain** | `create-next-app` (TS, Tailwind 4, App Router, ESLint), `.gitignore` with Node entries, Vitest, Playwright, `@/` alias, CI | CI green on a hello-world route |
| **1. Foundation** | `/api/*` proxy, cookie session route handlers, `ApiException`, zod coercion layer, auth guard, sidebar shell, `@theme` tokens, `StatusBadge` | Sign in → land on `/dashboard` with **real** data; refresh survives reload; wrong password does **not** sign you out |
| **2. Pickups** | list, detail, create with quote + emergency fee, status badges, SSE tracking, cancel/reschedule | Live tracking works through the proxy (resolves §6 risk); vitest parity on §7 rules 1–6 |
| **3. Subscription & billing** | plan browse, `subscribe-calculated`, renew/retry/pay-balance, invoice list + detail + PDF blob download | A subscription change made on web shows correctly in the Flutter app |
| **4. Remaining surfaces** | bins, profile edits, activity log, notifications, support tickets, shop/cart/checkout, orders | 42-screen map from §9 fully closed |

Phase 1 is deliberately the only one that can be reviewed as a commit set without any product surface — it is where the porting hazards (§2.4, §5.2, §7) either get handled or get baked in.

---

## 12. Open questions

1. **Backend `code` field** — `EMAIL_NOT_VERIFIED` / `USER_BANNED` are load-bearing but undocumented in the spec. Is there an authoritative enum, or do we keep branching on observed strings?
2. **Spec ownership** — `api-1.json` lives in `lacarte-atlas-console/apidoc` and is version `0.0.1` with stale read schemas. Should it move to the backend repo and be regenerated per release, or do we treat Dart as truth and use the spec for drift alerts only?
3. **`get-session` staleness** — it returns no token, so cookie expiry relies on our own max-age. What is the backend session TTL, and does sign-out invalidate server-side unconditionally?
4. **i18n now or later** (§10).
5. **Deployment target** — Vercel vs a self-hosted Node container; this decides whether the SSE passthrough in §6 is allowed to stream.
