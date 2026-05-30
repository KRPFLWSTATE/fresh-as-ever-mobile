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

type MerchantContextState = {
  merchant: MerchantProfile | null;
  outlets: MerchantOutlet[];
  activeOutletId: string | null;
  loading: boolean;
  error: string | null;
  initialized: boolean;
};

type MerchantContextStore = {
  state: MerchantContextState;
  listeners: Set<() => void>;
  fetchPromise: Promise<void> | null;
};

const merchantContextStores = new Map<string, MerchantContextStore>();

function createInitialState(): MerchantContextState {
  return {
    merchant: null,
    outlets: [],
    activeOutletId: null,
    loading: true,
    error: null,
    initialized: false,
  };
}

function getStoreKey(env: AppEnv): string {
  return `${env.supabaseUrl}|${env.supabaseAnonKey}`;
}

function getMerchantContextStore(env: AppEnv): MerchantContextStore {
  const key = getStoreKey(env);
  const existing = merchantContextStores.get(key);
  if (existing) {
    return existing;
  }
  const next: MerchantContextStore = {
    state: createInitialState(),
    listeners: new Set(),
    fetchPromise: null,
  };
  merchantContextStores.set(key, next);
  return next;
}

function emitStore(store: MerchantContextStore) {
  store.listeners.forEach((listener) => listener());
}

function updateStore(
  store: MerchantContextStore,
  updater: (current: MerchantContextState) => MerchantContextState,
) {
  store.state = updater(store.state);
  emitStore(store);
}

async function fetchMerchantContext(
  store: MerchantContextStore,
  env: AppEnv,
): Promise<void> {
  if (store.fetchPromise) {
    return store.fetchPromise;
  }

  const supabase = getSupabase(env);
  store.fetchPromise = (async () => {
    updateStore(store, (current) => ({
      ...current,
      loading: true,
      error: null,
    }));

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        updateStore(store, () => ({
          merchant: null,
          outlets: [],
          activeOutletId: null,
          loading: false,
          error: 'Not authenticated',
          initialized: true,
        }));
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

      if (!merchantData?.id) {
        updateStore(store, () => ({
          merchant: null,
          outlets: [],
          activeOutletId: null,
          loading: false,
          error: null,
          initialized: true,
        }));
        return;
      }

      const { data: outletsData, error: outletsError } = await supabase
        .from('outlets')
        .select('*')
        .eq('merchant_id', merchantData.id);

      if (outletsError) {
        throw outletsError;
      }

      const nextOutlets = (outletsData ?? []) as MerchantOutlet[];
      const previousId = store.state.activeOutletId;
      const nextActiveOutletId =
        nextOutlets.length > 0
          ? nextOutlets.some((outlet) => String(outlet.id) === String(previousId))
            ? String(previousId)
            : String(nextOutlets[0]?.id ?? '')
          : null;

      updateStore(store, () => ({
        merchant: merchantData,
        outlets: nextOutlets,
        activeOutletId: nextActiveOutletId,
        loading: false,
        error: null,
        initialized: true,
      }));
    } catch (e) {
      logSupabaseError(e, 'useMerchantContext.fetchContext');
      updateStore(store, () => ({
        merchant: null,
        outlets: [],
        activeOutletId: null,
        loading: false,
        error: mapSupabaseError(e as Error, 'Failed to load merchant details.'),
        initialized: true,
      }));
    } finally {
      store.fetchPromise = null;
    }
  })();

  return store.fetchPromise;
}

export function useMerchantContext(env: AppEnv) {
  const store = useMemo(
    () => getMerchantContextStore(env),
    [env],
  );
  const [, setVersion] = useState(0);

  useEffect(() => {
    const listener = () => {
      setVersion((current) => current + 1);
    };
    store.listeners.add(listener);
    return () => {
      store.listeners.delete(listener);
    };
  }, [store]);

  const fetchContext = useCallback(
    async () => fetchMerchantContext(store, env),
    [env, store],
  );

  useEffect(() => {
    if (store.state.initialized || store.fetchPromise) {
      return;
    }
    fetchContext().catch((err) =>
      logError(err, { context: 'useMerchantContext.fetchContext' }),
    );
  }, [fetchContext, store]);

  const setActiveOutletId = useCallback(
    (
      next:
        | string
        | null
        | ((previousId: string | null) => string | null),
    ) => {
      updateStore(store, (current) => {
        const resolved =
          typeof next === 'function' ? next(current.activeOutletId) : next;
        return {
          ...current,
          activeOutletId:
            resolved != null && String(resolved).length > 0 ? String(resolved) : null,
        };
      });
    },
    [store],
  );

  const { merchant, outlets, activeOutletId, loading, error } = store.state;

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
