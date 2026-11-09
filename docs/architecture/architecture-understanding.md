# La Carte Web — Architecture Understanding

**Scope:** full current-state analysis of `lacarte-webv` (27 pages, ~12.5k lines).
**Date:** 2026-11-08 · **Branch:** `main` @ `53863ba`
**Method:** `architecture-visualization:explore` → `system-modeler` (primary) + `flow-visualizer` + `dependency-impact-analyzer`, with the Business Application Fitness reference applied. Diagram sources: `c4model` (Structurizr DSL) and `graphviz` (DOT).
**State:** current-state only. No target-state or runtime telemetry was available.

---

## 1. Executive summary

La Carte Web is the **customer-facing portal for a Ghanaian subscription waste-collection service** (currency GHS throughout — [src/lib/currency.ts:5](../../src/lib/currency.ts#L5), default country `'Ghana'` — [src/types/models.ts:294](../../src/types/models.ts#L294)). Customers book trash pickups, manage a per-bin or full-truck subscription, buy supplies from a shop, pay by Mobile Money, read invoices, and raise support tickets. It is the web sibling of a Flutter mobile app ([2026-11-04-lacarte-web-design.md](../../2026-11-04-lacarte-web-design.md) §1 D1).

**The single most important architectural fact:** this repository contains **no server-side application code at all**. Verified counts:

| Check | Result |
|---|---|
| `page.tsx` files | 27 — **all** `'use client'` |
| `layout.tsx` files | 2 — only [src/app/layout.tsx](../../src/app/layout.tsx) is a server component (fonts + metadata) |
| Files with `'use client'` | 32 |
| `route.ts` / `route.tsx` handlers | **0** |
| `"use server"` actions | **0** |
| `middleware.ts` | **0** |
| `loading.tsx` / `error.tsx` / `not-found.tsx` | **0** |

The only server behaviour is a **single catch-all rewrite** in [next.config.ts:7-14](../../next.config.ts#L7) forwarding `/api/:path*` to `LACARTE_API_BASE_URL`, which **defaults to the production backend** `https://lacarteprod.lazynerdstudios.com` ([next.config.ts:4](../../next.config.ts#L4)). The proxy exists because the backend sends no CORS headers ([src/lib/config.ts:1-7](../../src/lib/config.ts#L1)).

**Consequence:** every business outcome — account creation, pricing, charging a phone, reserving stock, assigning a truck, transitioning a subscription — happens in a system that is **not in this repo and cannot be verified from it**. This report therefore separates *confirmed client behaviour* from *unknown server effects* throughout, and the diagrams preserve that distinction (amber dashed nodes).

**Second most important fact:** the two specification documents **contradict each other on the security model**, and the code implements neither cleanly. See §7.

### Health snapshot (actually executed, not assumed)

| Gate | Command | Result |
|---|---|---|
| Types | `npm run typecheck` | **PASS** (exit 0, `strict: true`) |
| Tests | `npm test` | **PASS** — 53 tests / 8 files, 7.99s |
| Build | `npm run build` | **PASS** — 28 routes, 103 kB shared First Load JS, max 140 kB (`/dashboard`) |
| Lint | `npm run lint` | **BROKEN** — script is `next lint`, no ESLint config file exists |
| CI | — | **absent** (no `.github/`) |

Bundle size is comfortably inside the spec's <300 kB gz budget ([frontend-web-customer-portal-spec.md](../../frontend-web-customer-portal-spec.md) §10). Type safety is genuinely good: **zero `any`** in non-test source.

---

## 2. Top-level limitations (read these before trusting any flow)

1. **Checkout, payment and pickup lifecycle are structurally outlined but behaviourally unconfirmed.** There is no payment SDK in [package.json](../../package.json), no callback handler, no integration test. `paymentMethod` defaults to `'blupay'` at [src/lib/services/api-services.ts:697](../../src/lib/services/api-services.ts#L697) and the only caller ([checkout/page.tsx:159](../../src/app/%28app%29/checkout/page.tsx#L159)) never overrides it. `'blupay'` appears in **neither** spec document. Whether a phone is actually charged is a backend question.
2. **The spec's core security property is absent.** The spec mandates an httpOnly `lc_token` cookie minted by route handlers so the "token never reaches JS" (spec D4/§2.2/§10). Implemented instead: a **localStorage** bearer token `lacarte_bearer_token` ([src/lib/api-client.ts:39-54](../../src/lib/api-client.ts#L39)) injected client-side ([:93-95](../../src/lib/api-client.ts#L93)). The design doc §6.2 accepts this XSS risk; the spec forbids it. The code follows the design doc, not the spec.
3. **No agent-instruction file and no README.** No `AGENTS.md`, `CLAUDE.md`, `QODER.md`, `README.md`. An AI agent working here has the two spec docs but no statement of which one is authoritative, no regression-path list, and no domain rules beyond what it can reverse-engineer.
4. **The default backend is production.** A fresh `npm run dev` with no `.env.local` silently talks to `lacarteprod.lazynerdstudios.com`. There is no staging default and no guard.
5. **Repo maturity is prototype-grade.** Two commits: `e0baff0` is a single ~21.5k-line / 74-file initial dump; `53863ba` ("upd") changes one `.gitignore` line and adds a 118 kB build artifact. No incremental history to bisect.

---

## 3. L0 — Business capabilities

| Capability | Customer job | Where it lives |
|---|---|---|
| Identity & onboarding | Register, verify email by OTP, set service location, reset password | `src/app/(auth)/*`, `AuthService`, `CustomerService` |
| Pickup booking | Request a one-off or subscription collection; choose waste type, date, emergency | `pickups/new`, `PickupService` |
| Live collection tracking | See the assigned truck move and get an ETA | `pickups/[id]/track`, `dashboard`, `tracking-sse`, `map-service` |
| Subscription management | Quote a plan, subscribe, pay balance, retry, renew, cancel with settlement | `subscription`, `SubscriptionService`, `pricing-mode` |
| Bin inventory | Declare how many bins of each capacity the account holds | `account/bins`, `bin-inventory` |
| Billing | List invoices, view detail, download PDF | `billing`, `billing/[id]` |
| Supplies commerce | Browse catalog, cart, checkout by MoMo, order history, cancel | `shop`, `cart`, `checkout`, `orders`, `StoreService` |
| Support | Raise and reply to tickets by category/priority | `support`, `support/[id]`, `SupportService` |
| Notifications & audit | In-app notifications, unread badge, activity log | `notifications`, `account/activity` |

**Actors:** customers only. Admin/staff are explicitly out of scope (design §2). No role/permission enforcement exists client-side beyond `AppUser.role` and `banned` being parsed ([src/types/models.ts:17-53](../../src/types/models.ts#L17)) and a `USER_BANNED` modal on sign-in. **No tenancy/workspace/organization concept appears anywhere** — do not infer one.

---

## 4. L1/L2 — System context and containers

See [lacarte-web.structurizr.dsl](lacarte-web.structurizr.dsl) — open with Qoder's Structurizr DSL viewer. Views: `L1_SystemContext`, `L2_Containers`, `L3_Components`.

**Confirmed external dependencies**

| System | How it is reached | Evidence |
|---|---|---|
| La Carte Backend API | Same-origin `/api/*` → Next rewrite → `https://lacarteprod.lazynerdstudios.com` | [next.config.ts:4-14](../../next.config.ts#L4) |
| TomTom | **Direct from browser**, public key `NEXT_PUBLIC_TOMTOM_API_KEY`; tiles, search, reverse geocode, routing v1 | [src/lib/config.ts:21-30](../../src/lib/config.ts#L21), [map-service.ts:80-91](../../src/lib/services/map-service.ts#L80) |
| OpenStreetMap / Nominatim | Fallback when no TomTom key | [config.ts:30](../../src/lib/config.ts#L30), [map-service.ts:111-118](../../src/lib/services/map-service.ts#L111) |
| Mobile Money ("blupay") | **Inferred** — hardcoded payment method + client polling; no SDK, no callback | [api-services.ts:697](../../src/lib/services/api-services.ts#L697) |
| Flutter mobile app | Documented sibling client sharing the backend; not in repo | design §1 D1 |

**Trust boundary:** the browser holds the bearer token and calls TomTom directly. The Next server adds **no** authentication, headers, or CSP — it is a transparent forwarder. Everything sensitive is client-side.

---

## 5. L3 — Module structure

See [module-dependencies.dot](module-dependencies.dot) for the dependency + coverage graph.

| Layer | Path | Lines | Tests | Notes |
|---|---|---:|---:|---|
| Routes/UI | `src/app` | 6,799 | 0 | 27 client pages; all data via services |
| Components | `src/components` | 737 | 0 | `app-shell`, `ui/common` (3 primitives), `map/interactive-map` |
| Providers/state | `src/providers` | 769 | 0 | QueryClient + 3 contexts; the riskiest file in the repo |
| Lib (incl. tests) | `src/lib` | 2,809 | 749 | services, transport, domain rules, parsing |
| Types/DTOs | `src/types` | 1,399 | 0 | every entity has a defensive `parse*` |

**Layering is clean and strictly one-directional:** pages → services → api-client → config; pages/providers → domain rules → models → json-parse. No cycles found. Domain rules are pure functions, which is why they are the only well-tested part.

### State management

[src/providers/app-providers.tsx](../../src/providers/app-providers.tsx) sets up `QueryClientProvider` (retry 1, no refetch-on-focus, [:750-768](../../src/providers/app-providers.tsx#L750)) plus three contexts: **UIFeedback** (toasts + status modal), **Auth**, **Cart**.

- Server data: TanStack Query `useQuery` per page.
- Mutations: **plain async service calls + `invalidateQueries`** — `useMutation` is not used anywhere. No optimistic updates, no rollback.
- **Cart is server-backed, not localStorage.** `refreshCart` → `StoreService.getCart` on auth ([:426-445](../../src/providers/app-providers.tsx#L426)); writes go through a serialized `createCartMutationController` ([:190](../../src/providers/app-providers.tsx#L190), [:405-423](../../src/providers/app-providers.tsx#L405)). It survives reload, and is cleared on logout/401 ([:210](../../src/providers/app-providers.tsx#L210)).
- Neither spec's prescribed stack was used: **no Zustand** (Context instead), **no Zod** (hand-rolled guards), **no MapLibre GL** (Leaflet), **no shadcn/Radix**, **no react-hook-form**, **no Firebase/next-pwa**.

---

## 6. Domain model, business rules and lifecycle states

### 6.1 Entities ([src/types/models.ts](../../src/types/models.ts))

`AppUser`/`AppSession` → `CustomerProfile` (bins, location, customerType, zone, subscriptionInfo) → `PickupRequestResponse`, `ActiveSubscription`, `Invoice`, `StoreOrder`, `SupportTicket`, `AppNotification`, `ActivityLogItem`. Supporting: `Zone`, `CustomerType`, `CustomerBin`, `CapacityRate`, `TruckLoadRate`, `SubscriptionPlan`, `CalculatedQuote`, `CancelSettlement`, `StoreProduct`, `StoreCart`, `DeliveryFee`, `StoreAddress`.

**Pricing is a two-axis model** ([models.ts:91-121](../../src/types/models.ts#L91)): `pricingMode: 'per_bin' | 'full_truck'` × `paymentType: 'pay_as_you_go' | 'subscription'` ([models.ts:508-509](../../src/types/models.ts#L508)), with prepaid/postpaid on top ([subscription-display.ts:1-10](../../src/lib/domain/subscription-display.ts#L1)).

### 6.2 Confirmed lifecycle enums (client-side)

| Entity | States | Evidence |
|---|---|---|
| Pickup | `pending · assigned · scheduled · en_route · truck_dispatched · completed · cancelled · expired` | [pickup-display.ts:7-15](../../src/lib/domain/pickup-display.ts#L7) |
| Active subscription | `active · cancelled · expired` | [models.ts:722-724](../../src/types/models.ts#L722) |
| Subscription payment | `pending · paid · failed` | [models.ts:629-631](../../src/types/models.ts#L629) |
| Support category | `missed_pickup · billing · service_request · equipment_issue · schedule_change · other` | [models.ts:1257-1263](../../src/types/models.ts#L1257) |
| Support priority | `low · medium · high · urgent` | [models.ts:1265](../../src/types/models.ts#L1265) |
| **Invoice** `type`/`status` | **plain `string` — no enum anywhere** | [models.ts:855-958](../../src/types/models.ts#L855) |
| **Store order** `paymentStatus`/`deliveryStatus` | **plain `string` — no enum anywhere** | [models.ts:1147-1253](../../src/types/models.ts#L1147) |

The last two rows are a real gap: the checkout polling loop and the billing UI branch on status strings whose valid values are **not defined in this repo**. That is an unvalidatable contract.

### 6.3 Business rules actually implemented client-side

- **Pickup action matrix** ([pickup-display.ts:41-58](../../src/lib/domain/pickup-display.ts#L41)): `pending` → reschedule + cancel; `assigned`/`scheduled` → cancel; `en_route`/`truck_dispatched` → track; terminal states → disabled. `pay` shows whenever `requiresPayment`, independent of status ([:34](../../src/lib/domain/pickup-display.ts#L34)). **Reschedule is allowed only for `pending`** ([:65-67](../../src/lib/domain/pickup-display.ts#L65)), window = tomorrow … tomorrow+29 days ([:69-78](../../src/lib/domain/pickup-display.ts#L69)).
- **Delivery fee** ([delivery-fee.ts:19-38](../../src/lib/domain/delivery-fee.ts#L19)): state precedence `empty → loading → error → unavailable → ready`; free iff `freeDeliveryMinQuantity !== null && totalCount >= freeDeliveryMinQuantity`. **The fee amount is backend-supplied** — there is no client-side fee formula.
- **Payment polling** ([payment-state.ts:16-29](../../src/lib/domain/payment-state.ts#L16)): pickup list polls every **10 s** only while some pickup `requiresPayment`; subscription polling is "confirmed" when `isActive && payment.isPaid`, or (no subscription) `!hasDebt`.
- **Pricing mode** ([pricing-mode.ts:13-50](../../src/lib/domain/pricing-mode.ts#L13)): truck presentation requires `pricingMode === 'full_truck' && truckLoadRates.length > 0`, else degrades to per-bin; default tier = first API-delivered rate; add-bins CTA hidden for all full-truck accounts. `resolveHasBins` is tri-state (`null` while loading).
- **Bin inventory** ([bin-inventory.ts:10-44](../../src/lib/domain/bin-inventory.ts#L10)): merge by `capacityRateId`; replace-all payload keeps only `quantity > 0`, and **preserves saved bins on now-inactive rates**. No max-quantity validation.
- **Cart ordering** ([cart-mutation-controller.ts:7-38](../../src/lib/domain/cart-mutation-controller.ts#L7)): serialized promise queue + generation counter; a mutation resolves `'stale'` if the generation changed before execution or before the response landed; errors resolve `{status:'failed'}` rather than rejecting. This is a genuinely well-designed piece of concurrency control.

**All money arithmetic (rate × bins, emergency fee, totals, quotes) is server-side.** The client only parses `PricePreview` ([models.ts:412-445](../../src/types/models.ts#L412)).

### 6.4 Data ownership and transactional boundaries

| Data | Owner | Client persistence |
|---|---|---|
| Bearer token | Browser | `localStorage['lacarte_bearer_token']` |
| Cart | **Backend**, per account | none (React context mirror) |
| Pickup / subscription / order / invoice state | **Backend** | TanStack Query cache only |
| Profile, bins, location | Backend | context mirror |
| Notifications | Backend | query cache |

**There are no client-side transactional boundaries and no migrations, schema, ORM, audit table or soft-delete in this repo.** `ActivityLogService` reads an audit log the backend owns ([api-services.ts:851-866](../../src/lib/services/api-services.ts#L851)). Retention and sensitivity policy: **unknown**.

---

## 7. Specification vs implementation

The two docs disagree, and the code is a hybrid. This is the highest-value finding for anyone planning work here.

| Topic | design doc (2026-11-04) | spec doc | **Implemented** |
|---|---|---|---|
| Token | localStorage bearer, XSS risk accepted (§6.2) | httpOnly `lc_token` cookie via route handlers, "token never reaches JS" (D4/§2.2/§10) | **localStorage bearer** — design doc wins |
| Validation | Zod | Zod | **hand-rolled `asStr/asInt/asDouble`** ([json-parse.ts:10-45](../../src/lib/json-parse.ts#L10)) |
| Client state | Zustand | Zustand | **React Context** |
| Map | MapLibre GL | MapLibre GL | **Leaflet 1.9** |
| API timeout | — | 10 s (§2.2) | **12 s** (15 s blob) ([api-client.ts:75](../../src/lib/api-client.ts#L75)) |
| Payload pruning | shared `pruneUndefined` (§6.4) | — | **inline per-method** ([api-services.ts:674-676](../../src/lib/services/api-services.ts#L674)) |
| Accessibility | WCAG **2.2** AA (§5.3) | WCAG **2.1** AA (§10) | neither met — see §9 |
| Payment | MoMo **redirect-and-poll**, redirect contract explicitly unconfirmed (§7.4/§11) | — | **poll-only**, `paymentMethod:'blupay'`, no redirect |
| SSE | — | warns the rewrite may buffer (§6) | **plain rewrite, no passthrough handler** — risk unresolved |
| E2E tests | mandated | mandated | **none**; no Playwright installed |
| Deploy target | — | left open (§12.5) | no Dockerfile / vercel.json / CI |

Also: the spec's OpenAPI source `api-1.json` (249 paths) was declared untrustworthy for codegen (spec §5.2) — which explains the hand-written DTO layer, and means **there is no machine-checkable API contract in this repo**.

---

## 8. Business Application Fitness

| Dimension | Assessment | Evidence |
|---|---|---|
| **Business model clarity** | **Good.** Two-axis pricing, PAYG vs subscriber, prepaid/postpaid, bin/truck rates, settlement debt are all explicitly modelled and unit-tested. | `models.ts`, `src/lib/domain/*` + 39 tests |
| **Data & state understanding** | **Partial.** Pickup/subscription/support enums are explicit; **invoice and store-order statuses are unenumerated strings**. No schema, migrations, audit ownership, retention or soft-delete evidence. | [models.ts:855-958](../../src/types/models.ts#L855), [:1147-1253](../../src/types/models.ts#L1147) |
| **End-to-end path grounding** | **Weak at the outcome end.** UI trigger → request payload → polling is fully confirmed; **persistence, charging, stock reservation and state transition are not**. No integration or E2E test closes the loop. | §2, §6.4 |
| **Agent instruction use** | **Absent.** No `AGENTS.md`/`CLAUDE.md`/`QODER.md`/`README`. Two contradictory specs with no statement of precedence. An agent cannot know the security model is contested. | verified by directory listing |
| **Business validation readiness** | **Narrow but real.** 53 passing tests, all on pure domain logic + transport + payload shapes. **Zero** coverage of the 769-line provider, checkout, subscription mutations, SSE, maps, PDF download, or any component. `@testing-library/*` installed but unused. | `npm test` output; §9 |

**Verdict:** an agent can safely change *display rules and DTO parsing* here. It **cannot** safely change auth, cart concurrency, checkout, or subscription payment flows without backend contract evidence and integration tests that do not exist.

---

## 9. Risk register (prioritized, evidence-backed)

### P0 — security / correctness

| # | Risk | Evidence | Impact |
|---|---|---|---|
| R1 | **Bearer token in localStorage** — readable by any XSS; no httpOnly cookie, no CSP, no `middleware.ts` | [api-client.ts:39-54](../../src/lib/api-client.ts#L39), [next.config.ts](../../next.config.ts) (no `headers()`) | Full account takeover via any script injection. Directly violates spec D4. |
| R2 | **Optimistic offline authentication** — any non-401 error with a stored token sets `status='authenticated'` | [app-providers.tsx:260-269](../../src/providers/app-providers.tsx#L260) | A 500 or network blip renders the authenticated shell with `user=null, profile=null`. Combined with the client-only guard ([app/(app)/layout.tsx:13-25](../../src/app/%28app%29/layout.tsx#L13)) this is the *only* access control in the app. |
| R3 | **Image optimizer open to any host** — `remotePatterns` allows `hostname: '**'` for both http and https | [next.config.ts:15-26](../../next.config.ts#L15) | SSRF / image-optimizer abuse against arbitrary internal and external hosts. |
| R4 | **Production backend is the default** with no env guard | [next.config.ts:4](../../next.config.ts#L4) | Local dev and CI write to live customer data. |
| R5 | **Unenumerated order/invoice status strings** drive the checkout polling loop and billing UI | [models.ts:1147-1253](../../src/types/models.ts#L1147), [checkout/page.tsx:73-107](../../src/app/(app)/checkout/page.tsx#L73) | A backend enum change silently breaks payment confirmation; no test can catch it. |

### P1 — confirmed functional bugs

| # | Bug | Evidence |
|---|---|---|
| R6 | **Notification badge never refreshes.** Shell reads query key `['notifications', 1]`; the page invalidates `['notifications-unread-count']` (matches nothing) and refetches `['notifications']` (a different key). Badge stays stale for the 60 s `staleTime` or until remount. | [app-shell.tsx:70-76](../../src/components/layout/app-shell.tsx#L70) vs [notifications/page.tsx:18,31,41](../../src/app/(app)/notifications/page.tsx#L31) |
| R7 | **Shop pagination is dead.** `setPage` is only ever called with `1` (filter resets at lines 125, 141, 161) — `page` can never reach 2, so only the first 20 products are ever reachable. Search/category then filter just that loaded page. | [shop/page.tsx:34,42-43,47-49,125,141,161](../../src/app/(app)/shop/page.tsx#L34) |
| R8 | **Pickup address field is cosmetic.** Typed address/coordinates are deliberately never sent; user edits are silently discarded. | [pickups/new/page.tsx:43-49,228-229](../../src/app/(app)/pickups/new/page.tsx#L43) |
| R9 | **Delivery fee matched by zone *name* string equality**, falling back to the first rule. A rename or missing match silently charges the wrong fee. | [app-providers.tsx:449-466](../../src/providers/app-providers.tsx#L449) |
| R10 | **`displayOrder` parsed but never sorted on** — truck tier order depends on API response order. | [pricing-mode.ts:42-45](../../src/lib/domain/pricing-mode.ts#L42) |
| R11 | **SSE has no heartbeat timeout**; a stalled stream hangs silently. It also traverses a plain Next rewrite, which the spec §6 flags as a buffering risk. | [tracking-sse.ts:23-156](../../src/lib/services/tracking-sse.ts#L23), [next.config.ts:7-14](../../next.config.ts#L7) |
| R12 | **`npm run lint` cannot work** — `next lint` with no ESLint config file, despite `eslint@9` + `eslint-config-next` installed. 4 `eslint-disable` comments reference rules that are never evaluated. | [package.json:9](../../package.json#L9); verified no config exists |
| R13 | **No error boundaries** — zero `error.tsx` / `global-error.tsx` / `not-found.tsx`. Any render throw blanks the route. | verified by `find` |
| R14 | **`tsconfig.tsbuildinfo` (118 kB) is tracked in git**, and `.gitignore:11` reads `.tsbuildinfo`, which does **not** match `tsconfig.tsbuildinfo`. The pattern needs to be `*.tsbuildinfo` *and* the file needs `git rm --cached`. | `git ls-files -s tsconfig.tsbuildinfo` → tracked; `git show HEAD -- .gitignore` |

### P2 — silent failure / masking defaults

- `json-parse.ts` **skips malformed rows with only `console.warn`** ([:105-109](../../src/lib/json-parse.ts#L105)) → silent partial lists; bad dates fall back to **epoch 1970** ([:64-66](../../src/lib/json-parse.ts#L64)).
- Missing product stock **defaults to 10** ([models.ts:1006](../../src/types/models.ts#L1006)), which feeds `isAvailable` ([:1016](../../src/types/models.ts#L1016)) — an absent field makes a product look purchasable.
- Capacity litres extracted by **regex first-digits** ([models.ts:163-164](../../src/types/models.ts#L163)).
- HTTP **500 discards the server message** and substitutes a hardcoded string ([api-client.ts:161-167](../../src/lib/api-client.ts#L161)); blob errors never parse the body ([:217-222](../../src/lib/api-client.ts#L217)).
- Emergency-fee failure → `null` ([:377-391](../../src/lib/services/api-services.ts#L377), documented as intentional); map/routing failures → empty results ([map-service.ts:144-146,232-234,276-278](../../src/lib/services/map-service.ts#L144)).
- `apiRequestBlob` fires the 401 guard **unconditionally**, with no `triggerUnauthorizedGuard` opt-out ([:213-216](../../src/lib/api-client.ts#L213)) — and is entirely untested.
- Order detail renders **"Delivery: Paid separately" unconditionally** ([orders/[id]/page.tsx:177-179](../../src/app/(app)/orders/[id]/page.tsx#L177)); invoice payment method falls back to `'Mobile Money'` ([billing/[id]/page.tsx:128](../../src/app/(app)/billing/[id]/page.tsx#L128)).

### P2 — design system / accessibility

- **No design system.** [globals.css](../../src/app/globals.css) is 14 lines (Tailwind import + font var). All styling is inline Tailwind with hardcoded hex, and there are **two conflicting brand palettes**: amber `#FFB400` / ink `#0A0D12` in the shell and providers vs green `#307224` / `#1B4332` in every page. `ui/common.tsx` has only 3 components — no button/input/card primitives.
- **WCAG not met** (either version): labels lack `htmlFor`/nesting throughout; password toggles and the toast close button lack `aria-label`; modals and the cart drawer have no `role="dialog"`, focus trap, or Escape handling; emoji used as map markers and modal icons.
- Native `window.confirm` in 3 places despite a custom modal system existing ([orders/[id]:58](../../src/app/(app)/orders/[id]/page.tsx#L58), [pickups/[id]:118](../../src/app/(app)/pickups/[id]/page.tsx#L118), [subscription:267](../../src/app/(app)/subscription/page.tsx#L267)).
- Raw `<img>` with `eslint-disable` instead of `next/image` (4 occurrences).

### P3 — dead code / hygiene

- `CANCELLABLE` set is unused; the switch duplicates it ([pickup-display.ts:17](../../src/lib/domain/pickup-display.ts#L17)).
- Nav filter for `/account/bins` can never fire — that href is not in `DESKTOP_NAV` ([app-shell.tsx:126-131](../../src/components/layout/app-shell.tsx#L126) vs [:29-36](../../src/components/layout/app-shell.tsx#L29)).
- `@tanstack/react-table` is in **devDependencies** ([package.json:27](../../package.json#L27)) and appears unused.
- `payload.test.ts` has no `payload.ts` — it tests `api-services` request bodies. Not orphaned, but misleadingly named.
- `cart-mutation-controller.test.ts` uses **real 10–20 ms timers**, not fake timers — timing-sensitive/flaky.
- `payment-state.test.ts:76` uses `as never` to bypass types.

---

## 10. Test coverage map

**53 tests, 8 files, 749 lines — all under `src/lib`.**

| File | Cases | Covers |
|---|---:|---|
| `domain/pricing-mode.test.ts` | 15 | tier equality, truck→per-bin degradation, 3×2 matrix, CTA suppression, tri-state bins |
| `domain/payment-state.test.ts` | 9 | failed-badge priority, 10 s poll gate, subscription/debt confirmation |
| `api-client.test.ts` | 8 | URL resolution, bearer injection, selective 401 teardown, offline mapping |
| `services/payload.test.ts` | 6 | optional-key omission in real service request bodies |
| `domain/delivery-fee.test.ts` | 5 | never "free" while loading/error/no-rule; threshold gate |
| `domain/bin-inventory.test.ts` | 4 | replace-all payload, retired-rate preservation |
| `domain/cart-mutation-controller.test.ts` | 3 | in-order application, failure isolation, stale discard |
| `domain/subscription-display.test.ts` | 3 | `planType` precedence |

**Notable uncovered paths:** `app-providers.tsx` (769 lines — session bootstrap, auth, cart, delivery-fee matching); ~95% of `api-services.ts` (checkout, renew/retry/pay-balance, sign-up); `apiRequestBlob` entirely; the real timeout branch (the test's fake `AbortError` is a plain `Error`, so it falls through to the generic catch — [api-client.ts:177](../../src/lib/api-client.ts#L177)); `json-parse.ts`; `pickup-display.ts`; `tracking-sse.ts`; `map-service.ts`; delivery-fee boundaries (below threshold, `hasZone:false`, empty cart). **Zero component, integration, or E2E tests.** No coverage configuration, no Vitest setup file (`jest-dom` installed but unused).

---

## 11. Unknowns and validation tasks

| Unknown | Why it matters | How to validate |
|---|---|---|
| Does `blupay` actually charge the phone? What is the callback contract? | The entire revenue path | Backend source or a sandbox integration test; obtain the payment API contract |
| Valid values of invoice `status`/`type` and order `paymentStatus`/`deliveryStatus` | Checkout polling and billing UI branch on them | Backend enum/OpenAPI; then encode as a union type + contract test |
| Does the Next rewrite buffer the SSE stream? | Live tracking may silently stall in production | Deploy and observe `text/event-stream` chunk timing through the proxy |
| Which spec is authoritative — design doc or spec doc? | Determines whether R1 is a bug or an accepted risk | Product/security decision, then write `AGENTS.md` recording it |
| Server-side pricing, quota, emergency-fee and settlement rules | Client only displays them | Backend source or contract tests |
| Tenancy / role enforcement | `AppUser.role` and `banned` are parsed but never enforced client-side | Backend authorization evidence |
| Deployment target, env management, secret rotation | No CI, no Dockerfile, no deploy config; TomTom key is public by design | Decide host; add CI + `.env` policy |
| Data retention / audit ownership / PII handling | Location + phone numbers are collected | Backend policy; privacy review |

---

## 12. Recommended next actions (in order)

1. **Decide the auth model** (R1/R2). Either implement the spec's httpOnly-cookie route handlers, or formally record the design doc's accepted-risk decision. Remove the optimistic offline-auth fallback either way.
2. **Lock down `next.config.ts`** (R3/R4): restrict `images.remotePatterns` to the actual backend/CDN hosts; make a missing `LACARTE_API_BASE_URL` fail loudly rather than defaulting to production.
3. **Add `AGENTS.md` + `README.md`** stating which spec wins, the domain rules in §6.3, and the regression paths in §9. This is the cheapest large gain for future agent work.
4. **Fix the four confirmed functional bugs** R6–R9 (notification key, shop pagination, cosmetic address field, zone-name fee matching) — each is small and independently testable.
5. **Repair the tooling floor**: add an ESLint flat config so `npm run lint` runs; add `error.tsx` + `not-found.tsx`; untrack `tsconfig.tsbuildinfo` and fix the ignore glob (R12–R14); add CI running typecheck + test + build + lint.
6. **Close the contract gap**: enumerate invoice/order statuses, add a Vitest setup file, and write integration tests for checkout and subscription payment against a sandbox backend.
7. **Then** address the design-system split (two palettes) and the accessibility debt — both are currently spec violations, not cosmetic preferences.

---

## 13. Artifact index

| File | Answers | Format |
|---|---|---|
| [architecture-understanding.md](architecture-understanding.md) | Everything above — primary report | Markdown |
| [lacarte-web.structurizr.dsl](lacarte-web.structurizr.dsl) | L1 context, L2 containers, L3 components | Structurizr DSL (`c4model`) — open in Qoder's DSL viewer |
| [business-flows.dot](business-flows.dot) | The three critical business paths, with unknown server effects marked | Graphviz DOT (`flow-visualizer` + `graphviz`) |
| [module-dependencies.dot](module-dependencies.dot) | Module dependencies + where tests do and don't exist | Graphviz DOT (`dependency-impact-analyzer` + `graphviz`) |

**Maintenance note:** regenerate from code, not by hand-editing renders. Graphviz is **not installed** on this machine (`dot: command not found`), so the `.dot` files were syntax-reviewed but not rendered — open them in Qoder's DOT viewer to inspect. All `file:line` citations were verified against the working tree at `53863ba`; they will drift as the code changes.