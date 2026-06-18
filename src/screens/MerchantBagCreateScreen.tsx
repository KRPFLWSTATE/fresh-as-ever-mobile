import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useMerchantRescueBagGuard } from '@/hooks/useMerchantRescueBagGuard';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { useAuthContext } from '@/context/AuthContext';
import { useMerchantBags } from '@/hooks/useMerchantBags';
import { BAG_ALLERGEN_LABELS } from '@/lib/bagAllergens';
import { defaultCreateForm, isoLocalRounded } from '@/lib/merchantBagForm';
import { SeasonalOccasionPicker } from '@/components/merchant/SeasonalOccasionPicker';
import { featureFlags } from '@/config/featureFlags';
import { useSeasonalOccasionWindows } from '@/hooks/useSeasonalOccasionWindows';
import { useScrollContentBottomPad } from '@/lib/useScrollContentBottomPad';
import {
  bagImagePath,
  pickAndUploadImage,
} from '@/lib/storage/uploadImage';
import {
  BagWeightField,
  resolveFormBagWeightKg,
} from '@/components/merchant/BagWeightField';
import { PickupDateTimeField } from '@/components/PickupDateTimeField';
import { PickupWindowPresetChips } from '@/components/merchant/PickupWindowPresetChips';
import { type PickupWindowKind } from '@/lib/pickupWindowPresets';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import {
  StitchButton,
  StitchIcon,
  StitchScreen,
  StitchSurface,
  StitchText,
} from '@/ui/stitch';

const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: 'bakery', label: 'Bakery' },
  { value: 'cafe', label: 'Cafe' },
  { value: 'mixed_meals', label: 'Prepared meals' },
  { value: 'groceries', label: 'Groceries' },
  { value: 'other', label: 'Other' },
];

type LayoutStylesArgs = {
  spacing: ReturnType<typeof useStitchTheme>['spacing'];
  radii: ReturnType<typeof useStitchTheme>['radii'];
};

