import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'fae.clearanceBasket.v1';

type BasketState = {
  shelfId: string | null;
  items: Record<string, number>;
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
    return JSON.parse(raw) as BasketState;
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

  useEffect(() => {
    void readStorage().then((stored) => {
      if (stored?.shelfId) {
        setShelfId(stored.shelfId);
        setItems(stored.items ?? {});
      }
    });
  }, []);

  const persist = useCallback(async (nextShelfId: string | null, nextItems: Record<string, number>) => {
    setShelfId(nextShelfId);
    setItems(nextItems);
    await writeStorage({ shelfId: nextShelfId, items: nextItems });
  }, []);

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
        void persist(baseShelf, next);
        return next;
      });
    },
    [persist, shelfId],
  );

  const clear = useCallback(() => {
    void persist(null, {});
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
    lineCount,
    payloadItems,
    setQuantity,
    clear,
  };
}
