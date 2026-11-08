# LaCarte Customer Web — Design Specification

**Date:** 2026-11-04
**Status:** Approved for implementation planning
**Deliverable:** `lacarte-web` — a new, separate repository

---

## 1. Decision Log

| # | Decision | Outcome |
|---|---|---|
| D1 | Purpose | Same customer app as mobile, **full feature parity at v1** |
| D2 | UX bar | **Desktop-native redesign**, not a stretched mobile UI |
| D3 | Team | Separate web team maintains it long-term |
| D4 | Framework | **Next.js 15 (App Router) + TypeScript** |
| D5 | Repo model | **Separate repository** (`lacarte-web`), no build-then-move |
| D6 | Payments | Backend supports a **web/MoMo redirect checkout** |
| D7 | CORS | Backend will allowlist the web origin |
| D8 | Live tracking | **SSE works for the web origin** |
| D9 | Maps | TomTom key usable on the web domain |
| D10 | Push | FCM Web configured (web push cert + service worker) |

**Why not Flutter Web:** the app already ships Flutter web scaffolding, but Flutter Web's strength is mobile-port parity. Once "desktop-native redesign" (D2) and "separate web team" (D3) were chosen, Flutter Web lost both of its advantages — real desktop layouts, hover/focus states and data tables require heavy custom work, and the web team would be learning Dart.

**Why Next.js over Vue/Nuxt:** deeper ecosystem for the specific desktop patterns required (TanStack Table data grids, react-hook-form + Zod, shadcn/ui primitives). Nuxt remains a sound choice if the team later prefers Vue.

---

## 2. Goals & Non-Goals

**Goals**
- Complete customer self-service in a browser: auth, booking, live tracking, subscription, billing, shop, support, account.
- A genuinely desktop experience at ≥1280px while remaining usable down to phone widths.
- Behavioral parity with mobile on every pricing-mode rule, so a customer gets the same price and the same flow on either surface.

**Non-Goals (v1)**
- Mobile-specific permission UX as the primary locator. Web uses the browser's own
  geolocation prompt; a customer whose address already exists on the profile is not
  re-prompted.
- An offline-first PWA. The app is installable via `next-pwa`, but v1 has no
  background sync or offline data. "Optimistic session" (§6.2) means the *session*
  survives a network blip — it does not mean features work offline.
- Admin/staff surfaces (separate product).

---

## 3. Repository & Contract Strategy

```
lacarte-customer/    ← Flutter mobile app (this repo) — unchanged
lacarte-web/         ← NEW: Next.js customer web app
```

### Contract source of truth
The mobile app's `frontend-mobile-*.md` specs are the closest thing to a written API contract and are validated against working code. Copy into the web repo and treat as shared:

```
lacarte-web/docs/contracts/
  ├── pricing-mode.md            ← from frontend-mobile-customer-pricing-mode.md
  ├── truck-based-customers.md   ← from frontend-mobile-truck-based-customers.md
  ├── multi-bin-sizes.md         ← from frontend-mobile-customer-multi-bin-sizes.md
  ├── entity-names.md            ← from frontend-mobile-customer-entity-names.md
  └── endpoint-inventory.md      ← §8 below, derived from lib/services/
```

**Drift policy (open):** when mobile gains a feature, the mobile team updates the contract doc and flags the web repo. Recommended: a `#api-contract` change note in the mobile PR template. Not yet decided.

---

## 4. Tech Stack

