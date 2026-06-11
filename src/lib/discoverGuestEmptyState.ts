/** Discover feed empty state when the customer is not signed in. */

export const DISCOVER_GUEST_SIGN_IN_COPY = {
  title: 'Sign in to see rescue bags and clearance shelves near you',
  body: 'Log in to browse live rescues and daily clearance shelves from merchants around you.',
  cta: 'Sign in',
} as const;

export type DiscoverListEmptyKind = 'guest-sign-in' | 'filter-empty' | 'geo-empty';

export function shouldShowDiscoverGuestSignIn(params: {
  isGuest: boolean;
  loading: boolean;
  displayFeedLength: number;
}): boolean {
  return params.isGuest && !params.loading && params.displayFeedLength === 0;
}

export function resolveDiscoverListEmptyCopy(params: {
  isGuest: boolean;
  loading: boolean;
  listFeedLength: number;
  displayFeedLength: number;
  searchQuery: string;
}): { title: string; body: string; kind: DiscoverListEmptyKind } {
  if (
    shouldShowDiscoverGuestSignIn({
      isGuest: params.isGuest,
      loading: params.loading,
      displayFeedLength: params.displayFeedLength,
    })
  ) {
    return { ...DISCOVER_GUEST_SIGN_IN_COPY, kind: 'guest-sign-in' };
  }

  if (params.listFeedLength === 0 && params.displayFeedLength > 0) {
    const q = params.searchQuery.trim();
    if (q) {
      return {
        title: 'No matches for your search',
        body: 'Try different words or tap See all for full results.',
        kind: 'filter-empty',
      };
    }
    return {
      title: 'Nothing in this category',
      body: 'Try another filter or pick All to see every rescue nearby.',
      kind: 'filter-empty',
    };
  }

  return {
    title: 'No bags or shelves nearby',
    body: 'Pull to refresh or widen your pickup area search.',
    kind: 'geo-empty',
  };
}