function createLayoutStyles({ spacing, radii }: LayoutStylesArgs) {
  return StyleSheet.create({
    pad: {
      paddingHorizontal: spacing.pageMarginMobile,
      paddingTop: spacing.md,
      paddingBottom: spacing.xxl,
      gap: spacing.lg,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    pickupRow: {
      flexDirection: 'column',
      gap: spacing.md,
    },
    pickupCol: {
      width: '100%',
    },
    qtyShell: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderRadius: radii.lg,
      padding: spacing.xs,
    },
    qtyBtn: {
      width: 40,
      height: 40,
      borderRadius: radii.default,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}

export function MerchantBagCreateScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'MerchantBagCreate'>>();
  const prefill = route.params?.prefill;
  const { env } = useAuthContext();
  const { allowed: bagsAllowed, goToShelves } = useMerchantRescueBagGuard();
  const { createBag, activeOutlet, loading: ctxBusy } = useMerchantBags(env);
  const { windows: seasonalWindows, loading: seasonalWindowsLoading } =
    useSeasonalOccasionWindows(env);
  const { colors, spacing, radii } = useStitchTheme();

  useFocusEffect(
    useCallback(() => {
      if (!bagsAllowed) {
        goToShelves();
        navigation.goBack();
      }
    }, [bagsAllowed, goToShelves, navigation]),
  );
  const scrollBottomPad = useScrollContentBottomPad();
  const layout = useMemo(
    () => createLayoutStyles({ spacing, radii }),
    [spacing, radii],
  );

  const [form, setForm] = useState(() => {
    const base = defaultCreateForm();
    if (!prefill) return base;
    return {
      ...base,
      title: prefill.title ?? base.title,
      description: prefill.description ?? base.description,
      category: prefill.category ?? base.category,
      image_url: prefill.image_url ?? base.image_url,
      retail_value_estimate:
        prefill.retail_value_estimate ?? base.retail_value_estimate,
      rescue_price: prefill.rescue_price ?? base.rescue_price,
      quantity_remaining:
        prefill.quantity_remaining ?? base.quantity_remaining,
    };
  });
  const [weightPresetKg, setWeightPresetKg] = useState<number | null>(1);
  const [customWeightKg, setCustomWeightKg] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const merchantId = useMemo(() => {
    const raw = (activeOutlet as { merchant_id?: unknown } | null)?.merchant_id;
    return typeof raw === 'string' && raw.length > 0 ? raw : null;
  }, [activeOutlet]);

  const onPickCoverImage = useCallback(async () => {
    if (!merchantId) {
      Alert.alert(
        'Outlet not ready',
        'Wait for your merchant outlet to load before uploading a cover image.',
      );
      return;
    }
    setUploadingImage(true);
    try {
      const result = await pickAndUploadImage({
        env,
        bucket: 'bag-images',
        path: bagImagePath(merchantId),
      });
      if (result.kind === 'uploaded') {
        setForm((f) => ({ ...f, image_url: result.publicUrl }));
      } else if (result.kind === 'error') {
        Alert.alert('Upload failed', result.message);
      }
    } finally {
      setUploadingImage(false);
    }
  }, [env, merchantId]);

  const outletLabel = useMemo(() => {
    const n =
      typeof activeOutlet?.name === 'string' ? activeOutlet.name : '';
    return n || 'Active outlet';
  }, [activeOutlet]);

  const activeOutletId = useMemo(() => {
    const raw = activeOutlet?.id;
    return raw != null && String(raw).length > 0 ? String(raw) : null;
  }, [activeOutlet]);

  const openOutletEditor = useCallback(() => {
    if (!activeOutletId) {
      Alert.alert(
        'Outlet not ready',
        'Wait for your merchant outlet to load before editing location.',
      );
      return;
    }
    navigation.navigate('MerchantOutletEditor', { outletId: activeOutletId });
  }, [activeOutletId, navigation]);

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
    [
      colors.outlineVariant,
      colors.surfaceBright,
      colors.text,
      radii.lg,
      spacing.md,
    ],
  );

  const rescueInputStyle = useMemo(
    () => ({
      ...inputStyle,
      backgroundColor: `${colors.accentHighlight}4D`,
      borderColor: `${colors.accent}4D`,
    }),
    [colors.accent, colors.accentHighlight, inputStyle],
  );

  const qty = Math.max(
    1,
    Number.parseInt(String(form.quantity_remaining), 10) || 1,
  );

  const bumpQty = useCallback((delta: number) => {
    setForm((f) => {
      const n = Math.max(
        1,
        Number.parseInt(String(f.quantity_remaining), 10) || 1,
      );
      return { ...f, quantity_remaining: String(Math.max(1, n + delta)) };
    });
  }, []);

  async function submit() {
    setErr(null);
    if (
      !form.title.trim() ||
      !form.retail_value_estimate ||
      !form.rescue_price ||
      !form.pickup_start ||
      !form.pickup_end
    ) {
      setErr('Complete required fields.');
      return;
    }

    const retail = Number(form.retail_value_estimate);
    const rescue = Number(form.rescue_price);
    const qtyN = Math.max(
      1,
      Number.parseInt(String(form.quantity_remaining), 10) || 1,
    );

    const estimatedWeightKg = resolveFormBagWeightKg(
      weightPresetKg,
      customWeightKg,
    );
    if (estimatedWeightKg == null) {
      setErr('Choose or enter estimated food weight (0.1–25 kg).');
      return;
    }

    const ps = new Date(form.pickup_start);
    const pe = new Date(form.pickup_end);
    if (Number.isNaN(ps.getTime()) || Number.isNaN(pe.getTime())) {
      setErr('Invalid pickup times.');
      return;
    }

    try {
      setSaving(true);
      await createBag({
        title: form.title.trim(),
        notes: form.description.trim() || null,
        category: form.category,
        estimated_weight_kg: estimatedWeightKg,
        retail_value_estimate: retail,
        rescue_price: rescue,
        quantity_total: qtyN,
        quantity_remaining: qtyN,
        pickup_start: ps.toISOString(),
        pickup_end: pe.toISOString(),
        pickup_window_kind: form.pickup_window_kind || 'custom',
        image_url: form.image_url.trim() || null,
        status: 'live',
        allergens:
          form.selectedAllergens.length > 0 ? form.selectedAllergens : null,
        is_halal: form.isHalal ? true : null,
        occasion_kind: form.occasion_kind,
      });
      navigation.goBack();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not create bag.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <StitchScreen scroll scrollProps={{ keyboardShouldPersistTaps: 'handled', contentContainerStyle: [layout.pad, { paddingBottom: scrollBottomPad }] }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: spacing.md }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <StitchText variant="label-caps" colorKey="textMuted" style={{ marginBottom: spacing.xs }}>
            {outletLabel}
          </StitchText>
          <StitchText variant="h1" colorKey="onBackground" style={{ marginBottom: spacing.xs }}>
            List a Rescue Bag
          </StitchText>
          <StitchText variant="body-md" colorKey="textMuted">
            Create a new listing to save surplus food and reach new customers.
          </StitchText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Preview rescue bag"
          onPress={() => setPreviewOpen(true)}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.md,
            borderRadius: radii.lg,
            borderWidth: 1,
            borderColor: colors.outlineVariant,
            backgroundColor: pressed ? colors.surfaceContainerLow : colors.surface,
          })}
        >
          <StitchIcon name="preview" size={18} colorKey="textMuted" />
          <StitchText variant="label" colorKey="textMuted">
            Preview
          </StitchText>
        </Pressable>
      </View>

      <StitchSurface elevated padding="md">
        <View style={layout.sectionHeader}>
          <StitchIcon name="storefront" size={22} colorKey="textMuted" />
          <StitchText variant="h3" colorKey="onBackground">
            General Details
          </StitchText>
        </View>

        <StitchText variant="label" colorKey="onBackground" style={{ marginBottom: spacing.xs }}>
          Outlet location
        </StitchText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Edit outlet location"
          accessibilityHint="Opens the outlet editor for address and map pin"
          onPress={openOutletEditor}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: colors.outlineVariant,
            borderRadius: radii.lg,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.md,
            backgroundColor: pressed ? colors.surfaceContainerLow : colors.surfaceBright,
            marginBottom: spacing.md,
            opacity: activeOutletId ? 1 : 0.6,
          })}
        >
          <StitchText variant="body-md" colorKey="text" style={{ flex: 1 }}>
            {outletLabel}
          </StitchText>
          <StitchIcon name="chevron_right" size={22} colorKey="textMuted" />
        </Pressable>

        <StitchText variant="label" colorKey="onBackground" style={{ marginBottom: spacing.xs }}>
          Bag title *
        </StitchText>
        <TextInput
          value={form.title}
          onChangeText={(title) => setForm((f) => ({ ...f, title }))}
          placeholder="e.g., End of Day Pastry Mix"
          placeholderTextColor={colors.textFaint}
          style={[inputStyle, { marginBottom: spacing.xs }]}
        />
        <StitchText variant="body-sm" colorKey="textMuted" style={{ marginBottom: spacing.md }}>
          Keep it descriptive but general enough to accommodate daily variations.
        </StitchText>

        <StitchText variant="label" colorKey="onBackground" style={{ marginBottom: spacing.sm }}>
          Cover image
        </StitchText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Upload cover image from photo library"
          accessibilityState={{ busy: uploadingImage, disabled: uploadingImage }}
          disabled={uploadingImage}
          onPress={() => {
            void onPickCoverImage();
          }}
          style={({ pressed }) => ({
            borderWidth: 2,
            borderStyle: 'dashed',
            borderColor: pressed ? colors.primary : colors.outlineVariant,
            backgroundColor: colors.surfaceBright,
            borderRadius: radii.xl,
            padding: spacing.xl,
            alignItems: 'center',
            minHeight: 120,
            marginBottom: spacing.md,
            opacity: uploadingImage ? 0.7 : 1,
          })}
        >
          {form.image_url && /^https?:\/\//.test(form.image_url) ? (
            <View style={{ width: '100%' }}>
              <Image
                accessibilityLabel="Cover image preview"
                source={{ uri: form.image_url }}
                style={{
                  width: '100%',
                  aspectRatio: 16 / 9,
                  borderRadius: radii.lg,
                  backgroundColor: colors.surfaceContainer,
                }}
                resizeMode="cover"
              />
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: spacing.xs,
                  marginTop: spacing.sm,
                }}
              >
                {uploadingImage ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <StitchIcon name="add_photo_alternate" size={18} colorKey="primaryContainer" />
                )}
                <StitchText variant="body-sm" colorKey="textMuted">
                  {uploadingImage ? 'Uploading…' : 'Tap to replace'}
                </StitchText>
              </View>
            </View>
          ) : (
            <>
              {uploadingImage ? (
                <ActivityIndicator size="large" color={colors.primary} />
              ) : (
                <StitchIcon
                  name="add_photo_alternate"
                  size={40}
                  colorKey="primaryFixedDim"
                />
              )}
              <StitchText
                variant="label"
                colorKey="onBackground"
                style={{ marginTop: spacing.sm, textAlign: 'center' }}
              >
                {uploadingImage ? 'Uploading photo…' : 'Tap to upload a photo'}
              </StitchText>
              <StitchText
                variant="body-sm"
                colorKey="textMuted"
                style={{ marginTop: spacing.xs, textAlign: 'center' }}
              >
                Recommended: 16:9, clear lighting.
              </StitchText>
            </>
          )}
        </Pressable>
        <StitchText variant="body-sm" colorKey="textMuted" style={{ marginBottom: spacing.xs }}>
          Or paste an image URL
        </StitchText>
        <TextInput
          value={form.image_url}
          onChangeText={(image_url) => setForm((f) => ({ ...f, image_url }))}
          placeholder="https://…"
          placeholderTextColor={colors.textFaint}
          autoCapitalize="none"
          style={[inputStyle, { marginBottom: spacing.md }]}
        />

        <StitchText variant="label" colorKey="onBackground" style={{ marginBottom: spacing.xs }}>
          Description
        </StitchText>
        <TextInput
          value={form.description}
          onChangeText={(description) =>
            setForm((f) => ({ ...f, description }))
          }
          placeholder="What might be inside?"
          placeholderTextColor={colors.textFaint}
          multiline
          style={[inputStyle, { minHeight: 100, textAlignVertical: 'top' }]}
        />

        <StitchText variant="label" colorKey="onBackground" style={{ marginTop: spacing.md, marginBottom: spacing.sm }}>
          Declared allergens
        </StitchText>
        <View style={layout.chipRow}>
          {BAG_ALLERGEN_LABELS.map((label) => {
            const on = form.selectedAllergens.includes(label);
            return (
              <Pressable
                key={label}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() =>
                  setForm((f) => ({
                    ...f,
                    selectedAllergens: on
                      ? f.selectedAllergens.filter((x) => x !== label)
                      : [...f.selectedAllergens, label],
                  }))
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
            marginTop: spacing.md,
            paddingTop: spacing.md,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.divider,
          }}
        >
          <View style={{ flex: 1, paddingRight: spacing.md }}>
            <StitchText variant="label" colorKey="onBackground">
              Halal certified
            </StitchText>
            <StitchText variant="body-sm" colorKey="textMuted">
              Only enable if this bag is suitable for halal customers.
            </StitchText>
          </View>
          <Switch
            accessibilityLabel="Halal certified"
            value={form.isHalal}
            onValueChange={(isHalal) => setForm((f) => ({ ...f, isHalal }))}
          />
        </View>
      </StitchSurface>

      <StitchSurface elevated padding="md">
        <View style={layout.sectionHeader}>
          <StitchIcon name="category" size={22} colorKey="textMuted" />
          <StitchText variant="h3" colorKey="onBackground">
            Categorization
          </StitchText>
        </View>
        <StitchText variant="label" colorKey="onBackground" style={{ marginBottom: spacing.sm }}>
          Primary category
        </StitchText>
        <View style={layout.chipRow}>
          {CATEGORY_OPTIONS.map((opt) => {
            const on = form.category === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => setForm((f) => ({ ...f, category: opt.value }))}
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
                  {opt.label}
                </StitchText>
              </Pressable>
            );
          })}
        </View>
      </StitchSurface>

      <StitchSurface
        elevated
        padding="md"
        style={{ borderTopWidth: 4, borderTopColor: colors.secondaryContainer }}
      >
        <View style={layout.sectionHeader}>
          <StitchIcon name="sell" size={22} colorKey="textMuted" />
          <StitchText variant="h3" colorKey="onBackground">
            Value & inventory
          </StitchText>
        </View>

        <BagWeightField
          selectedKg={weightPresetKg}
          customKg={customWeightKg}
          onSelectPreset={(kg) => {
            setWeightPresetKg(kg);
            setCustomWeightKg('');
          }}
          onCustomChange={(value) => {
            setCustomWeightKg(value);
            if (value.trim()) setWeightPresetKg(null);
          }}
        />

        <StitchText variant="label" colorKey="onBackground" style={{ marginBottom: spacing.xs }}>
          Estimated retail value (LKR) *
        </StitchText>
        <View style={{ position: 'relative', marginBottom: spacing.md }}>
          <View style={{ position: 'absolute', left: spacing.md, top: 0, bottom: 0, justifyContent: 'center', zIndex: 1 }}>
            <StitchText variant="label" colorKey="textMuted">
              LKR
            </StitchText>
          </View>
          <TextInput
            value={form.retail_value_estimate}
            onChangeText={(retail_value_estimate) =>
              setForm((f) => ({ ...f, retail_value_estimate }))
            }
            keyboardType="decimal-pad"
            placeholder="3000"
            placeholderTextColor={colors.textFaint}
            style={[inputStyle, { paddingLeft: 52 }]}
          />
        </View>

        <StitchText variant="label" colorKey="accent" style={{ marginBottom: spacing.xs }}>
          Rescue price (LKR) *
        </StitchText>
        <View style={{ position: 'relative', marginBottom: spacing.md }}>
          <View style={{ position: 'absolute', left: spacing.md, top: 0, bottom: 0, justifyContent: 'center', zIndex: 1 }}>
            <StitchText variant="h3" colorKey="accent">
              LKR
            </StitchText>
          </View>
          <TextInput
            value={form.rescue_price}
            onChangeText={(rescue_price) =>
              setForm((f) => ({ ...f, rescue_price }))
            }
            keyboardType="decimal-pad"
            placeholder="1000"
            placeholderTextColor={colors.textFaint}
            style={[rescueInputStyle, { paddingLeft: 56 }]}
          />
        </View>

        <View
          style={{
            height: StyleSheet.hairlineWidth,
            backgroundColor: colors.divider,
            marginVertical: spacing.sm,
          }}
        />

        <StitchText variant="label" colorKey="onBackground" style={{ marginBottom: spacing.sm }}>
          Quantity available today
        </StitchText>
        <View style={[layout.qtyShell, { borderColor: colors.outlineVariant, backgroundColor: colors.surfaceBright }]}>
          <Pressable
            accessibilityRole="button"
            onPress={() => bumpQty(-1)}
            style={({ pressed }) => [
              layout.qtyBtn,
              { backgroundColor: pressed ? colors.surfaceContainer : 'transparent' },
            ]}
          >
            <StitchIcon name="remove" size={22} colorKey="onBackground" />
          </Pressable>
          <StitchText variant="h2" colorKey="onBackground" style={{ minWidth: 40, textAlign: 'center' }}>
            {qty}
          </StitchText>
          <Pressable
            accessibilityRole="button"
            onPress={() => bumpQty(1)}
            style={({ pressed }) => [
              layout.qtyBtn,
              { backgroundColor: pressed ? colors.surfaceContainer : 'transparent' },
            ]}
          >
            <StitchIcon name="add" size={22} colorKey="onBackground" />
          </Pressable>
        </View>
      </StitchSurface>

      {featureFlags.SEASONAL_BADGES ? (
        <SeasonalOccasionPicker
          value={form.occasion_kind}
          onChange={(occasion_kind) => setForm((f) => ({ ...f, occasion_kind }))}
          windows={seasonalWindows}
          loading={seasonalWindowsLoading}
        />
      ) : null}

      <StitchSurface elevated padding="md">
        <View style={layout.sectionHeader}>
          <StitchIcon name="schedule" size={22} colorKey="textMuted" />
          <StitchText variant="h3" colorKey="onBackground">
            Pickup window
          </StitchText>
        </View>
        <View style={layout.chipRow}>
          {featureFlags.PICKUP_WINDOW_PRESETS ? (
            <PickupWindowPresetChips
              selectedKind={(form.pickup_window_kind || 'custom') as PickupWindowKind}
              listingMode="bag"
              onSelectKind={(kind, pickup_start, pickup_end) =>
                setForm((f) => ({
                  ...f,
                  pickup_window_kind: kind,
                  pickup_start,
                  pickup_end,
                }))
              }
              onCustomOverride={() =>
                setForm((f) => ({ ...f, pickup_window_kind: 'custom' }))
              }
            />
          ) : (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                const now = new Date();
                const end = new Date(now.getTime() + 2 * 60 * 60 * 1000);
                setForm((f) => ({
                  ...f,
                  pickup_window_kind: 'immediately_2h',
                  pickup_start: isoLocalRounded(now),
                  pickup_end: isoLocalRounded(end),
                }));
              }}
              style={({ pressed }) => [
                {
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  borderRadius: radii.full,
                  borderWidth: 1,
                  borderColor: colors.primaryContainer,
                  backgroundColor: colors.primaryHighlight,
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
            >
              <StitchText variant="label" colorKey="primaryContainer">
                Immediately (2h window)
              </StitchText>
            </Pressable>
          )}
        </View>
        <View style={layout.pickupRow}>
          <View style={layout.pickupCol}>
            <PickupDateTimeField
              label="Starts *"
              value={form.pickup_start}
              onChange={(pickup_start) =>
                setForm((f) => ({
                  ...f,
                  pickup_start,
                  pickup_window_kind: featureFlags.PICKUP_WINDOW_PRESETS
                    ? 'custom'
                    : f.pickup_window_kind,
                }))
              }
            />
          </View>
          <View style={layout.pickupCol}>
            <PickupDateTimeField
              label="Ends *"
              value={form.pickup_end}
              onChange={(pickup_end) =>
                setForm((f) => ({
                  ...f,
                  pickup_end,
                  pickup_window_kind: featureFlags.PICKUP_WINDOW_PRESETS
                    ? 'custom'
                    : f.pickup_window_kind,
                }))
              }
            />
          </View>
        </View>
      </StitchSurface>

      {err ? (
        <StitchText variant="body-sm" colorKey="error">
          {err}
        </StitchText>
      ) : null}

      <Pressable
        accessibilityRole="button"
        disabled={saving || ctxBusy || !activeOutlet}
        onPress={() => {
          void submit();
        }}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
          minHeight: 52,
          paddingVertical: spacing.md,
          borderRadius: radii.xl,
          backgroundColor: colors.primary,
          opacity: saving || ctxBusy || !activeOutlet ? 0.5 : pressed ? 0.92 : 1,
        })}
      >
        {saving ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <>
            <StitchIcon name="publish" size={22} colorKey="onPrimary" />
            <StitchText variant="label" colorKey="onPrimary">
              {!activeOutlet ? 'Loading outlet…' : 'Publish bag'}
            </StitchText>
          </>
        )}
      </Pressable>
      <StitchText variant="body-sm" colorKey="textMuted" style={{ textAlign: 'center', marginTop: -spacing.sm }}>
        Listing will go live immediately on the customer app.
      </StitchText>

      <StitchButton
        variant="secondary"
        title="Cancel"
        onPress={() => navigation.goBack()}
        style={{ marginTop: spacing.sm }}
      />

      <Modal
        visible={previewOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setPreviewOpen(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: `${colors.inverseSurface}99`,
            justifyContent: 'flex-end',
          }}
        >
          <View
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: radii.xl,
              borderTopRightRadius: radii.xl,
              maxHeight: '90%',
              paddingHorizontal: spacing.md,
              paddingTop: spacing.md,
              paddingBottom: spacing.xl,
              gap: spacing.md,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <View>
                <StitchText variant="h3" colorKey="text">
                  Discover preview
                </StitchText>
                <StitchText variant="body-sm" colorKey="textMuted">
                  How customers will see this listing
                </StitchText>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close preview"
                onPress={() => setPreviewOpen(false)}
                style={{ padding: 6 }}
              >
                <StitchIcon name="close" size={22} colorKey="textMuted" />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: spacing.md }}>
              <BagPreviewCard
                title={form.title}
                description={form.description}
                category={form.category}
                imageUrl={form.image_url}
                retail={form.retail_value_estimate}
                rescue={form.rescue_price}
                pickupStart={form.pickup_start}
                pickupEnd={form.pickup_end}
                outletLabel={outletLabel}
                quantity={qty}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </StitchScreen>
  );
}