| Concern | Choice | Rationale |
|---|---|---|
| Framework | Next.js 15, App Router, TypeScript | SSR for auth-free marketing/landing, CSR for app |
| Styling | Tailwind CSS v4 + `tailwindcss-animate` | Token-driven theming, responsive variants |
| Components | shadcn/ui | Desktop-native primitives, real focus/hover/keyboard states, owned code |
| Server state | TanStack Query | Maps to Riverpod `FutureProvider` mental model: cache, invalidate, retry |
| Client state | Zustand (scoped, minimal) | Tab/ui state only; server data stays in TanStack Query |
| Forms | react-hook-form + Zod | Schema validation mirroring mobile's resilient parsing |
| Tables | TanStack Table | Sortable/filterable history, invoices, bin inventory |
| Maps | MapLibre GL + **TomTom raster tiles** | Reuses existing tile URLs and key already proven in mobile |
| HTTP | `fetch` via one typed client (see §6) | Mirrors `ApiClient`; no axios dependency |
| Payments | MoMo web redirect (D6) | Backend-driven, see §7.4 |
| Push | Firebase JS SDK + service worker | Web push certificate configured |
| Testing | Vitest + Testing Library + Playwright | See §10 |

---

## 5. Design Concept

### 5.1 Visual identity
Carry the existing brand into a desktop grammar rather than redesigning it:

- **Typography:** DM Sans retained (already the mobile family) — weights 300–800 map to `font-light` → `font-extrabold`. Manrope retained as the secondary/display option.
- **Color:** reuse the mobile palette (`appColorOrange` `#FFB400` as the single accent/CTA, green for success states, red for destructive/error). Tokens defined once in `styles/tokens.css` as CSS custom properties, consumed only via Tailwind theme extension — no raw hex in components.
- **Radius & elevation:** mobile's rounded-card language (14px) scales to 12px on dense desktop surfaces; shadows stay shallow because desktop surfaces are already separated by layout.
- **Iconography:** Lucide (shadcn default) replaces Material Icons; keep semantic parity (bolt = emergency, truck = truck load, recycling = pickups).

### 5.2 Layout grammar

| Breakpoint | Width | Structure |
|---|---|---|
| Mobile web | < 768 | Single column, bottom tab bar (mirrors mobile), FAB for booking |
| Tablet | 768–1279 | Collapsible icon rail (64px) + content, no persistent labels |
| Desktop | ≥ 1280 | Persistent sidebar (240–280px) + main pane, often **two-column master–detail** |

- **Global shell:** top bar with global search, notifications bell (unread count), account menu. Breadcrumbs in the content header. Sidebar nav: Dashboard, Pickups, Shop, Billing, Support, Account.
- **Master–detail** applies to Pickups list→detail, Shop grid→product drawer, Billing table→invoice preview, Support list→thread.
- **Data tables** (History, Billing, Bin inventory, Shop orders): sortable columns, sticky header, row actions, pagination, column density toggle on desktop. On mobile they collapse to cards.
- **Forms:** move from mobile's stacked full-width fields to two-column labelled fields with inline validation and `Tab` order that matches visual order.
- **Modals/sheets:** mobile bottom-sheets become centered dialogs on desktop (drawer on tablet). Every dialog is keyboard-trapped, `Esc`-dismissible, focus-returning.
- **Toasts** replace `SnackBar`/status modals; destructive actions keep an explicit confirm dialog.

### 5.3 Accessibility & UX bar
WCAG 2.2 AA: visible focus rings on every interactive element, 44px minimum hit areas (desktop 32px visual with 44px hit extension), color contrast ≥4.5:1 on the amber accent (text on `#FFB400` must be dark, never white), full keyboard operability for booking and checkout, `prefers-reduced-motion` honored on map/timeline animations, and live-region announcements for payment/tracking status changes.

---

## 6. Architecture

```
lacarte-web/src/
├── app/                      # App Router routes (thin, compose features)
├── features/<domain>/        # auth | pickups | subscription | billing | shop
│   ├── api/                  #   endpoints for this domain
│   ├── model/                #   zod schemas + types (ported mobile models)
│   ├── hooks/                #   TanStack Query hooks (ported Riverpod providers)
│   └── ui/                   #   components/screens
├── components/ui/            # shadcn primitives
├── components/layout/        # shell, sidebar, topbar, master-detail
├── lib/api/                  # client.ts, errors.ts, authGuard.ts, prune.ts
├── lib/maps/                 # tomtom.ts, tiles.ts, sse.ts
├── styles/tokens.css         # design tokens (single source of color truth)
└── docs/contracts/           # §3
```

