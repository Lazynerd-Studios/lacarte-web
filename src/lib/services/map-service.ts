import { MapConfig } from '@/lib/config';
import { asDouble, asInt, asMap, asStr } from '@/lib/json-parse';

export interface NormalizedPlace {
  lat: number;
  lon: number;
  display_name: string;
  name: string;
  city: string;
  region?: string;
  postalCode?: string;
  country: string;
  source: 'tomtom' | 'nominatim';
}

export interface RouteInfo {
  points: [number, number][]; // [lat, lon]
  travelTimeSeconds: number | null;
}

function normalizeTomTomResult(raw: Record<string, unknown>): NormalizedPlace {
  const position = asMap(raw.position) ?? {};
  const address = asMap(raw.address) ?? {};
  const poi = asMap(raw.poi) ?? {};

  const poiName = asStr(poi.name);
  const streetName = asStr(address.streetName);
  const streetNumber = asStr(address.streetNumber);
  const municipality =
    asStr(address.municipality) || asStr(address.municipalitySubdivision);
  const countrySubdivision = asStr(address.countrySubdivision);
  const country = asStr(address.country, 'Ghana');

  const nameParts: string[] = [];
  if (streetNumber && streetName) {
    nameParts.push(`${streetNumber} ${streetName}`);
  } else if (streetName) {
    nameParts.push(streetName);
  } else if (poiName) {
    nameParts.push(poiName);
  }
  if (municipality) nameParts.push(municipality);
  if (countrySubdivision && countrySubdivision !== municipality) {
    nameParts.push(countrySubdivision);
  }
  if (country) nameParts.push(country);

  const displayName =
    nameParts.length > 0
      ? nameParts.join(', ')
      : asStr(address.freeformAddress);

  return {
    lat: asDouble(position.lat),
    lon: asDouble(position.lon),
    display_name: displayName,
    name: poiName || streetName || municipality || displayName,
    city: municipality,
    region: countrySubdivision,
    postalCode: asStr(address.postalCode),
    country,
    source: 'tomtom',
  };
}

