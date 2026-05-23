import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthContext } from '@/context/AuthContext';
import {
  useMerchantPromotions,
  type PromoRow,
  type PromoStatus,
} from '@/hooks/useMerchantPromotions';
import { useMerchantContext } from '@/hooks/useMerchantContext';
import type { RootStackParamList } from '@/navigation/types';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import {
  StitchButton,
  StitchIcon,
  StitchScreen,
  StitchSurface,
  StitchText,
} from '@/ui/stitch';

const TABS = ['active', 'scheduled', 'expired'] as const;
type TabKey = (typeof TABS)[number];

type PromoCardModel = {
  id: string;
  tab: TabKey;
  headline: string;
  discountChip: string;
  body?: string;
  usageCurrent?: number;
  usageCapLabel: string;
  expiresLabel: string;
  tone: 'primary' | 'accent';
  minOrderLabel?: string;
};

function rowFromDb(r: PromoRow): PromoCardModel {
  const expires = r.ends_at
    ? new Date(r.ends_at).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
    : 'No expiry';
  return {
    id: r.id,
    tab: r.status,
    headline: r.title,
    discountChip: r.discount_label,
    body: undefined,
    usageCurrent: r.used_count,
    usageCapLabel: r.max_uses == null ? 'Unlimited' : String(r.max_uses),
    expiresLabel: expires,
    tone: 'primary',
    minOrderLabel: r.min_order_value > 0 ? `Min Rs. ${Math.round(r.min_order_value).toLocaleString()}` : undefined,
  };
}

