import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'fae.clearanceBasket.v1';

type BasketState = {
  shelfId: string | null;
  items: Record<string, number>;
  startedAtMs: number | null;
};

export function scopeBasketToShelf(
  basketShelfId: string | null,
  items: Record<string, number>,
  targetShelfId: string | null | undefined,
): Record<string, number> {
  if (!basketShelfId || !targetShelfId || basketShelfId !== targetShelfId) {
    return {};
  }
  return items;
}

async function readStorage(): Promise<BasketState | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BasketState;
    return {
      shelfId: parsed.shelfId ?? null,
      items: parsed.items ?? {},
      startedAtMs: parsed.startedAtMs ?? null,
    };
  } catch {
    return null;
  }
}

async function writeStorage(payload: BasketState | null) {
  if (!payload?.shelfId || !Object.keys(payload.items ?? {}).length) {
    await AsyncStorage.removeItem(STORAGE_KEY);
    return;
  }
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function useClearanceBasket() {
  const [shelfId, setShelfId] = useState<string | null>(null);
  const [items, setItems] = useState<Record<string, number>>({});
  const [startedAtMs, setStartedAtMs] = useState<number | null>(null);

  const hydrateFromStorage = useCallback(() => {
    void readStorage().then((stored) => {
      if (stored?.shelfId) {
        setShelfId(stored.shelfId);
        setItems(stored.items ?? {});
        setStartedAtMs(stored.startedAtMs ?? null);
      }
    });
  }, []);

  useEffect(() => {
    hydrateFromStorage();
  }, [hydrateFromStorage]);

  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      if (state === 'active') hydrateFromStorage();
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [hydrateFromStorage]);

  const persist = useCallback(
    async (
      nextShelfId: string | null,
      nextItems: Record<string, number>,
      nextStartedAtMs: number | null,
    ) => {
      setShelfId(nextShelfId);
      setItems(nextItems);
      setStartedAtMs(nextStartedAtMs);
      await writeStorage({ shelfId: nextShelfId, items: nextItems, startedAtMs: nextStartedAtMs });
    },
    [],
  );

  const setQuantity = useCallback(
    (targetShelfId: string, shelfItemId: string, quantity: number, maxRemaining?: number) => {
      const qty = Math.max(0, Math.min(quantity, maxRemaining ?? quantity));
      setItems((prev) => {
        let baseShelf = shelfId;
        let next = { ...prev };
        if (baseShelf && baseShelf !== targetShelfId) {
          next = {};
          baseShelf = targetShelfId;
        } else if (!baseShelf) {
          baseShelf = targetShelfId;
        }
        if (qty <= 0) {
          delete next[shelfItemId];
        } else {
          next[shelfItemId] = qty;
        }
        const hasLines = Object.keys(next).length > 0;
        const started = hasLines ? Date.now() : null;
        void persist(baseShelf, next, started);
        setStartedAtMs(started);
        return next;
      });
    },
    [persist, shelfId],
  );

  const clear = useCallback(() => {
    void persist(null, {}, null);
  }, [persist]);

  const lineCount = useMemo(
    () => Object.values(items).reduce((sum, q) => sum + Number(q ?? 0), 0),
    [items],
  );

  const payloadItems = useMemo(
    () =>
      Object.entries(items)
        .filter(([, q]) => Number(q) > 0)
        .map(([shelfItemId, quantity]) => ({
          shelf_item_id: shelfItemId,
          quantity: Number(quantity),
        })),
    [items],
  );

  return {
    shelfId,
    items,
    startedAtMs,
    lineCount,
    payloadItems,
    setQuantity,
    clear,
  };
}