export const MapService = {
  /**
   * 2-tier place search: TomTom Typeahead -> Nominatim (OSM) fallback.
   */
  async searchPlaces(
    query: string,
    options?: { lat?: number; lon?: number },
  ): Promise<NormalizedPlace[]> {
    const trimmed = query.trim();
    if (trimmed.length < 3) return [];

    // Tier 1: TomTom
    if (MapConfig.tomtomApiKey) {
      try {
        const params = new URLSearchParams({
          key: MapConfig.tomtomApiKey,
          typeahead: 'true',
          limit: '10',
          countrySet: 'GH',
          language: 'en-GB',
          lat: String(options?.lat ?? MapConfig.searchBiasLat),
          lon: String(options?.lon ?? MapConfig.searchBiasLon),
          radius: String(MapConfig.searchBiasRadius),
          relatedPois: 'off',
        });
        const url = `${MapConfig.tomtomSearchUrl}/search/${encodeURIComponent(trimmed)}.json?${params.toString()}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = (await res.json()) as Record<string, unknown>;
          const results = Array.isArray(data.results) ? data.results : [];
          if (results.length > 0) {
            return results
              .map((r) => asMap(r))
              .filter((r): r is Record<string, unknown> => r !== null)
              .map(normalizeTomTomResult)
              .filter((p) => p.lat !== 0 || p.lon !== 0);
          }
        }
      } catch (err) {
        console.warn('[MapService] TomTom search failed, trying Nominatim:', err);
      }
    }

    // Tier 2: Nominatim (OSM) fallback
    try {
      const params = new URLSearchParams({
        q: `${trimmed}, Ghana`,
        format: 'json',
        addressdetails: '1',
        limit: '8',
      });
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?${params.toString()}`,
        {
          headers: { 'Accept-Language': 'en' },
        },
      );
      if (!res.ok) return [];
      const data = (await res.json()) as Record<string, unknown>[];
      return data.map((item) => {
        const addr = asMap(item.address) ?? {};
        const city =
          asStr(addr.city) ||
          asStr(addr.town) ||
          asStr(addr.suburb) ||
          asStr(addr.state);
        return {
          lat: asDouble(item.lat),
          lon: asDouble(item.lon),
          display_name: asStr(item.display_name),
          name: asStr(item.name, asStr(item.display_name).split(',')[0]),
          city,
          region: asStr(addr.state),
          postalCode: asStr(addr.postcode),
          country: asStr(addr.country, 'Ghana'),
          source: 'nominatim' as const,
        };
      });
    } catch {
      return [];
    }
  },

  /**
   * 2-tier reverse geocoding: TomTom -> Nominatim fallback.
   */
  async reverseGeocode(
    lat: number,
    lon: number,
  ): Promise<NormalizedPlace | null> {
    if (MapConfig.tomtomApiKey) {
      try {
        const url = `${MapConfig.tomtomReverseGeocodingUrl}/${lat},${lon}.json?key=${MapConfig.tomtomApiKey}&language=en-GB`;
        const res = await fetch(url);
        if (res.ok) {
          const data = (await res.json()) as Record<string, unknown>;
          const addresses = Array.isArray(data.addresses) ? data.addresses : [];
          if (addresses.length > 0) {
            const first = asMap(addresses[0]) ?? {};
            const addr = asMap(first.address) ?? {};
            const streetNumber = asStr(addr.streetNumber);
            const streetName = asStr(addr.streetName);
            const municipality =
              asStr(addr.municipality) || asStr(addr.municipalitySubdivision);
            const countrySubdivision = asStr(addr.countrySubdivision);
            const country = asStr(addr.country, 'Ghana');

            const parts: string[] = [];
            if (streetNumber && streetName) {
              parts.push(`${streetNumber} ${streetName}`);
            } else if (streetName) {
              parts.push(streetName);
            }
            if (municipality) parts.push(municipality);
            if (countrySubdivision && countrySubdivision !== municipality) {
              parts.push(countrySubdivision);
            }
            if (country) parts.push(country);

            const displayName =
              parts.length > 0
                ? parts.join(', ')
                : asStr(addr.freeformAddress, `${lat.toFixed(5)}, ${lon.toFixed(5)}`);

            return {
              lat,
              lon,
              display_name: displayName,
              name: streetName || municipality || displayName,
              city: municipality || 'Accra',
              region: countrySubdivision,
              postalCode: asStr(addr.postalCode),
              country,
              source: 'tomtom',
            };
          }
        }
      } catch (err) {
        console.warn('[MapService] TomTom reverse geocode failed:', err);
      }
    }

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
        { headers: { 'Accept-Language': 'en' } },
      );
      if (!res.ok) return null;
      const data = (await res.json()) as Record<string, unknown>;
      const addr = asMap(data.address) ?? {};
      const city =
        asStr(addr.city) ||
        asStr(addr.town) ||
        asStr(addr.suburb) ||
        'Accra';
      return {
        lat,
        lon,
        display_name: asStr(data.display_name),
        name: asStr(addr.road, city),
        city,
        region: asStr(addr.state),
        postalCode: asStr(addr.postcode),
        country: asStr(addr.country, 'Ghana'),
        source: 'nominatim',
      };
    } catch {
      return null;
    }
  },

  /**
   * Calculate driving route & travel time (ETA) using TomTom Routing API.
   */
  async getRoute(
    from: [number, number],
    to: [number, number],
  ): Promise<RouteInfo> {
    if (!MapConfig.tomtomApiKey) {
      return { points: [], travelTimeSeconds: null };
    }
    try {
      const locations = `${from[0]},${from[1]}:${to[0]},${to[1]}`;
      const url = `https://api.tomtom.com/routing/1/calculateRoute/${locations}/json?key=${MapConfig.tomtomApiKey}`;
      const res = await fetch(url);
      if (!res.ok) return { points: [], travelTimeSeconds: null };

      const data = (await res.json()) as Record<string, unknown>;
      const routes = Array.isArray(data.routes) ? data.routes : [];
      if (routes.length === 0) return { points: [], travelTimeSeconds: null };

      const route = asMap(routes[0]) ?? {};
      const summary = asMap(route.summary);
      const travelTimeSeconds = summary
        ? asInt(summary.travelTimeInSeconds)
        : null;
      const legs = Array.isArray(route.legs) ? route.legs : [];
      const points: [number, number][] = [];

      for (const leg of legs) {
        const legMap = asMap(leg);
        const legPoints = Array.isArray(legMap?.points) ? legMap.points : [];
        for (const pt of legPoints) {
          const p = asMap(pt);
          if (p && p.latitude !== undefined && p.longitude !== undefined) {
            points.push([asDouble(p.latitude), asDouble(p.longitude)]);
          }
        }
      }
      return { points, travelTimeSeconds };
    } catch {
      return { points: [], travelTimeSeconds: null };
    }
  },
};

