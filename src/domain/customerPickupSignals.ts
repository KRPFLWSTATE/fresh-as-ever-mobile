/** Merchant-facing customer pickup signal labels (F5 — on my way). */

export type CustomerPickupSignal =
  | { kind: 'at_outlet' }
  | { kind: 'en_route' }
  | null;

export function customerPickupSignal(input: {
  customer_arrived_at?: string | null;
  customer_on_the_way_at?: string | null;
}): CustomerPickupSignal {
  if (typeof input.customer_arrived_at === 'string' && input.customer_arrived_at) {
    return { kind: 'at_outlet' };
  }
  if (typeof input.customer_on_the_way_at === 'string' && input.customer_on_the_way_at) {
    return { kind: 'en_route' };
  }
  return null;
}

export function customerPickupSignalLabel(signal: CustomerPickupSignal): string | null {
  if (signal?.kind === 'at_outlet') return 'At outlet';
  if (signal?.kind === 'en_route') return 'En route';
  return null;
}

export function customerPickupSignalHeroLabel(signal: CustomerPickupSignal): string | null {
  if (signal?.kind === 'at_outlet') return 'Customer arrived';
  if (signal?.kind === 'en_route') return 'On the way';
  return null;
}

export function customerPickupSignalHeroSubcopy(signal: CustomerPickupSignal): string | null {
  if (signal?.kind === 'at_outlet') return 'At your outlet';
  if (signal?.kind === 'en_route') return 'Heading to you';
  return null;
}
