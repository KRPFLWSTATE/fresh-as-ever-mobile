import type { AppEnv } from '@/config/env';

export type LocationHit = { label: string; lat: number; lng: number };

/** Same presets as hosted `fresh-as-ever` `/api/location/search` fallback. */
export const SRI_LANKA_LOCATION_PRESETS: readonly LocationHit[] = [
  { label: 'Colombo 07, Sri Lanka', lat: 6.9147, lng: 79.8655 },
  { label: 'Colombo 03, Sri Lanka', lat: 6.9022, lng: 79.8534 },
  { label: 'Colombo 05, Sri Lanka', lat: 6.8953, lng: 79.8588 },
  { label: 'Nugegoda, Sri Lanka', lat: 6.8649, lng: 79.8997 },
  { label: 'Dehiwala, Sri Lanka', lat: 6.8528, lng: 79.8657 },
  { label: 'Kandy, Sri Lanka', lat: 7.2906, lng: 80.6337 },
] as const;

export type LocationSearchResponse = {
  results: LocationHit[];
  /** True when `API_BASE_URL` is unset — hosted search was skipped. */
  apiBaseUrlMissing: boolean;
  /** True when results came from Nominatim or local presets (not hosted API). */
  usedClientFallback: boolean;
};

async function parseJsonSafely(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function normalizeHits(raw: unknown): LocationHit[] {
  if (raw == null || typeof raw !== 'object') return [];
  const results = (raw as { results?: unknown }).results;
  if (!Array.isArray(results)) return [];
  return results
    .map((r) => r as Record<string, unknown>)
    .map((r) => ({
      label: String(r.label ?? '').trim(),
      lat: Number(r.lat),
      lng: Number(r.lng),
    }))
    .filter((r) => r.label && Number.isFinite(r.lat) && Number.isFinite(r.lng));
}

function filterPresets(query: string): LocationHit[] {
  const lowered = query.trim().toLowerCase();
  if (!lowered) {
    return [...SRI_LANKA_LOCATION_PRESETS].slice(0, 5);
  }
  const filtered = SRI_LANKA_LOCATION_PRESETS.filter((loc) =>
    loc.label.toLowerCase().includes(lowered),
  );
  const list = filtered.length > 0 ? filtered : SRI_LANKA_LOCATION_PRESETS;
  return [...list].slice(0, 5);
}

/** OpenStreetMap Nominatim — Sri Lanka bias (mirrors hosted API without Google key). */
export async function fetchNominatimLocationSearch(q: string): Promise<LocationHit[]> {
  const query = q.trim();
  if (!query) return filterPresets('');

  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', `${query}, Sri Lanka`);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '5');
  url.searchParams.set('countrycodes', 'lk');

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'fresh-as-ever-mobile/1.0' },
  });
  if (!res.ok) return [];

  const rows = (await parseJsonSafely(res)) as
    | { display_name?: string; lat?: string; lon?: string }[]
    | null;
  if (!Array.isArray(rows)) return [];

  return rows
    .map((item) => ({
      label: String(item.display_name ?? '').trim(),
      lat: Number(item.lat),
      lng: Number(item.lon),
    }))
    .filter((r) => r.label && Number.isFinite(r.lat) && Number.isFinite(r.lng));
}

async function fetchHostedLocationSearch(
  env: AppEnv,
  q: string,
): Promise<LocationHit[] | null> {
  const base = env.apiBaseUrl?.trim();
  if (!base) return null;

  const url = `${base.replace(/\/$/, '')}/api/location/search?q=${encodeURIComponent(q.trim())}`;
  try {
    const res = await fetch(url);
    const body = await parseJsonSafely(res);
    if (!res.ok) return null;
    const results = normalizeHits(body);
    return results;
  } catch {
    return null;
  }
}

/**
 * Location search: hosted Next.js API first, then Nominatim (LK bias), then presets.
 */
export async function fetchLocationSearch(
  env: AppEnv,
  q: string,
): Promise<LocationSearchResponse> {
  const trimmed = q.trim();
  const apiBaseUrlMissing = !env.apiBaseUrl?.trim();

  if (!trimmed) {
    return {
      results: filterPresets(''),
      apiBaseUrlMissing,
      usedClientFallback: true,
    };
  }

  const hosted = await fetchHostedLocationSearch(env, trimmed);
  if (hosted != null && hosted.length > 0) {
    return { results: hosted, apiBaseUrlMissing, usedClientFallback: false };
  }

  try {
    const nominatim = await fetchNominatimLocationSearch(trimmed);
    if (nominatim.length > 0) {
      return { results: nominatim, apiBaseUrlMissing, usedClientFallback: true };
    }
  } catch {
    // fall through to presets
  }

  return {
    results: filterPresets(trimmed),
    apiBaseUrlMissing,
    usedClientFallback: true,
  };
}

/** OpenStreetMap Nominatim reverse — Sri Lanka bias (mirrors hosted API). */
export async function fetchNominatimLocationReverse(
  lat: number,
  lng: number,
): Promise<string> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return '';

  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lng));
  url.searchParams.set('format', 'jsonv2');

  try {
    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': 'fresh-as-ever-mobile/1.0' },
    });
    if (!res.ok) return '';
    const body = (await parseJsonSafely(res)) as { display_name?: string } | null;
    return String(body?.display_name ?? '').trim();
  } catch {
    return '';
  }
}

/** Hosted Next.js `/api/location/reverse` — label for coordinates. */
export async function fetchLocationReverse(
  env: AppEnv,
  lat: number,
  lng: number,
): Promise<string> {
  const base = env.apiBaseUrl?.trim();
  if (base) {
    const url = `${base.replace(/\/$/, '')}/api/location/reverse?lat=${lat}&lng=${lng}`;
    try {
      const res = await fetch(url);
      const body = await parseJsonSafely(res);
      if (res.ok && body != null && typeof body === 'object') {
        const label = String((body as { label?: string }).label ?? '').trim();
        if (label) return label;
      }
    } catch {
      // fall through to Nominatim
    }
  }

  return fetchNominatimLocationReverse(lat, lng);
}
