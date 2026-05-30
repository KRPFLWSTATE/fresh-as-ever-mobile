/**
 * Basket reducer logic (single-shelf rule).
 */
import { scopeBasketToShelf } from '@/hooks/useClearanceBasket';

function applyQuantity(
  shelfId: string | null,
  items: Record<string, number>,
  targetShelfId: string,
  shelfItemId: string,
  quantity: number,
  maxRemaining?: number,
) {
  const qty = Math.max(0, Math.min(quantity, maxRemaining ?? quantity));
  let baseShelf = shelfId;
  let next = { ...items };
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
  return { shelfId: baseShelf, items: next };
}

describe('useClearanceBasket reducer', () => {
  it('replaces basket when shelf changes', () => {
    const first = applyQuantity('shelf-a', { item1: 2 }, 'shelf-a', 'item2', 1);
    const second = applyQuantity(first.shelfId, first.items, 'shelf-b', 'item3', 2);
    expect(second.shelfId).toBe('shelf-b');
    expect(second.items).toEqual({ item3: 2 });
  });

  it('clamps to max remaining', () => {
    const result = applyQuantity(null, {}, 'shelf-a', 'item1', 99, 3);
    expect(result.items.item1).toBe(3);
  });

  it('hides persisted items when viewing a different shelf', () => {
    expect(scopeBasketToShelf('shelf-a', { item1: 2 }, 'shelf-b')).toEqual({});
  });

  it('keeps persisted items for the active shelf only', () => {
    expect(scopeBasketToShelf('shelf-a', { item1: 2 }, 'shelf-a')).toEqual({
      item1: 2,
    });
  });
});