export function MerchantPromotionsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { env } = useAuthContext();
  const { activeOutletId, loading: ctxLoading } = useMerchantContext(env);
  const [tab, setTab] = useState<TabKey>('active');
  const {
    rows,
    loading: promosLoading,
    error: promosError,
    create,
    update,
    updateStatus,
    remove,
  } = useMerchantPromotions(env, activeOutletId);
  const { colors, radii, spacing } = useStitchTheme();
  const loading = ctxLoading || promosLoading;
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftDiscount, setDraftDiscount] = useState('');
  const [draftStatus, setDraftStatus] = useState<PromoStatus>('active');
  const [draftMaxUses, setDraftMaxUses] = useState('');
  const [draftMinOrder, setDraftMinOrder] = useState('');
  // Free-form YYYY-MM-DD HH:mm inputs; parsed to ISO on submit. Cross-platform without the
  // imperative DateTimePickerAndroid / inline-iOS split that @react-native-community/datetimepicker
  // would otherwise require.
  const [draftStartsAt, setDraftStartsAt] = useState('');
  const [draftEndsAt, setDraftEndsAt] = useState('');
  const [draftError, setDraftError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Native date/time picker — surfaced via Pressable buttons next to the text
  // inputs so editors who prefer typing still can. We track which input + mode
  // (date | time) is currently picking; `null` means the picker is closed.
  const [picker, setPicker] = useState<{
    field: 'starts' | 'ends';
    mode: 'date' | 'time';
  } | null>(null);

  function formatPickerInput(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function pickerInitial(field: 'starts' | 'ends'): Date {
    const raw = field === 'starts' ? draftStartsAt : draftEndsAt;
    const parsed = parsePromoDate(raw);
    if (parsed.iso) return new Date(parsed.iso);
    const fallback = new Date();
    fallback.setSeconds(0, 0);
    return fallback;
  }

  function onPickerChange(event: DateTimePickerEvent, value?: Date) {
    if (!picker) return;
    const dismissed =
      event.type === 'dismissed' || (Platform.OS === 'android' && !value);
    if (dismissed) {
      setPicker(null);
      return;
    }
    const chosen = value ?? pickerInitial(picker.field);
    const formatted = formatPickerInput(chosen);
    if (picker.field === 'starts') setDraftStartsAt(formatted);
    else setDraftEndsAt(formatted);
    if (Platform.OS === 'android' && picker.mode === 'date') {
      // Chain date → time so Android users still get a full timestamp.
      setPicker({ field: picker.field, mode: 'time' });
    } else if (Platform.OS === 'android') {
      setPicker(null);
    }
  }

  /**
   * Parse a YYYY-MM-DD or YYYY-MM-DD HH:mm string into an ISO 8601 UTC string. Returns:
   *  - `{ iso: null }`  when input is empty (caller may treat as "no value")
   *  - `{ iso: '...' }` on success
   *  - `{ error: '...' }` when the input is unparseable
   * Accepts trailing seconds, and is lenient about the date/time separator.
   */
  function parsePromoDate(raw: string): { iso?: string | null; error?: string } {
    const v = raw.trim();
    if (!v) return { iso: null };
    const match = v.match(
      /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/,
    );
    if (!match) return { error: 'Use YYYY-MM-DD or YYYY-MM-DD HH:mm.' };
    const [, y, mo, d, h = '00', mi = '00', s = '00'] = match;
    const dt = new Date(
      Number(y),
      Number(mo) - 1,
      Number(d),
      Number(h),
      Number(mi),
      Number(s),
    );
    if (Number.isNaN(dt.getTime())) return { error: 'Invalid date.' };
    return { iso: dt.toISOString() };
  }

  function isoToInputString(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  const cards = useMemo(() => {
    return rows.filter((r) => r.status === tab).map(rowFromDb);
  }, [rows, tab]);

  const activeCount = useMemo(() => rows.filter((r) => r.status === 'active').length, [rows]);

  const stats = useMemo(() => {
    const active = activeCount;
    const uses = rows.reduce((sum, r) => sum + (r.used_count ?? 0), 0);
    const topByUses = [...rows].sort(
      (a, b) => (b.used_count ?? 0) - (a.used_count ?? 0),
    )[0];
    return {
      active,
      uses,
      topCode: topByUses?.title ?? '—',
      topUses: String(topByUses?.used_count ?? 0),
    };
  }, [rows, activeCount]);

  const styles = useMemo(() => {
    const pagePad = spacing.pageMarginMobile;
    const tabRow: ViewStyle = {
      flexDirection: 'row',
      gap: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
      marginBottom: spacing.lg,
    };
    const tabBtn: ViewStyle = {
      paddingBottom: spacing.sm,
      borderBottomWidth: 2,
      marginBottom: -1,
    };
    const statTile: ViewStyle = {
      flex: 1,
      minWidth: 140,
      borderRadius: radii.lg,
      padding: spacing.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.surfaceContainer,
    };
    const bentoTop: ViewStyle = {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
    };
    const cardBorder: ViewStyle = {
      borderWidth: 1,
      borderColor: colors.surfaceContainer,
      borderRadius: radii.lg,
    };
    const fabBase: ViewStyle = {
      position: 'absolute',
      right: spacing.md,
      bottom: spacing.lg + insets.bottom,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 20,
      elevation: 6,
      shadowColor: colors.shadow,
      shadowOpacity: 0.15,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
    };
    return {
      content: {
        paddingHorizontal: pagePad,
        paddingTop: spacing.md,
        paddingBottom: spacing.xxl + 72,
        gap: spacing.md,
      },
      headerBlock: { marginBottom: spacing.lg },
      tabRow,
      tabBtn,
      statTile,
      bentoTop,
      cardBorder,
      fabBase,
    };
  }, [colors, radii, spacing, insets.bottom]);

  function resetDraft() {
    setDraftTitle('');
    setDraftDiscount('');
    setDraftStatus('active');
    setDraftMaxUses('');
    setDraftMinOrder('');
    setDraftStartsAt('');
    setDraftEndsAt('');
    setDraftError(null);
  }

  function onCreatePromo() {
    if (!activeOutletId) {
      Alert.alert(
        'No active outlet',
        'Select an outlet from the merchant home screen before creating a promo.',
      );
      return;
    }
    resetDraft();
    setEditingId(null);
    setCreateOpen(true);
  }

  function onEditPromo(item: PromoCardModel) {
    const row = rows.find((r) => r.id === item.id);
    if (!row) return;
    setDraftTitle(row.title);
    setDraftDiscount(row.discount_label);
    setDraftStatus(row.status);
    setDraftMaxUses(row.max_uses == null ? '' : String(row.max_uses));
    setDraftMinOrder(row.min_order_value > 0 ? String(row.min_order_value) : '');
    setDraftStartsAt(isoToInputString(row.starts_at));
    setDraftEndsAt(isoToInputString(row.ends_at));
    setDraftError(null);
    setEditingId(row.id);
    setCreateOpen(true);
  }

  async function onSubmitDraft() {
    const title = draftTitle.trim();
    const discount = draftDiscount.trim();
    if (!title) {
      setDraftError('Promo code is required (e.g. SAVE10).');
      return;
    }
    if (!discount) {
      setDraftError('Discount label is required (e.g. 10% OFF).');
      return;
    }
    const maxUsesNum = draftMaxUses.trim()
      ? Number.parseInt(draftMaxUses.trim(), 10)
      : null;
    if (draftMaxUses.trim() && (Number.isNaN(maxUsesNum ?? NaN) || (maxUsesNum ?? 0) < 1)) {
      setDraftError('Max uses must be a positive whole number (or leave blank).');
      return;
    }
    const minOrderNum = draftMinOrder.trim()
      ? Number.parseFloat(draftMinOrder.trim())
      : 0;
    if (draftMinOrder.trim() && (Number.isNaN(minOrderNum) || minOrderNum < 0)) {
      setDraftError('Minimum order value must be 0 or greater (or leave blank).');
      return;
    }
    const startsParsed = parsePromoDate(draftStartsAt);
    if (startsParsed.error) {
      setDraftError(`Starts at: ${startsParsed.error}`);
      return;
    }
    const endsParsed = parsePromoDate(draftEndsAt);
    if (endsParsed.error) {
      setDraftError(`Ends at: ${endsParsed.error}`);
      return;
    }
    if (startsParsed.iso && endsParsed.iso && endsParsed.iso < startsParsed.iso) {
      setDraftError('Ends at must be after Starts at.');
      return;
    }
    setSubmitting(true);
    setDraftError(null);
    const result = editingId
      ? await update(editingId, {
          title: title.toUpperCase(),
          discount_label: discount,
          status: draftStatus,
          max_uses: maxUsesNum,
          min_order_value: minOrderNum,
          starts_at: startsParsed.iso ?? null,
          ends_at: endsParsed.iso ?? null,
        })
      : await create({
          title: title.toUpperCase(),
          discount_label: discount,
          status: draftStatus,
          max_uses: maxUsesNum,
          min_order_value: minOrderNum,
          starts_at: startsParsed.iso ?? null,
          ends_at: endsParsed.iso ?? null,
        });
    setSubmitting(false);
    if (result.error) {
      setDraftError(result.error);
      return;
    }
    resetDraft();
    setEditingId(null);
    setCreateOpen(false);
  }

  function onPromoMenu(item: PromoCardModel) {
    const current = rows.find((r) => r.id === item.id);
    if (!current) return;
    const next: PromoStatus =
      current.status === 'active' ? 'expired' : 'active';
    Alert.alert(item.headline, 'Choose an action for this promo.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Edit',
        onPress: () => onEditPromo(item),
      },
      {
        text: current.status === 'active' ? 'Pause (expire)' : 'Reactivate',
        onPress: async () => {
          setBusyId(item.id);
          const { error } = await updateStatus(item.id, next);
          setBusyId(null);
          if (error) Alert.alert('Update failed', error);
        },
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusyId(item.id);
          const { error } = await remove(item.id);
          setBusyId(null);
          if (error) Alert.alert('Delete failed', error);
        },
      },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StitchScreen scroll style={{ flex: 1 }} scrollProps={{ contentContainerStyle: styles.content }}>
        <View style={styles.headerBlock}>
          <StitchText variant="h1" colorKey="text">
            Promos management
          </StitchText>
          <StitchText variant="body-md" colorKey="textMuted" style={{ marginTop: 4 }}>
            Create and manage your discount codes.
          </StitchText>
        </View>

        <View style={[styles.bentoTop, { marginBottom: spacing.xl }]}>
          <View style={styles.statTile}>
            <StitchText variant="label-caps" colorKey="textMuted" style={{ marginBottom: spacing.sm }}>
              Active promos
            </StitchText>
            <StitchText variant="display" colorKey="text">
              {loading ? '—' : String(stats.active)}
            </StitchText>
          </View>
          <View style={styles.statTile}>
            <StitchText variant="label-caps" colorKey="textMuted" style={{ marginBottom: spacing.sm }}>
              Total uses
            </StitchText>
            <StitchText variant="display" colorKey="text">
              {loading ? '—' : stats.uses.toLocaleString()}
            </StitchText>
          </View>
        </View>

        <View style={[styles.bentoTop, { marginBottom: spacing.xl }]}>
          <View style={[styles.statTile, { flexGrow: 1, minWidth: 260 }]}>
            <StitchText variant="label-caps" colorKey="textMuted" style={{ marginBottom: spacing.sm }}>
              Top performing code
            </StitchText>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
              <StitchText variant="price" colorKey="primaryContainer">
                {stats.topCode}
              </StitchText>
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: radii.default,
                  backgroundColor: colors.surface2,
                }}
              >
                <StitchText variant="body-sm" colorKey="textMuted">
                  {stats.topUses} uses
                </StitchText>
              </View>
            </View>
          </View>
        </View>

        {promosError ? (
          <StitchSurface elevated padding="md" style={[styles.cardBorder, { marginBottom: spacing.md, backgroundColor: colors.errorContainer }]}>
            <StitchText variant="label-caps" colorKey="error">Promotions unavailable</StitchText>
            <StitchText variant="body-sm" colorKey="text" style={{ marginTop: 4 }}>
              {promosError}
            </StitchText>
          </StitchSurface>
        ) : null}

        {createOpen ? (
          <StitchSurface elevated padding="md" style={[styles.cardBorder, { marginBottom: spacing.md }]}>
            <StitchText variant="h3" colorKey="text">
              {editingId ? 'Edit promo' : 'New promo code'}
            </StitchText>
            <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: 4 }}>
              {editingId
                ? 'Updates the existing `merchant_promotions` row.'
                : 'Will be saved to `merchant_promotions` for the active outlet.'}
            </StitchText>

            <StitchText variant="label-caps" colorKey="textMuted" style={{ marginTop: spacing.md, marginBottom: 4 }}>
              Promo code
            </StitchText>
            <TextInput
              value={draftTitle}
              onChangeText={setDraftTitle}
              autoCapitalize="characters"
              placeholder="SAVE10"
              placeholderTextColor={colors.textMuted}
              style={{
                borderWidth: 1,
                borderColor: colors.outlineVariant,
                borderRadius: radii.default,
                paddingHorizontal: spacing.md,
                paddingVertical: 10,
                color: colors.text,
              }}
            />

            <StitchText variant="label-caps" colorKey="textMuted" style={{ marginTop: spacing.md, marginBottom: 4 }}>
              Discount label
            </StitchText>
            <TextInput
              value={draftDiscount}
              onChangeText={setDraftDiscount}
              placeholder="10% OFF"
              placeholderTextColor={colors.textMuted}
              style={{
                borderWidth: 1,
                borderColor: colors.outlineVariant,
                borderRadius: radii.default,
                paddingHorizontal: spacing.md,
                paddingVertical: 10,
                color: colors.text,
              }}
            />

            <StitchText variant="label-caps" colorKey="textMuted" style={{ marginTop: spacing.md, marginBottom: 4 }}>
              Status
            </StitchText>
            <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
              {(TABS as readonly PromoStatus[]).map((s) => {
                const on = draftStatus === s;
                return (
                  <Pressable
                    key={s}
                    accessibilityRole="button"
                    onPress={() => setDraftStatus(s)}
                    style={{
                      paddingHorizontal: spacing.md,
                      paddingVertical: 8,
                      borderRadius: radii.full,
                      backgroundColor: on ? colors.primaryHighlight : colors.surface,
                      borderWidth: 1,
                      borderColor: on ? colors.primary : colors.outlineVariant,
                    }}
                  >
                    <StitchText variant="label" colorKey={on ? 'primaryContainer' : 'textMuted'}>
                      {s === 'active' ? 'Active' : s === 'scheduled' ? 'Scheduled' : 'Expired'}
                    </StitchText>
                  </Pressable>
                );
              })}
            </View>

            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
              <View style={{ flex: 1 }}>
                <StitchText variant="label-caps" colorKey="textMuted" style={{ marginBottom: 4 }}>
                  Max uses (optional)
                </StitchText>
                <TextInput
                  value={draftMaxUses}
                  onChangeText={setDraftMaxUses}
                  keyboardType="number-pad"
                  placeholder="Unlimited"
                  placeholderTextColor={colors.textMuted}
                  style={{
                    borderWidth: 1,
                    borderColor: colors.outlineVariant,
                    borderRadius: radii.default,
                    paddingHorizontal: spacing.md,
                    paddingVertical: 10,
                    color: colors.text,
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <StitchText variant="label-caps" colorKey="textMuted" style={{ marginBottom: 4 }}>
                  Min order (LKR)
                </StitchText>
                <TextInput
                  value={draftMinOrder}
                  onChangeText={setDraftMinOrder}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  style={{
                    borderWidth: 1,
                    borderColor: colors.outlineVariant,
                    borderRadius: radii.default,
                    paddingHorizontal: spacing.md,
                    paddingVertical: 10,
                    color: colors.text,
                  }}
                />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
              <View style={{ flex: 1 }}>
                <StitchText variant="label-caps" colorKey="textMuted" style={{ marginBottom: 4 }}>
                  Starts at (optional)
                </StitchText>
                <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                  <TextInput
                    value={draftStartsAt}
                    onChangeText={setDraftStartsAt}
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder="YYYY-MM-DD HH:mm"
                    placeholderTextColor={colors.textMuted}
                    style={{
                      flex: 1,
                      borderWidth: 1,
                      borderColor: colors.outlineVariant,
                      borderRadius: radii.default,
                      paddingHorizontal: spacing.md,
                      paddingVertical: 10,
                      color: colors.text,
                    }}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Open date picker for Starts at"
                    onPress={() =>
                      setPicker({
                        field: 'starts',
                        mode: Platform.OS === 'ios' ? 'date' : 'date',
                      })
                    }
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 10,
                      borderRadius: radii.default,
                      borderWidth: 1,
                      borderColor: colors.outlineVariant,
                    }}
                  >
                    <StitchIcon name="event" size={20} colorKey="textMuted" />
                  </Pressable>
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <StitchText variant="label-caps" colorKey="textMuted" style={{ marginBottom: 4 }}>
                  Ends at (optional)
                </StitchText>
                <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                  <TextInput
                    value={draftEndsAt}
                    onChangeText={setDraftEndsAt}
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder="YYYY-MM-DD HH:mm"
                    placeholderTextColor={colors.textMuted}
                    style={{
                      flex: 1,
                      borderWidth: 1,
                      borderColor: colors.outlineVariant,
                      borderRadius: radii.default,
                      paddingHorizontal: spacing.md,
                      paddingVertical: 10,
                      color: colors.text,
                    }}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Open date picker for Ends at"
                    onPress={() => setPicker({ field: 'ends', mode: 'date' })}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 10,
                      borderRadius: radii.default,
                      borderWidth: 1,
                      borderColor: colors.outlineVariant,
                    }}
                  >
                    <StitchIcon name="event" size={20} colorKey="textMuted" />
                  </Pressable>
                </View>
              </View>
            </View>

            {picker ? (
              <View style={{ marginTop: spacing.sm }}>
                <DateTimePicker
                  value={pickerInitial(picker.field)}
                  mode={picker.mode}
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={onPickerChange}
                  themeVariant="light"
                />
                {Platform.OS === 'ios' ? (
                  <View
                    style={{
                      flexDirection: 'row',
                      gap: spacing.sm,
                      marginTop: spacing.xs,
                      justifyContent: 'flex-end',
                    }}
                  >
                    {picker.mode === 'date' ? (
                      <StitchButton
                        title="Pick time"
                        variant="secondary"
                        onPress={() =>
                          setPicker({ field: picker.field, mode: 'time' })
                        }
                      />
                    ) : (
                      <StitchButton
                        title="Pick date"
                        variant="secondary"
                        onPress={() =>
                          setPicker({ field: picker.field, mode: 'date' })
                        }
                      />
                    )}
                    <StitchButton
                      title="Done"
                      variant="primary"
                      onPress={() => setPicker(null)}
                    />
                  </View>
                ) : null}
              </View>
            ) : null}

            {draftError ? (
              <StitchText variant="body-sm" colorKey="error" style={{ marginTop: spacing.sm }}>
                {draftError}
              </StitchText>
            ) : null}

            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
              <StitchButton
                title={
                  submitting
                    ? 'Saving…'
                    : editingId
                      ? 'Save changes'
                      : 'Create promo'
                }
                variant="primary"
                disabled={submitting}
                onPress={() => void onSubmitDraft()}
                style={{ flex: 1 }}
              />
              <StitchButton
                title="Cancel"
                variant="secondary"
                disabled={submitting}
                onPress={() => {
                  resetDraft();
                  setEditingId(null);
                  setCreateOpen(false);
                }}
                style={{ flex: 1 }}
              />
            </View>
          </StitchSurface>
        ) : null}

        <View style={styles.tabRow}>
          {TABS.map((t) => {
            const on = tab === t;
            return (
              <Pressable
                key={t}
                accessibilityRole="button"
                onPress={() => setTab(t)}
                style={[styles.tabBtn, { borderBottomColor: on ? colors.primaryContainer : 'transparent' }]}
              >
                <StitchText variant="label" colorKey={on ? 'primaryContainer' : 'textMuted'}>
                  {t === 'active' ? 'Active' : t === 'scheduled' ? 'Scheduled' : 'Expired'}
                </StitchText>
              </Pressable>
            );
          })}
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primaryContainer} style={{ marginTop: spacing.lg }} />
        ) : cards.length === 0 ? (
          <StitchSurface elevated padding="lg" style={styles.cardBorder}>
            <StitchText variant="h3" colorKey="text" style={{ textAlign: 'center' }}>
              {tab === 'active' ? 'No promos yet' : `No ${tab} promos yet`}
            </StitchText>
            <StitchText
              variant="body-md"
              colorKey="textMuted"
              style={{ textAlign: 'center', marginTop: 6 }}
            >
              {tab === 'active'
                ? 'Create your first promo to start offering deals to customers.'
                : tab === 'scheduled'
                  ? 'Plan a promo in advance to drive demand on quieter days.'
                  : 'Expired or paused promos will show up here for reference.'}
            </StitchText>
            <View style={{ marginTop: spacing.md, alignItems: 'center' }}>
              <StitchButton
                title="Create promo"
                variant="primary"
                onPress={onCreatePromo}
              />
            </View>
          </StitchSurface>
        ) : (
          <View style={{ gap: spacing.md }}>
            {cards.map((item) => (
              <StitchSurface key={item.id} elevated padding="md" style={styles.cardBorder}>
                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    gap: spacing.md,
                  }}
                >
                  <View style={{ flex: 1, minWidth: 200 }}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: spacing.sm,
                        flexWrap: 'wrap',
                        marginBottom: spacing.sm,
                      }}
                    >
                      <StitchText variant="h3" colorKey="text">
                        {item.headline}
                      </StitchText>
                      <View
                        style={{
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                          borderRadius: radii.default,
                          backgroundColor:
                            item.tone === 'primary' ? colors.primaryHighlight : colors.accentHighlight,
                        }}
                      >
                        <StitchText
                          variant="label-caps"
                          colorKey={item.tone === 'primary' ? 'primaryContainer' : 'secondary'}
                        >
                          {item.discountChip}
                        </StitchText>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <View
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: colors.success,
                          }}
                        />
                        <StitchText variant="label-caps" colorKey="success">
                          {item.tab === 'active'
                            ? 'Active'
                            : item.tab === 'scheduled'
                              ? 'Scheduled'
                              : 'Expired'}
                        </StitchText>
                      </View>
                    </View>
                    {item.body ? (
                      <StitchText variant="body-sm" colorKey="textMuted">
                        {item.body}
                      </StitchText>
                    ) : null}
                    {item.minOrderLabel ? (
                      <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: 2 }}>
                        {item.minOrderLabel}
                      </StitchText>
                    ) : null}
                  </View>
                  <View
                    style={{
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      gap: spacing.lg,
                      alignItems: 'center',
                    }}
                  >
                    <View>
                      <StitchText variant="label-caps" colorKey="textFaint" style={{ marginBottom: 4 }}>
                        Usage
                      </StitchText>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline' }}>
                        <StitchText variant="label" colorKey="text">
                          {item.usageCurrent != null ? String(item.usageCurrent) : '—'}
                        </StitchText>
                        <StitchText variant="label" colorKey="textMuted">
                          {' '}
                          / {item.usageCapLabel}
                        </StitchText>
                      </View>
                    </View>
                    <View>
                      <StitchText variant="label-caps" colorKey="textFaint" style={{ marginBottom: 4 }}>
                        Expires
                      </StitchText>
                      <StitchText variant="label" colorKey="text">
                        {item.expiresLabel}
                      </StitchText>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => onPromoMenu(item)}
                      disabled={busyId === item.id}
                      style={{ opacity: busyId === item.id ? 0.5 : 1 }}
                    >
                      <StitchIcon name="more_vert" size={22} colorKey="textMuted" />
                    </Pressable>
                  </View>
                </View>
              </StitchSurface>
            ))}
          </View>
        )}

        <Pressable accessibilityRole="button" onPress={() => navigation.goBack()} style={{ marginTop: spacing.md }}>
          <StitchText variant="label" colorKey="primaryContainer">
            Back
          </StitchText>
        </Pressable>
      </StitchScreen>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Create new promo"
        onPress={onCreatePromo}
        style={({ pressed }) => [styles.fabBase, { opacity: pressed ? 0.9 : 1 }]}
      >
        <StitchIcon name="add" size={26} colorKey="onPrimary" />
      </Pressable>
    </View>
  );
}
