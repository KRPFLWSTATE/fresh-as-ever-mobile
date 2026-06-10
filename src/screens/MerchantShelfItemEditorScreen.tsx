import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useMerchantClearanceShelfGuard } from '@/hooks/useMerchantClearanceShelfGuard';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { useAuthContext } from '@/context/AuthContext';
import { PickupDateTimeField } from '@/components/PickupDateTimeField';
import { useProductCatalogSearch } from '@/hooks/useProductCatalogSearch';
import { BAG_ALLERGEN_LABELS } from '@/lib/bagAllergens';
import { pickAndUploadImage, shelfImagePath } from '@/lib/storage/uploadImage';
import { useMerchantContext } from '@/hooks/useMerchantContext';
import {
  appendUnitToName,
  newTempItemId,
  parseUnitFromName,
  SHELF_UNIT_OPTIONS,
  type ShelfItemDraft,
  type ShelfUnitOption,
} from '@/lib/merchantShelfForm';
import {
  validateLkrRescuePrice,
  validateLkrRetailPrice,
} from '@/lib/merchantShelfValidation';
import { useScrollContentBottomPad } from '@/lib/useScrollContentBottomPad';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import {
  StitchButton,
  StitchIcon,
  StitchScreen,
  StitchSurface,
  StitchText,
} from '@/ui/stitch';

type Props = NativeStackScreenProps<RootStackParamList, 'MerchantShelfItemEditor'>;

