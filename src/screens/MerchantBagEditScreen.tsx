import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import type { RouteProp } from '@react-navigation/native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useMerchantRescueBagGuard } from '@/hooks/useMerchantRescueBagGuard';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { useAuthContext } from '@/context/AuthContext';
import { getSupabase } from '@/lib/supabase';
import { BAG_ALLERGEN_LABELS } from '@/lib/bagAllergens';
import {
  defaultCreateForm,
  toLocalDateTime,
  type MerchantBagFormState,
} from '@/lib/merchantBagForm';
import { useMerchantBags } from '@/hooks/useMerchantBags';
import {
  bagImagePath,
  pickAndUploadImage,
} from '@/lib/storage/uploadImage';
import { useScrollContentBottomPad } from '@/lib/useScrollContentBottomPad';
import {
  BagWeightField,
  resolveFormBagWeightKg,
} from '@/components/merchant/BagWeightField';
import { BAG_WEIGHT_PRESETS_KG } from '@/lib/co2Impact';
import { ERROR } from '@/lib/messages/errors';
import { mapSupabaseError } from '@/lib/supabaseError';
import { PickupDateTimeField } from '@/components/PickupDateTimeField';
import { PickupWindowPresetChips } from '@/components/merchant/PickupWindowPresetChips';
import { SeasonalOccasionPicker } from '@/components/merchant/SeasonalOccasionPicker';
import { featureFlags } from '@/config/featureFlags';
import { parseSeasonalOccasionKind } from '@/domain/seasonalOccasion';
import { useSeasonalOccasionWindows } from '@/hooks/useSeasonalOccasionWindows';
import type { PickupWindowKind } from '@/lib/pickupWindowPresets';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import {
  StitchButton,
  StitchIcon,
  StitchScreen,
  StitchSurface,
  StitchText,
} from '@/ui/stitch';
import { logError } from '@/observability/logError';

const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: 'bakery', label: 'Bakery' },
  { value: 'cafe', label: 'Cafe' },
  { value: 'mixed_meals', label: 'Prepared meals' },
  { value: 'groceries', label: 'Groceries' },
  { value: 'other', label: 'Other' },
];

