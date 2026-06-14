import React, { useLayoutEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootStackParamList } from '@/navigation/types';
import { useShelfDetail } from '@/hooks/useShelfDetail';
import { scopeBasketToShelf, useClearanceBasket } from '@/hooks/useClearanceBasket';
import { useAuthContext } from '@/context/AuthContext';
import { useFavourites } from '@/hooks/useFavourites';
import { CLEARANCE_FOOD_SAFETY_NOTICE } from '@/lib/foodSafetyCopy';
import { isClearanceShelvesEnabled } from '@/config/clearanceShelves';
import { OutletTrustBadge } from '@/components/OutletTrustBadge';
import {
  filterShelfItems,
  groupShelfItemsByCategory,
  resolveShelfItemCategory,
  sortShelfItems,
  type ShelfSortKey,
} from '@/lib/shelfBrowse';
import {
  buildShelfWhatsAppMessage,
  buildWhatsAppShareUrl,
} from '@/lib/shelfShare';
import {
  formatBestBefore,
  formatItemSavings,
  formatLowStock,
  formatPickupByLabel,
  formatPickupWindow,
  formatUnitLabel,
  sumRetailSavings,
} from '@/lib/shelfDisplay';
import { BasketTimerPill } from '@/components/shelf/BasketTimerPill';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import { StitchIcon, StitchSurface, StitchText } from '@/ui/stitch';
import {
  parsePreviewQueryParam,
  resolveShelfPreviewMode,
} from '@/lib/shelfPreviewMode';

type Props = NativeStackScreenProps<RootStackParamList, 'ClearanceShelf'>;

type ShelfListRow =
  | { kind: 'category'; key: string; category: string }
  | { kind: 'item'; key: string; item: Record<string, unknown> };

const SORT_OPTIONS: { key: ShelfSortKey; label: string }[] = [
  { key: 'default', label: 'Default' },
  { key: 'name', label: 'Name' },
  { key: 'price_asc', label: 'Price ↑' },
  { key: 'price_desc', label: 'Price ↓' },
  { key: 'savings', label: 'Savings' },
];

function formatLkr(n: number): string {
  return `LKR ${Math.round(n).toLocaleString('en-LK')}`;
}