**Boundary rule:** a feature never imports another feature's `ui/`; cross-feature use goes through `model/` or a shared `components/` primitive. This keeps the 8 domains independently understandable and testable — the same failure mode that made the mobile screens (1,600-line `pickup_screen.dart`) hard to change.

### 6.1 API client (ports `lib/services/api_client.dart`)
- Single `fetch` wrapper; base URL from `NEXT_PUBLIC_API_BASE_URL`.
- Injects `Authorization: Bearer`, `Content-Type` on bodies, per-request timeout.
- Maps every non-2xx to a typed `ApiError { statusCode, message, code }` — identical to mobile's `ApiException`, so error `code`s (`EMAIL_NOT_VERIFIED`, `USER_BANNED`) flow through unchanged.
- **Multi-prefix aware:** paths are declared per-domain against the roots in §8, so the client never guesses.

### 6.2 401 / session guard (ports `AuthSessionGuard`)
- Global response interceptor: on 401 for a **protected** call → clear session, invalidate all queries, redirect to `/login` with a "session expired" notice.
- **Exempt list** for anonymous endpoints (sign-in, OTP send/check, verify-email, password reset, customer types, zones, rates, store catalogue): 401 there surfaces as a normal field/server error and **must not** tear down the session. This is the exact invariant mobile enforces with `triggerUnauthorizedGuard: false`.
- Token storage: `localStorage` in v1 (parity with mobile's secure storage, and workable with the existing bearer API). **Upgrade path:** `httpOnly` cookie session — requires a backend change; recorded as a security improvement, not a v1 blocker.
- Session bootstrap mirrors `checkSession()`: a genuine 401 signs out; network/5xx failures keep the token and stay optimistically authenticated; a profile-fetch failure does **not** destroy the session.

### 6.3 Resilient parsing (ports `utils/json_parse.dart`)
The backend sometimes sends numbers as strings, omits optional fields, or includes one malformed row in a list. Every schema is Zod with tolerant coercion:
```ts
z.coerce.number().catch(0)        // asDouble
z.coerce.string().catch('')       // asStr
z.array(Schema).catch([])         // list never blanks a screen
```
List endpoints parse **element-wise**, skipping and logging bad rows (`asList` behavior) rather than rejecting the payload.

### 6.4 Optional-field rule (the 422 class)
For every optional id/UUID field, **omit the key entirely when there is no value**. Sending `""` *or* `null` fails backend UUID validation with 422 "Expected string to match uuid".
```ts
pruneUndefined(body)  // strips undefined/''/null before POST/PATCH
// per_bin subscribe  → { frequency, billingCycle, paymentType }
// full_truck subscribe → { frequency, billingCycle, paymentType, truckLoadRateId }
```
Enforced by a unit test plus a repo lint that forbids `''` literals in request bodies.

### 6.5 Cache invalidation map (ports Riverpod `ref.invalidate`)
| After | Invalidate |
|---|---|
| Sign-out / forced 401 | **all** queries + `session` |
| Bin save | `customerMe`, `subscriptionOptions`, `mySubscription` |
| Subscribe success | `mySubscription`, `subscriptionOptions`, `pickupRequests`, `profile` |
| Pickup create/cancel/reschedule | `pickupRequests`, `unreadNotifications` |
| Cart mutation | `cart`, `cartSubtotal` |
| Order checkout | `storeOrders`, `cart` |
| Ticket reply | `tickets`, `ticketDetail` |

### 6.6 Bin-inventory invariant (the restart-nudge class)
`GET /api/customer/me` does **not** reliably carry `bins`. "Has bins" must merge two signals:
`profile.bins.length > 0` **OR** `GET /api/subscription/options → calculated.bins.length > 0`, with an explicit `unknown` state while options are loading. Any surface that shows an "add your bins" prompt or gates booking uses this combined selector — never `profile.bins` alone.

---

## 7. Feature Design by Domain

### 7.1 Auth
Routes `/login`, `/verify-email`, `/forgot-password`, `/reset-password`, `/onboarding/{location,plan,payment}`.
Handles error codes `EMAIL_NOT_VERIFIED` (→ OTP screen) and `USER_BANNED` (terminal message). OTP is a 6-field auto-advancing input with resend cooldown. Business categories request `entityName` using the API's `entityNameLabel`, identical to mobile's rule.

### 7.2 Pickups & live tracking
`/pickups` desktop table (date, type, status, amount, payment status) with a detail pane; `/pickups/new` booking; `/pickups/[id]` detail with live tracking.
**Booking branches on `customerType.pricingMode`** — see §7.3. Emergency toggle reflects `GET /emergency-fee`: `available:false` disables it; `fee` renders as `+GHS x.xx`. Degrades to enabled-with-generic-copy if the fetch fails, so booking is never blocked by this call.
Live tracking uses **SSE** (D8) with `EventSource` + reconnect/backoff, alongside a status timeline; map + timeline are side-by-side on desktop, tabbed on mobile.

### 7.3 Pricing-mode branching rules (port of the two mobile specs)
Detection: `customerType.pricingMode` ∈ {`full_truck`, `per_bin`}, **defaulting to `per_bin`** when absent. Helpers `isFullTruck` / `isPerBin`.

| Surface | `per_bin` | `full_truck` |
|---|---|---|
| Booking | No quantity picker (server derives). Waste type + date only | Truck-size picker (`GET /rates/truck-loads`), no quantity picker |
| `truckLoadRateId` | Omitted entirely | **Required** on price-preview and create |
| Create body | `{ disposableItemTypeId, preferredPickupDate, isEmergency }` | adds `truckLoadRateId` |
| Price preview | `?isEmergency=` only | `?truckLoadRateId=&isEmergency=` |
| Bins | Bin inventory screen available | **Hidden**; `bins: []`; no "Add Your Bins" CTA |
| Subscription tier | Priced from registered bins | Tier fixed on the plan; subscriber does not re-pick per booking |
| Over-quota subscriber | n/a | Falls back to PAYG → still sends a tier on every booking |
| Missing tier (PAYG) | n/a | Block submit client-side; server also 400s |
| Stale tier after 400 | n/a | Invalidate rates, clear selection, ask user to re-pick |

Subscription options come from the **pre-computed `quotes[]` matrix** in `GET /subscription/options`, filtered by `quotesForTier()`; the web does **not** call `GET /subscription/calculate` (same accepted-equivalent design as mobile). `calculated.available === false` → show `calculated.message`, disable subscribe, and **no** bin CTA for truck accounts.

Subscriber current plan shows `truckLoadRateId` / nested `truckLoadRate.label` / `binEquivalent` as a tier chip instead of "0 bins".

### 7.4 Subscription, payments & MoMo redirect
`/subscription` plan matrix (frequency × billing cycle table, desktop grid) with prepaid/postpaid toggle.
**Redirect source (to confirm with backend):** the mobile flow initiates a MoMo prompt
server-side, so v1 assumes one of `POST /subscribe-calculated`, `POST /pickup-requests/`,
`POST /store-orders/orders/checkout`, `POST /me/renew`, `POST /me/payment/retry` or
`POST /me/pay-balance` returns the provider checkout URL in its response (or a dedicated
field such as `redirectUrl`). **The exact endpoint and field name are unconfirmed** — see
§11; verify before M5 and update this section, do not code against a guess.
`POST /subscribe-calculated` then:
1. Backend returns the MoMo redirect URL (D6).
2. Browser navigates to the provider checkout page.
3. Provider redirects to `/subscription/return?status=…` (also reachable by the user closing/returning).
4. On return, **poll** `GET /subscription/me` + `GET /invoices/me/{id}` until `payment.paidAt` is set or the attempt expires; show a pending state meanwhile.
The same return-and-poll pattern serves PAYG pickup payment (`/pickups/return`) and shop order checkout. `POST /me/renew`, `/me/payment/retry`, `/me/pay-balance` and `DELETE /me` (cancel, may return a `settlement`) all surface exactly as mobile does, including exit-debt banners.

### 7.5 Billing & invoices
`/billing` table of invoices (number, period, amount, status) → detail pane → `GET /invoices/me/{id}/pdf` rendered in-browser (blob + `<embed>`/pdfjs) with download. Outstanding-debt and failed-payment banners are persistent, not toasts, because they block value.

### 7.6 Shop
`/shop` category filter rail + product grid with search and price sort; product drawer for details; `/cart` as a persistent drawer on desktop, page on mobile; `/checkout` multi-step (address → review → payment redirect). Server cart (`GET /store-orders/cart`) is authoritative — subtotal comes from the server, never recomputed client-side. Address book management at `/account/addresses`.

### 7.7 Account, notifications, support
`/account` tabbed: profile, email, login security (change email/password, OTP), notification settings, bin inventory (editable quantity table, `PUT /api/customer/me/bins` replace-all), business name when `requiresEntityName`.
`/notifications` list with read/read-all and unread badge in the top bar; **FCM web push** via `POST /notifications/device-tokens` after service-worker permission grant, and `DELETE` on sign-out.
`/support` ticket list + creation dialog + thread view with replies and status filter.

---

## 8. Endpoint Inventory (derived from `lib/services/*.dart`)

**Root A — `…/api`**
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/customer/sign-up` | Registration |
| PATCH | `/api/customer/me` | Update profile (`entityName`) |
| GET | `/api/customer/types` | Customer types (+`pricingMode`) |
| PUT | `/api/customer/me/bins` | Replace bin inventory |
| GET | `/api/zone/public/list` | Active zones |
| GET | `/api/rates/capacity` | Bin capacity tiers |
| GET | `/api/rates/truck-loads` | Truck-load tiers |
| POST | `/api/location/` | Save location |
| GET | `/api/user/profile` | Profile w/ location |
| GET | `/api/activity-logs/me` | Activity log |
| GET | `/api/notifications/customer/` | Notifications |
| PATCH | `/api/notifications/customer/{id}/read` | Mark read |
| PATCH | `/api/notifications/customer/read-all` | Mark all read |
| POST | `/api/notifications/device-tokens` | Register web push token |
| DELETE | `/api/notifications/device-tokens` | Unregister on sign-out |

**Root B — `…/api/auth`**
`POST /sign-in/email` · `POST /sign-out` · `GET /get-session` · `POST /change-email` · `POST /change-password` · `POST /email-otp/send-verification-otp` · `POST /email-otp/check-verification-otp` · `POST /email-otp/verify-email` · `POST /email-otp/request-password-reset` · `POST /email-otp/reset-password`

**Root C — `…/api/pickup-requests`**
`GET /` · `GET /{id}` · `POST /` · `PATCH /{id}` (reschedule) · `DELETE /{id}` (cancel) · `GET /price-preview` · `GET /emergency-fee`

**Root D — `…/api/subscription`**
`GET /options` · `POST /subscribe-calculated` · `GET /me` · `DELETE /me` · `POST /me/renew` · `POST /me/payment/retry` · `POST /me/pay-balance`

**Root E — `…/api/invoices`**
`GET /me/` · `GET /me/{id}` · `GET /me/{id}/pdf`

**Root F — `…/api/disposable`**
`GET /item-types/active?customerTypeId=` · `GET /quantities/active?customerTypeId=`

**Root G — `…/api/support`**
`GET /customer/tickets` · `POST /customer/tickets` · `GET /customer/tickets/{id}` · `POST /customer/tickets/{id}/messages`

**Root H — `…/api/store*`**
`GET /store/customer/categories` · `GET /store/customer/products` · `GET /store/customer/products/{id}` · `GET /store-orders/delivery-fees` · `GET /store-orders/cart` · `POST /store-orders/cart/items` · `PATCH /store-orders/cart/items/{itemId}` · `DELETE /store-orders/cart/items/{itemId}` · `DELETE /store-orders/cart/` · `GET|POST /store-orders/addresses/` · `POST /store-orders/orders/checkout` · `GET /store-orders/orders/me` · `GET /store-orders/orders/{id}` · `POST /store-orders/orders/{id}/cancel` · `GET /store-orders/orders/me/{id}/invoice/pdf`

**External:** TomTom Search/Geocode/Reverse + raster tiles; OSM Nominatim fallback; MoMo provider redirect.

---

## 9. Delivery Sequence (parity at launch, internal preview throughout)

| # | Milestone | Ships |
|---|---|---|
| M1 | Repo, Next.js scaffold, design tokens, CI, shell + sidebar/rail | Internal only |
| M2 | API client, auth, session guard, resilient parsing, `prune` rule | Internal |
| M3 | Dashboard + booking flow incl. **pricing-mode branching** + bins | Internal preview |
| M4 | Pickup list/detail + SSE live tracking + TomTom map | Internal |
| M5 | Subscription matrix + MoMo redirect + return/poll | Internal |
| M6 | Billing/invoices + PDF | Internal |
| M7 | Shop, cart, checkout (redirect) | Internal |
| M8 | Account settings, notifications + FCM web push, support | Internal |
| M9 | Hardening: a11y audit, responsive QA at 3 breakpoints, Playwright E2E, load | — |
| M10 | **Public launch, full parity** | Production |

M1–M4 are the risky core; M5–M8 can parallelize once the payment-redirect contract is proven in M5.

---

## 10. Testing Strategy

- **Unit (Vitest):** API client (header/timeout/error mapping), 401 guard including the anonymous-endpoint exemption, Zod parsing resilience (number-as-string, missing fields, one malformed row), `pruneUndefined`, session bootstrap semantics, bin-signal merge (§6.6).
- **Contract tests:** request bodies asserted against §7.3/§8 (guards the 422 class and the create-pickup payload).
- **Component (Testing Library):** forms, tier picker, bin table, cart drawer, dialogs (focus trap, `Esc`).
- **E2E (Playwright)** at 375 / 1024 / 1440: sign-in → book → (truck: pick tier) → confirm; subscribe → MoMo redirect → return → paid; shop add-to-cart → checkout; invoice download; live tracking status transitions.
- **A11y:** axe in CI on every route; keyboard-only walkthrough of booking and checkout.

---

## 11. Risks & Assumptions

| Item | Type | Handling |
|---|---|---|
| MoMo redirect return params not yet documented | **Assumption** | Confirm actual query shape / signature check before M5; spec assumes `?status=` |
| Bearer token in `localStorage` is XSS-exposed | Accepted risk v1 | Document `httpOnly` cookie upgrade as a backend follow-up |
| Pricing-mode rules silently differ from mobile | High | §7.3 is normative for both; contract tests mirror mobile's tests |
| Server-cart subtotal drift | Medium | Never recompute client-side |
| CORS / TomTom referrer / FCM web cert | External, confirmed | Re-verify at M1 with the actual deployed origin |
| SSE connection limits per origin under many tabs | Low–Med | Single shared `EventSource` per tracked pickup; reconnect with backoff |
| Contract drift between mobile and web | Medium | Open item in §3 (drift policy undecided) |

---

## 12. Open Items (not blocking spec approval)

1. **Contract drift policy** — who updates the web's contract docs when mobile ships a feature (§3).
2. **`httpOnly` cookie migration** — schedule with the backend team post-launch.
3. **Marketing/landing pages on the same Next.js app** vs a separate site — v1 assumes same app, SSR public routes + CSR app routes.
