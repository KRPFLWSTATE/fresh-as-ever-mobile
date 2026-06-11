import { useCallback, useEffect, useState } from 'react';
import type { AppEnv } from '@/config/env';
import {
  fetchLocationSearch,
  type LocationHit,
} from '@/lib/locationApi';

export type UseLocationSearchOptions = {
  /** Debounce interval in ms (Discover uses 400). */
  debounceMs?: number;
  /** Minimum query length before search runs (Discover uses 2). */
  minChars?: number;
  /** When false, skips debounced search (e.g. sheet closed). */
  enabled?: boolean;
};

export type UseLocationSearchResult = {
  suggestions: LocationHit[];
  busy: boolean;
  error: string | null;
  clearSuggestions: () => void;
  clearError: () => void;
};

/**
 * Debounced location search — extracted from DiscoverScreen place-search sheet.
 */
export function useLocationSearch(
  env: AppEnv,
  query: string,
  options: UseLocationSearchOptions = {},
): UseLocationSearchResult {
  const { debounceMs = 400, minChars = 2, enabled = true } = options;
  const [suggestions, setSuggestions] = useState<LocationHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearSuggestions = useCallback(() => setSuggestions([]), []);
  const clearError = useCallback(() => setError(null), []);

  const runSearch = useCallback(async () => {
    const q = query.trim();
    if (!q) {
      setSuggestions([]);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { results, apiBaseUrlMissing } = await fetchLocationSearch(env, q);
      setSuggestions(results);
      if (!results.length) {
        setError(
          apiBaseUrlMissing
            ? 'Set API_BASE_URL in .env for live search, or try "Colombo 07".'
            : 'No places found — try a neighbourhood or "Colombo 07".',
        );
      }
    } catch {
      setError('Search failed — try again or pick a suggestion below.');
      setSuggestions([]);
    } finally {
      setBusy(false);
    }
  }, [env, query]);

  useEffect(() => {
    if (!enabled) return;
    const q = query.trim();
    if (q.length < minChars) {
      setSuggestions([]);
      setError(q.length === 0 ? null : `Type at least ${minChars} characters`);
      return;
    }
    const timer = setTimeout(() => {
      void runSearch();
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [debounceMs, enabled, minChars, query, runSearch]);

  return { suggestions, busy, error, clearSuggestions, clearError };
}
