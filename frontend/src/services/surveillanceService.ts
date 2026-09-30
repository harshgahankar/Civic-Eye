/**
 * OpenSurveillance DB (OSDB) external camera feed.
 *
 * Contract status: the provider has no public docs, so the endpoint shape
 * below is the conventional default (Bearer auth + bbox query) with tolerant
 * parsing of the common response envelopes. Confirm the exact base URL and
 * endpoint against the provider docs and adjust ENDPOINTS accordingly.
 *
 * The key lives in frontend/.env (gitignored) as VITE_OSDB_KEY and is never
 * committed. For production, route this through the backend to avoid CORS
 * issues and to keep the key server-side.
 */

export interface ExternalCamera {
  id: string;
  name: string;
  lat: number;
  lng: number;
  city?: string;
}

export interface MumbaiBbox {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}

export const MUMBAI_BBOX: MumbaiBbox = {
  minLat: 18.8,
  minLng: 72.68,
  maxLat: 19.35,
  maxLng: 73.08,
};

function env(key: string): string {
  return (
    (import.meta as unknown as { env?: Record<string, string> }).env?.[key] ?? ''
  );
}

export function osdbBase(): string {
  return env('VITE_OSDB_BASE_URL').replace(/\/+$/, '');
}

export function isOsdbConfigured(): boolean {
  return env('VITE_OSDB_KEY').length > 0 && osdbBase().length > 0;
}

function num(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

/** Accepts array | {data|cameras|results|items} envelopes and common field names. */
export function normalizeOsdbPayload(payload: unknown): ExternalCamera[] {
  const raw: unknown = payload;
  const list: unknown[] = Array.isArray(raw)
    ? raw
    : (['data', 'cameras', 'results', 'items'] as const).flatMap((k) => {
        const v = (raw as Record<string, unknown> | null)?.[k];
        return Array.isArray(v) ? v : [];
      });
  const out: ExternalCamera[] = [];
  for (const item of list) {
    if (typeof item !== 'object' || item === null) continue;
    const r = item as Record<string, unknown>;
    const lat = num(r.lat ?? r.latitude);
    const lng = num(r.lng ?? r.lon ?? r.long ?? r.longitude);
    if (lat === null || lng === null) continue;
    out.push({
      id: String(r.id ?? r.asset_id ?? `osdb-${out.length}`),
      name: String(r.name ?? r.title ?? r.label ?? 'OSDB camera'),
      lat,
      lng,
      city: typeof r.city === 'string' ? r.city : undefined,
    });
  }
  return out;
}

let cache: { at: number; cams: ExternalCamera[] } | null = null;
const CACHE_TTL = 10 * 60 * 1000;

/**
 * Fetch provider cameras inside the Mumbai bbox.
 * TODO(provider-docs): replace the path/query below with the exact endpoint.
 */
export async function fetchOsdbCameras(
  bbox: MumbaiBbox = MUMBAI_BBOX,
  signal?: AbortSignal,
): Promise<ExternalCamera[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL) return cache.cams;
  const base = osdbBase();
  const key = env('VITE_OSDB_KEY');
  if (!base || !key) throw new Error('OSDB feed is not configured (missing base URL or key).');

  // Conventional default; adjust path/params once the provider docs are confirmed.
  const url =
    `${base}/cameras?` +
    `min_lat=${bbox.minLat}&min_lng=${bbox.minLng}&max_lat=${bbox.maxLat}&max_lng=${bbox.maxLng}&limit=150`;

  const res = await fetch(url, {
    signal,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${key}`,
    },
  });
  if (!res.ok) throw new Error(`OSDB request failed: HTTP ${res.status}`);
  const cams = normalizeOsdbPayload(await res.json()).slice(0, 150);
  cache = { at: Date.now(), cams };
  return cams;
}

export function clearOsdbCache() {
  cache = null;
}
