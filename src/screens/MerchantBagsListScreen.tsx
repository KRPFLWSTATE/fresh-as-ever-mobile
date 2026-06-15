import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useMerchantRescueBagGuard } from '@/hooks/useMerchantRescueBagGuard';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { useAuthContext } from '@/context/AuthContext';
import { useMerchantBags, type MerchantBagRow } from '@/hooks/useMerchantBags';
import { useScrollContentBottomPad } from '@/lib/useScrollContentBottomPad';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import {
  StitchIcon,
  StitchScreen,
  StitchSurface,
  StitchText,
} from '@/ui/stitch';
import { logError } from '@/observability/logError';

type BagTab = 'all' | 'live' | 'drafts' | 'sold';

function normalizeStatus(status: string): string {
  return status.trim().toLowerCase();
}

/** Inventory slice used for Stitch-style tabs (HTML: All / Live / Drafts / Sold out). */
function bagInventoryKind(b: MerchantBagRow): 'live' | 'draft' | 'sold' | 'other' {
  const st = normalizeStatus(b.status);
  const qty = b.quantity_available ?? 0;
  if (st === 'draft') return 'draft';
  if (st === 'sold_out' || st === 'sold-out') return 'sold';
  if (st === 'live' && qty > 0) return 'live';
  if (st === 'live' && qty <= 0) return 'sold';
  return 'other';
}

function formatBagPickupLine(
  item: MerchantBagRow,
  kind: 'live' | 'draft' | 'sold',
): string {
  const start = item.pickup_start;
  const end = item.pickup_end;
  if (!start || !end) {
    return 'Pickup: Not set';
  }
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
    return 'Pickup: Not set';
  }
  const tf: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
  if (kind === 'sold' && Date.now() > e.getTime()) {
    return `Pickup: Ended at ${e.toLocaleTimeString(undefined, tf)}`;
  }
  return `Pickup: ${s.toLocaleTimeString(undefined, tf)} - ${e.toLocaleTimeString(undefined, tf)}`;
}

type CreateStylesArgs = {
  spacing: ReturnType<typeof useStitchTheme>['spacing'];
  radii: ReturnType<typeof useStitchTheme>['radii'];
};

function createStyles({ spacing, radii }: CreateStylesArgs) {
  return StyleSheet.create({
    flexOne: { flex: 1 },
    listContent: {
      paddingTop: spacing.sm,
      paddingBottom: spacing.xxl,
      paddingHorizontal: spacing.pageMarginMobile,
    },
    center: { padding: spacing.xl, alignItems: 'center' },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: spacing.md,
      marginBottom: spacing.lg,
    },
    headerTitles: { flex: 1, minWidth: 0 },
    tabRow: {
      flexDirection: 'row',
      flexWrap: 'nowrap',
      alignItems: 'center',
      gap: spacing.md,
      paddingRight: spacing.md,
    },
    tabBtn: {
      paddingBottom: spacing.sm,
      paddingHorizontal: spacing.sm,
    },
    cardHero: {
      height: 180,
      width: '100%',
    },
    cardBody: {
      padding: spacing.md,
      flexGrow: 1,
      gap: spacing.xs,
    },
    cardFooter: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      marginTop: 'auto',
      paddingTop: spacing.md,
      gap: spacing.sm,
    },
    scheduleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginBottom: spacing.md,
    },
    statusPill: {
      position: 'absolute',
      top: spacing.sm + 4,
      right: spacing.sm + 4,
      zIndex: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: 999,
    },
    moreBtn: {
      width: 40,
      height: 40,
      borderRadius: 4,
      alignItems: 'center',
      justifyContent: 'center',
    },
    smallCta: {
      minHeight: 40,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radii.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}

type MerchantBagsListScreenProps = {
  /** Mounted on merchant bottom tab — no clearance redirect. */
  embeddedInTab?: boolean;
};

