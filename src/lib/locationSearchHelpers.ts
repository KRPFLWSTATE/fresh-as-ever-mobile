import type { AppEnv } from '@/config/env';
import { haversineKm } from '@/lib/haversine';
import { fetchLocationSearch, type LocationHit } from '@/lib/locationApi';

export type { LocationHit };

/** Normalize for label comparison. */
export function normalizeLocationLabel(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Short display label — venue + neighbourhood, not full Nominatim string. */
export function shortenLocationLabel(label: string): string {
  const parts = label
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length <= 2) return label.trim();

  const area =
    parts.find((p) => /colombo|kandy|galle|negombo|dehiwala|nugegoda/i.test(p)) ??
    parts[Math.min(1, parts.length - 1)];

  return `${parts[0]}, ${area}`;
}

function primaryVenueKey(label: string): string {
  return normalizeLocationLabel(label).split(',')[0]?.trim() ?? '';
}

function isNearDuplicate(a: LocationHit, b: LocationHit, proximityKm: number): boolean {
  if (primaryVenueKey(a.label) !== primaryVenueKey(b.label)) return false;
  const dist = haversineKm(a.lat, a.lng, b.lat, b.lng);
  return Number.isFinite(dist) && dist < proximityKm;
}

/**
 * Collapse near-duplicate Nominatim rows (same venue, similar coords) and shorten labels.
 */
export function dedupeLocationHits(
  hits: LocationHit[],
  opts?: { maxResults?: number; proximityKm?: number },
): LocationHit[] {
  const maxResults = opts?.maxResults ?? 5;
  const proximityKm = opts?.proximityKm ?? 0.15;
  const result: LocationHit[] = [];

  for (const hit of hits) {
    const duplicate = result.some((existing) => isNearDuplicate(existing, hit, proximityKm));
    if (duplicate) continue;

    result.push({
      ...hit,
      label: shortenLocationLabel(hit.label),
    });
    if (result.length >= maxResults) break;
  }

  return result;
}

/**
 * Pick a single forward-geocode hit for typed text (Google Maps–style).
 * Returns null when query is too short or results are ambiguous.
 */
export function pickForwardGeocodeHit(
  query: string,
  hits: LocationHit[],
): LocationHit | null {
  const q = query.trim();
  if (!q || hits.length === 0) return null;
  if (hits.length === 1) return hits[0];
  if (q.length < 4) return null;

  const qNorm = normalizeLocationLabel(q);
  const qFirst = qNorm.split(',')[0] ?? qNorm;

  const prefixMatch = hits.find((h) => {
    const hNorm = normalizeLocationLabel(h.label);
    const hFirst = hNorm.split(',')[0] ?? hNorm;
    return hNorm.includes(qNorm) || qNorm.includes(hFirst) || hFirst.includes(qFirst);
  });
  if (prefixMatch) return prefixMatch;

  return hits[0];
}

/** Forward-geocode free-typed address; returns coords hit or null. */
export async function geocodeTypedAddress(
  env: AppEnv,
  query: string,
  minChars = 4,
): Promise<LocationHit | null> {
  const q = query.trim();
  if (q.length < minChars) return null;

  const { results } = await fetchLocationSearch(env, q);
  const deduped = dedupeLocationHits(results);
  return pickForwardGeocodeHit(q, deduped);
}