type Row = Record<string, unknown>;

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
    center: {
      flexGrow: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.xl,
      gap: spacing.md,
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

export function MerchantBagEditScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'MerchantBagEdit'>>();
  const { bagId } = route.params;
  const { env } = useAuthContext();
  const supabase = useMemo(() => getSupabase(env), [env]);
  const { allowed: bagsAllowed, goToShelves } = useMerchantRescueBagGuard();
  const {
    updateBag,
    deleteBag,
    activeOutlet,
    loading: ctxBusy,
  } = useMerchantBags(env);
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

  const [form, setForm] = useState<MerchantBagFormState>(() =>
    defaultCreateForm(),
  );
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [loadingBag, setLoadingBag] = useState(true);
  const [outletMismatch, setOutletMismatch] = useState(false);
  const [weightPresetKg, setWeightPresetKg] = useState<number | null>(1);
  const [customWeightKg, setCustomWeightKg] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
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

  const hydrate = useCallback(
    async (cancelled: { current: boolean }) => {
      setLoadingBag(true);
      setLoadErr(null);
      setOutletMismatch(false);
      try {
        const { data, error: qErr } = await supabase
          .from('rescue_bags')
          .select('*')
          .eq('id', bagId)
          .single();

        if (cancelled.current) return;
        if (qErr || !data) {
          setLoadErr(mapSupabaseError(qErr, ERROR.merchant.loadBag));
          return;
        }

        const row = data as Row;
        const act = activeOutlet?.id != null ? String(activeOutlet.id) : '';
        const bagOutlet =
          typeof row.outlet_id === 'string'
            ? row.outlet_id
            : row.outlet_id != null
              ? String(row.outlet_id)
              : '';
        if (act && bagOutlet && act !== bagOutlet) {
          setOutletMismatch(true);
        }

        const wRaw = Number(row.estimated_weight_kg);
        if (Number.isFinite(wRaw) && wRaw > 0) {
          const preset = (BAG_WEIGHT_PRESETS_KG as readonly number[]).find(
            (p) => p === wRaw,
          );
          if (preset != null) {
            setWeightPresetKg(preset);
            setCustomWeightKg('');
          } else {
            setWeightPresetKg(null);
            setCustomWeightKg(String(wRaw));
          }
        }

        setForm({
          title: typeof row.title === 'string' ? row.title : '',
          description:
            typeof row.notes === 'string'
              ? row.notes
              : row.notes != null
                ? String(row.notes)
                : '',
          category:
            typeof row.category === 'string' && row.category
              ? row.category
              : 'other',
          retail_value_estimate: String(row.retail_value_estimate ?? ''),
          rescue_price: String(row.rescue_price ?? ''),
          quantity_remaining: String(row.quantity_remaining ?? 1),
          pickup_start: toLocalDateTime(
            typeof row.pickup_start === 'string' ? row.pickup_start : '',
          ),
          pickup_end: toLocalDateTime(
            typeof row.pickup_end === 'string' ? row.pickup_end : '',
          ),
          pickup_window_kind:
            typeof row.pickup_window_kind === 'string'
              ? row.pickup_window_kind
              : 'custom',
          occasion_kind: parseSeasonalOccasionKind(row.occasion_kind),
          image_url:
            typeof row.image_url === 'string' ? row.image_url : '',
          selectedAllergens: Array.isArray(row.allergens)
            ? row.allergens.filter((x): x is string => typeof x === 'string')
            : [],
          isHalal: row.is_halal === true,
        });
      } catch (e) {
        if (!cancelled.current) {
          setLoadErr(mapSupabaseError(e as Error, ERROR.merchant.loadBag));
        }
      } finally {
        if (!cancelled.current) {
          setLoadingBag(false);
        }
      }
    },
    [bagId, supabase, activeOutlet?.id],
  );

  useEffect(() => {
    if (ctxBusy) {
      return;
    }
    const cancelled = { current: false };
    hydrate(cancelled).catch((e) => logError(e, { context: 'MerchantBagEditScreen.hydrate' }));
    return () => {
      cancelled.current = true;
    };
  }, [hydrate, ctxBusy]);

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
    if (outletMismatch) {
      setErr('This bag does not belong to your outlet.');
      return;
    }
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
      await updateBag(bagId, {
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
        allergens:
          form.selectedAllergens.length > 0 ? form.selectedAllergens : null,
        is_halal: form.isHalal ? true : null,
        occasion_kind: form.occasion_kind,
      });
      navigation.goBack();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    Alert.alert(
      'Delete listing',
      'Mark this bag as removed? It will no longer appear for customers.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void deleteBag(bagId)
              .then((r) => {
                if (r.error) {
                  Alert.alert('Could not delete', r.error);
                  return;
                }
                navigation.goBack();
              })
              .catch(() => {
                Alert.alert('Could not delete', 'Try again.');
              });
          },
        },
      ],
    );
  }

  if (ctxBusy) {
    return (
      <StitchScreen>
        <View style={layout.center}>
          <ActivityIndicator color={colors.primaryContainer} />
          <StitchText variant="body-md" colorKey="textMuted">
            Loading merchant…
          </StitchText>
        </View>
      </StitchScreen>
    );
  }

  if (loadingBag) {
    return (
      <StitchScreen>
        <View style={layout.center}>
          <ActivityIndicator color={colors.primaryContainer} />
          <StitchText variant="body-md" colorKey="textMuted">
            Loading bag…
          </StitchText>
        </View>
      </StitchScreen>
    );
  }

  if (loadErr) {
    return (
      <StitchScreen scroll scrollProps={{ contentContainerStyle: [layout.pad, { paddingBottom: scrollBottomPad }] }}>
        <StitchText variant="body-md" colorKey="error">
          {loadErr}
        </StitchText>
        <StitchButton variant="secondary" title="Go back" onPress={() => navigation.goBack()} />
      </StitchScreen>
    );
  }

  return (
    <StitchScreen scroll scrollProps={{ keyboardShouldPersistTaps: 'handled', contentContainerStyle: [layout.pad, { paddingBottom: scrollBottomPad }] }}>
      <StitchText variant="label-caps" colorKey="textMuted" style={{ marginBottom: spacing.xs }}>
        {outletLabel}
      </StitchText>
      <StitchText variant="h1" colorKey="onBackground" style={{ marginBottom: spacing.xs }}>
        Edit Rescue Bag
      </StitchText>
      <StitchText variant="body-md" colorKey="textMuted" style={{ marginBottom: spacing.md }}>
        {"Update inventory for today's surplus."}
      </StitchText>

      {outletMismatch ? (
        <View
          style={{
            padding: spacing.md,
            borderRadius: radii.lg,
            backgroundColor: colors.accentHighlight,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.outlineVariant,
          }}
        >
          <StitchText variant="body-sm" colorKey="onSurfaceVariant">
            This bag is not linked to your active outlet. Saving is disabled.
          </StitchText>
        </View>
      ) : null}

      <StitchSurface elevated padding="md">
        <View style={layout.sectionHeader}>
          <StitchIcon name="photo_camera" size={22} colorKey="textMuted" />
          <StitchText variant="h3" colorKey="onBackground">
            Listing image
          </StitchText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Upload listing image from photo library"
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
                accessibilityLabel="Listing image preview"
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
                  <StitchIcon name="photo_camera" size={18} colorKey="primaryContainer" />
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
                <StitchIcon name="add_photo_alternate" size={40} colorKey="primaryFixedDim" />
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
        <StitchText variant="label" colorKey="textMuted" style={{ marginBottom: spacing.xs }}>
          Or paste an image URL
        </StitchText>
        <TextInput
          value={form.image_url}
          onChangeText={(image_url) => setForm((f) => ({ ...f, image_url }))}
          placeholder="https://…"
          placeholderTextColor={colors.textFaint}
          autoCapitalize="none"
          style={inputStyle}
        />
      </StitchSurface>

      <StitchSurface elevated padding="md">
        <StitchText variant="h3" colorKey="onBackground" style={{ marginBottom: spacing.md, paddingBottom: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider }}>
          Bag details
        </StitchText>

        <StitchText variant="label" colorKey="textMuted" style={{ marginBottom: spacing.xs }}>
          Bag title *
        </StitchText>
        <TextInput
          value={form.title}
          onChangeText={(title) => setForm((f) => ({ ...f, title }))}
          placeholder="End of Day Pastry Mix"
          placeholderTextColor={colors.textFaint}
          style={[inputStyle, { marginBottom: spacing.md }]}
        />

        <StitchText variant="label" colorKey="textMuted" style={{ marginBottom: spacing.sm }}>
          Category
        </StitchText>
        <View style={[layout.chipRow, { marginBottom: spacing.md }]}>
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

        <StitchText variant="label" colorKey="textMuted" style={{ marginBottom: spacing.xs }}>
          Description (optional)
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

        <StitchText variant="label" colorKey="textMuted" style={{ marginTop: spacing.md, marginBottom: spacing.sm }}>
          Declared allergens
        </StitchText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {BAG_ALLERGEN_LABELS.map((label) => {
            const on = form.selectedAllergens.includes(label);
            return (
              <Pressable
                key={label}
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
          }}
        >
          <StitchText variant="label" colorKey="textMuted">
            Halal certified
          </StitchText>
          <Switch
            value={form.isHalal}
            onValueChange={(isHalal) => setForm((f) => ({ ...f, isHalal }))}
          />
        </View>
      </StitchSurface>

      <StitchSurface
        elevated
        padding="md"
        style={{ borderTopWidth: 4, borderTopColor: colors.secondaryContainer }}
      >
        <StitchText variant="h3" colorKey="onBackground" style={{ marginBottom: spacing.md, paddingBottom: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider }}>
          Value & inventory
        </StitchText>

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

        <StitchText variant="label" colorKey="textMuted" style={{ marginBottom: spacing.xs }}>
          Estimated retail value (LKR) *
        </StitchText>
        <View style={{ position: 'relative', marginBottom: spacing.md }}>
          <View style={{ position: 'absolute', left: spacing.md, top: 0, bottom: 0, justifyContent: 'center', zIndex: 1 }}>
            <StitchText variant="body-md" colorKey="textMuted">
              LKR
            </StitchText>
          </View>
          <TextInput
            value={form.retail_value_estimate}
            onChangeText={(retail_value_estimate) =>
              setForm((f) => ({ ...f, retail_value_estimate }))
            }
            keyboardType="decimal-pad"
            placeholder="2500"
            placeholderTextColor={colors.textFaint}
            style={[inputStyle, { paddingLeft: 52 }]}
          />
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs, gap: spacing.sm }}>
          <StitchText variant="label" colorKey="textMuted">
            Rescue price (LKR) *
          </StitchText>
          <View style={{ backgroundColor: colors.accentHighlight, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radii.default }}>
            <StitchText variant="body-sm" colorKey="accent" style={{ fontSize: 12 }}>
              Suggested: ~⅓ of retail
            </StitchText>
          </View>
        </View>
        <View style={{ position: 'relative', marginBottom: spacing.md }}>
          <View style={{ position: 'absolute', left: spacing.md, top: 0, bottom: 0, justifyContent: 'center', zIndex: 1 }}>
            <StitchText variant="body-md" colorKey="textMuted">
              LKR
            </StitchText>
          </View>
          <TextInput
            value={form.rescue_price}
            onChangeText={(rescue_price) =>
              setForm((f) => ({ ...f, rescue_price }))
            }
            keyboardType="decimal-pad"
            placeholder="800"
            placeholderTextColor={colors.textFaint}
            style={[rescueInputStyle, { paddingLeft: 52 }]}
          />
        </View>

        <StitchText variant="label" colorKey="textMuted" style={{ marginBottom: spacing.sm }}>
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
          <StitchText variant="h3" colorKey="onBackground" style={{ flex: 1, textAlign: 'center' }}>
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
        ) : null}
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
        disabled={saving || outletMismatch || !activeOutlet}
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
          opacity: saving || outletMismatch || !activeOutlet ? 0.5 : pressed ? 0.92 : 1,
        })}
      >
        {saving ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <>
            <StitchIcon name="save" size={22} colorKey="onPrimary" />
            <StitchText variant="label" colorKey="onPrimary">
              Save changes
            </StitchText>
          </>
        )}
      </Pressable>

      <Pressable
        accessibilityRole="button"
        onPress={confirmDelete}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
          minHeight: 48,
          paddingVertical: spacing.md,
          borderRadius: radii.lg,
          borderWidth: 2,
          borderColor: colors.error,
          backgroundColor: 'transparent',
          opacity: pressed ? 0.9 : 1,
        })}
      >
        <StitchIcon name="delete" size={20} colorKey="error" />
        <StitchText variant="label" colorKey="error">
          Delete listing
        </StitchText>
      </Pressable>

      <StitchButton
        variant="secondary"
        title="Cancel"
        onPress={() => navigation.goBack()}
      />
    </StitchScreen>
  );
}