export function MerchantBagsListScreen({ embeddedInTab: _embeddedInTab }: MerchantBagsListScreenProps = {}) {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { env } = useAuthContext();
  const { colors, spacing, radii } = useStitchTheme();
  const scrollBottomPad = useScrollContentBottomPad();
  const styles = useMemo(() => createStyles({ spacing, radii }), [spacing, radii]);

  const { allowed: bagsAllowed, goToShelves } = useMerchantRescueBagGuard();
  const {
    bags,
    loading,
    error,
    refetch,
    deleteBag,
    activeOutlet,
  } = useMerchantBags(env);

  const [tab, setTab] = useState<BagTab>('all');

  useFocusEffect(
    useCallback(() => {
      if (!bagsAllowed) return;
      refetch().catch((err) => logError(err, { context: 'MerchantBagsListScreen.refetch' }));
    }, [bagsAllowed, refetch]),
  );

  const baseBags = useMemo(
    () => bags.filter((b) => normalizeStatus(b.status) !== 'removed'),
    [bags],
  );

  const counts = useMemo(() => {
    let live = 0;
    let drafts = 0;
    let sold = 0;
    for (const b of baseBags) {
      const k = bagInventoryKind(b);
      if (k === 'live') live += 1;
      else if (k === 'draft') drafts += 1;
      else if (k === 'sold') sold += 1;
    }
    return { all: baseBags.length, live, drafts, sold };
  }, [baseBags]);

  const visibleBags = useMemo(() => {
    if (tab === 'all') return baseBags;
    return baseBags.filter((b) => {
      const k = bagInventoryKind(b);
      if (tab === 'live') return k === 'live';
      if (tab === 'drafts') return k === 'draft';
      if (tab === 'sold') return k === 'sold';
      return true;
    });
  }, [baseBags, tab]);

  const confirmRemove = useCallback(
    (id: string, title: string) => {
      Alert.alert(
        'Remove bag',
        `Mark "${title}" as removed from listing?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => {
              void deleteBag(id).then((r) => {
                if (r.error) {
                  Alert.alert('Could not remove', r.error);
                }
              });
            },
          },
        ],
      );
    },
    [deleteBag],
  );

  const openBagActions = useCallback(
    (item: MerchantBagRow) => {
      Alert.alert(item.title, undefined, [
        {
          text: 'Edit',
          onPress: () =>
            navigation.navigate('MerchantBagEdit', { bagId: item.id }),
        },
        {
          text: 'Remove from listing',
          style: 'destructive',
          onPress: () => confirmRemove(item.id, item.title),
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
    },
    [confirmRemove, navigation],
  );

  const tabDefs: { key: BagTab; label: (n: number) => string }[] = useMemo(
    () => [
      { key: 'all', label: (n) => `All Bags (${n})` },
      { key: 'live', label: (n) => `Live (${n})` },
      { key: 'drafts', label: (n) => `Drafts (${n})` },
      { key: 'sold', label: (n) => `Sold Out (${n})` },
    ],
    [],
  );

  const tabRow = useMemo(
    () => (
      <View
        style={{
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.divider,
          paddingBottom: spacing.xs,
          marginBottom: spacing.lg,
        }}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabRow}
        >
          {tabDefs.map(({ key, label }) => {
            const active = tab === key;
            const n =
              key === 'all'
                ? counts.all
                : key === 'live'
                  ? counts.live
                  : key === 'drafts'
                    ? counts.drafts
                    : counts.sold;
            return (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setTab(key)}
                style={[
                  styles.tabBtn,
                  {
                    borderBottomWidth: active ? 2 : 0,
                    borderBottomColor: active ? colors.primaryContainer : 'transparent',
                    marginBottom: -StyleSheet.hairlineWidth,
                  },
                ]}
              >
                <StitchText
                  variant="label"
                  colorKey={active ? 'onBackground' : 'textMuted'}
                  numberOfLines={1}
                >
                  {label(n)}
                </StitchText>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    ),
    [
      colors.divider,
      colors.primaryContainer,
      counts.all,
      counts.drafts,
      counts.live,
      counts.sold,
      spacing.lg,
      spacing.xs,
      styles.tabBtn,
      styles.tabRow,
      tab,
      tabDefs,
    ],
  );

  const renderItem = useCallback(
    ({ item }: { item: MerchantBagRow }) => {
      const kind = bagInventoryKind(item);
      const displayKind: 'live' | 'draft' | 'sold' =
        kind === 'draft' ? 'draft' : kind === 'sold' ? 'sold' : 'live';
      const pickupLine = formatBagPickupLine(item, displayKind);
      const retail = item.retail_value_estimate;
      const showStrike =
        retail != null && Number.isFinite(retail) && retail > item.rescue_price;

      const statusPillBg =
        displayKind === 'live'
          ? `${colors.surface}E6`
          : displayKind === 'draft'
            ? `${colors.surfaceContainer}E6`
            : `${colors.errorContainer}E6`;
      const statusBorder =
        displayKind === 'draft'
          ? { borderWidth: 1, borderColor: `${colors.outlineVariant}4D` as const }
          : {};

      const dotColor =
        displayKind === 'live'
          ? colors.success
          : displayKind === 'draft'
            ? colors.outline
            : colors.error;

      const statusLabel =
        displayKind === 'live'
          ? `Live • ${item.quantity_available ?? 0} Left`
          : displayKind === 'draft'
            ? 'Draft'
            : 'Sold Out';

      const statusTextColorKey =
        displayKind === 'sold' ? 'onErrorContainer' : displayKind === 'draft' ? 'textMuted' : 'text';

      const rescueColorKey =
        displayKind === 'live' ? 'accent' : 'textMuted';

      return (
        <View
          style={{
            marginBottom: spacing.md,
            opacity: displayKind === 'draft' ? 0.88 : 1,
          }}
        >
          <StitchSurface
            elevated
            padding="none"
            style={{
              borderWidth: 1,
              borderColor: colors.outlineVariant,
              overflow: 'hidden',
            }}
          >
            {displayKind === 'sold' ? (
              <View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFill,
                  { backgroundColor: `${colors.surface}66`, zIndex: 15 },
                ]}
              />
            ) : null}

            <View style={styles.cardHero}>
              {item.image_url ? (
                <Image
                  accessibilityIgnoresInvertColors
                  accessibilityLabel={`${item.title} preview`}
                  source={{ uri: item.image_url }}
                  style={[
                    StyleSheet.absoluteFill,
                    displayKind === 'draft' ? { opacity: 0.92 } : null,
                  ]}
                  resizeMode="cover"
                />
              ) : (
                <View
                  style={[
                    StyleSheet.absoluteFill,
                    { backgroundColor: colors.surfaceVariant },
                  ]}
                />
              )}
              <View
                style={[
                  styles.statusPill,
                  {
                    backgroundColor: statusPillBg,
                    zIndex: displayKind === 'sold' ? 30 : 10,
                  },
                  statusBorder,
                ]}
              >
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: dotColor,
                  }}
                />
                <StitchText variant="label-caps" colorKey={statusTextColorKey}>
                  {statusLabel}
                </StitchText>
              </View>
            </View>

            <View style={[styles.cardBody, displayKind === 'sold' ? { zIndex: 20 } : null]}>
              <View style={{ marginBottom: spacing.xs }}>
                <View
                  style={{
                    alignSelf: 'flex-start',
                    paddingHorizontal: spacing.sm,
                    paddingVertical: 4,
                    borderRadius: radii.default,
                    backgroundColor: colors.surface2,
                  }}
                >
                  <StitchText
                    variant="label-caps"
                    colorKey="textMuted"
                    style={{ fontSize: 10, letterSpacing: 1 }}
                  >
                    {(item.category ?? 'Uncategorized').toUpperCase()}
                  </StitchText>
                </View>
              </View>

              <StitchText variant="h3" colorKey="onBackground" numberOfLines={1}>
                {item.title}
              </StitchText>

              <View style={styles.scheduleRow}>
                <StitchIcon name="schedule" size={16} colorKey="textFaint" />
                <StitchText variant="body-sm" colorKey="textFaint" numberOfLines={2}>
                  {pickupLine}
                </StitchText>
              </View>

              <View
                style={[
                  styles.cardFooter,
                  {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: `${colors.divider}80`,
                  },
                ]}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  {showStrike ? (
                    <StitchText
                      variant="price-original"
                      colorKey="textFaint"
                      style={{ textDecorationLine: 'line-through', marginBottom: 2 }}
                    >
                      LKR {retail!.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </StitchText>
                  ) : null}
                  <StitchText variant="price" colorKey={rescueColorKey}>
                    LKR{' '}
                    {item.rescue_price.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}
                  </StitchText>
                </View>

                {displayKind === 'draft' ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      navigation.navigate('MerchantBagEdit', { bagId: item.id })
                    }
                    style={({ pressed }) => [
                      styles.smallCta,
                      {
                        backgroundColor: colors.surface2,
                        opacity: pressed ? 0.9 : 1,
                      },
                    ]}
                  >
                    <StitchText variant="label" colorKey="onBackground">
                      Edit Draft
                    </StitchText>
                  </Pressable>
                ) : null}

                {displayKind === 'sold' ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      navigation.navigate('MerchantBagCreate', {
                        prefill: {
                          title: item.title,
                          category: item.category ?? undefined,
                          image_url: item.image_url ?? undefined,
                          retail_value_estimate:
                            item.retail_value_estimate != null
                              ? String(item.retail_value_estimate)
                              : undefined,
                          rescue_price:
                            item.rescue_price != null
                              ? String(item.rescue_price)
                              : undefined,
                          quantity_remaining:
                            item.quantity_available != null
                              ? String(item.quantity_available)
                              : undefined,
                        },
                      })
                    }
                    style={({ pressed }) => [
                      styles.smallCta,
                      {
                        borderWidth: 1.5,
                        borderColor: colors.outlineVariant,
                        backgroundColor: 'transparent',
                        opacity: pressed ? 0.88 : 1,
                      },
                    ]}
                  >
                    <StitchText variant="label" colorKey="onBackground">
                      Duplicate
                    </StitchText>
                  </Pressable>
                ) : null}

                {displayKind === 'live' ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Bag actions"
                    onPress={() => openBagActions(item)}
                    style={({ pressed }) => [
                      styles.moreBtn,
                      {
                        backgroundColor: pressed
                          ? colors.surfaceVariant
                          : colors.surfaceContainerLow,
                      },
                    ]}
                  >
                    <StitchIcon name="more_vert" size={20} colorKey="onBackground" />
                  </Pressable>
                ) : null}
              </View>
            </View>
          </StitchSurface>
        </View>
      );
    },
    [
      colors.divider,
      colors.error,
      colors.errorContainer,
      colors.outline,
      colors.outlineVariant,
      colors.success,
      colors.surface,
      colors.surface2,
      colors.surfaceContainer,
      colors.surfaceContainerLow,
      colors.surfaceVariant,
      navigation,
      openBagActions,
      radii.default,
      spacing.md,
      spacing.sm,
      spacing.xs,
      styles.cardBody,
      styles.cardFooter,
      styles.cardHero,
      styles.moreBtn,
      styles.scheduleRow,
      styles.smallCta,
      styles.statusPill,
    ],
  );

  const header = useMemo(
    () => (
      <>
        {!activeOutlet && !loading ? (
          <View
            style={{
              marginBottom: spacing.md,
              padding: spacing.md,
              borderRadius: radii.lg,
              backgroundColor: colors.accentHighlight,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: colors.outlineVariant,
            }}
          >
            <StitchText variant="body-sm" colorKey="onSurfaceVariant">
              No outlet linked to your merchant yet.
            </StitchText>
          </View>
        ) : null}

        <View style={styles.headerRow}>
          <View style={styles.headerTitles}>
            <StitchText variant="h1" colorKey="onBackground" style={{ marginBottom: spacing.xs }}>
              Rescue Bags
            </StitchText>
            {activeOutlet?.name ? (
              <StitchText
                variant="label-caps"
                colorKey="textMuted"
                testID="merchant.bags.activeOutlet"
                numberOfLines={1}
                style={{ marginBottom: spacing.xs }}
              >
                {String(activeOutlet.name)}
              </StitchText>
            ) : null}
            <StitchText variant="body-md" colorKey="textMuted">
              Manage your daily inventory and surplus.
            </StitchText>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('MerchantBagCreate')}
            style={({ pressed }) => ({
              opacity: pressed ? 0.92 : 1,
            })}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                minHeight: 48,
                paddingVertical: spacing.sm,
                paddingHorizontal: spacing.lg,
                borderRadius: radii.lg,
                backgroundColor: colors.primary,
              }}
            >
              <StitchIcon name="add" size={20} colorKey="onPrimary" />
              <StitchText variant="label" colorKey="onPrimary">
                Create Bag
              </StitchText>
            </View>
          </Pressable>
        </View>

        {tabRow}

        {error ? (
          <StitchText variant="body-sm" colorKey="error" style={{ marginBottom: spacing.sm }}>
            {error}
          </StitchText>
        ) : null}
      </>
    ),
    [
      activeOutlet,
      colors.accentHighlight,
      colors.outlineVariant,
      colors.primary,
      error,
      loading,
      navigation,
      radii.lg,
      spacing.lg,
      spacing.md,
      spacing.sm,
      spacing.xs,
      styles.headerRow,
      styles.headerTitles,
      tabRow,
    ],
  );

  if (!bagsAllowed) {
    return (
      <StitchScreen
        scroll
        scrollProps={{
          contentContainerStyle: {
            padding: spacing.pageMarginMobile,
            gap: spacing.md,
          },
        }}
      >
        <StitchText variant="h2" colorKey="onBackground">
          Clearance shelves only
        </StitchText>
        <StitchText variant="body-md" colorKey="textMuted">
          This outlet does not publish rescue bags. Manage today&apos;s shelf markdowns
          instead.
        </StitchText>
        <Pressable onPress={goToShelves}>
          <StitchText variant="label" colorKey="primary">
            Go to clearance shelves
          </StitchText>
        </Pressable>
      </StitchScreen>
    );
  }

  return (
    <StitchScreen edges={['top', 'left', 'right']}>
      {loading && visibleBags.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primaryContainer} />
        </View>
      ) : null}
      <FlatList
        data={visibleBags}
        keyExtractor={(i) => i.id}
        style={styles.flexOne}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.listContent, { paddingBottom: scrollBottomPad }]}
        refreshControl={
          <RefreshControl
            refreshing={loading && visibleBags.length > 0}
            onRefresh={() => {
              refetch().catch((err) => logError(err, { context: 'MerchantBagsListScreen.refetch' }));
            }}
            tintColor={colors.primaryContainer}
          />
        }
        ListHeaderComponent={header}
        ListEmptyComponent={
          !loading ? (
            <StitchText variant="body-md" colorKey="textMuted" style={{ textAlign: 'center' }}>
              {tab === 'all'
                ? 'No bags for this outlet yet.'
                : 'No bags match this filter.'}
            </StitchText>
          ) : null
        }
        renderItem={renderItem}
      />
    </StitchScreen>
  );
}
