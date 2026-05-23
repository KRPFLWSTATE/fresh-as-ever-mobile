import { useCallback, useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import type { AppEnv } from '@/config/env';
import { logError } from '@/observability/logError';

export type PlatformFlags = {
  maintenance: boolean;
  merchant_signups: boolean;
  fraud_guard_strict: boolean;
};

const DEFAULT_FLAGS: PlatformFlags = {
  maintenance: false,
  merchant_signups: true,
  fraud_guard_strict: false,
};

/**
 * Reads `public.platform_settings.flags` for customer/merchant gating (maintenance banner, etc.).
 */
export function usePlatformSettings(env: AppEnv) {
  const [flags, setFlags] = useState<PlatformFlags>(DEFAULT_FLAGS);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const sb = getSupabase(env);
      const { data, error } = await sb
        .from('platform_settings')
        .select('value')
        .eq('key', 'flags')
        .maybeSingle();
      if (error) throw error;
      const raw = (data?.value ?? {}) as Record<string, unknown>;
      setFlags({
        maintenance: Boolean(raw.maintenance),
        merchant_signups: raw.merchant_signups !== false,
        fraud_guard_strict: Boolean(raw.fraud_guard_strict),
      });
    } catch (err) {
      logError(err, { context: 'usePlatformSettings.refresh' });
      setFlags(DEFAULT_FLAGS);
    } finally {
      setLoading(false);
    }
  }, [env]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { flags, loading, refresh };
}
