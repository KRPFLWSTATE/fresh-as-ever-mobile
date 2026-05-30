import { useCallback, useMemo, useRef, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import type { AppEnv } from '@/config/env';
import { mapSupabaseError } from '@/lib/supabaseError';

const SCAN_THROTTLE_MS = 1500;

export type BarcodeProduct = {
  id?: string;
  barcode: string;
  name: string;
  brand?: string | null;
  allergens?: string[];
  is_halal_hint?: boolean | null;
  image_url?: string | null;
  category?: string | null;
  weight_grams?: number | null;
  ingredients_summary?: string | null;
};

export function useBarcodeLookup(env: AppEnv) {
  const supabase = useMemo(() => getSupabase(env), [env]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [product, setProduct] = useState<BarcodeProduct | null>(null);
  const lastScanRef = useRef({ barcode: '', at: 0 });

  const lookup = useCallback(
    async (barcode: string): Promise<BarcodeProduct | null> => {
      const code = String(barcode ?? '').trim();
      if (!code) return null;

      const now = Date.now();
      if (
        lastScanRef.current.barcode === code &&
        now - lastScanRef.current.at < SCAN_THROTTLE_MS
      ) {
        return product;
      }
      lastScanRef.current = { barcode: code, at: now };

      setLoading(true);
      setError(null);
      try {
        const { data, error: fnErr } = await supabase.functions.invoke(
          'lookup-product-barcode',
          { body: { barcode: code } },
        );
        if (fnErr) throw fnErr;
        if (data?.error) {
          setError(String(data.error));
          setProduct(null);
          return null;
        }
        const p = (data?.product ?? null) as BarcodeProduct | null;
        setProduct(p);
        return p;
      } catch (err) {
        setError(mapSupabaseError(err as Error));
        setProduct(null);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [product, supabase],
  );

  const clear = useCallback(() => {
    setProduct(null);
    setError(null);
  }, []);

  return { loading, error, product, lookup, clear };
}
