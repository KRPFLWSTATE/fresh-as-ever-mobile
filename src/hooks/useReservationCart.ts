import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CART_KEY = 'fae.reservationCart.v1';
export const MAX_GROUP_BAGS = 5;

export type ReservationCartBag = {
  id: string;
  outletId: string;
  title: string;
  rescuePrice: number;
};

export type ReservationCartState = {
  outletId: string | null;
  bagIds: string[];
  bags: ReservationCartBag[];
};

const EMPTY: ReservationCartState = {
  outletId: null,
  bagIds: [],
  bags: [],
};

async function readCart(): Promise<ReservationCartState> {
  try {
    const raw = await AsyncStorage.getItem(CART_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as ReservationCartState;
    if (!parsed || !Array.isArray(parsed.bagIds)) return EMPTY;
    return {
      outletId: parsed.outletId ?? null,
      bagIds: parsed.bagIds.slice(0, MAX_GROUP_BAGS),
      bags: Array.isArray(parsed.bags) ? parsed.bags.slice(0, MAX_GROUP_BAGS) : [],
    };
  } catch {
    return EMPTY;
  }
}

async function writeCart(state: ReservationCartState): Promise<void> {
  await AsyncStorage.setItem(CART_KEY, JSON.stringify(state));
}

export function useReservationCart() {
  const [cart, setCart] = useState<ReservationCartState>(EMPTY);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void readCart().then((c) => {
      setCart(c);
      setReady(true);
    });
  }, []);

  const persist = useCallback(async (next: ReservationCartState) => {
    setCart(next);
    await writeCart(next);
  }, []);

  const addBag = useCallback(
    async (bag: ReservationCartBag, options?: { replaceOutlet?: boolean }) => {
      const current = await readCart();
      if (
        current.outletId &&
        current.outletId !== bag.outletId &&
        !options?.replaceOutlet
      ) {
        return { error: 'different_outlet' as const };
      }
      if (current.bagIds.includes(bag.id)) {
        return { ok: true as const };
      }
      if (current.bagIds.length >= MAX_GROUP_BAGS) {
        return { error: 'cart_full' as const };
      }
      const next: ReservationCartState = {
        outletId: bag.outletId,
        bagIds: [...current.bagIds, bag.id],
        bags: [...current.bags, bag],
      };
      await persist(next);
      return { ok: true as const };
    },
    [persist],
  );

  const removeBag = useCallback(
    async (bagId: string) => {
      const current = await readCart();
      const bagIds = current.bagIds.filter((id) => id !== bagId);
      const bags = current.bags.filter((b) => b.id !== bagId);
      const next: ReservationCartState = {
        outletId: bagIds.length ? current.outletId : null,
        bagIds,
        bags,
      };
      await persist(next);
    },
    [persist],
  );

  const clear = useCallback(async () => {
    await persist(EMPTY);
  }, [persist]);

  const replaceOutletCart = useCallback(
    async (bag: ReservationCartBag) => {
      await persist({
        outletId: bag.outletId,
        bagIds: [bag.id],
        bags: [bag],
      });
      return { ok: true as const };
    },
    [persist],
  );

  return useMemo(
    () => ({
      cart,
      ready,
      count: cart.bagIds.length,
      addBag,
      removeBag,
      clear,
      replaceOutletCart,
      isInCart: (bagId: string) => cart.bagIds.includes(bagId),
    }),
    [cart, ready, addBag, removeBag, clear, replaceOutletCart],
  );
}
