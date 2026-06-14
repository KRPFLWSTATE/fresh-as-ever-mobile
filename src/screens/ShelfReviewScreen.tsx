import React, { useMemo, useEffect, useRef } from 'react';
import { Alert, Image, Pressable, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootStackParamList } from '@/navigation/types';
import { useShelfDetail } from '@/hooks/useShelfDetail';
import { scopeBasketToShelf, useClearanceBasket } from '@/hooks/useClearanceBasket';
import { useAuthContext } from '@/context/AuthContext';
import {
  formatBestBefore,
  formatItemSavings,
  formatPickupByLabel,
  formatUnitLabel,
  sumRetailSavings,
} from '@/lib/shelfDisplay';
import { CLEARANCE_FOOD_SAFETY_NOTICE } from '@/lib/foodSafetyCopy';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import { StitchIcon, StitchScreen, StitchSurface, StitchText } from '@/ui/stitch';
import {
  parsePreviewQueryParam,
  resolveShelfPreviewMode,
} from '@/lib/shelfPreviewMode';

type Props = NativeStackScreenProps<RootStackParamList, 'ShelfReview'>;

export function ShelfReviewScreen({ navigation, route }: Props) {
  const previewRequested = parsePreviewQueryParam(route.params.preview);
  const { env, resolvedRole } = useAuthContext();
  const shelfId = route.params.shelfId;
  const { isBrowseOnly } = resolveShelfPreviewMode(previewRequested, resolvedRole);
  const { shelf, loading, error, refresh } = useShelfDetail(env, shelfId);
  const { shelfId: basketShelfId, items, setQuantity } = useClearanceBasket();
  const { colors, spacing, radii } = useStitchTheme();
  const insets = useSafeAreaInsets();
  const pass8Seeded = useRef(false);

  const scopedItems = useMemo(
    () => scopeBasketToShelf(basketShelfId, items, shelfId),
    [basketShelfId, items, shelfId],
  );

  const lines = useMemo(() => {
    const rows = (shelf?.items ?? []) as Record<string, unknown>[];
    return rows
      .map((row) => {
        const id = String(row.id);
        const qty = scopedItems[id] ?? 0;
        if (qty < 1) return null;
        const max = Number(row.quantity_remaining ?? 0);
        const soldOut = row.status === 'sold_out' || max < 1;
        if (soldOut) return null;
        return { row, id, qty: Math.min(qty, max) };
      })
      .filter(Boolean) as { row: Record<string, unknown>; id: string; qty: number }[];
  }, [scopedItems, shelf]);

  const subtotal = useMemo(
    () =>
      lines.reduce(
        (sum, { row, qty }) => sum + Number(row.rescue_price ?? 0) * qty,
        0,
      ),
    [lines],
  );

  const savings = useMemo(() => {
    const rows = lines.map(({ row, id, qty }) => ({
      id,
      retail_price: row.retail_price as string | number | null | undefined,
      rescue_price: row.rescue_price as string | number | null | undefined,
      quantity: qty,
    }));
    return sumRetailSavings(rows, Object.fromEntries(lines.map((l) => [l.id, l.qty])));
  }, [lines]);

  const pickupBy = formatPickupByLabel(
    typeof shelf?.pickup_end === 'string' ? shelf.pickup_end : null,
  );

  useEffect(() => {
    if (isBrowseOnly) {
      navigation.replace('ClearanceShelf', { id: shelfId, preview: true });
    }
  }, [isBrowseOnly, navigation, shelfId]);

  useEffect(() => {
    const seedItemId = route.params.pass8Seed;
    if (!__DEV__ || !seedItemId || pass8Seeded.current || !shelf?.items) return;
    const row = (shelf.items as Record<string, unknown>[]).find(
      (item) => String(item.id) === seedItemId,
    );
    if (!row) return;
    const max = Number(row.quantity_remaining ?? 0);
    if (max < 1) return;
    pass8Seeded.current = true;
    setQuantity(shelfId, seedItemId, 1, max);
  }, [route.params.pass8Seed, shelf, shelfId, setQuantity]);

  if (isBrowseOnly) {
    return (
      <StitchScreen>
        <StitchText variant="body-md" colorKey="textMuted" style={{ padding: spacing.xl }}>
          Checkout is not available in preview.
        </StitchText>
      </StitchScreen>
    );
  }

  if (loading) {
    return (
      <StitchScreen>
        <StitchText variant="body-md" colorKey="textMuted" style={{ padding: spacing.xl }}>
          Loading review…
        </StitchText>
      </StitchScreen>
    );
  }

  if (error || !shelf) {
    return (
      <StitchScreen>
        <StitchText variant="body-md" colorKey="error" style={{ padding: spacing.xl }}>
          {error ?? 'Shelf not found'}
        </StitchText>
      </StitchScreen>
    );
  }

  const outlet = shelf.outlet as Record<string, unknown> | undefined;
  const outletName = String(outlet?.name ?? 'Outlet');

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingTop: insets.top + spacing.sm,
          paddingHorizontal: spacing.pageMarginMobile,
          paddingBottom: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.divider,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to shelf"
          onPress={() => navigation.goBack()}
          style={{ padding: spacing.xs, marginRight: spacing.sm }}
        >
          <StitchIcon name="arrow_back" size={28} colorKey="primaryContainer" />
        </Pressable>
        <StitchText variant="h2" colorKey="primaryContainer">
          Review shelf
        </StitchText>
      </View>

      <StitchScreen
        scroll
        scrollProps={{
          contentContainerStyle: {
            paddingHorizontal: spacing.pageMarginMobile,
            paddingTop: spacing.md,
            paddingBottom: 120 + insets.bottom,
            gap: spacing.md,
          },
        }}
      >
        <StitchText variant="body-sm" colorKey="textMuted">
          {outletName}
        </StitchText>
        {pickupBy ? (
          <StitchText variant="body-sm" colorKey="accent">
            {pickupBy}
          </StitchText>
        ) : null}
        <StitchSurface elevated padding="md" style={{ backgroundColor: colors.surfaceContainerLow }}>
          <StitchText variant="body-sm" colorKey="textMuted">
            {CLEARANCE_FOOD_SAFETY_NOTICE}
          </StitchText>
        </StitchSurface>

        {lines.map(({ row, id, qty }) => {
          const max = Number(row.quantity_remaining ?? 0);
          const soldOut = row.status === 'sold_out' || max < 1;
          const savingsLine = formatItemSavings(
            row.retail_price as string | number | null | undefined,
            row.rescue_price as string | number | null | undefined,
          );
          const bestBefore = formatBestBefore(
            typeof row.best_before === 'string' ? row.best_before : null,
          );
          const displayName = formatUnitLabel({
            name: String(row.name_snapshot ?? ''),
            weight_grams: null,
          });
          return (
            <StitchSurface key={id} elevated padding="md">
              <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
                {row.image_url_snapshot ? (
                  <Image
                    source={{ uri: String(row.image_url_snapshot) }}
                    style={{ width: 56, height: 56, borderRadius: radii.lg }}
                  />
                ) : (
                  <View
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: radii.lg,
                      backgroundColor: colors.surfaceContainerHighest,
                    }}
                  />
                )}
                <View style={{ flex: 1 }}>
                  <StitchText variant="label" colorKey="onBackground" numberOfLines={2}>
                    {displayName}
                  </StitchText>
                  {row.brand_snapshot ? (
                    <StitchText variant="body-sm" colorKey="textMuted">
                      {String(row.brand_snapshot)}
                    </StitchText>
                  ) : null}
                  <StitchText variant="price" colorKey="accent">
                    LKR {Number(row.rescue_price).toFixed(0)}
                  </StitchText>
                  {savingsLine ? (
                    <StitchText variant="body-sm" colorKey="secondary">
                      {savingsLine}
                    </StitchText>
                  ) : null}
                  {bestBefore ? (
                    <StitchText variant="body-sm" colorKey="textMuted">
                      {bestBefore}
                    </StitchText>
                  ) : null}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Pressable
                    disabled={soldOut || qty <= 0}
                    onPress={() => setQuantity(shelfId, id, qty - 1, max)}
                  >
                    <StitchIcon name="remove" size={22} colorKey="onBackground" />
                  </Pressable>
                  <StitchText variant="h3" colorKey="onBackground">
                    {qty}
                  </StitchText>
                  <Pressable
                    disabled={soldOut || qty >= max}
                    onPress={() => setQuantity(shelfId, id, qty + 1, max)}
                  >
                    <StitchIcon name="add" size={22} colorKey="onBackground" />
                  </Pressable>
                </View>
              </View>
            </StitchSurface>
          );
        })}
      </StitchScreen>

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
          Subtotal LKR {subtotal.toFixed(0)}
          {savings > 0 ? ` · You save LKR ${savings.toFixed(0)}` : ''}
        </StitchText>
        <Pressable
          testID="shelf.reviewCheckout"
          disabled={lines.length < 1}
          onPress={async () => {
            await refresh();
            const rows = (shelf?.items ?? []) as Record<string, unknown>[];
            const byId = new Map(rows.map((r) => [String(r.id), r]));
            const payload: { shelf_item_id: string; quantity: number }[] = [];
            for (const { id, qty } of lines) {
              const row = byId.get(id);
              const max = Number(row?.quantity_remaining ?? 0);
              const soldOut = row?.status === 'sold_out' || max < 1;
              if (soldOut || qty > max) {
                setQuantity(shelfId, id, 0, max);
                continue;
              }
              payload.push({ shelf_item_id: id, quantity: qty });
            }
            if (payload.length < 1) {
              Alert.alert(
                'Items unavailable',
                'Some items just sold out. Your basket was updated — add another item or go back.',
              );
              return;
            }
            navigation.navigate('Checkout', {
              shelf: shelfId,
              shelfItems: JSON.stringify(payload),
            });
          }}
          style={({ pressed }) => ({
            padding: spacing.md,
            borderRadius: radii.xl,
            backgroundColor: lines.length < 1 ? colors.surfaceContainer : colors.primary,
            opacity: pressed ? 0.92 : 1,
          })}
        >
          <StitchText
            variant="label"
            colorKey={lines.length < 1 ? 'textMuted' : 'onPrimary'}
            style={{ textAlign: 'center' }}
          >
            Continue to checkout
          </StitchText>
        </Pressable>
      </View>
    </View>
  );
}
