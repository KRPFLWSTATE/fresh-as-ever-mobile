import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppEnv } from '@/config/env';
import {
  fetchLocationSearch,
  type LocationHit,
} from '@/lib/locationApi';
import { dedupeLocationHits } from '@/lib/locationSearchHelpers';

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

function queryChangedSubstantially(prev: string, next: string): boolean {
  const a = prev.trim().toLowerCase();
  const b = next.trim().toLowerCase();
  if (!a || !b) return a !== b;
  if (a === b) return false;
  const shared = Math.min(3, a.length, b.length);
  return a.slice(0, shared) !== b.slice(0, shared);
}

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
  const [suggestionsQuery, setSuggestionsQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastQueryRef = useRef('');

  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
    setSuggestionsQuery('');
  }, []);
  const clearError = useCallback(() => setError(null), []);

  const runSearch = useCallback(async () => {
    const q = query.trim();
    if (!q) {
      clearSuggestions();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { results, apiBaseUrlMissing } = await fetchLocationSearch(env, q);
      const deduped = dedupeLocationHits(results);
      setSuggestions(deduped);
      setSuggestionsQuery(q);
      if (!results.length) {
        setError(
          apiBaseUrlMissing
            ? 'Set API_BASE_URL in .env for live search, or try "Colombo 07".'
            : 'No places found — try a neighbourhood or "Colombo 07".',
        );
      }
    } catch {
      setError('Search failed — try again or pick a suggestion below.');
      clearSuggestions();
    } finally {
      setBusy(false);
    }
  }, [clearSuggestions, env, query]);

  useEffect(() => {
    if (!enabled) return;
    const q = query.trim();
    const prev = lastQueryRef.current;
    if (queryChangedSubstantially(prev, q)) {
      clearSuggestions();
    }
    lastQueryRef.current = q;

    if (q.length < minChars) {
      clearSuggestions();
      setError(q.length === 0 ? null : `Type at least ${minChars} characters`);
      return;
    }
    const timer = setTimeout(() => {
      void runSearch();
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [clearSuggestions, debounceMs, enabled, minChars, query, runSearch]);

  const activeSuggestions = query.trim() === suggestionsQuery ? suggestions : [];

  return {
    suggestions: activeSuggestions,
    busy,
    error,
    clearSuggestions,
    clearError,
  };
}
