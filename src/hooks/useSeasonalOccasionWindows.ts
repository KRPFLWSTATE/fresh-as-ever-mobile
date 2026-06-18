import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AppEnv } from '@/config/env';
import { isSeasonalBadgesEnabled } from '@/config/featureFlags';
import {
  getActiveSeasonalWindows,
  parseSeasonalOccasionKind,
  type SeasonalOccasionWindow,
} from '@/domain/seasonalOccasion';
import { getSupabase } from '@/lib/supabase';

function mapWindowRows(rows: Record<string, unknown>[] | null | undefined): SeasonalOccasionWindow[] {
  if (!rows?.length) return [];
  return rows
    .map((row) => {
      const occasion = parseSeasonalOccasionKind(row.occasion);
      if (occasion === 'none') return null;
      const starts_on = String(row.starts_on ?? '').slice(0, 10);
      const ends_on = String(row.ends_on ?? '').slice(0, 10);
      const label = String(row.label ?? '').trim();
      if (!starts_on || !ends_on || !label) return null;
      return { occasion, starts_on, ends_on, label };
    })
    .filter((w): w is SeasonalOccasionWindow => w != null);
}

export function useSeasonalOccasionWindows(env: AppEnv) {
  const supabase = useMemo(() => getSupabase(env), [env]);
  const enabled = isSeasonalBadgesEnabled();
  const [windows, setWindows] = useState<SeasonalOccasionWindow[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setWindows([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: qErr } = await supabase
        .from('seasonal_occasion_windows')
        .select('occasion, starts_on, ends_on, label')
        .order('starts_on', { ascending: true });
      if (qErr) throw qErr;
      setWindows(mapWindowRows(data as Record<string, unknown>[]));
    } catch (e) {
      setWindows([]);
      setError(e instanceof Error ? e.message : 'Could not load seasonal windows.');
    } finally {
      setLoading(false);
    }
  }, [enabled, supabase]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const activeWindows = useMemo(
    () => getActiveSeasonalWindows(windows),
    [windows],
  );

  return {
    enabled,
    windows,
    activeWindows,
    loading,
    error,
    refresh,
  };
}