export function MerchantShelfItemEditorScreen({ navigation, route }: Props) {
  const { allowed: shelvesAllowed, goToBags } = useMerchantClearanceShelfGuard();

  useLayoutEffect(() => {
    const returnTo = route.params?.returnTo ?? 'scan';
    navigation.setOptions({
      headerBackTitle: returnTo === 'shelf' ? "Today's shelf" : 'Scan',
    });
  }, [navigation, route.params?.returnTo]);

  useFocusEffect(
    useCallback(() => {
      if (!shelvesAllowed) {
        goToBags();
      }
    }, [goToBags, shelvesAllowed]),
  );

  const { prefill, editIndex } = route.params ?? {};
  const { env } = useAuthContext();
  const { merchant } = useMerchantContext(env);
  const { hits, loading: searchLoading, search, clear } = useProductCatalogSearch(env);
  const { colors, spacing, radii } = useStitchTheme();
  const merchantId = merchant?.id != null ? String(merchant.id) : null;
  const scrollBottomPad = useScrollContentBottomPad();

  const initialName = parseUnitFromName(prefill?.name_snapshot ?? '');
  const [name, setName] = useState(initialName.baseName);
  const [unit, setUnit] = useState<ShelfUnitOption | ''>(initialName.unit);
  const [brand, setBrand] = useState(prefill?.brand_snapshot ?? '');
  const [retailPrice, setRetailPrice] = useState(
    prefill?.retail_price != null ? String(prefill.retail_price) : '',
  );
  const [rescuePrice, setRescuePrice] = useState(
    prefill?.rescue_price != null ? String(prefill.rescue_price) : '100',
  );
  const [qty, setQty] = useState(
    String(prefill?.quantity_total ?? prefill?.quantity_remaining ?? 5),
  );
  const [allergens, setAllergens] = useState<string[]>(
    prefill?.allergens_snapshot ?? [],
  );
  const [isHalal, setIsHalal] = useState(prefill?.is_halal === true);
  const [bestBefore, setBestBefore] = useState(prefill?.best_before ?? '');
  const [imageUrl, setImageUrl] = useState(prefill?.image_url_snapshot ?? '');
  const [imageUploading, setImageUploading] = useState(false);
  const [productId, setProductId] = useState(prefill?.product_id ?? null);
  const [catalogCategory, setCatalogCategory] = useState(prefill?.catalog_category ?? null);
  const [catalogIngredients, setCatalogIngredients] = useState(
    prefill?.catalog_ingredients ?? null,
  );
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      void search(name);
    }, 300);
    return () => clearTimeout(t);
  }, [name, search]);

  const inputStyle = useMemo(
    () => ({
      width: '100%' as const,
      minHeight: 48,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      backgroundColor: colors.surfaceBright,
      fontSize: 16,
      color: colors.text,
    }),
    [colors.outlineVariant, colors.surfaceBright, colors.text, radii.lg, spacing.md],
  );

  const rescueInputStyle = useMemo(
    () => ({
      ...inputStyle,
      backgroundColor: `${colors.accentHighlight}4D`,
      borderColor: `${colors.accent}4D`,
    }),
    [colors.accent, colors.accentHighlight, inputStyle],
  );

  const qtyN = Math.max(1, Number.parseInt(qty, 10) || 1);

  const bumpQty = useCallback((delta: number) => {
    setQty(String(Math.max(1, qtyN + delta)));
  }, [qtyN]);

  const save = useCallback(() => {
    setErr(null);
    if (!name.trim()) {
      setErr('Item name is required.');
      return;
    }
    const rescue = Number(rescuePrice);
    const rescueErr = validateLkrRescuePrice(rescue);
    if (rescueErr) {
      setErr(rescueErr);
      return;
    }
    if (!retailPrice.trim()) {
      setErr('Retail price is required so customers can see savings.');
      return;
    }
    const retail = Number(retailPrice);
    const retailErr = validateLkrRetailPrice(retail, rescue);
    if (retailErr) {
      setErr(retailErr);
      return;
    }
    const trimmedBestBefore = bestBefore.trim();
    if (trimmedBestBefore && !/^\d{4}-\d{2}-\d{2}$/.test(trimmedBestBefore)) {
      setErr('Best before must be YYYY-MM-DD.');
      return;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (trimmedBestBefore) {
      const bb = new Date(`${trimmedBestBefore}T12:00:00`);
      if (!Number.isNaN(bb.getTime()) && bb < today) {
        setErr('Best before cannot be in the past.');
        return;
      }
    }

    const item: ShelfItemDraft = {
      id: prefill?.id,
      tempId: prefill?.tempId ?? newTempItemId(),
      product_id: productId,
      barcode: prefill?.barcode ?? null,
      name_snapshot: appendUnitToName(name.trim(), unit),
      brand_snapshot: brand.trim() || null,
      image_url_snapshot: imageUrl.trim() || null,
      allergens_snapshot: allergens,
      is_halal: isHalal ? true : null,
      retail_price: retail,
      rescue_price: rescue,
      quantity_total: qtyN,
      quantity_remaining: qtyN,
      catalog_category: catalogCategory,
      catalog_weight_grams: prefill?.catalog_weight_grams ?? null,
      catalog_ingredients: catalogIngredients,
      best_before: trimmedBestBefore || null,
    };

    navigation.navigate({
      name: 'MerchantShelfEditor',
      params: { savedItem: item, editIndex },
      merge: true,
    });
  }, [
    allergens,
    brand,
    editIndex,
    isHalal,
    bestBefore,
    name,
    navigation,
    catalogCategory,
    catalogIngredients,
    imageUrl,
    prefill,
    productId,
    qtyN,
    rescuePrice,
    retailPrice,
    unit,
  ]);

  const applyCatalogHit = useCallback(
    (hit: (typeof hits)[number]) => {
      setName(hit.name);
      if (hit.brand) setBrand(hit.brand);
      setProductId(hit.id);
      setCatalogCategory(hit.category);
      setCatalogIngredients(hit.ingredients_summary);
      if (hit.image_url) setImageUrl(hit.image_url);
      if (hit.allergens.length) setAllergens(hit.allergens);
      if (hit.is_halal_hint) setIsHalal(true);
      clear();
    },
    [clear],
  );

  return (
    <StitchScreen
      scroll
      scrollProps={{
        keyboardShouldPersistTaps: 'handled',
        contentContainerStyle: {
          paddingHorizontal: spacing.pageMarginMobile,
          paddingTop: spacing.md,
          paddingBottom: scrollBottomPad,
          gap: spacing.lg,
        },
      }}
    >
      <View>
        <StitchText variant="label-caps" colorKey="textMuted" style={{ marginBottom: spacing.xs }}>
          {prefill?.barcode ? `Barcode ${prefill.barcode}` : 'Shelf item'}
        </StitchText>
        <StitchText variant="h1" colorKey="onBackground">
          {editIndex != null ? 'Edit item' : 'Add item'}
        </StitchText>
      </View>

      <StitchSurface elevated padding="md">
        <StitchText variant="label" colorKey="onBackground" style={{ marginBottom: spacing.xs }}>
          Product name *
        </StitchText>
        <TextInput
          value={name}
          onChangeText={setName}
          onEndEditing={(e) => {
            const next = e.nativeEvent.text?.trim();
            if (next) setName(next);
          }}
          placeholder="e.g. Sourdough loaf"
          placeholderTextColor={colors.textFaint}
          style={[inputStyle, { marginBottom: spacing.sm }]}
        />
        {hits.length > 0 ? (
          <View
            style={{
              marginBottom: spacing.md,
              borderWidth: 1,
              borderColor: colors.outlineVariant,
              borderRadius: radii.lg,
              overflow: 'hidden',
            }}
          >
            {searchLoading ? (
              <ActivityIndicator style={{ padding: spacing.md }} color={colors.primary} />
            ) : null}
            {hits.map((hit) => (
              <Pressable
                key={hit.id}
                accessibilityRole="button"
                onPress={() => applyCatalogHit(hit)}
                style={({ pressed }) => ({
                  padding: spacing.sm,
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: colors.divider,
                  opacity: pressed ? 0.9 : 1,
                })}
              >
                <StitchText variant="body-sm" colorKey="onBackground">
                  {hit.name}
                  {hit.brand ? ` · ${hit.brand}` : ''}
                </StitchText>
                {hit.category ? (
                  <StitchText variant="body-sm" colorKey="textMuted">
                    {hit.category}
                  </StitchText>
                ) : null}
              </Pressable>
            ))}
          </View>
        ) : null}

        <StitchText variant="label" colorKey="onBackground" style={{ marginBottom: spacing.xs }}>
          Brand
        </StitchText>
        <TextInput
          value={brand}
          onChangeText={setBrand}
          placeholder="Optional"
          placeholderTextColor={colors.textFaint}
          style={[inputStyle, { marginBottom: spacing.md }]}
        />

        <StitchText variant="label" colorKey="onBackground" style={{ marginBottom: spacing.sm }}>
          Unit (shown on shelf)
        </StitchText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md }}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: unit === '' }}
            onPress={() => setUnit('')}
            style={{
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.md,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: unit === '' ? colors.primary : colors.outlineVariant,
              backgroundColor: unit === '' ? colors.primaryHighlight : colors.surfaceBright,
            }}
          >
            <StitchText variant="body-sm" colorKey={unit === '' ? 'primaryContainer' : 'text'}>
              None
            </StitchText>
          </Pressable>
          {SHELF_UNIT_OPTIONS.map((opt) => {
            const on = unit === opt;
            return (
              <Pressable
                key={opt}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => setUnit(opt)}
                style={{
                  paddingVertical: spacing.sm,
                  paddingHorizontal: spacing.md,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: on ? colors.primary : colors.outlineVariant,
                  backgroundColor: on ? colors.primaryHighlight : colors.surfaceBright,
                }}
              >
                <StitchText variant="body-sm" colorKey={on ? 'primaryContainer' : 'text'}>
                  {opt}
                </StitchText>
              </Pressable>
            );
          })}
        </View>

        {prefill?.catalog_category || prefill?.catalog_weight_grams || prefill?.catalog_ingredients ? (
          <StitchSurface
            elevated
            padding="md"
            style={{ marginBottom: spacing.md, backgroundColor: colors.surfaceContainerLow }}
          >
            <StitchText variant="label-caps" colorKey="textMuted" style={{ marginBottom: spacing.sm }}>
              From product catalog
            </StitchText>
            {prefill.catalog_category ? (
              <StitchText variant="body-sm" colorKey="text">
                Category: {prefill.catalog_category}
              </StitchText>
            ) : null}
            {prefill.catalog_weight_grams != null ? (
              <StitchText variant="body-sm" colorKey="text">
                Weight: {prefill.catalog_weight_grams}g
              </StitchText>
            ) : null}
            {prefill.catalog_ingredients ? (
              <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: spacing.xs }}>
                {prefill.catalog_ingredients}
              </StitchText>
            ) : null}
          </StitchSurface>
        ) : null}

        <StitchText variant="label" colorKey="onBackground" style={{ marginBottom: spacing.sm }}>
          Declared allergens
        </StitchText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md }}>
          {BAG_ALLERGEN_LABELS.map((label) => {
            const on = allergens.includes(label);
            return (
              <Pressable
                key={label}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() =>
                  setAllergens((prev) =>
                    on ? prev.filter((x) => x !== label) : [...prev, label],
                  )
                }
                style={{
                  paddingVertical: spacing.sm,
                  paddingHorizontal: spacing.md,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: on ? colors.primary : colors.outlineVariant,
                  backgroundColor: on ? colors.primaryHighlight : colors.surfaceBright,
                }}
              >
                <StitchText
                  variant={on ? 'label' : 'body-sm'}
                  colorKey={on ? 'primaryContainer' : 'text'}
                >
                  {label}
                </StitchText>
              </Pressable>
            );
          })}
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: spacing.md,
            paddingTop: spacing.sm,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.divider,
          }}
        >
          <View style={{ flex: 1, paddingRight: spacing.md }}>
            <StitchText variant="label" colorKey="onBackground">
              Halal certified
            </StitchText>
          </View>
          <Switch
            accessibilityLabel="Halal certified"
            value={isHalal}
            onValueChange={setIsHalal}
          />
        </View>

        <PickupDateTimeField
          label="Best before (optional)"
          mode="date"
          value={bestBefore}
          minimumDate={new Date()}
          onChange={setBestBefore}
        />

        <StitchText variant="label" colorKey="onBackground" style={{ marginBottom: spacing.xs, marginTop: spacing.md }}>
          Item photo
        </StitchText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Upload item photo"
          disabled={!merchantId || imageUploading}
          onPress={() => {
            if (!merchantId) return;
            void (async () => {
              setImageUploading(true);
              const result = await pickAndUploadImage({
                env,
                bucket: 'bag-images',
                path: shelfImagePath(merchantId),
              });
              setImageUploading(false);
              if (result.kind === 'uploaded') {
                setImageUrl(result.publicUrl);
              } else if (result.kind === 'error') {
                Alert.alert('Upload failed', result.message);
              }
            })();
          }}
          style={{
            marginBottom: spacing.sm,
            borderRadius: radii.lg,
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: colors.outlineVariant,
            minHeight: 100,
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {imageUrl.trim() ? (
            <Image source={{ uri: imageUrl.trim() }} style={{ width: '100%', height: 120 }} />
          ) : (
            <StitchText variant="body-sm" colorKey="textMuted">
              {imageUploading ? 'Uploading…' : 'Tap to upload'}
            </StitchText>
          )}
        </Pressable>
        <TextInput
          value={imageUrl}
          onChangeText={setImageUrl}
          placeholder="Image URL (optional)"
          placeholderTextColor={colors.textFaint}
          autoCapitalize="none"
          keyboardType="url"
          style={{ ...inputStyle, marginBottom: spacing.md }}
        />

        <StitchText variant="label" colorKey="onBackground" style={{ marginBottom: spacing.xs }}>
          Retail price (LKR) *
        </StitchText>
        <TextInput
          value={retailPrice}
          onChangeText={setRetailPrice}
          keyboardType="decimal-pad"
          placeholder="Required"
          placeholderTextColor={colors.textFaint}
          style={[inputStyle, { marginBottom: spacing.md }]}
        />

        <StitchText variant="label" colorKey="accent" style={{ marginBottom: spacing.xs }}>
          Rescue price (LKR) *
        </StitchText>
        <TextInput
          value={rescuePrice}
          onChangeText={setRescuePrice}
          keyboardType="decimal-pad"
          placeholder="100"
          placeholderTextColor={colors.textFaint}
          style={[rescueInputStyle, { marginBottom: spacing.md }]}
        />

        <StitchText variant="label" colorKey="onBackground" style={{ marginBottom: spacing.sm }}>
          Quantity on shelf
        </StitchText>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderWidth: 1,
            borderColor: colors.outlineVariant,
            borderRadius: radii.lg,
            padding: spacing.xs,
            backgroundColor: colors.surfaceBright,
          }}
        >
          <Pressable
            accessibilityRole="button"
            onPress={() => bumpQty(-1)}
            style={({ pressed }) => ({
              width: 40,
              height: 40,
              borderRadius: radii.default,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: pressed ? colors.surfaceContainer : 'transparent',
            })}
          >
            <StitchIcon name="remove" size={22} colorKey="onBackground" />
          </Pressable>
          <StitchText variant="h2" colorKey="onBackground" style={{ minWidth: 40, textAlign: 'center' }}>
            {qtyN}
          </StitchText>
          <Pressable
            accessibilityRole="button"
            onPress={() => bumpQty(1)}
            style={({ pressed }) => ({
              width: 40,
              height: 40,
              borderRadius: radii.default,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: pressed ? colors.surfaceContainer : 'transparent',
            })}
          >
            <StitchIcon name="add" size={22} colorKey="onBackground" />
          </Pressable>
        </View>
      </StitchSurface>

      {err ? (
        <StitchText variant="body-sm" colorKey="error">
          {err}
        </StitchText>
      ) : null}

      <Pressable
        accessibilityRole="button"
        onPress={save}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
          minHeight: 52,
          paddingVertical: spacing.md,
          borderRadius: radii.xl,
          backgroundColor: colors.primary,
          opacity: pressed ? 0.92 : 1,
        })}
      >
        <StitchIcon name="check" size={22} colorKey="onPrimary" />
        <StitchText variant="label" colorKey="onPrimary">
          {editIndex != null ? 'Update item' : 'Add to shelf'}
        </StitchText>
      </Pressable>

      <StitchButton variant="secondary" title="Cancel" onPress={() => navigation.goBack()} />
    </StitchScreen>
  );
}
