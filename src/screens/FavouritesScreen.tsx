import React, { useCallback, useMemo, useState } from 'react';
import {
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
  { label: 'All Favourites', icon: 'favorite' as const, category: null },
  { label: 'Bakeries', icon: 'bakery_dining' as const, category: 'bakery' },
  { label: 'Cafés', icon: 'local_cafe' as const, category: 'cafe' },
  { label: 'Groceries', icon: 'shopping_bag' as const, category: 'supermarket' },
  { label: 'Restaurants', icon: 'restaurant' as const, category: 'restaurant' },
] as const;

type ChipKey = (typeof FILTER_CHIPS)[number]['label'];

function FavouritesSkeleton({
  colors,
  spacing,
  radii,
}: {
  colors: ReturnType<typeof useStitchTheme>['colors'];
  spacing: ReturnType<typeof useStitchTheme>['spacing'];
  radii: ReturnType<typeof useStitchTheme>['radii'];
}): React.ReactElement {
  return (
    <View style={{ gap: spacing.lg, paddingTop: spacing.md }}>
      {[0, 1].map((k) => (
        <View
          key={k}
          style={{
            borderRadius: radii.xl,
            overflow: 'hidden',
            backgroundColor: colors.surface,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: `${colors.divider}99`,
            ...stitchAmbientShadow,
          }}
        >
          <View
            style={{
              width: '100%',
              aspectRatio: 16 / 9,
              backgroundColor: colors.surfaceContainerHighest,
            }}
          />
          <View style={{ padding: spacing.md, gap: spacing.sm }}>
            <View
              style={{
                height: 12,
                width: '28%',
                borderRadius: radii.default,
                backgroundColor: colors.surfaceContainerHighest,
              }}
            />
            <View
              style={{
                height: 18,
                width: '72%',
                borderRadius: radii.default,
                backgroundColor: colors.surfaceContainerHighest,
              }}
            />
            <View
              style={{
                height: 12,
                width: '45%',
                borderRadius: radii.default,
                backgroundColor: colors.surfaceContainerLow,
              }}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

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
        headerBlock: { marginBottom: spacing.lg, gap: spacing.sm },
        chipScroll: { flexGrow: 0, marginTop: spacing.xs },
        chipRow: {
          flexDirection: 'row',
          gap: spacing.sm,
          paddingBottom: spacing.xs,
        },
        chip: {
          flexShrink: 0,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderRadius: radii.full,
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
          ...stitchAmbientShadow,
        },
        titleRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: spacing.sm,
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
        emptyCard: {
          borderRadius: radii.xl,
          padding: spacing.xl,
          alignItems: 'center',
          gap: spacing.md,
          backgroundColor: colors.surface,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: `${colors.divider}80`,
          ...stitchAmbientShadow,
        },
        emptyIconWrap: {
          width: 72,
          height: 72,
          borderRadius: 36,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.primaryHighlight,
        },
        sectionLabel: {
          marginTop: spacing.xs,
          marginBottom: spacing.sm,
        },
      }),
    [colors, radii, spacing],
  );

  const goDiscover = useCallback(() => {
    navigation.navigate('MainTabs', { screen: 'DiscoverTab' });
  }, [navigation]);

  const filteredFavourites = useMemo(() => {
    if (chip === 'All Favourites') return favourites;
    const target = FILTER_CHIPS.find((c) => c.label === chip)?.category;
    if (!target) return favourites;
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
                removeFavourite(item.id).catch((err) =>
                  logError(err, { context: 'FavouritesScreen.removeFavourite' }),
                );
              }}
            >
              <PersonHeartIcon size={22} color={colors.primary} />
            </Pressable>
          </View>
          <View style={styles.titleRow}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <StitchText variant="label-caps" colorKey="primaryContainer" style={{ marginBottom: 4 }}>
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
    [
      colors.primary,
      colors.surface2,
      openOutlet,
      removeFavourite,
      styles.card,
      styles.hero,
      styles.heroImg,
      styles.heartBtn,
      styles.titleRow,
      styles.metaRow,
      styles.metaItem,
    ],
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
            <StitchIcon name="arrow_back" size={22} colorKey="primaryContainer" />
            <StitchText variant="label" colorKey="primaryContainer">
              Back
            </StitchText>
          </Pressable>
        ) : null}
        <View style={{ gap: spacing.xs }}>
          <StitchText variant="h1" colorKey="onSurface">
            Saved Spots
          </StitchText>
          <StitchText variant="body-md" colorKey="textMuted">
            Outlets you&apos;ve hearted from rescue bag details — quick access when you&apos;re hungry.
          </StitchText>
        </View>
        <ScrollView
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          style={styles.chipScroll}
          contentContainerStyle={styles.chipRow}
        >
          {FILTER_CHIPS.map(({ label, icon }) => {
            const selected = chip === label;
            return (
              <Pressable
                key={label}
                onPress={() => setChip(label)}
                style={({ pressed }) => [
                  styles.chip,
                  selected
                    ? {
                        backgroundColor: colors.primaryContainer,
                        ...stitchAmbientShadow,
                      }
                    : {
                        backgroundColor: colors.surface,
                        borderWidth: 1,
                        borderColor: colors.divider,
                      },
                  { opacity: pressed ? 0.92 : 1 },
                ]}
              >
                <StitchIcon
                  name={icon}
                  size={18}
                  colorKey={selected ? 'onPrimary' : 'onSurface'}
                />
                <StitchText
                  variant="label"
                  colorKey={selected ? 'onPrimary' : 'text'}
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
        {favourites.length > 0 && !loading ? (
          <StitchText variant="label-caps" colorKey="textMuted" style={styles.sectionLabel}>
            {filteredFavourites.length} saved outlet
            {filteredFavourites.length === 1 ? '' : 's'}
            {chip !== 'All Favourites' ? ` · ${chip}` : ''}
          </StitchText>
        ) : null}
      </View>
    ),
    [
      canGoBack,
      chip,
      colors,
      error,
      favourites.length,
      filteredFavourites.length,
      loading,
      navigation,
      spacing.xs,
      user,
      styles.chip,
      styles.chipRow,
      styles.chipScroll,
      styles.headerBlock,
      styles.sectionLabel,
      styles.warn,
    ],
  );

  const listEmpty = useMemo(() => {
    if (loading) return null;
    if (chip !== 'All Favourites' && favourites.length > 0) {
      return (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIconWrap}>
            <StitchIcon name="filter_list" size={32} colorKey="primaryContainer" />
          </View>
          <StitchText variant="h3" colorKey="onSurface" style={{ textAlign: 'center' }}>
            No {chip.toLowerCase()} yet
          </StitchText>
          <StitchText variant="body-md" colorKey="textMuted" style={{ textAlign: 'center' }}>
            Try another category filter or browse Discover to find more spots.
          </StitchText>
          <StitchButton
            title="Show all favourites"
            variant="secondary"
            onPress={() => setChip('All Favourites')}
            style={{ alignSelf: 'stretch' }}
          />
        </View>
      );
    }
    return (
      <View style={styles.emptyCard}>
        <View style={styles.emptyIconWrap}>
          <PersonHeartIcon size={34} color={colors.primaryContainer} />
        </View>
        <StitchText variant="h3" colorKey="onSurface" style={{ textAlign: 'center' }}>
          No saved spots yet
        </StitchText>
        <StitchText variant="body-md" colorKey="textMuted" style={{ textAlign: 'center' }}>
          Tap the heart on a rescue bag detail page to save an outlet here for faster re-orders.
        </StitchText>
        <StitchButton title="Browse Discover" onPress={goDiscover} style={{ alignSelf: 'stretch' }} />
      </View>
    );
  }, [
    chip,
    colors.primaryContainer,
    favourites.length,
    goDiscover,
    loading,
    styles.emptyCard,
    styles.emptyIconWrap,
  ]);

  const listBottomPad = spacing.xxl + insets.bottom;

  return (
    <View style={styles.flex}>
      {loading && favourites.length === 0 ? (
        <View style={[styles.pagePad, { flex: 1, paddingBottom: listBottomPad }]}>
          {listHeader}
          <FavouritesSkeleton colors={colors} spacing={spacing} radii={radii} />
        </View>
      ) : (
        <FlatList
          data={filteredFavourites}
          keyExtractor={(i) => i.id}
          style={{ flex: 1 }}
          contentContainerStyle={[styles.pagePad, styles.gridGap, { paddingBottom: listBottomPad }]}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={listEmpty}
          refreshControl={
            <RefreshControl
              refreshing={loading && favourites.length > 0}
              onRefresh={() => {
                refetch().catch((err) =>
                  logError(err, { context: 'FavouritesScreen.refetch' }),
                );
              }}
              tintColor={colors.primaryContainer}
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
