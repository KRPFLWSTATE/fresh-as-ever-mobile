import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { useAuthContext } from '@/context/AuthContext';
import { useFavourites, type FavouriteOutlet } from '@/hooks/useFavourites';
import { useUserLocation } from '@/hooks/useUserLocation';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import { stitchAmbientShadow } from '@/theme/stitchTokens';
import { categoryLabel } from '@/lib/categoryLabel';
import { StitchIcon } from '@/ui/stitch/StitchIcon';
import { StitchSurface } from '@/ui/stitch/StitchSurface';
import { StitchText } from '@/ui/stitch/StitchText';
import { StitchButton } from '@/ui/stitch/StitchButton';
import { OutletTrustBadge } from '@/components/OutletTrustBadge';
import { PersonHeartIcon } from '@/ui/PersonHeartIcon';
import { logError } from '@/observability/logError';

const FILTER_CHIPS = [
  'All Favourites',
  'Bakeries',
  'Cafés',
  'Groceries',
  'Restaurants',
] as const;

type ChipKey = (typeof FILTER_CHIPS)[number];

/** Maps Stitch chip labels → `public.outlets.category` enum values. */
const CHIP_CATEGORY: Record<Exclude<ChipKey, 'All Favourites'>, string> = {
  Bakeries: 'bakery',
  'Cafés': 'cafe',
  Groceries: 'supermarket',
  Restaurants: 'restaurant',
};

