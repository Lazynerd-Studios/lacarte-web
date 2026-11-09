/*
 * La Carte Customer Web Portal — current-state C4 model (L1 context, L2 containers, L3 components).
 * Generated 2026-11-08 by architecture-visualization:system-modeler + c4model.
 * Evidence: docs/architecture/architecture-understanding.md (file:line citations).
 * Open with Qoder's Structurizr DSL viewer.
 *
 * Confidence is carried in tags + descriptions:
 *   Confirmed = direct code/config evidence in this repo.
 *   External  = outside this repo; contract inferred from client call sites only.
 *   Unknown   = behaviour cannot be verified from this repository.
 */
workspace "La Carte Web" "Current-state architecture of the lacarte-webv customer portal" {

    model {
        customer = person "Customer" "Ghanaian household or business subscribing to waste collection. Per-bin or full-truck pricing; pay-as-you-go or subscriber; prepaid or postpaid. Confirmed: src/types/models.ts:91-121, src/lib/currency.ts:5-10." {
            tags "Actor" "Confirmed"
        }

        mobileApp = softwareSystem "La Carte Mobile (Flutter)" "Sibling client named in 2026-11-04-lacarte-web-design.md section 1 (D1). Not in this repo; shares the same backend. Contract unverified." {
            tags "External" "Unknown"
        }

        lacarteWeb = softwareSystem "La Carte Customer Web Portal" "This repository. Next.js 15 App Router + React 19. 27 client-rendered pages, no server actions, no route handlers, no middleware. Confirmed: src/app/**, package.json." {
            tags "Confirmed"

            nextServer = container "Next.js Server" "Serves the SPA shell and performs ONE dumb catch-all rewrite /api/:path* -> LACARTE_API_BASE_URL (default https://lacarteprod.lazynerdstudios.com). No auth injection, no headers, no CSP, no SSE passthrough. Confirmed: next.config.ts:3-27." "Next.js 15 / Node" {
                tags "Confirmed"
            }

            spa = container "Browser SPA" "All 27 page.tsx files plus (app)/layout.tsx are 'use client' (32 files total). Only src/app/layout.tsx is a server component (fonts + metadata). Auth, session, cart and token handling are entirely browser-side. Confirmed: src/app/layout.tsx:21-33, src/providers/app-providers.tsx." "React 19 / TypeScript 5.7" {
                tags "Confirmed"

                providers = component "AppProviders" "QueryClientProvider + three React contexts: UIFeedback (toasts/modal), Auth (session bootstrap, 401 guard), Cart (server-backed cart + serialized mutation controller). 769 lines, zero tests. Confirmed: src/providers/app-providers.tsx:43-141,190-276,750-768." "React Context + TanStack Query v5" {
                    tags "Confirmed" "Untested"
                }

                shell = component "AppShell + UI primitives" "Desktop sidebar (6 items), mobile bottom bar (4 items), utility header with cart/notification badges, slide-over cart drawer. common.tsx holds only NetworkErrorView, PageLoader, StatusBadge — no design-system primitives. Confirmed: src/components/layout/app-shell.tsx:29-43,294-435; src/components/ui/common.tsx." "React + Tailwind v4" {
                    tags "Confirmed"
                }

                pages = component "Route Pages (27)" "(auth): sign-in, sign-up, verify-otp, reset-password, onboarding/location. (app): dashboard, pickups(+new/[id]/track), subscription, billing(+[id]), shop(+[id]), cart, checkout, orders(+[id]), notifications, support(+[id]), account(+bins/security/activity). No loading.tsx / error.tsx / not-found.tsx. Confirmed: src/app/**." "Next.js App Router (client)" {
                    tags "Confirmed"
                }

                services = component "API Services" "10 service objects, ~70 endpoints: Auth, Customer, Disposable, Pickup, Subscription, Store, Support, Notification, ActivityLog. 867 lines; only payload shapes covered by 6 tests. Confirmed: src/lib/services/api-services.ts:81-866." "TypeScript" {
                    tags "Confirmed" "PartiallyTested"
                }

                apiClient = component "API Client" "apiRequest / apiRequestBlob. Bearer token from localStorage 'lacarte_bearer_token'. 12s timeout (15s blob). Global authSessionGuard on 401. Network/abort -> ApiException statusCode 0. 500 discards server message. Confirmed: src/lib/api-client.ts:39-54,65-190,192-227." "fetch + AbortController" {
                    tags "Confirmed" "Tested"
                }

                domain = component "Domain Rules" "Pure, well-tested business logic: bin-inventory, cart-mutation-controller, delivery-fee, payment-state, pickup-display, pricing-mode, subscription-display. 39 of 53 tests live here. Confirmed: src/lib/domain/*." "TypeScript (pure)" {
                    tags "Confirmed" "Tested"
                }

                models = component "Models + JSON Parse" "1399-line DTO layer: every entity has a defensive parse* function built on hand-rolled asStr/asInt/asDouble guards (no Zod). json-parse.ts silently skips malformed rows and falls back to epoch 1970 for bad dates. Confirmed: src/types/models.ts, src/lib/json-parse.ts:10-45,64-66,105-109." "TypeScript" {
                    tags "Confirmed" "Untested"
                }

                mapService = component "Map Service" "TomTom search/reverse-geocode/routing with Nominatim + OSM fallback. Ghana-biased (countrySet=GH, Accra 5.6037/-0.187, 50km). Public key NEXT_PUBLIC_TOMTOM_API_KEY. Confirmed: src/lib/services/map-service.ts:75-118,195-278; src/lib/config.ts:20-37." "TomTom API v2 / Nominatim" {
                    tags "Confirmed" "Untested"
                }

                tracking = component "Tracking SSE Client" "NOT EventSource — fetch streaming with Authorization header, hand-rolled SSE frame parser. Events: connected, location. No heartbeat timeout or built-in reconnect (callers retry after 5s). Confirmed: src/lib/services/tracking-sse.ts:23-156." "fetch ReadableStream" {
                    tags "Confirmed" "Untested"
                }

                leafletMap = component "InteractiveMap" "Leaflet 1.9, dynamically imported. Emoji divIcon markers, click-to-pick location, route polyline. Confirmed: src/components/map/interactive-map.tsx:41-141." "Leaflet" {
                    tags "Confirmed"
                }
            }
        }

        backend = softwareSystem "La Carte Backend API" "https://lacarteprod.lazynerdstudios.com (PRODUCTION default). Bearer-token REST API, ~8 endpoint roots. Owns all pricing, payment, order, subscription and pickup state. Sends no CORS headers — hence the proxy. Implementation is NOT in this repo: every server-side effect below is unverified. Confirmed: next.config.ts:4, src/lib/config.ts:1-7." "External REST API" {
            tags "External" "Unknown"
        }

        payment = softwareSystem "Mobile Money / 'blupay'" "Checkout defaults paymentMethod to 'blupay' (src/lib/services/api-services.ts:697) and the only caller never overrides it. UI tells the user to approve a MoMo prompt and polls order status every 5s. No payment SDK in package.json. Processor identity, charge semantics and callback contract are UNKNOWN from this repo." "External payment rail" {
            tags "External" "Unknown"
        }

        tomtom = softwareSystem "TomTom" "Map tiles, search/typeahead, reverse geocoding, routing v1. Called directly from the browser with a public key. Confirmed: src/lib/config.ts:21-30, src/lib/services/map-service.ts:80-91,249." "External SaaS" {
            tags "External" "Confirmed"
        }

        osm = softwareSystem "OpenStreetMap / Nominatim" "Fallback tiles and geocoding when no TomTom key is configured. Confirmed: src/lib/config.ts:30, src/lib/services/map-service.ts:111-118." "External public service" {
            tags "External" "Confirmed"
        }

        customer -> spa "Books pickups, manages subscription, shops, pays, tracks trucks" "HTTPS / browser"
        customer -> mobileApp "Same jobs via the sibling mobile app (documented, unverified)" ""
        spa -> nextServer "All /api/* calls, same-origin" "HTTP"
        nextServer -> backend "Catch-all rewrite, forwards browser Authorization header verbatim" "HTTPS"
        mobileApp -> backend "Shares the same API (documented only)" "HTTPS"
        backend -> payment "Initiates MoMo charge — MECHANISM UNKNOWN, inferred from client polling" "unknown"
        spa -> tomtom "Tiles, place search, reverse geocode, route/ETA" "HTTPS"
        spa -> osm "Fallback tiles + geocoding" "HTTPS"
        spa -> backend "SSE tracking stream via the same rewrite (buffering risk unresolved)" "HTTPS / text-event-stream"

        providers -> pages "Auth / Cart / Feedback context"
        pages -> shell "Renders inside"
        pages -> services "Queries + mutations"
        pages -> domain "Display rules, action matrix, polling gates"
        pages -> tracking "Live truck location"
        pages -> leafletMap "Renders map"
        shell -> providers "useAuth / useCart"
        services -> apiClient "apiRequest / apiRequestBlob"
        services -> models "parse* DTO guards"
        models -> domain "Typed entities"
        apiClient -> providers "authSessionGuard.notifyUnauthorized() on 401"
        providers -> services "Session bootstrap + server cart"
        leafletMap -> mapService "Tiles / route geometry"
        mapService -> tomtom "Search, reverse geocode, routing"
        mapService -> osm "Fallback"
        tracking -> apiClient "Reuses token storage; own fetch stream"
    }

    views {
        systemContext lacarteWeb "L1_SystemContext" "Who uses the portal and what it talks to. Backend and payment behaviour are outside this repo and tagged Unknown." {
            include *
            autolayout tb
        }

        container lacarteWeb "L2_Containers" "The Next.js server is a proxy only; all application logic lives in the browser SPA." {
            include *
            autolayout tb
        }

        component spa "L3_Components" "Internal module structure of the browser SPA." {
            include *
            autolayout tb
        }

        styles {
            element "Actor" {
                shape person
                background #0a0d12
                color #ffffff
            }
            element "Confirmed" {
                background #1b4332
                color #ffffff
            }
            element "External" {
                background #6b7280
                color #ffffff
            }
            element "Unknown" {
                background #b45309
                color #ffffff
                border dashed
            }
            element "Untested" {
                stroke #dc2626
                stroke-width 3
            }
            element "Tested" {
                stroke #16a34a
                stroke-width 3
            }
            relationship "Relationship" {
                thickness 2
                fontsize 22
            }
        }
    }
}