function BagPreviewCard({
  title,
  description,
  category,
  imageUrl,
  retail,
  rescue,
  pickupStart,
  pickupEnd,
  outletLabel,
  quantity,
}: {
  title: string;
  description: string;
  category: string;
  imageUrl: string;
  retail: string;
  rescue: string;
  pickupStart: string;
  pickupEnd: string;
  outletLabel: string;
  quantity: number;
}): React.ReactElement {
  const { colors, spacing, radii } = useStitchTheme();
  const validImage = /^https?:\/\//.test(imageUrl);
  const retailNum = Number(retail);
  const rescueNum = Number(rescue);
  const formatLkr = (n: number) =>
    `Rs. ${(Number.isFinite(n) ? Math.round(n) : 0).toLocaleString('en-LK')}`;
  const formatRange = (start: string, end: string) => {
    if (!start || !end) return 'Pickup window pending';
    const a = new Date(start);
    const b = new Date(end);
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) {
      return 'Pickup window pending';
    }
    const fmt = (d: Date) =>
      d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    return `${fmt(a)} – ${fmt(b)}`;
  };
  return (
    <StitchSurface elevated padding="none">
      <View
        style={{
          width: '100%',
          aspectRatio: 16 / 9,
          backgroundColor: colors.surfaceContainer,
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        {validImage ? (
          <Image
            accessibilityLabel="Cover image preview"
            source={{ uri: imageUrl }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
          />
        ) : (
          <StitchIcon name="image" size={36} colorKey="textMuted" />
        )}
        <View
          style={{
            position: 'absolute',
            top: spacing.sm,
            left: spacing.sm,
            paddingHorizontal: spacing.sm,
            paddingVertical: 4,
            borderRadius: 999,
            backgroundColor:
              quantity > 0 ? colors.primaryHighlight : colors.errorContainer,
          }}
        >
          <StitchText
            variant="label-caps"
            colorKey={quantity > 0 ? 'primaryContainer' : 'error'}
          >
            {quantity > 0 ? `${quantity} left` : 'Sold out'}
          </StitchText>
        </View>
        {category ? (
          <View
            style={{
              position: 'absolute',
              top: spacing.sm,
              right: spacing.sm,
              paddingHorizontal: spacing.sm,
              paddingVertical: 4,
              borderRadius: 999,
              backgroundColor: colors.surface2,
            }}
          >
            <StitchText variant="label-caps" colorKey="textMuted">
              {category.replace(/_/g, ' ')}
            </StitchText>
          </View>
        ) : null}
      </View>

      <View style={{ padding: spacing.md, gap: spacing.xs }}>
        <StitchText variant="label-caps" colorKey="textMuted">
          {outletLabel}
        </StitchText>
        <StitchText variant="h3" colorKey="text">
          {title.trim() || 'Untitled rescue bag'}
        </StitchText>
        {description.trim() ? (
          <StitchText variant="body-sm" colorKey="textMuted" numberOfLines={2}>
            {description.trim()}
          </StitchText>
        ) : null}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
            marginTop: spacing.xs,
          }}
        >
          <StitchIcon name="schedule" size={16} colorKey="textMuted" />
          <StitchText variant="body-sm" colorKey="textMuted">
            {formatRange(pickupStart, pickupEnd)}
          </StitchText>
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'baseline',
            gap: spacing.sm,
            marginTop: spacing.sm,
            paddingTop: spacing.sm,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.divider,
          }}
        >
          {Number.isFinite(retailNum) && retailNum > 0 ? (
            <StitchText
              variant="body-sm"
              colorKey="textFaint"
              style={{ textDecorationLine: 'line-through' }}
            >
              {formatLkr(retailNum)}
            </StitchText>
          ) : null}
          <StitchText variant="price" colorKey="accent">
            {formatLkr(rescueNum)}
          </StitchText>
        </View>
        <View
          style={{
            marginTop: spacing.sm,
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.md,
            borderRadius: radii.lg,
            backgroundColor: colors.surfaceContainerLow,
            alignItems: 'center',
          }}
        >
          <StitchText variant="label" colorKey="textMuted">
            Reserve now
          </StitchText>
        </View>
      </View>
    </StitchSurface>
  );
}
