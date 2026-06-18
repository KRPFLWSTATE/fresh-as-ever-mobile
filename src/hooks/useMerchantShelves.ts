import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import type { AppEnv } from '@/config/env';
import type { ShelfItemDraft } from '@/lib/merchantShelfForm';
import { mapSupabaseError } from '@/lib/supabaseError';

export function useMerchantShelves(env: AppEnv, outletId: string | null) {
  const supabase = useMemo(() => getSupabase(env), [env]);
  const [shelves, setShelves] = useState<Record<string, unknown>[]>([]);
  const [todayShelf, setTodayShelf] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchShelves = useCallback(async () => {
    if (!outletId) {
      setShelves([]);
      setTodayShelf(null);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const today = new Date().toISOString().slice(0, 10);
      const { data, error: qErr } = await supabase
        .from('clearance_shelves')
        .select(`*, items:clearance_shelf_items (*)`)
        .eq('outlet_id', outletId)
        .order('shelf_date', { ascending: false })
        .limit(30);
      if (qErr) throw qErr;
      const rows = (data ?? []) as Record<string, unknown>[];
      setShelves(rows);
      setTodayShelf(rows.find((r) => r.shelf_date === today) ?? null);
    } catch (err) {
      setError(mapSupabaseError(err as Error));
    } finally {
      setLoading(false);
    }
  }, [outletId, supabase]);

  useEffect(() => {
    void fetchShelves();
  }, [fetchShelves]);

  const cloneYesterday = useCallback(
    async (sourceShelfId: string) => {
      const { data, error: rpcErr } = await supabase.rpc('clone_shelf_to_today', {
        p_source_shelf_id: sourceShelfId,
      });
      if (rpcErr) throw rpcErr;
      await fetchShelves();
      return data;
    },
    [fetchShelves, supabase],
  );

  const upsertShelf = useCallback(
    async ({
      pickupStart,
      pickupEnd,
      pickupWindowKind,
      notes,
      title,
      description,
      coverImageUrl,
      occasionKind,
      status,
      items,
      removedItemIds,
    }: {
      pickupStart: string;
      pickupEnd: string;
      pickupWindowKind?: string;
      notes?: string | null;
      title?: string | null;
      description?: string | null;
      coverImageUrl?: string | null;
      occasionKind?: string;
      status: 'draft' | 'published';
      items: ShelfItemDraft[];
      removedItemIds?: string[];
    }) => {
      if (!outletId) throw new Error('No outlet selected');
      const today = new Date().toISOString().slice(0, 10);
      let shelfId =
        typeof todayShelf?.id === 'string' ? todayShelf.id : undefined;

      if (!shelfId) {
        const { data: inserted, error: insErr } = await supabase
          .from('clearance_shelves')
          .insert({
            outlet_id: outletId,
            shelf_date: today,
            status,
            pickup_start: pickupStart,
            pickup_end: pickupEnd,
            pickup_window_kind: pickupWindowKind ?? 'custom',
            notes: notes ?? null,
            title: title ?? null,
            description: description ?? null,
            cover_image_url: coverImageUrl ?? null,
            occasion_kind: occasionKind ?? 'none',
            published_at: status === 'published' ? new Date().toISOString() : null,
          })
          .select()
          .single();
        if (insErr) throw insErr;
        shelfId = String(inserted.id);
      } else {
        const { error: updErr } = await supabase
          .from('clearance_shelves')
          .update({
            pickup_start: pickupStart,
            pickup_end: pickupEnd,
            pickup_window_kind: pickupWindowKind ?? 'custom',
            notes: notes ?? null,
            title: title ?? null,
            description: description ?? null,
            cover_image_url: coverImageUrl ?? null,
            occasion_kind: occasionKind ?? 'none',
            status,
            published_at:
              status === 'published' && todayShelf?.status !== 'published'
                ? new Date().toISOString()
                : todayShelf?.published_at ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', shelfId);
        if (updErr) throw updErr;
      }

      if (Array.isArray(removedItemIds) && removedItemIds.length > 0) {
        for (const id of removedItemIds) {
          await supabase
            .from('clearance_shelf_items')
            .update({ status: 'removed', updated_at: new Date().toISOString() })
            .eq('id', id);
        }
      }

      for (const [idx, item] of items.entries()) {
        const soldOut =
          item.item_status === 'sold_out' ||
          Number(item.quantity_remaining ?? 0) < 1;
        const payload = {
          name_snapshot: item.name_snapshot,
          brand_snapshot: item.brand_snapshot ?? null,
          rescue_price: item.rescue_price,
          retail_price: item.retail_price ?? null,
          quantity_total: soldOut ? 0 : item.quantity_total,
          quantity_remaining: soldOut ? 0 : item.quantity_remaining,
          allergens_snapshot: item.allergens_snapshot ?? [],
          is_halal: item.is_halal ?? null,
          image_url_snapshot: item.image_url_snapshot ?? null,
          product_id: item.product_id ?? null,
          barcode: item.barcode ?? null,
          sort_order: item.sort_order ?? idx,
          status: soldOut ? ('sold_out' as const) : ('live' as const),
          best_before: item.best_before ?? null,
          category_snapshot: item.catalog_category ?? null,
        };
        if (item.id) {
          const { error: itemErr } = await supabase
            .from('clearance_shelf_items')
            .update({ ...payload, updated_at: new Date().toISOString() })
            .eq('id', item.id);
          if (itemErr) throw itemErr;
        } else {
          const { error: itemErr } = await supabase
            .from('clearance_shelf_items')
            .insert({ shelf_id: shelfId, ...payload });
          if (itemErr) throw itemErr;
        }
      }

      await fetchShelves();
      return shelfId;
    },
    [fetchShelves, outletId, supabase, todayShelf],
  );

  const markShelfItemSoldOut = useCallback(
    async (shelfItemId: string) => {
      const { error: updErr } = await supabase
        .from('clearance_shelf_items')
        .update({
          status: 'sold_out',
          quantity_remaining: 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', shelfItemId);
      if (updErr) throw updErr;
      await fetchShelves();
    },
    [fetchShelves, supabase],
  );

  return {
    shelves,
    todayShelf,
    loading,
    error,
    refresh: fetchShelves,
    cloneYesterday,
    upsertShelf,
    markShelfItemSoldOut,
  };
}
