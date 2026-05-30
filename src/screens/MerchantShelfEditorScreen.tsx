import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useMerchantClearanceShelfGuard } from '@/hooks/useMerchantClearanceShelfGuard';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { PickupDateTimeField } from '@/components/PickupDateTimeField';
import { useAuthContext } from '@/context/AuthContext';
import { useMerchantContext } from '@/hooks/useMerchantContext';
import { useMerchantShelves } from '@/hooks/useMerchantShelves';
import { isoLocalRounded } from '@/lib/merchantBagForm';
import { useMerchantRecentShelfItems } from '@/hooks/useMerchantRecentShelfItems';
import { useShelfItemPerformance } from '@/hooks/useShelfItemPerformance';
import {
  applyBulkDiscountToItems,
  buildPublishChecklist,
} from '@/lib/shelfBrowse';
import {
  defaultShelfEditorForm,
  formatLkr,
  newTempItemId,
  shelfFormFromRow,
  type ShelfEditorForm,
  type ShelfItemDraft,
} from '@/lib/merchantShelfForm';
import { isPeakPublishHour } from '@/lib/merchantShelfValidation';
import { useScrollContentBottomPad } from '@/lib/useScrollContentBottomPad';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import {
  StitchButton,
  StitchIcon,
  StitchScreen,
  StitchSurface,
  StitchText,
} from '@/ui/stitch';

type Props = NativeStackScreenProps<RootStackParamList, 'MerchantShelfEditor'>;

