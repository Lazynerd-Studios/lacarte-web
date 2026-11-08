import { resolveApiUrl } from '@/lib/config';
import { TokenStorage } from '@/lib/api-client';
import { asDouble, asIntOrNull, asMap, asStr } from '@/lib/json-parse';

export type TrackingEvent =
  | {
      type: 'connected';
      pickupRequestId: string | null;
      driverName: string | null;
      truckPlate: string | null;
      receivedAt: number;
    }
  | {
      type: 'location';
      latitude: number;
      longitude: number;
      durationSeconds: number | null;
      driverName: string | null;
      truckPlate: string | null;
      receivedAt: number;
    };

/**
 * Connects to GET /api/pickup-requests/{id}/tracking/sse with Bearer auth
 * using fetch streaming (since browser EventSource does not support custom
 * Authorization headers).
 */
export function subscribeToPickupTracking(params: {
  pickupId: string;
  token?: string | null;
  onEvent: (event: TrackingEvent) => void;
  onError?: (err: unknown) => void;
}): () => void {
  const token = params.token ?? TokenStorage.read();
  const controller = new AbortController();
  let cancelled = false;

  async function run() {
    if (!token) {
      params.onError?.(new Error('Not authenticated'));
      return;
    }
    const url = resolveApiUrl(
      `/api/pickup-requests/${params.pickupId}/tracking/sse`,
    );

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`Tracking stream error (${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let partial = '';
      let buffer: string[] = [];

      while (!cancelled) {
        const { value, done } = await reader.read();
        if (done) break;
        partial += decoder.decode(value, { stream: true });
        const lines = partial.split(/\r?\n/);
        partial = lines.pop() ?? '';

        for (const line of lines) {
          if (line.trim() === '') {
            if (buffer.length > 0) {
              processEventBlock(buffer, params.onEvent);
              buffer = [];
            }
          } else {
            buffer.push(line);
          }
        }
      }
    } catch (err) {
      if (!cancelled) {
        params.onError?.(err);
      }
    }
  }

  run();

  return () => {
    cancelled = true;
    controller.abort();
  };
}

function processEventBlock(
  lines: string[],
  onEvent: (event: TrackingEvent) => void,
) {
  let eventName: string | null = null;
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith('event:')) {
      eventName = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trim());
    }
  }

  if (dataLines.length === 0) return;
  const payload = dataLines.join('\n');
  if (!payload) return;

  try {
    const parsed = asMap(JSON.parse(payload));
    if (!parsed) return;

    if (eventName === 'connected') {
      onEvent({
        type: 'connected',
        pickupRequestId: parsed.pickupRequestId
          ? asStr(parsed.pickupRequestId)
          : null,
        driverName: parsed.driverName ? asStr(parsed.driverName) : null,
        truckPlate: parsed.truckPlate ? asStr(parsed.truckPlate) : null,
        receivedAt: Date.now(),
      });
      return;
    }

    if (!eventName || eventName === 'location') {
      const lat = asDouble(parsed.lat ?? parsed.latitude, Number.NaN);
      const lng = asDouble(
        parsed.lng ?? parsed.lon ?? parsed.longitude,
        Number.NaN,
      );
      if (Number.isNaN(lat) || Number.isNaN(lng)) return;

      onEvent({
        type: 'location',
        latitude: lat,
        longitude: lng,
        durationSeconds: asIntOrNull(parsed.duration),
        driverName: parsed.driverName ? asStr(parsed.driverName) : null,
        truckPlate: parsed.truckPlate ? asStr(parsed.truckPlate) : null,
        receivedAt: Date.now(),
      });
    }
  } catch {
    // Ignore malformed SSE ping/frame
  }
}

