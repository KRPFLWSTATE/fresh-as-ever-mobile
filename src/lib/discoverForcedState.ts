/** Parity with web `discover?state=` empty / edge states. */

export const DISCOVER_FORCED_EMPTY_STATES = [
  'empty-search',
  'no-results',
  'no-bags-nearby',
  'no-listings-nearby',
  'no-shelves-yet',
  'sold-out',
] as const;

export type DiscoverForcedState = (typeof DISCOVER_FORCED_EMPTY_STATES)[number];

export function parseDiscoverState(raw: unknown): DiscoverForcedState | null {
  const v = String(raw ?? '')
    .trim()
    .toLowerCase();
  return DISCOVER_FORCED_EMPTY_STATES.includes(v as DiscoverForcedState)
    ? (v as DiscoverForcedState)
    : null;
}

export const DISCOVER_EMPTY_COPY: Record<
  DiscoverForcedState,
  { title: string; body: string }
> = {
  'empty-search': {
    title: 'Search for meals, bakeries, and more',
    body: "Try a food type, merchant name, or neighborhood to discover today's offers.",
  },
  'no-results': {
    title: 'No bags found',
    body: 'Try a different search or widen your area to see more rescues.',
  },
  'no-bags-nearby': {
    title: 'No bags nearby right now',
    body: 'Check again later. Merchants publish new rescue bags throughout the day.',
  },
  'no-listings-nearby': {
    title: 'No bags or shelves nearby',
    body: 'Check again later — merchants publish rescue bags and clearance shelves throughout the day.',
  },
  'no-shelves-yet': {
    title: 'No clearance shelves yet',
    body: 'Supermarkets publish daily shelves when stock is ready. Rescue bags may still be available nearby.',
  },
  'sold-out': {
    title: 'Missed out today',
    body: 'Everything listed nearby sold quickly. Check back soon for new bags.',
  },
};
