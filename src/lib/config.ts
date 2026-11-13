/**
 * Empty means "call the API same-origin through the Next.js proxy" (see
 * src/app/api/[...path]/route.ts). The backend sends no Access-Control-Allow-Origin
 * and rejects unknown browser Origin headers on Better Auth endpoints with
 * INVALID_ORIGIN, so the proxy forwards requests with the upstream Origin. Set
 * NEXT_PUBLIC_API_BASE_URL to a full origin to bypass the proxy once CORS and
 * trustedOrigins are allowlisted.
 */
export const AppConfig = {
  baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? '',
} as const;

export function resolveApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const origin =
    AppConfig.baseUrl ||
    (typeof window === 'undefined' ? 'http://localhost:3000' : window.location.origin);
  return new URL(normalizedPath, origin).toString();
}

export const MapConfig = {
  tomtomApiKey: process.env.NEXT_PUBLIC_TOMTOM_API_KEY ?? '',
  tomtomSearchUrl: 'https://api.tomtom.com/search/2',
  tomtomReverseGeocodingUrl: 'https://api.tomtom.com/search/2/reverseGeocode',
  get appTileUrl() {
    if (this.tomtomApiKey) {
      return `https://api.tomtom.com/map/1/tile/basic/main/{z}/{x}/{y}.png?key=${this.tomtomApiKey}&view=Unified&language=en-GB`;
    }
    return this.osmTileUrl;
  },
  osmTileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  tomtomAttribution: '© TomTom, © OpenStreetMap contributors',
  defaultLat: 5.6037,
  defaultLon: -0.187,
  searchBiasLat: 5.6037,
  searchBiasLon: -0.187,
  searchBiasRadius: 50000,
} as const;