export function FavouritesScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { env, user } = useAuthContext();
  const customerId = user?.id ?? null;
  const { location: userLocation } = useUserLocation({ enabled: true });
  const userCoords =
    userLocation?.lat != null && userLocation?.lng != null
      ? { lat: userLocation.lat, lng: userLocation.lng }
      : null;
  const { favourites, loading, error, refetch, removeFavourite } = useFavourites(
    env,
    customerId,
    userCoords,
  );
  const [chip, setChip] = useState<ChipKey>('All Favourites');

  const { colors, spacing, radii } = useStitchTheme();
  const insets = useSafeAreaInsets();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        flex: { flex: 1, backgroundColor: colors.background },
        pagePad: {
          paddingHorizontal: spacing.pageMarginMobile,
          paddingBottom: spacing.xxl,
        },
        headerBlock: { marginBottom: spacing.md, gap: spacing.sm },
        chipScroll: { flexGrow: 0 },
        chipRow: {
          flexDirection: 'row',
          gap: spacing.sm,
          paddingBottom: spacing.xs,
          paddingHorizontal: spacing.pageMarginMobile,
        },
        chip: {
          flexShrink: 0,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderRadius: radii.full,
          borderWidth: StyleSheet.hairlineWidth,
        },
        gridGap: { gap: spacing.lg },
        card: {
          borderRadius: radii.xl,
          padding: spacing.md,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: `${colors.divider}99`,
          gap: spacing.sm,
          ...stitchAmbientShadow,
        },
        hero: {
          width: '100%',
          aspectRatio: 16 / 9,
          borderRadius: radii.lg,
          overflow: 'hidden',
          marginBottom: spacing.xs,
          backgroundColor: colors.surfaceContainerHighest,
        },
        heroImg: { width: '100%', height: '100%' },
        heartBtn: {
          position: 'absolute',
          top: spacing.sm + 4,
          right: spacing.sm + 4,
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: `${colors.surface}E6`,
          alignItems: 'center',
          justifyContent: 'center',
        },
        titleRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: spacing.sm,
        },
        ratingPill: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          paddingHorizontal: spacing.sm,
          paddingVertical: 4,
          borderRadius: radii.lg,
          backgroundColor: colors.surfaceContainerLow,
        },
        metaRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          marginTop: 'auto' as const,
          paddingTop: spacing.sm,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.surfaceContainerHighest,
        },
        metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
        warn: {
          backgroundColor: colors.errorContainer,
          padding: spacing.md,
          borderRadius: radii.lg,
        },
        empty: {
          flexGrow: 1,
          paddingVertical: spacing.xl,
          alignItems: 'flex-start',
          gap: spacing.md,
        },
        loader: { marginTop: spacing.xl },
      }),
    [colors, radii, spacing],
  );

  const goDiscover = useCallback(() => {
    navigation.navigate('MainTabs', { screen: 'DiscoverTab' });
  }, [navigation]);

  const filteredFavourites = useMemo(() => {
    if (chip === 'All Favourites') return favourites;
    const target = CHIP_CATEGORY[chip];
    return favourites.filter(
      (f) =>
        typeof f.category === 'string' && f.category.toLowerCase() === target,
    );
  }, [chip, favourites]);

  const openOutlet = useCallback(
    (id: string) => {
      navigation.navigate('OutletDetail', { outletId: id });
    },
    [navigation],
  );

  const renderCard = useCallback(
    ({ item }: { item: FavouriteOutlet }) => (
      <Pressable
        accessibilityRole="button"
        onPress={() => openOutlet(item.id)}
        style={({ pressed }) => ({ opacity: pressed ? 0.94 : 1 })}
      >
      <StitchSurface elevated={false} padding="none" style={styles.card}>
        <View style={styles.hero}>
          {item.image ? (
            <Image
              source={{ uri: item.image }}
              style={styles.heroImg}
              resizeMode="cover"
              accessibilityLabel={`${item.name} cover image`}
            />
          ) : (
            <View
              style={[
                StyleSheet.absoluteFill,
                { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface2 },
              ]}
            >
              <StitchIcon name="storefront" size={40} colorKey="textMuted" />
            </View>
          )}
          <Pressable
            accessibilityLabel="Remove from favourites"
            style={({ pressed }) => [styles.heartBtn, pressed && { opacity: 0.85 }]}
            onPress={(e) => {
              e.stopPropagation();
              removeFavourite(item.id).catch((err) => logError(err, { context: 'FavouritesScreen.removeFavourite' }));
            }}
          >
            <PersonHeartIcon size={22} color={colors.primary} />
          </Pressable>
        </View>
        <View style={styles.titleRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <StitchText variant="label-caps" colorKey="textMuted" style={{ marginBottom: 4 }}>
              {categoryLabel(item.category)}
            </StitchText>
            <StitchText variant="h3" colorKey="onSurface" numberOfLines={2}>
              {item.name}
            </StitchText>
          </View>
          <OutletTrustBadge
            size="sm"
            trustScore={item.trustScore}
            averageRating={item.averageRating}
            totalReviews={item.totalReviews}
            collectionRatePct={item.collectionRatePct}
            complaintRatePct={item.complaintRatePct}
            noShowRatePct={item.noShowRatePct}
          />
        </View>
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <StitchIcon name="location_on" size={18} colorKey="textMuted" />
            <StitchText variant="body-sm" colorKey="textMuted">
              {item.distanceLabel}
            </StitchText>
          </View>
          <View style={styles.metaItem}>
            <StitchIcon
              name="shopping_bag"
              size={18}
              colorKey={
                item.status === 'selling_fast'
                  ? 'success'
                  : item.status === 'sold_out_today'
                    ? 'accent'
                    : 'textMuted'
              }
            />
            <StitchText
              variant="body-sm"
              colorKey={
                item.status === 'selling_fast'
                  ? 'success'
                  : item.status === 'sold_out_today'
                    ? 'accent'
                    : 'textMuted'
              }
              style={
                item.status === 'selling_fast' ? { fontWeight: '600' } : undefined
              }
            >
              {item.status === 'selling_fast'
                ? `${item.bagsAvailable} bag${item.bagsAvailable === 1 ? '' : 's'} left`
                : item.status === 'sold_out_today'
                  ? 'Sold out today'
                  : 'No bags right now'}
            </StitchText>
          </View>
        </View>
      </StitchSurface>
      </Pressable>
    ),
    [colors.primary, colors.surface2, openOutlet, removeFavourite, styles.card, styles.hero, styles.heroImg, styles.heartBtn, styles.titleRow, styles.ratingPill, styles.metaRow, styles.metaItem],
  );

  const canGoBack = navigation.canGoBack();

  const listHeader = useMemo(
    () => (
      <View style={styles.headerBlock}>
        {canGoBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => navigation.goBack()}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.xs,
              alignSelf: 'flex-start',
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <StitchIcon name="arrow_back" size={22} colorKey="text" />
            <StitchText variant="label" colorKey="textMuted">
              Back
            </StitchText>
          </Pressable>
        ) : null}
        <StitchText variant="h1" colorKey="onSurface">
          Saved Spots
        </StitchText>
        <ScrollView
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          style={styles.chipScroll}
          contentContainerStyle={styles.chipRow}
        >
          {FILTER_CHIPS.map((label) => {
            const selected = chip === label;
            return (
              <Pressable
                key={label}
                onPress={() => setChip(label)}
                style={({ pressed }) => [
                  styles.chip,
                  {
                    backgroundColor: selected ? colors.primaryContainer : colors.surface2,
                    borderColor: selected ? colors.primaryContainer : colors.outlineVariant,
                    borderWidth: StyleSheet.hairlineWidth,
                    opacity: pressed ? 0.92 : 1,
                  },
                ]}
              >
                <StitchText
                  variant="label"
                  colorKey={selected ? 'onPrimary' : 'textMuted'}
                >
                  {label}
                </StitchText>
              </Pressable>
            );
          })}
        </ScrollView>
        {!user ? (
          <View style={styles.warn}>
            <StitchText variant="body-sm" colorKey="onErrorContainer">
              Sign in to sync saved outlets.
            </StitchText>
          </View>
        ) : null}
        {error ? (
          <View style={styles.warn}>
            <StitchText variant="body-sm" colorKey="onErrorContainer">
              {error}
            </StitchText>
          </View>
        ) : null}
      </View>
    ),
    [
      canGoBack,
      chip,
      colors,
      error,
      navigation,
      spacing.xs,
      user,
      styles.chip,
      styles.chipRow,
      styles.chipScroll,
      styles.headerBlock,
      styles.warn,
    ],
  );

  const listEmpty = useMemo(() => {
    if (loading) return null;
    return (
      <View style={styles.empty}>
        <StitchText variant="body-md" colorKey="textMuted" style={{ textAlign: 'left' }}>
          No saved outlets yet. Heart an outlet from a rescue bag detail.
        </StitchText>
        <StitchButton
          title="Browse Discover"
          onPress={goDiscover}
          style={{ alignSelf: 'flex-start' }}
        />
      </View>
    );
  }, [goDiscover, loading, styles.empty]);

  const listBottomPad = spacing.xxl + insets.bottom;

  return (
    <View style={styles.flex}>
      {loading && favourites.length === 0 ? (
        <View style={[styles.pagePad, { flex: 1, paddingBottom: listBottomPad }]}>
          {listHeader}
          <ActivityIndicator style={styles.loader} color={colors.primaryContainer} />
        </View>
      ) : (
        <FlatList
          data={filteredFavourites}
          keyExtractor={(i) => i.id}
          contentContainerStyle={[styles.pagePad, styles.gridGap, { paddingBottom: listBottomPad }]}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={listEmpty}
          refreshControl={
            <RefreshControl
              refreshing={loading && favourites.length > 0}
              onRefresh={() => {
                refetch().catch((err) => logError(err, { context: 'FavouritesScreen.refetch' }));
              }}
            />
          }
          renderItem={renderCard}
          ListFooterComponent={
            favourites.length > 0 ? (
              <View
                style={{
                  paddingTop: spacing.lg,
                  paddingBottom: spacing.lg + insets.bottom,
                  alignItems: 'center',
                }}
              >
                {filteredFavourites.length === 0 ? (
                  <StitchText
                    variant="body-sm"
                    colorKey="textMuted"
                    style={{ textAlign: 'center', marginBottom: spacing.md }}
                  >
                    No {chip.toLowerCase()} match your current filter.
                  </StitchText>
                ) : null}
                <StitchButton
                  title="Browse Discover"
                  variant="secondary"
                  onPress={goDiscover}
                  style={{ alignSelf: 'stretch' }}
                />
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}