export function ClearanceShelfScreen({ navigation, route }: Props) {
  const previewRequested = parsePreviewQueryParam(route.params.preview);
  const { env, user, resolvedRole } = useAuthContext();
  const shelfId = route.params.id;
  const { isMerchantPreview, isBrowseOnly } = resolveShelfPreviewMode(
    previewRequested,
    resolvedRole,
  );
  const { shelf, loading, error, refresh: refreshShelf } = useShelfDetail(env, shelfId, {
    merchantPreview: isMerchantPreview,
  });
  const outletIdForFav = useMemo(() => {
    const outlet = shelf?.outlet as Record<string, unknown> | undefined;
    return typeof outlet?.id === 'string' ? outlet.id : null;
  }, [shelf?.outlet]);
  const { isSaved, toggleFavourite } = useFavourites(env, user?.id ?? null);
  const { shelfId: basketShelfId, items, startedAtMs, setQuantity } = useClearanceBasket();
  const { colors, spacing, radii } = useStitchTheme();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<ShelfSortKey>('default');
  const [groupByCategory, setGroupByCategory] = useState(false);
  const [detailItem, setDetailItem] = useState<Record<string, unknown> | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const scopedItems = useMemo(
    () => scopeBasketToShelf(basketShelfId, items, shelfId),
    [basketShelfId, items, shelfId],
  );

  const lineCount = useMemo(
    () => Object.values(scopedItems).reduce((sum, qty) => sum + Number(qty ?? 0), 0),
    [scopedItems],
  );

  const subtotal = useMemo(() => {
    const rows = (shelf?.items ?? []) as Record<string, unknown>[];
    return rows.reduce((sum, row) => {
      const id = String(row.id);
      const qty = scopedItems[id] ?? 0;
      return sum + Number(row.rescue_price ?? 0) * qty;
    }, 0);
  }, [scopedItems, shelf]);

  const savingsHint = useMemo(() => {
    const rows = (shelf?.items ?? []) as Record<string, unknown>[];
    return sumRetailSavings(rows, scopedItems);
  }, [scopedItems, shelf]);

  const displayItems = useMemo(() => {
    const raw = (shelf?.items ?? []) as Record<string, unknown>[];
    const filtered = filterShelfItems(raw, searchQuery);
    return sortShelfItems(filtered, sortKey);
  }, [searchQuery, shelf, sortKey]);

  const groupedItems = useMemo(
    () => (groupByCategory ? groupShelfItemsByCategory(displayItems) : null),
    [displayItems, groupByCategory],
  );

  const listRows = useMemo((): ShelfListRow[] => {
    if (displayItems.length === 0) return [];
    if (groupedItems) {
      return groupedItems.flatMap((group) => [
        { kind: 'category' as const, key: `cat-${group.category}`, category: group.category },
        ...group.items.map((item) => ({
          kind: 'item' as const,
          key: String(item.id),
          item,
        })),
      ]);
    }
    return displayItems.map((item) => ({
      kind: 'item' as const,
      key: String(item.id),
      item,
    }));
  }, [displayItems, groupedItems]);

  const onShareWhatsApp = async () => {
    if (!shelf) return;
    const outlet = shelf.outlet as Record<string, unknown> | undefined;
    const outletName = String(outlet?.name ?? 'Outlet');
    const message = buildShelfWhatsAppMessage({
      shelfId,
      outletName,
      itemCount: displayItems.length,
    });
    const url = buildWhatsAppShareUrl(message);
    await Linking.openURL(url).catch(() => undefined);
  };

  if (!isClearanceShelvesEnabled() && !isMerchantPreview) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <StitchText variant="body-md" colorKey="textMuted" style={{ padding: spacing.xl }}>
          Clearance shelves are not enabled.
        </StitchText>
      </View>
    );
  }

  if (loading) {
    return (
      <View
        testID="shelf.loading"
        style={{ flex: 1, backgroundColor: colors.background }}
      >
        <StitchText variant="body-md" colorKey="textMuted" style={{ padding: spacing.xl }}>
          Loading shelf…
        </StitchText>
      </View>
    );
  }

  if (error || !shelf) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <StitchText variant="body-md" colorKey="error" style={{ padding: spacing.xl }}>
          {error ?? 'Shelf not found'}
        </StitchText>
      </View>
    );
  }

  const outlet = shelf.outlet as Record<string, unknown> | undefined;
  const outletName = String(outlet?.name ?? 'Outlet');
  const shelfTitle =
    typeof shelf.title === 'string' && shelf.title.trim().length > 0
      ? shelf.title.trim()
      : null;
  const shelfDescription =
    typeof shelf.description === 'string' && shelf.description.trim().length > 0
      ? shelf.description.trim()
      : null;
  const shelfCoverUrl =
    typeof shelf.cover_image_url === 'string' && shelf.cover_image_url.trim().length > 0
      ? shelf.cover_image_url.trim()
      : null;
  const isHalalOutlet = outlet?.is_halal_certified === true;
  const notes = typeof shelf.notes === 'string' ? shelf.notes.trim() : '';
  const pickup = formatPickupWindow(
    typeof shelf.pickup_start === 'string' ? shelf.pickup_start : null,
    typeof shelf.pickup_end === 'string' ? shelf.pickup_end : null,
  );
  const pickupBy = formatPickupByLabel(
    typeof shelf.pickup_end === 'string' ? shelf.pickup_end : null,
  );
  const isDraftPreview = isMerchantPreview && String(shelf.status ?? '') === 'draft';
  const categoryNames = new Set<string>();
  for (const row of (shelf.items ?? []) as Record<string, unknown>[]) {
    categoryNames.add(resolveShelfItemCategory(row));
  }
  const categoryGroupingUseful = categoryNames.size > 1;
  const basketBarPad = isBrowseOnly ? insets.bottom + spacing.md : 120 + insets.bottom;

  const renderItemRow = (item: Record<string, unknown>) => {
    const id = String(item.id);
    const qty = scopedItems[id] ?? 0;
    const max = Number(item.quantity_remaining ?? 0);
    const soldOut = item.status === 'sold_out' || max < 1;
    const disabled = soldOut;
    const savingsLine = formatItemSavings(
      item.retail_price as string | number | null | undefined,
      item.rescue_price as string | number | null | undefined,
    );
    const lowStock = !soldOut ? formatLowStock(max) : null;
    const bestBefore = formatBestBefore(
      typeof item.best_before === 'string' ? item.best_before : null,
    );
    const displayName = formatUnitLabel({
      name: String(item.name_snapshot ?? ''),
      weight_grams: null,
    });
    const allergens = Array.isArray(item.allergens_snapshot)
      ? (item.allergens_snapshot as string[]).slice(0, 3)
      : [];

    return (
      <Pressable onPress={() => setDetailItem(item)}>
        <StitchSurface
          elevated
          padding="md"
          style={{
            opacity: soldOut ? 0.55 : 1,
            backgroundColor: soldOut ? colors.surfaceContainerLow : undefined,
          }}
        >
          <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
            {item.image_url_snapshot ? (
              <Image
                source={{ uri: String(item.image_url_snapshot) }}
                style={{ width: 64, height: 64, borderRadius: radii.lg }}
              />
            ) : (
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: radii.lg,
                  backgroundColor: colors.surfaceContainerHighest,
                }}
              />
            )}
            <View style={{ flex: 1, minWidth: 0 }}>
              <StitchText variant="label" colorKey="onBackground" numberOfLines={2}>
                {displayName}
              </StitchText>
              {item.brand_snapshot ? (
                <StitchText variant="body-sm" colorKey="textMuted">
                  {String(item.brand_snapshot)}
                </StitchText>
              ) : null}
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, marginTop: 4 }}>
                <StitchText variant="price" colorKey="accent">
                  {formatLkr(Number(item.rescue_price ?? 0))}
                </StitchText>
                {item.retail_price != null &&
                Number(item.retail_price) > Number(item.rescue_price ?? 0) ? (
                  <StitchText
                    variant="body-sm"
                    colorKey="textFaint"
                    style={{ textDecorationLine: 'line-through' }}
                  >
                    {formatLkr(Number(item.retail_price))}
                  </StitchText>
                ) : null}
              </View>
              {savingsLine ? (
                <StitchText variant="body-sm" colorKey="secondary">
                  {savingsLine}
                </StitchText>
              ) : null}
              {soldOut ? (
                <StitchText variant="label" colorKey="error" style={{ marginTop: 4 }}>
                  Sold out
                </StitchText>
              ) : lowStock ? (
                <StitchText variant="body-sm" colorKey="secondary" style={{ marginTop: 4 }}>
                  {lowStock}
                </StitchText>
              ) : null}
              {bestBefore ? (
                <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: 4 }}>
                  {bestBefore}
                </StitchText>
              ) : null}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.xs }}>
                {item.is_halal === true ? <Chip label="Halal" colors={colors} /> : null}
                {allergens.map((a) => (
                  <Chip key={a} label={a} colors={colors} muted />
                ))}
              </View>
            </View>
            {!soldOut && !isBrowseOnly ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Pressable
                  testID={`shelf.qtyDecrement.${id}`}
                  disabled={disabled || qty <= 0}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    setQuantity(shelfId, id, qty - 1, max);
                  }}
                >
                  <StitchIcon name="remove" size={24} colorKey="onBackground" />
                </Pressable>
                <StitchText variant="h3" colorKey="onBackground" testID={`shelf.qtyDisplay.${id}`}>
                  {qty}
                </StitchText>
                <Pressable
                  testID={`shelf.qtyIncrement.${id}`}
                  disabled={disabled || qty >= max}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    setQuantity(shelfId, id, qty + 1, max);
                  }}
                >
                  <StitchIcon name="add" size={24} colorKey="primaryContainer" />
                </Pressable>
              </View>
            ) : null}
          </View>
        </StitchSurface>
      </Pressable>
    );
  };

  const listHeader = (
    <View
      style={{
        paddingTop: insets.top + spacing.sm,
        paddingBottom: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.divider,
      }}
    >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => navigation.goBack()}
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md }}
          >
            <StitchIcon name="arrow_back" size={24} colorKey="primaryContainer" />
            <StitchText variant="body-sm" colorKey="primaryContainer">
              Back
            </StitchText>
          </Pressable>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            {!isMerchantPreview && outletIdForFav ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  isSaved(outletIdForFav) ? 'Remove outlet from favourites' : 'Save outlet to favourites'
                }
                onPress={() => {
                  void toggleFavourite(outletIdForFav);
                }}
              >
                <StitchIcon
                  name={isSaved(outletIdForFav) ? 'favorite' : 'favorite_border'}
                  size={22}
                  colorKey="primaryContainer"
                />
              </Pressable>
            ) : null}
            {!isMerchantPreview ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Share shelf"
                onPress={() => void onShareWhatsApp()}
              >
                <StitchIcon name="share" size={22} colorKey="primaryContainer" />
              </Pressable>
            ) : null}
          </View>
        </View>
        {isMerchantPreview ? (
          <View
            style={{
              marginBottom: spacing.sm,
              padding: spacing.sm,
              borderRadius: radii.lg,
              backgroundColor: colors.accentHighlight,
            }}
          >
            <StitchText variant="label" colorKey="accent">
              {isDraftPreview
                ? 'Merchant preview — draft shelf (not visible to customers)'
                : 'Merchant preview — browse only. Customers cannot check out from this screen.'}
            </StitchText>
          </View>
        ) : null}
        <StitchText variant="label-caps" colorKey="textMuted">
          Clearance shelf
        </StitchText>
        {shelfCoverUrl ? (
          <Image
            source={{ uri: shelfCoverUrl }}
            style={{
              width: '100%',
              height: 140,
              borderRadius: radii.lg,
              marginTop: spacing.sm,
            }}
            accessibilityLabel={shelfTitle ?? `${outletName} shelf cover`}
          />
        ) : null}
        <StitchText variant="h1" colorKey="onBackground" style={{ marginTop: spacing.xs }}>
          {shelfTitle ?? outletName}
        </StitchText>
        {shelfTitle ? (
          <StitchText variant="body-md" colorKey="textMuted" style={{ marginTop: spacing.xs }}>
            {outletName}
          </StitchText>
        ) : null}
        {shelfDescription ? (
          <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: spacing.sm }}>
            {shelfDescription}
          </StitchText>
        ) : null}
        {typeof outlet?.trust_score === 'number' ? (
          <View style={{ marginTop: spacing.sm }}>
            <OutletTrustBadge trustScore={Number(outlet.trust_score)} size="sm" />
          </View>
        ) : null}
        {isHalalOutlet ? (
          <View
            style={{
              marginTop: spacing.sm,
              alignSelf: 'flex-start',
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.xs,
              borderRadius: radii.full,
              backgroundColor: colors.primaryHighlight,
            }}
          >
            <StitchText variant="label" colorKey="primaryContainer">
              Halal-certified outlet
            </StitchText>
          </View>
        ) : null}
        {lineCount > 0 && basketShelfId === shelfId && startedAtMs ? (
          <View style={{ marginTop: spacing.md }}>
            <BasketTimerPill
              startedAtMs={startedAtMs}
              onExpired={() => {
                void refreshShelf();
              }}
            />
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md }}>
          <StitchIcon name="schedule" size={20} colorKey="textMuted" />
          <View>
            <StitchText variant="body-md" colorKey="onBackground">
              {pickup.day ? `${pickup.day} · ` : ''}
              {pickup.window}
            </StitchText>
            {pickupBy ? (
              <StitchText variant="body-sm" colorKey="accent">
                {pickupBy}
              </StitchText>
            ) : null}
          </View>
        </View>
        {notes ? (
          <StitchSurface
            elevated
            padding="md"
            style={{ marginTop: spacing.md, backgroundColor: colors.surfaceContainerLow }}
          >
            <StitchText variant="body-sm" colorKey="textMuted">
              {notes}
            </StitchText>
          </StitchSurface>
        ) : null}
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search items…"
          placeholderTextColor={colors.textFaint}
          style={{
            marginTop: spacing.md,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderRadius: radii.lg,
            borderWidth: 1,
            borderColor: colors.outlineVariant,
            backgroundColor: colors.surfaceBright,
            color: colors.text,
          }}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: spacing.sm }}
          contentContainerStyle={{ gap: spacing.xs, paddingRight: spacing.md }}
        >
          {SORT_OPTIONS.map((opt) => (
            <Pressable
              key={opt.key}
              onPress={() => setSortKey(opt.key)}
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.xs,
                borderRadius: radii.full,
                backgroundColor:
                  sortKey === opt.key ? colors.primaryHighlight : colors.surfaceContainer,
              }}
            >
              <StitchText
                variant="label"
                colorKey={sortKey === opt.key ? 'primaryContainer' : 'textMuted'}
              >
                {opt.label}
              </StitchText>
            </Pressable>
          ))}
          <Pressable
            onPress={() => setGroupByCategory((v) => !v)}
            style={{
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.xs,
              borderRadius: radii.full,
              backgroundColor: groupByCategory ? colors.secondaryContainer : colors.surfaceContainer,
            }}
          >
            <StitchText
              variant="label"
              colorKey={groupByCategory ? 'onSecondaryContainer' : 'textMuted'}
            >
              Group by category
            </StitchText>
          </Pressable>
        </ScrollView>
        {groupByCategory && !categoryGroupingUseful ? (
          <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: spacing.xs }}>
            Items share one category — turn off grouping or add catalog categories when editing items.
          </StitchText>
        ) : null}
    </View>
  );

  return (
    <View testID="shelf.content" style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        style={{ flex: 1 }}
        data={listRows}
        keyExtractor={(row) => row.key}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={listHeader}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        renderItem={({ item: row }) =>
          row.kind === 'category' ? (
            <StitchText variant="label-caps" colorKey="textMuted" style={{ marginTop: spacing.xs }}>
              {row.category}
            </StitchText>
          ) : (
            renderItemRow(row.item)
          )
        }
        ListEmptyComponent={
          <StitchText variant="body-md" colorKey="textMuted" style={{ paddingTop: spacing.md }}>
            {searchQuery.trim() ? 'No items match your search.' : 'No items on this shelf yet.'}
          </StitchText>
        }
        contentContainerStyle={{
          paddingHorizontal: spacing.pageMarginMobile,
          paddingTop: spacing.md,
          paddingBottom: basketBarPad,
        }}
      />

      {!isBrowseOnly ? (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            paddingHorizontal: spacing.pageMarginMobile,
            paddingTop: spacing.md,
            paddingBottom: Math.max(insets.bottom, spacing.md),
            borderTopWidth: 1,
            borderTopColor: colors.divider,
            backgroundColor: colors.surface,
          }}
        >
          <StitchText variant="body-sm" colorKey="textMuted" style={{ marginBottom: spacing.xs }}>
            {CLEARANCE_FOOD_SAFETY_NOTICE}
          </StitchText>
          <StitchText variant="body-sm" colorKey="textMuted" style={{ marginBottom: spacing.xs }}>
            {lineCount} item{lineCount === 1 ? '' : 's'} · {formatLkr(subtotal)}
            {savingsHint > 0 ? ` · Save ${formatLkr(savingsHint)}` : ''}
          </StitchText>
          <Pressable
            testID="shelf.reviewBasket"
            disabled={lineCount < 1}
            onPress={() => {
              void refreshShelf();
              navigation.navigate('ShelfReview', { shelfId });
            }}
            style={({ pressed }) => ({
              padding: spacing.md,
              borderRadius: radii.xl,
              backgroundColor: lineCount < 1 ? colors.surfaceContainer : colors.primary,
              opacity: pressed ? 0.92 : 1,
            })}
          >
            <StitchText
              variant="label"
              colorKey={lineCount < 1 ? 'textMuted' : 'onPrimary'}
              style={{ textAlign: 'center' }}
            >
              Review basket
            </StitchText>
          </Pressable>
        </View>
      ) : null}

      <ItemDetailSheet
        item={detailItem}
        onClose={() => setDetailItem(null)}
        colors={colors}
        spacing={spacing}
        radii={radii}
      />
    </View>
  );
}

