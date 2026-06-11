import {
  DISCOVER_GUEST_SIGN_IN_COPY,
  resolveDiscoverListEmptyCopy,
  shouldShowDiscoverGuestSignIn,
} from '@/lib/discoverGuestEmptyState';

describe('discoverGuestEmptyState', () => {
  describe('shouldShowDiscoverGuestSignIn', () => {
    it('returns true for guest with empty feed after load', () => {
      expect(
        shouldShowDiscoverGuestSignIn({
          isGuest: true,
          loading: false,
          displayFeedLength: 0,
        }),
      ).toBe(true);
    });

    it('returns false while loading', () => {
      expect(
        shouldShowDiscoverGuestSignIn({
          isGuest: true,
          loading: true,
          displayFeedLength: 0,
        }),
      ).toBe(false);
    });

    it('returns false for signed-in users', () => {
      expect(
        shouldShowDiscoverGuestSignIn({
          isGuest: false,
          loading: false,
          displayFeedLength: 0,
        }),
      ).toBe(false);
    });
  });

  describe('resolveDiscoverListEmptyCopy', () => {
    it('uses guest sign-in copy instead of geo empty for guests', () => {
      expect(
        resolveDiscoverListEmptyCopy({
          isGuest: true,
          loading: false,
          listFeedLength: 0,
          displayFeedLength: 0,
          searchQuery: '',
        }),
      ).toEqual({
        ...DISCOVER_GUEST_SIGN_IN_COPY,
        kind: 'guest-sign-in',
      });
    });

    it('keeps geo empty copy for signed-in users with no nearby listings', () => {
      expect(
        resolveDiscoverListEmptyCopy({
          isGuest: false,
          loading: false,
          listFeedLength: 0,
          displayFeedLength: 0,
          searchQuery: '',
        }),
      ).toMatchObject({
        title: 'No bags or shelves nearby',
        kind: 'geo-empty',
      });
    });

    it('keeps filter empty copy when data exists but filters hide it', () => {
      expect(
        resolveDiscoverListEmptyCopy({
          isGuest: false,
          loading: false,
          listFeedLength: 0,
          displayFeedLength: 3,
          searchQuery: '',
        }),
      ).toMatchObject({
        title: 'Nothing in this category',
        kind: 'filter-empty',
      });
    });
  });
});
