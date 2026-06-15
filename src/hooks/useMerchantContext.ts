import type { Session, User } from '@supabase/supabase-js';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuthContext } from '@/context/AuthContext';
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
  /** Explicit merchant outlet pick — survives fetchContext races (Pass 25 KB-04). */
  pinnedOutletId: string | null;
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
    pinnedOutletId: null,
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

export function resetMerchantContextStore(env: AppEnv): void {
  const store = merchantContextStores.get(getStoreKey(env));
  if (!store) {
    return;
  }
  store.fetchPromise = null;
  store.state = createInitialState();
  emitStore(store);
}

/** Synchronous outlet pin for deeplinks / QA runners (Pass 25 KB-04). */
export function pinMerchantActiveOutlet(env: AppEnv, outletId: string): void {
  const id = String(outletId ?? '').trim();
  if (!id) return;
  const store = getMerchantContextStore(env);
  updateStore(store, (current) => ({
    ...current,
    activeOutletId: id,
    pinnedOutletId: id,
  }));
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
  authSession?: Session | null,
): Promise<void> {
  const supabase = getSupabase(env);
  if (authSession?.access_token && authSession.refresh_token) {
    store.fetchPromise = null;
  }

  if (store.fetchPromise) {
    return store.fetchPromise;
  }

  store.fetchPromise = (async () => {
    updateStore(store, (current) => ({
      ...current,
      loading: true,
      error: null,
    }));

    try {
      let liveSession = (
        await supabase.auth.getSession()
      ).data.session;

      if (
        authSession?.access_token &&
        authSession.refresh_token &&
        (!liveSession?.access_token ||
          liveSession.access_token !== authSession.access_token)
      ) {
        const { data: setData, error: setSessionError } = await supabase.auth.setSession({
          access_token: authSession.access_token,
          refresh_token: authSession.refresh_token,
        });
        if (setSessionError) {
          throw setSessionError;
        }
        liveSession = setData.session ?? (await supabase.auth.getSession()).data.session;
      }

      if (!liveSession?.access_token && authSession?.access_token) {
        for (let attempt = 0; attempt < 8; attempt += 1) {
          await new Promise<void>((resolve) => {
            setTimeout(() => resolve(), 400);
          });
          liveSession = (await supabase.auth.getSession()).data.session;
          if (liveSession?.access_token) {
            break;
          }
        }
      }

      if (!liveSession?.access_token || !liveSession.user) {
        updateStore(store, () => ({
          merchant: null,
          outlets: [],
          activeOutletId: null,
          pinnedOutletId: null,
          loading: false,
          error: 'Not authenticated',
          initialized: true,
        }));
        return;
      }

      const verifiedUser = liveSession.user;

      const { error: linkStaffError } = await supabase.rpc(
        'link_merchant_staff_from_email',
      );
      if (linkStaffError) {
        logSupabaseError(linkStaffError, 'useMerchantContext.linkStaff');
      }

      let { data: merchantRows, error: merchantError } = await supabase
        .from('merchants')
        .select('*')
        .eq('owner_id', verifiedUser.id)
        .order('created_at', { ascending: true });

      if (merchantError) {
        throw merchantError;
      }

      if (!merchantRows?.length) {
        const retry = await supabase
          .from('merchants')
          .select('*')
          .eq('owner_id', verifiedUser.id)
          .order('created_at', { ascending: true });
        if (retry.error) {
          throw retry.error;
        }
        merchantRows = retry.data;
      }

      if (__DEV__ && !merchantRows?.length) {
        // eslint-disable-next-line no-console
        console.warn('[useMerchantContext] no merchants for owner', verifiedUser.id);
      }

      let merchantData = (merchantRows?.[0] as MerchantProfile | undefined) ?? null;

      if (!merchantData?.id) {
        const { data: staffLink, error: staffErr } = await supabase
          .from('merchant_staff')
          .select('merchant_id')
          .eq('user_id', verifiedUser.id)
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
          pinnedOutletId: null,
          loading: false,
          error: null,
          initialized: true,
        }));
        return;
      }

      const merchantIds =
        (merchantRows?.length ?? 0) > 0
          ? merchantRows!.map((row) => String(row.id))
          : [String(merchantData.id)];

      const { data: outletsData, error: outletsError } = await supabase
        .from('outlets')
        .select('*')
        .in('merchant_id', merchantIds);

      if (outletsError) {
        throw outletsError;
      }

      const nextOutlets = (outletsData ?? []) as MerchantOutlet[];
      const { activeOutletId: liveActiveId, pinnedOutletId } = store.state;
      const demoOutletId = '00000000-0000-0000-0000-000000000003';
      const preferredDemo = nextOutlets.find(
        (outlet) => String(outlet.id) === demoOutletId,
      );
      const preferredHybrid = nextOutlets.find(
        (outlet) => String(outlet.category ?? '').toLowerCase() === 'hybrid',
      );
      const outletInRoster = (id: string | null | undefined) =>
        id != null &&
        nextOutlets.some((outlet) => String(outlet.id) === String(id));
      const explicitPick = [liveActiveId, pinnedOutletId].find((id) =>
        outletInRoster(id),
      );
      const nextActiveOutletId =
        nextOutlets.length > 0
          ? explicitPick
            ? String(explicitPick)
            : preferredHybrid
              ? String(preferredHybrid.id)
              : preferredDemo
                ? String(preferredDemo.id)
                : String(nextOutlets[0]?.id ?? '')
          : null;

      updateStore(store, (current) => ({
        merchant: merchantData,
        outlets: nextOutlets,
        activeOutletId: nextActiveOutletId,
        pinnedOutletId:
          nextActiveOutletId != null &&
          String(current.pinnedOutletId) === String(nextActiveOutletId)
            ? current.pinnedOutletId
            : outletInRoster(current.pinnedOutletId)
              ? current.pinnedOutletId
              : null,
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
        pinnedOutletId: null,
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
  const { session, initializing: authInitializing } = useAuthContext();
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
    async (authSession?: Session | null) =>
      fetchMerchantContext(store, env, authSession ?? session),
    [env, session, store],
  );

  useEffect(() => {
    if (authInitializing) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      if (cancelled) return;

      if (!session) {
        updateStore(store, () => ({
          merchant: null,
          outlets: [],
          activeOutletId: null,
          pinnedOutletId: null,
          loading: false,
          error: null,
          initialized: true,
        }));
        return;
      }

      store.fetchPromise = null;

      await fetchContext(session).catch((err) =>
        logError(err, { context: 'useMerchantContext.fetchContext' }),
      );
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [authInitializing, session?.access_token, env, fetchContext, store]);

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
        const nextId =
          resolved != null && String(resolved).length > 0 ? String(resolved) : null;
        return {
          ...current,
          activeOutletId: nextId,
          pinnedOutletId: nextId,
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
