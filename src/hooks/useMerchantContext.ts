import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import type { AppEnv } from '@/config/env';
import { logError } from '@/observability/logError';
import { mapSupabaseError, logSupabaseError } from '@/lib/supabaseError';

export type MerchantOutlet = Record<string, unknown> & {
  id: string;
  name?: string | null;
  merchant_id?: string;
};

export type MerchantProfile = Record<string, unknown> & {
  id: string;
  owner_id?: string;
  business_name?: string | null;
};

export function useMerchantContext(env: AppEnv) {
  const supabase = useMemo(() => getSupabase(env), [env]);

  const [merchant, setMerchant] = useState<MerchantProfile | null>(null);
  const [outlets, setOutlets] = useState<MerchantOutlet[]>([]);
  const [activeOutletId, setActiveOutletId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContext = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError('Not authenticated');
        setMerchant(null);
        setOutlets([]);
        setActiveOutletId(null);
        return;
      }

      await supabase.rpc('link_merchant_staff_from_email');

      const { data: merchantRows, error: merchantError } = await supabase
        .from('merchants')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: true });

      if (merchantError) {
        throw merchantError;
      }

      let merchantData = (merchantRows?.[0] as MerchantProfile | undefined) ?? null;

      if (!merchantData?.id) {
        const { data: staffLink, error: staffErr } = await supabase
          .from('merchant_staff')
          .select('merchant_id')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();
        if (!staffErr && staffLink?.merchant_id) {
          const { data: staffMerchant, error: smErr } = await supabase
            .from('merchants')
            .select('*')
            .eq('id', String(staffLink.merchant_id))
            .maybeSingle();
          if (!smErr && staffMerchant) {
            merchantData = staffMerchant as MerchantProfile;
          }
        }
      }

      if (merchantData?.id) {
        setMerchant(merchantData);

        const { data: outletsData, error: outletsError } = await supabase
          .from('outlets')
          .select('*')
          .eq('merchant_id', merchantData.id);

        if (outletsError) {
          throw outletsError;
        }

        const nextOutlets = (outletsData ?? []) as MerchantOutlet[];
        setOutlets(nextOutlets);
        if (nextOutlets.length > 0) {
          setActiveOutletId((previousId) => {
            const ok = previousId && nextOutlets.some((o) => o.id === previousId);
            return ok ? previousId : String(nextOutlets[0].id);
          });
        } else {
          setActiveOutletId(null);
        }
      } else {
        setMerchant(null);
        setOutlets([]);
        setActiveOutletId(null);
      }
    } catch (e) {
      logSupabaseError(e, 'useMerchantContext.fetchContext');
      setError(mapSupabaseError(e as Error, 'Failed to load merchant details.'));
      setMerchant(null);
      setOutlets([]);
      setActiveOutletId(null);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchContext().catch((err) => logError(err, { context: 'useMerchantContext.fetchContext' }));
  }, [fetchContext]);

  const activeOutlet = useMemo(
    () =>
      outlets.find((o) => String(o.id) === String(activeOutletId)) ?? outlets[0] ?? null,
    [outlets, activeOutletId],
  );

  const outletScopeIds = useMemo(
    () => outlets.map((o) => String(o.id)),
    [outlets],
  );

  return {
    merchant,
    outlets,
    activeOutlet,
    activeOutletId,
    outletScopeIds,
    setActiveOutletId,
    loading,
    error,
    refetch: fetchContext,
  };
}
