import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import type { AppEnv } from '@/config/env';
import { useMerchantContext } from '@/hooks/useMerchantContext';
import { logError } from '@/observability/logError';


export type MerchantReviewRow = {
  id: string;
  rating: number;
  comment: string;
  customerName: string;
  createdAt: string;
};

export function useMerchantReviews(env: AppEnv) {
  const supabase = useMemo(() => getSupabase(env), [env]);
  const { outletScopeIds, loading: contextLoading } = useMerchantContext(env);

  const [reviews, setReviews] = useState<MerchantReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReviews = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      if (!outletScopeIds.length) {
        setReviews([]);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('reviews')
        .select(
          `
          id,
          rating,
          comment,
          created_at,
          customer:profiles(full_name)
        `,
        )
        .in('outlet_id', outletScopeIds)
        .order('created_at', { ascending: false })
        .limit(20);

      if (fetchError) {
        throw fetchError;
      }

      const mapped = ((data ?? []) as Record<string, unknown>[]).map((r) => ({
        id: String(r.id),
        rating: Number(r.rating ?? 0),
        comment: typeof r.comment === 'string' ? r.comment : '',
        customerName:
          String(
            (r.customer as Record<string, unknown> | undefined)?.full_name ??
              '',
          ) || 'Customer',
        createdAt:
          typeof r.created_at === 'string' ? r.created_at : String(r.created_at ?? ''),
      }));
      setReviews(mapped);
    } catch {
      setError('Could not load reviews.');
      setReviews([]);
    } finally {
      setLoading(false);
    }
  }, [outletScopeIds, supabase]);

  useEffect(() => {
    if (contextLoading) {
      return;
    }
    fetchReviews().catch((err) => logError(err, { context: 'useMerchantReviews.fetchReviews' }));
  }, [contextLoading, fetchReviews]);

  const averageRating =
    reviews.length > 0
      ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
      : 0;

  return {
    reviews,
    averageRating,
    loading: loading || contextLoading,
    error,
    refetch: fetchReviews,
  };
}