function ItemDetailSheet({
  item,
  onClose,
  colors,
  spacing,
  radii,
}: {
  item: Record<string, unknown> | null;
  onClose: () => void;
  colors: ReturnType<typeof useStitchTheme>['colors'];
  spacing: ReturnType<typeof useStitchTheme>['spacing'];
  radii: ReturnType<typeof useStitchTheme>['radii'];
}): React.ReactElement | null {
  if (!item) return null;
  const allergens = Array.isArray(item.allergens_snapshot)
    ? (item.allergens_snapshot as string[])
    : [];
  const ingredients =
    typeof item.ingredients_snapshot === 'string' && item.ingredients_snapshot.trim()
      ? item.ingredients_snapshot
      : null;
  const source =
    typeof item.catalog_source === 'string' ? item.catalog_source : 'Shop listing';
  const bestBefore = formatBestBefore(
    typeof item.best_before === 'string' ? item.best_before : null,
  );

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}
        onPress={onClose}
      >
        <Pressable
          onPress={(e) => e.stopPropagation?.()}
          style={{
            maxHeight: '75%',
            backgroundColor: colors.surface,
            borderTopLeftRadius: radii.xl,
            borderTopRightRadius: radii.xl,
            padding: spacing.lg,
          }}
        >
          <StitchText variant="h2" colorKey="onBackground">
            {String(item.name_snapshot ?? 'Item')}
          </StitchText>
          {item.brand_snapshot ? (
            <StitchText variant="body-md" colorKey="textMuted" style={{ marginTop: spacing.xs }}>
              {String(item.brand_snapshot)}
            </StitchText>
          ) : null}
          <StitchText variant="price" colorKey="accent" style={{ marginTop: spacing.md }}>
            {formatLkr(Number(item.rescue_price ?? 0))}
          </StitchText>
          {bestBefore ? (
            <StitchText variant="body-sm" colorKey="accent" style={{ marginTop: spacing.md }}>
              {bestBefore}
            </StitchText>
          ) : null}
          {item.is_halal === true ? (
            <StitchText variant="label" colorKey="primaryContainer" style={{ marginTop: spacing.sm }}>
              Halal item
            </StitchText>
          ) : null}
          <View style={{ marginTop: spacing.md }}>
            <StitchText variant="label-caps" colorKey="textMuted">
              Allergens
            </StitchText>
            <StitchText variant="body-sm" colorKey="onBackground">
              {allergens.length > 0
                ? allergens.join(', ')
                : 'Not provided by the shop — check the pack at pickup.'}
            </StitchText>
          </View>
          {ingredients ? (
            <View style={{ marginTop: spacing.md }}>
              <StitchText variant="label-caps" colorKey="textMuted">
                Ingredients
              </StitchText>
              <StitchText variant="body-sm" colorKey="onBackground">
                {ingredients}
              </StitchText>
            </View>
          ) : null}
          <StitchText variant="body-sm" colorKey="textFaint" style={{ marginTop: spacing.md }}>
            Source: {source}
          </StitchText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onClose}
            style={{
              marginTop: spacing.lg,
              padding: spacing.md,
              borderRadius: radii.lg,
              backgroundColor: colors.primary,
              alignItems: 'center',
            }}
          >
            <StitchText variant="label" colorKey="onPrimary">
              Close
            </StitchText>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Chip({
  label,
  colors,
  muted,
}: {
  label: string;
  colors: ReturnType<typeof useStitchTheme>['colors'];
  muted?: boolean;
}): React.ReactElement {
  return (
    <View
      style={{
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 999,
        backgroundColor: muted ? colors.surfaceContainer : colors.primaryHighlight,
      }}
    >
      <StitchText variant="body-sm" colorKey={muted ? 'textMuted' : 'primaryContainer'}>
        {label}
      </StitchText>
    </View>
  );
}
