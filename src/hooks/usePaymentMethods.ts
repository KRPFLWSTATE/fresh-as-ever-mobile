import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import type { AppEnv } from '@/config/env';
import { logError } from '@/observability/logError';

export const PAYMENT_META_KEY = 'saved_payment_methods' as const;

function newPaymentMethodId(): string {
  const g = globalThis as typeof globalThis & {
    crypto?: { randomUUID?: () => string };
  };
  return g.crypto?.randomUUID?.() ?? `pm-${Date.now()}`;
}

export type SavedPaymentMethod = {
  id: string;
  brand: string;
  last4: string;
  expiry: string;
  label: string;
  isDefault?: boolean;
};

function normalizeList(raw: unknown): SavedPaymentMethod[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((x) => x && typeof x === 'object' && (x as { id?: string }).id) as SavedPaymentMethod[];
}

export function usePaymentMethods(env: AppEnv, userHasSession: boolean) {
  const supabase = useMemo(() => getSupabase(env), [env]);

  const [methods, setMethods] = useState<SavedPaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const list = normalizeList(user?.user_metadata?.[PAYMENT_META_KEY]);
      setMethods(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load payment methods.');
      setMethods([]);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    if (!userHasSession) {
      setMethods([]);
      setLoading(false);
      return;
    }
    reload().catch((err) => logError(err, { context: 'usePaymentMethods.reload' }));
  }, [reload, userHasSession]);

  const persist = useCallback(
    async (next: SavedPaymentMethod[]) => {
      const safe = normalizeList(next);
      const { error: upErr } = await supabase.auth.updateUser({
        data: { [PAYMENT_META_KEY]: safe },
      });
      if (upErr) {
        throw upErr;
      }
      setMethods(safe);
    },
    [supabase],
  );

  const addMethod = useCallback(
    async (input: {
      brand: string;
      last4: string;
      expiry: string;
      label: string;
    }) => {
      const randomId = newPaymentMethodId();
      const trimmedBrand = String(input.brand || 'Card').trim() || 'Card';
      const trimmedLast =
        String(input.last4 || '')
          .replace(/\D/g, '')
          .slice(-4) || '0000';
      const trimmedExpiry = String(input.expiry || '').trim() || '—';
      const trimmedLabel =
        String(input.label || `${trimmedBrand} •••• ${trimmedLast}`).trim();
      const hadAny = methods.length > 0;
      const entry: SavedPaymentMethod = {
        id: randomId,
        brand: trimmedBrand,
        last4: trimmedLast,
        expiry: trimmedExpiry,
        label: trimmedLabel,
        isDefault: !hadAny,
      };
      const nextPrep = hadAny
        ? methods.map((m) => ({ ...m, isDefault: false }))
        : [];
      await persist([...nextPrep, entry]);
    },
    [methods, persist],
  );

  const setDefault = useCallback(
    async (id: string) => {
      const next = methods.map((m) => ({ ...m, isDefault: m.id === id }));
      await persist(next);
    },
    [methods, persist],
  );

  const removeMethod = useCallback(
    async (id: string) => {
      const filtered = methods.filter((m) => m.id !== id);
      let next = filtered;
      if (filtered.length > 0 && !filtered.some((m) => m.isDefault)) {
        next = filtered.map((m, i) => ({ ...m, isDefault: i === 0 }));
      }
      await persist(next);
    },
    [methods, persist],
  );

  return {
    methods,
    loading,
    error,
    reload,
    addMethod,
    setDefault,
    removeMethod,
  };
}