export function MerchantShelfEditorScreen({ navigation, route }: Props) {
  const { allowed: shelvesAllowed, goToBags } = useMerchantClearanceShelfGuard();
  const { env } = useAuthContext();
  const { activeOutlet, loading: contextLoading } = useMerchantContext(env);

  useFocusEffect(
    useCallback(() => {
      if (!shelvesAllowed) {
        goToBags();
      }
    }, [goToBags, shelvesAllowed]),
  );
  const outletId = activeOutlet?.id != null ? String(activeOutlet.id) : null;
  const outletLabel =
    typeof activeOutlet?.name === 'string' && activeOutlet.name
      ? activeOutlet.name
      : 'Active outlet';

  const {
    todayShelf,
    shelves,
    loading: shelvesLoading,
    error: shelvesError,
    upsertShelf,
  } = useMerchantShelves(env, outletId);
  const {
    items: recentItems,
    loading: recentLoading,
    refresh: refreshRecent,
  } = useMerchantRecentShelfItems(env, outletId);
  const outletHalalCertified = activeOutlet?.is_halal_certified === true;

  const { colors, spacing, radii } = useStitchTheme();
  const scrollBottomPad = useScrollContentBottomPad();

  const [form, setForm] = useState<ShelfEditorForm>(() => defaultShelfEditorForm());
  const [removedItemIds, setRemovedItemIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [showPublishChecklist, setShowPublishChecklist] = useState(false);
  const [bulkDiscountPct, setBulkDiscountPct] = useState('25');

  const targetShelf = useMemo(() => {
    const shelfId = route.params?.shelfId;
    if (shelfId) {
      return shelves.find((s) => String(s.id) === String(shelfId)) ?? todayShelf;
    }
    return todayShelf;
  }, [route.params?.shelfId, shelves, todayShelf]);

  const shelfIdForPerf =
    typeof targetShelf?.id === 'string' ? targetShelf.id : null;
  const { rows: perfRows } = useShelfItemPerformance(env, outletId, shelfIdForPerf);

  const publishChecklist = useMemo(
    () =>
      buildPublishChecklist({
        pickupStart: form.pickup_start,
        pickupEnd: form.pickup_end,
        itemCount: form.items.length,
        itemsMissingRetail: form.items.filter(
          (i) => i.retail_price == null || Number(i.retail_price) <= 0,
        ).length,
        outletHalalCertified,
        nonHalalCount: form.items.filter((i) => i.is_halal !== true).length,
      }),
    [form.items, form.pickup_end, form.pickup_start, outletHalalCertified],
  );

  const applyBulkDiscount = useCallback(() => {
    const pct = Number(bulkDiscountPct);
    if (!Number.isFinite(pct) || pct <= 0 || pct >= 100) {
      setErr('Enter a discount between 1 and 99%.');
      return;
    }
    setForm((prev) => ({
      ...prev,
      items: applyBulkDiscountToItems(prev.items, pct),
    }));
    setErr(null);
  }, [bulkDiscountPct]);

  const openDraftPreview = useCallback(() => {
    const id =
      typeof targetShelf?.id === 'string'
        ? targetShelf.id
        : typeof todayShelf?.id === 'string'
          ? todayShelf.id
          : null;
    if (!id) {
      Alert.alert('Save draft first', 'Save your shelf as a draft before previewing.');
      return;
    }
    navigation.navigate('ClearanceShelf', { id, preview: true });
  }, [navigation, targetShelf?.id, todayShelf?.id]);

  useEffect(() => {
    if (hydrated || shelvesLoading) return;
    setForm(shelfFormFromRow(targetShelf));
    setHydrated(true);
  }, [hydrated, shelvesLoading, targetShelf]);

  useFocusEffect(
    useCallback(() => {
      const { savedItem, editIndex } = route.params ?? {};
      if (!savedItem) return;

      setForm((prev) => {
        const items = [...prev.items];
        if (editIndex != null && editIndex >= 0 && editIndex < items.length) {
          items[editIndex] = savedItem;
        } else {
          items.push(savedItem);
        }
        return { ...prev, items };
      });

      navigation.setParams({ savedItem: undefined, editIndex: undefined });
    }, [navigation, route.params]),
  );

  const removeItem = useCallback((index: number) => {
    setForm((prev) => {
      const item = prev.items[index];
      if (item?.id) {
        setRemovedItemIds((ids) => [...ids, item.id as string]);
      }
      return { ...prev, items: prev.items.filter((_, i) => i !== index) };
    });
  }, []);

  const editItem = useCallback(
    (index: number) => {
      const item = form.items[index];
      if (!item) return;
      navigation.navigate('MerchantShelfItemEditor', {
        prefill: item,
        editIndex: index,
        returnTo: 'shelf',
      });
    },
    [form.items, navigation],
  );

  const validateAndSave = useCallback(
    async (status: 'draft' | 'published') => {
      setErr(null);
      if (!outletId) {
        setErr('Wait for your outlet to load.');
        return;
      }
      if (!form.pickup_start || !form.pickup_end) {
        setErr('Set pickup start and end times.');
        return;
      }
      const ps = new Date(form.pickup_start);
      const pe = new Date(form.pickup_end);
      if (Number.isNaN(ps.getTime()) || Number.isNaN(pe.getTime())) {
        setErr('Invalid pickup times.');
        return;
      }
      if (status === 'published' && form.items.length < 1) {
        setErr('Add at least one item before publishing.');
        return;
      }
      if (status === 'published' && outletHalalCertified) {
        const nonHalal = form.items.filter((i) => i.is_halal !== true);
        if (nonHalal.length > 0) {
          const proceed = await new Promise<boolean>((resolve) => {
            Alert.alert(
              'Halal outlet notice',
              `${nonHalal.length} item(s) are not marked halal. Customers may expect halal-only products. Publish anyway?`,
              [
                { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                { text: 'Publish anyway', style: 'destructive', onPress: () => resolve(true) },
              ],
            );
          });
          if (!proceed) return;
        }
      }

      try {
        setSaving(true);
        await upsertShelf({
          pickupStart: ps.toISOString(),
          pickupEnd: pe.toISOString(),
          notes: form.notes.trim() || null,
          title: form.title.trim() || null,
          description: form.description.trim() || null,
          coverImageUrl: form.cover_image_url.trim() || null,
          status,
          items: form.items,
          removedItemIds,
        });
        navigation.goBack();
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Could not save shelf.');
      } finally {
        setSaving(false);
      }
    },
    [form, navigation, outletHalalCertified, outletId, removedItemIds, upsertShelf],
  );

  const addRecentItem = useCallback((item: ShelfItemDraft) => {
    setForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          ...item,
          id: undefined,
          tempId: newTempItemId(),
          quantity_total: item.quantity_total ?? 5,
          quantity_remaining: item.quantity_remaining ?? 5,
        },
      ],
    }));
  }, []);

  const peakNudge = isPeakPublishHour();

  const confirmRemove = useCallback(
    (index: number, name: string) => {
      Alert.alert('Remove item', `Remove "${name}" from this shelf?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeItem(index),
        },
      ]);
    },
    [removeItem],
  );

  const addItemWithoutBarcode = useCallback(() => {
    navigation.navigate('MerchantShelfItemEditor', {
      prefill: {
        tempId: newTempItemId(),
        barcode: null,
        name_snapshot: '',
        allergens_snapshot: [],
        rescue_price: 100,
        quantity_total: 5,
        quantity_remaining: 5,
      },
      returnTo: 'shelf',
    });
  }, [navigation]);

  const loading = contextLoading || shelvesLoading;

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
          {outletLabel}
        </StitchText>
        <StitchText variant="h1" colorKey="onBackground" style={{ marginBottom: spacing.xs }}>
          Today&apos;s clearance shelf
        </StitchText>
        <StitchText variant="body-md" colorKey="textMuted">
          Set pickup times and scan items onto your shelf.
        </StitchText>
      </View>

      {loading ? (
        <View style={{ padding: spacing.xl, alignItems: 'center' }}>
          <ActivityIndicator color={colors.primary} />
          <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: spacing.sm }}>
            Loading shelf…
          </StitchText>
        </View>
      ) : null}

      {shelvesError ? (
        <StitchText variant="body-sm" colorKey="error">
          {shelvesError}
        </StitchText>
      ) : null}

      <StitchSurface elevated padding="md">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
          <StitchIcon name="schedule" size={22} colorKey="textMuted" />
          <StitchText variant="h3" colorKey="onBackground">
            Pickup window
          </StitchText>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md }}>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              const now = new Date();
              const end = new Date(now.getTime() + 4 * 60 * 60 * 1000);
              setForm((f) => ({
                ...f,
                pickup_start: isoLocalRounded(now),
                pickup_end: isoLocalRounded(end),
              }));
            }}
            style={({ pressed }) => ({
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              borderRadius: radii.full,
              borderWidth: 1,
              borderColor: colors.primaryContainer,
              backgroundColor: colors.primaryHighlight,
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <StitchText variant="label" colorKey="primaryContainer">
              Now (4h window)
            </StitchText>
          </Pressable>
        </View>

        <PickupDateTimeField
          label="Starts *"
          value={form.pickup_start}
          onChange={(pickup_start) => setForm((f) => ({ ...f, pickup_start }))}
        />
        <PickupDateTimeField
          label="Ends *"
          value={form.pickup_end}
          onChange={(pickup_end) => setForm((f) => ({ ...f, pickup_end }))}
        />
      </StitchSurface>

      <StitchSurface elevated padding="md">
        <StitchText variant="h3" colorKey="onBackground" style={{ marginBottom: spacing.sm }}>
          Shelf notes
        </StitchText>
        <StitchText variant="body-sm" colorKey="textMuted" style={{ marginBottom: spacing.md }}>
          Shown to customers on the shelf page (pickup tips, bundle deals, etc.).
        </StitchText>
        <TextInput
          value={form.notes}
          onChangeText={(notes) => setForm((f) => ({ ...f, notes }))}
          placeholder="Optional note for shoppers"
          placeholderTextColor={colors.textFaint}
          multiline
          style={{
            minHeight: 72,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.md,
            borderRadius: radii.lg,
            borderWidth: 1,
            borderColor: colors.outlineVariant,
            backgroundColor: colors.surfaceBright,
            fontSize: 16,
            color: colors.text,
            textAlignVertical: 'top',
          }}
        />
      </StitchSurface>

      <StitchSurface elevated padding="md">
        <StitchText variant="h3" colorKey="onBackground" style={{ marginBottom: spacing.sm }}>
          Shelf listing
        </StitchText>
        <StitchText variant="body-sm" colorKey="textMuted" style={{ marginBottom: spacing.md }}>
          Optional title, description, and cover shown on the customer shelf page.
        </StitchText>
        <StitchText variant="label" colorKey="onBackground" style={{ marginBottom: spacing.xs }}>
          Title
        </StitchText>
        <TextInput
          value={form.title}
          onChangeText={(title) => setForm((f) => ({ ...f, title }))}
          placeholder="Today's clearance shelf"
          placeholderTextColor={colors.textFaint}
          style={{
            minHeight: 48,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.md,
            borderRadius: radii.lg,
            borderWidth: 1,
            borderColor: colors.outlineVariant,
            backgroundColor: colors.surfaceBright,
            fontSize: 16,
            color: colors.text,
            marginBottom: spacing.md,
          }}
        />
        <StitchText variant="label" colorKey="onBackground" style={{ marginBottom: spacing.xs }}>
          Description
        </StitchText>
        <TextInput
          value={form.description}
          onChangeText={(description) => setForm((f) => ({ ...f, description }))}
          placeholder="What's on offer today?"
          placeholderTextColor={colors.textFaint}
          multiline
          style={{
            minHeight: 72,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.md,
            borderRadius: radii.lg,
            borderWidth: 1,
            borderColor: colors.outlineVariant,
            backgroundColor: colors.surfaceBright,
            fontSize: 16,
            color: colors.text,
            textAlignVertical: 'top',
            marginBottom: spacing.md,
          }}
        />
        <StitchText variant="label" colorKey="onBackground" style={{ marginBottom: spacing.xs }}>
          Cover image URL
        </StitchText>
        <TextInput
          value={form.cover_image_url}
          onChangeText={(cover_image_url) => setForm((f) => ({ ...f, cover_image_url }))}
          placeholder="https://…"
          placeholderTextColor={colors.textFaint}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          style={{
            minHeight: 48,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.md,
            borderRadius: radii.lg,
            borderWidth: 1,
            borderColor: colors.outlineVariant,
            backgroundColor: colors.surfaceBright,
            fontSize: 16,
            color: colors.text,
          }}
        />
      </StitchSurface>

      {peakNudge ? (
        <StitchSurface
          elevated
          padding="md"
          style={{
            borderWidth: 1,
            borderColor: colors.primaryContainer,
            backgroundColor: colors.primaryHighlight,
          }}
        >
          <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
            <StitchIcon name="trending_up" size={22} colorKey="primaryContainer" />
            <View style={{ flex: 1 }}>
              <StitchText variant="label" colorKey="primaryContainer">
                Peak shopping hours
              </StitchText>
              <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: 4 }}>
                Publishing now helps your shelf appear while more customers are browsing.
              </StitchText>
            </View>
          </View>
        </StitchSurface>
      ) : null}

      {recentItems.length > 0 ? (
        <StitchSurface elevated padding="md">
          <StitchText variant="h3" colorKey="onBackground" style={{ marginBottom: spacing.sm }}>
            Recent items
          </StitchText>
          <StitchText variant="body-sm" colorKey="textMuted" style={{ marginBottom: spacing.md }}>
            Quick-add from past shelf listings.
          </StitchText>
          <View style={{ gap: spacing.sm }}>
            {recentItems.slice(0, 6).map((item) => (
              <Pressable
                key={`${item.barcode ?? item.name_snapshot}`}
                accessibilityRole="button"
                onPress={() => addRecentItem(item)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: spacing.sm,
                  borderRadius: radii.lg,
                  borderWidth: 1,
                  borderColor: colors.outlineVariant,
                  opacity: pressed ? 0.9 : 1,
                })}
              >
                <StitchText variant="body-sm" colorKey="onBackground" numberOfLines={1} style={{ flex: 1 }}>
                  {item.name_snapshot}
                </StitchText>
                <StitchIcon name="add" size={20} colorKey="primaryContainer" />
              </Pressable>
            ))}
          </View>
          {recentLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.sm }} />
          ) : null}
          <View style={{ marginTop: spacing.md }}>
            <StitchButton
              variant="secondary"
              title="Refresh recent"
              onPress={() => void refreshRecent()}
            />
          </View>
        </StitchSurface>
      ) : null}

      <StitchSurface elevated padding="md">
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: spacing.md,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <StitchIcon name="inventory_2" size={22} colorKey="textMuted" />
            <StitchText variant="h3" colorKey="onBackground">
              Items on shelf
            </StitchText>
          </View>
          <StitchText variant="label-caps" colorKey="textMuted">
            {form.items.length} item{form.items.length === 1 ? '' : 's'}
          </StitchText>
        </View>

        {form.items.length === 0 ? (
          <View
            style={{
              padding: spacing.lg,
              borderRadius: radii.lg,
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: colors.outlineVariant,
              alignItems: 'center',
              gap: spacing.sm,
            }}
          >
            <StitchIcon name="qr_code_scanner" size={32} colorKey="textFaint" />
            <StitchText variant="body-md" colorKey="textMuted" style={{ textAlign: 'center' }}>
              No items yet. Scan a barcode or add an item manually.
            </StitchText>
          </View>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {form.items.map((item, index) => (
              <ShelfItemCard
                key={item.id ?? item.tempId ?? index}
                item={item}
                onEdit={() => editItem(index)}
                onRemove={() => confirmRemove(index, item.name_snapshot)}
              />
            ))}
          </View>
        )}
      </StitchSurface>

      <StitchSurface elevated padding="md">
        <StitchText variant="h3" colorKey="onBackground" style={{ marginBottom: spacing.sm }}>
          Bulk discount
        </StitchText>
        <StitchText variant="body-sm" colorKey="textMuted" style={{ marginBottom: spacing.md }}>
          Apply the same % off retail to all items that have a retail price set.
        </StitchText>
        <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
          <TextInput
            value={bulkDiscountPct}
            onChangeText={setBulkDiscountPct}
            keyboardType="number-pad"
            placeholder="25"
            placeholderTextColor={colors.textFaint}
            style={{
              flex: 1,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              borderRadius: radii.lg,
              borderWidth: 1,
              borderColor: colors.outlineVariant,
              color: colors.text,
            }}
          />
          <StitchText variant="body-md" colorKey="textMuted">
            % off
          </StitchText>
          <Pressable
            onPress={applyBulkDiscount}
            style={{
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              borderRadius: radii.lg,
              backgroundColor: colors.secondaryContainer,
            }}
          >
            <StitchText variant="label" colorKey="onSecondaryContainer">
              Apply
            </StitchText>
          </Pressable>
        </View>
      </StitchSurface>

      {perfRows.length > 0 ? (
        <StitchSurface elevated padding="md">
          <StitchText variant="h3" colorKey="onBackground" style={{ marginBottom: spacing.sm }}>
            Today&apos;s item performance
          </StitchText>
          {perfRows.slice(0, 5).map((row) => (
            <View
              key={row.shelf_item_id}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingVertical: spacing.xs,
              }}
            >
              <StitchText variant="body-sm" colorKey="onBackground" style={{ flex: 1 }}>
                {row.name_snapshot}
              </StitchText>
              <StitchText variant="body-sm" colorKey="textMuted">
                {row.quantity_sold} sold · {formatLkr(row.revenue)}
              </StitchText>
            </View>
          ))}
        </StitchSurface>
      ) : null}

      <StitchButton variant="secondary" title="Preview as customer" onPress={openDraftPreview} />

      <Pressable
        accessibilityRole="button"
        onPress={() => navigation.navigate('MerchantShelfScanItem')}
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
        <StitchIcon name="qr_code_scanner" size={22} colorKey="onPrimary" />
        <StitchText variant="label" colorKey="onPrimary">
          Scan barcode to add item
        </StitchText>
      </Pressable>

      <StitchButton
        variant="secondary"
        title="Add without barcode"
        onPress={addItemWithoutBarcode}
      />

      {err ? (
        <StitchText variant="body-sm" colorKey="error">
          {err}
        </StitchText>
      ) : null}

      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <Pressable
          accessibilityRole="button"
          disabled={saving || !outletId}
          onPress={() => {
            void validateAndSave('draft');
          }}
          style={({ pressed }) => ({
            flex: 1,
            minHeight: 48,
            paddingVertical: spacing.md,
            borderRadius: radii.xl,
            borderWidth: 1,
            borderColor: colors.outlineVariant,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: saving || !outletId ? 0.5 : pressed ? 0.9 : 1,
          })}
        >
          {saving ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <StitchText variant="label" colorKey="onBackground">
              Save draft
            </StitchText>
          )}
        </Pressable>

        <Pressable
          accessibilityRole="button"
          disabled={saving || !outletId || form.items.length < 1}
          onPress={() => setShowPublishChecklist(true)}
          style={({ pressed }) => ({
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.xs,
            minHeight: 48,
            paddingVertical: spacing.md,
            borderRadius: radii.xl,
            backgroundColor: colors.secondaryContainer,
            opacity: saving || !outletId || form.items.length < 1 ? 0.5 : pressed ? 0.92 : 1,
          })}
        >
          {saving ? (
            <ActivityIndicator color={colors.onSecondaryContainer} />
          ) : (
            <>
              <StitchIcon name="publish" size={20} colorKey="onSecondaryContainer" />
              <StitchText variant="label" colorKey="onSecondaryContainer">
                Publish shelf
              </StitchText>
            </>
          )}
        </Pressable>
      </View>

      <StitchButton variant="secondary" title="Cancel" onPress={() => navigation.goBack()} />

      <Modal
        visible={showPublishChecklist}
        animationType="slide"
        transparent
        onRequestClose={() => setShowPublishChecklist(false)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: 'flex-end',
            backgroundColor: 'rgba(0,0,0,0.4)',
          }}
        >
          <View
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: radii.xl,
              borderTopRightRadius: radii.xl,
              padding: spacing.lg,
              gap: spacing.md,
            }}
          >
            <StitchText variant="h2" colorKey="onBackground">
              Publish checklist
            </StitchText>
            {publishChecklist.map((item) => (
              <View key={item.id} style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
                <StitchIcon
                  name={item.ok ? 'check_circle' : 'error'}
                  size={20}
                  colorKey={item.ok ? 'success' : 'error'}
                />
                <StitchText variant="body-md" colorKey="onBackground">
                  {item.label}
                </StitchText>
              </View>
            ))}
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <StitchButton
                variant="secondary"
                title="Cancel"
                onPress={() => setShowPublishChecklist(false)}
              />
              <Pressable
                disabled={saving}
                onPress={() => {
                  setShowPublishChecklist(false);
                  void validateAndSave('published');
                }}
                style={{
                  flex: 1,
                  minHeight: 48,
                  borderRadius: radii.xl,
                  backgroundColor: colors.secondaryContainer,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: saving ? 0.5 : 1,
                }}
              >
                <StitchText variant="label" colorKey="onSecondaryContainer">
                  Confirm publish
                </StitchText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </StitchScreen>
  );
}

function ShelfItemCard({
  item,
  onEdit,
  onRemove,
}: {
  item: ShelfItemDraft;
  onEdit: () => void;
  onRemove: () => void;
}): React.ReactElement {
  const { colors, spacing, radii } = useStitchTheme();

  return (
    <StitchSurface
      elevated
      padding="md"
      style={{
        borderWidth: 1,
        borderColor: colors.outlineVariant,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <StitchText variant="label" colorKey="onBackground" numberOfLines={2}>
            {item.name_snapshot}
          </StitchText>
          {item.brand_snapshot ? (
            <StitchText variant="body-sm" colorKey="textMuted">
              {item.brand_snapshot}
            </StitchText>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, marginTop: spacing.xs }}>
            {item.retail_price != null && item.retail_price > item.rescue_price ? (
              <StitchText
                variant="body-sm"
                colorKey="textFaint"
                style={{ textDecorationLine: 'line-through' }}
              >
                {formatLkr(item.retail_price)}
              </StitchText>
            ) : null}
            <StitchText variant="price" colorKey="accent">
              {formatLkr(item.rescue_price)}
            </StitchText>
          </View>
          <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: spacing.xs }}>
            Qty {item.quantity_total}
          </StitchText>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Edit item"
            onPress={onEdit}
            style={({ pressed }) => ({
              width: 36,
              height: 36,
              borderRadius: radii.default,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: pressed ? colors.surfaceContainer : colors.surfaceContainerLow,
            })}
          >
            <StitchIcon name="edit" size={18} colorKey="onBackground" />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Remove item"
            onPress={onRemove}
            style={({ pressed }) => ({
              width: 36,
              height: 36,
              borderRadius: radii.default,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: pressed ? colors.errorContainer : colors.surfaceContainerLow,
            })}
          >
            <StitchIcon name="delete" size={18} colorKey="error" />
          </Pressable>
        </View>
      </View>
    </StitchSurface>
  );
}
