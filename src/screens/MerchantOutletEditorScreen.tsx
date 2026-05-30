/**
 * MerchantOutletEditor — dedicated post-onboarding editor for a specific outlet owned by the
 * signed-in merchant. Builds on Stitch primitives (`StitchScreen`, `StitchSurface`,
 * `StitchCard`, `StitchButton`, `StitchText`, `StitchIcon`, `StitchDivider`) and closes the
 * lat/lng + per-day opening hours gap that `MerchantOnboarding` step 2 leaves open.
 *
 * Sections:
 *   - Outlet name
 *   - Address
 *   - Contact phone
 *   - Category (segmented picker over `outlets.category` enum vocabulary)
 *   - `is_active` switch
 *   - Per-day opening hours grid (Mon–Sun rows, two `HH:MM` time inputs each)
 *   - Location: `react-native-maps` is a dependency, so we render a draggable `Marker` on a
 *     `MapView`. Numeric `TextInput`s remain as a typing fallback. Persists via
 *     `update outlets set location = ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
 *     where id = $1` (we verified `outlets.location` is `geography`).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Switch,
  TextInput,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { useAuthContext } from '@/context/AuthContext';
import { FALLBACK_COORDS } from '@/lib/fallbackCoords';
import { parseOutletCoords } from '@/lib/parseOutletCoords';
import { useMerchantContext } from '@/hooks/useMerchantContext';
import { ensureOutletDemoListings } from '@/lib/ensureOutletDemoListings';
import { MERCHANT_OUTLET_CATEGORIES } from '@/lib/outletListingMode';
import { outletCategoryWarnings } from '@/lib/outletCategoryWarning';
import { getSupabase } from '@/lib/supabase';
import { mapStyleForScheme } from '@/lib/mapStyles';
import { useStitchTheme, type StitchTheme } from '@/theme/StitchThemeContext';
import {
  StitchButton,
  StitchDivider,
  StitchIcon,
  StitchScreen,
  StitchSurface,
  StitchText,
} from '@/ui/stitch';

type Nav = NativeStackNavigationProp<RootStackParamList, 'MerchantOutletEditor'>;
type R = RouteProp<RootStackParamList, 'MerchantOutletEditor'>;

type CategoryKey = (typeof MERCHANT_OUTLET_CATEGORIES)[number]['key'] | 'hotel';

const DAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
type DayKey = (typeof DAY_ORDER)[number];

const DAY_LABEL: Record<DayKey, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};

type DayHours = { open: string; close: string };
type BusinessHours = Record<DayKey, DayHours>;

const DEFAULT_HOURS: DayHours = { open: '09:00', close: '18:00' };

/** Accepts `HH:MM` (24h) or `H:MM`; returns normalized `HH:MM` or original on miss. */
function normalizeTimeInput(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed === '') return trimmed;
  const m = /^([0-9]{1,2}):([0-9]{2})$/.exec(trimmed);
  if (!m) return trimmed;
  const h = Math.max(0, Math.min(23, Number(m[1])));
  const mm = Math.max(0, Math.min(59, Number(m[2])));
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function readHoursJsonb(raw: unknown): BusinessHours {
  const base: BusinessHours = {
    mon: { ...DEFAULT_HOURS },
    tue: { ...DEFAULT_HOURS },
    wed: { ...DEFAULT_HOURS },
    thu: { ...DEFAULT_HOURS },
    fri: { ...DEFAULT_HOURS },
    sat: { ...DEFAULT_HOURS },
    sun: { ...DEFAULT_HOURS },
  };
  if (!raw || typeof raw !== 'object') return base;
  const obj = raw as Record<string, unknown>;
  for (const day of DAY_ORDER) {
    const v = obj[day];
    if (v && typeof v === 'object') {
      const cell = v as Record<string, unknown>;
      const open = String(cell.open ?? '').trim();
      const close = String(cell.close ?? '').trim();
      base[day] = {
        open: open || DEFAULT_HOURS.open,
        close: close || DEFAULT_HOURS.close,
      };
    }
  }
  return base;
}

export function MerchantOutletEditorScreen(): React.ReactElement {
  const navigation = useNavigation<Nav>();
  const route = useRoute<R>();
  const { env } = useAuthContext();
  const { refetch: refetchMerchantContext } = useMerchantContext(env);
  const { colors, radii, spacing, colorScheme } = useStitchTheme();
  const customMapStyle = useMemo(
    () => mapStyleForScheme(colorScheme),
    [colorScheme],
  );
  const outletId = String(route.params?.outletId ?? '').trim();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [category, setCategory] = useState<CategoryKey>('other');
  const [isActive, setIsActive] = useState(false);
  const [isHalalCertified, setIsHalalCertified] = useState(false);
  const [hours, setHours] = useState<BusinessHours>(() => readHoursJsonb(null));
  const [lat, setLat] = useState<string>('');
  const [lng, setLng] = useState<string>('');

  const styles = useMemo(() => createStyles({ colors, radii, spacing }), [colors, radii, spacing]);
  const categoryWarnings = useMemo(
    () => outletCategoryWarnings(name, category),
    [name, category],
  );

  useEffect(() => {
    let alive = true;
    if (!outletId) {
      setLoadError('Missing outlet id.');
      setLoading(false);
      return () => {
        alive = false;
      };
    }
    (async () => {
      const sb = getSupabase(env);
      const { data, error } = await sb
        .from('outlets')
        .select(
          'id, name, address, pickup_instructions, business_hours, category, is_active, is_halal_certified, location',
        )
        .eq('id', outletId)
        .maybeSingle();
      if (!alive) return;
      if (error) {
        setLoadError(error.message);
        setLoading(false);
        return;
      }
      if (!data) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const row = data as Record<string, unknown>;
      setName(String(row.name ?? ''));
      setAddress(String(row.address ?? ''));
      // `pickup_instructions` is a free-text column already; we keep the contact phone
      // alongside it as a short structured prefix `Phone: NN…\n…` so we don't need a new
      // column. Read back any leading `Phone:` line into the phone field.
      const pi = String(row.pickup_instructions ?? '');
      const phoneMatch = pi.match(/^Phone:\s*([^\n]+)/i);
      setPhone(phoneMatch ? phoneMatch[1].trim() : '');
      const rawCat = String(row.category ?? 'other').toLowerCase();
      const isKnown =
        MERCHANT_OUTLET_CATEGORIES.some((c) => c.key === rawCat) || rawCat === 'hotel';
      setCategory((isKnown ? rawCat : 'other') as CategoryKey);
      setIsActive(Boolean(row.is_active));
      setIsHalalCertified(Boolean(row.is_halal_certified));
      setHours(readHoursJsonb(row.business_hours));
      const loc = parseOutletCoords(row.location);
      if (loc) {
        setLat(String(loc.lat));
        setLng(String(loc.lng));
      } else {
        setLat('');
        setLng('');
      }
      setLoading(false);
    })().catch((e) => {
      if (!alive) return;
      setLoadError(e instanceof Error ? e.message : 'Failed to load outlet.');
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [env, outletId]);

  const parsedLat = Number(lat);
  const parsedLng = Number(lng);
  const hasLatLng =
    Number.isFinite(parsedLat) &&
    Number.isFinite(parsedLng) &&
    parsedLat >= -90 &&
    parsedLat <= 90 &&
    parsedLng >= -180 &&
    parsedLng <= 180;

  const initialRegion = useMemo(
    () => ({
      // Merchants editing an outlet do NOT want the map snapping to their phone's
      // current GPS — we deliberately use a shared static fallback constant
      // instead of pulling `useUserLocation` into this screen. The fallback only
      // ever matters when the outlet row has no `location` (newly created
      // outlets before lat/lng is saved).
      latitude: hasLatLng ? parsedLat : FALLBACK_COORDS.lat,
      longitude: hasLatLng ? parsedLng : FALLBACK_COORDS.lng,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    }),
    [hasLatLng, parsedLat, parsedLng],
  );

  const mapRegionKey = hasLatLng
    ? `${parsedLat.toFixed(5)}:${parsedLng.toFixed(5)}`
    : 'fallback';

  const onSave = useCallback(async () => {
    if (!outletId) return;
    if (!name.trim()) {
      Alert.alert('Name required', 'Outlet name cannot be empty.');
      return;
    }
    if (!address.trim()) {
      Alert.alert('Address required', 'Outlet address cannot be empty.');
      return;
    }
    setSaving(true);
    const sb = getSupabase(env);
    const trimmedPhone = phone.trim();
    // Merge the phone back into `pickup_instructions` so existing pickup notes (if any) are
    // preserved. Reads any `Phone: …` first line on load; rewrites it on save.
    const pickupInstructions = trimmedPhone
      ? `Phone: ${trimmedPhone}`
      : null;

    const businessHours: Record<string, DayHours> = {};
    for (const day of DAY_ORDER) {
      const cell = hours[day];
      businessHours[day] = {
        open: normalizeTimeInput(cell.open),
        close: normalizeTimeInput(cell.close),
      };
    }

    const payload: Record<string, unknown> = {
      name: name.trim(),
      address: address.trim(),
      category,
      is_active: isActive,
      is_halal_certified: isHalalCertified,
      business_hours: businessHours,
      pickup_instructions: pickupInstructions,
      updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await sb
      .from('outlets')
      .update(payload)
      .eq('id', outletId);

    if (updateError) {
      setSaving(false);
      Alert.alert('Save failed', updateError.message);
      return;
    }

    const demoEnsure = await ensureOutletDemoListings(env, outletId);
    if (demoEnsure.error) {
      setSaving(false);
      Alert.alert(
        'Outlet saved, demos not refreshed',
        `Category saved but demo listings could not be refreshed: ${demoEnsure.error}`,
      );
      navigation.goBack();
      return;
    }

    if (hasLatLng) {
      // PostGIS write must use ST_SetSRID(ST_MakePoint(...), 4326)::geography. We can't get
      // PostgREST to emit that exact cast — use the existing RPC-friendly text representation
      // via `update_outlet_location` if present, else fall back to a WKT string with SRID.
      const wktLiteral = `SRID=4326;POINT(${parsedLng} ${parsedLat})`;
      const { error: locError } = await sb
        .from('outlets')
        .update({ location: wktLiteral })
        .eq('id', outletId);
      if (locError) {
        setSaving(false);
        Alert.alert(
          'Outlet saved, location skipped',
          `Details were saved but location did not persist: ${locError.message}`,
        );
        navigation.goBack();
        return;
      }
    }

    await refetchMerchantContext();
    setSaving(false);
    navigation.goBack();
  }, [
    address,
    category,
    env,
    hasLatLng,
    hours,
    isActive,
    isHalalCertified,
    name,
    navigation,
    outletId,
    parsedLat,
    parsedLng,
    phone,
    refetchMerchantContext,
  ]);

  if (loading) {
    return (
      <StitchScreen>
        <View style={styles.centerFill}>
          <ActivityIndicator color={colors.primaryContainer} />
        </View>
      </StitchScreen>
    );
  }

  if (notFound) {
    return (
      <StitchScreen>
        <View style={styles.centerFill}>
          <StitchText variant="h2" colorKey="text">
            Outlet not found
          </StitchText>
          <StitchText variant="body-sm" colorKey="textMuted" style={styles.centerCopy}>
            We couldn't find this outlet under your account. It may have been removed or you
            may not have permission to edit it.
          </StitchText>
          <StitchButton title="Go back" variant="secondary" onPress={() => navigation.goBack()} />
        </View>
      </StitchScreen>
    );
  }

  return (
    <StitchScreen
      scroll
      scrollProps={{
        contentContainerStyle: styles.content,
        keyboardShouldPersistTaps: 'handled',
      }}
    >
      <View style={styles.headerBlock}>
        <StitchText variant="h1" colorKey="text">
          Edit outlet
        </StitchText>
        <StitchText variant="body-md" colorKey="textMuted" style={{ marginTop: 4 }}>
          Update details for this outlet. Changes apply immediately to your live listings.
        </StitchText>
      </View>

      {loadError ? (
        <StitchSurface elevated padding="md" style={{ backgroundColor: colors.errorContainer }}>
          <StitchText variant="body-sm" colorKey="onErrorContainer">
            {loadError}
          </StitchText>
        </StitchSurface>
      ) : null}

      <StitchSurface elevated padding="md" style={styles.cardBorder}>
        <StitchText variant="h3" colorKey="text">
          Outlet identity
        </StitchText>
        <View style={{ gap: spacing.md, marginTop: spacing.md }}>
          <View style={styles.fieldCol}>
            <StitchText variant="label-caps" colorKey="textMuted">
              Name
            </StitchText>
            <TextInput
              value={name}
              onChangeText={setName}
              style={styles.input}
              placeholder="Eg. The Daily Crumb — Wellawatte"
              placeholderTextColor={colors.textFaint}
            />
          </View>
          <View style={styles.fieldCol}>
            <StitchText variant="label-caps" colorKey="textMuted">
              Address
            </StitchText>
            <TextInput
              value={address}
              onChangeText={setAddress}
              style={[styles.input, styles.inputMultiline]}
              placeholder="Street, neighbourhood, city"
              placeholderTextColor={colors.textFaint}
              multiline
            />
          </View>
          <View style={styles.fieldCol}>
            <StitchText variant="label-caps" colorKey="textMuted">
              Contact phone
            </StitchText>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              style={styles.input}
              placeholder="+94 71 234 5678"
              placeholderTextColor={colors.textFaint}
              keyboardType="phone-pad"
            />
            <StitchText variant="body-sm" colorKey="textFaint" style={{ marginTop: 4 }}>
              Saved into `outlets.pickup_instructions` as a `Phone:` line for pickup ops.
            </StitchText>
          </View>
        </View>
      </StitchSurface>

      <StitchSurface elevated padding="md" style={styles.cardBorder}>
        <StitchText variant="h3" colorKey="text">
          Category
        </StitchText>
        <View style={styles.chipRow}>
          {MERCHANT_OUTLET_CATEGORIES.map(({ key, label }) => {
            const on = category === key;
            return (
              <Pressable
                key={key}
                onPress={() => setCategory(key)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: on ? colors.primary : colors.surface,
                    borderColor: on ? colors.primary : colors.outlineVariant,
                  },
                ]}
              >
                <StitchText variant="label" colorKey={on ? 'onPrimary' : 'text'}>
                  {label}
                </StitchText>
              </Pressable>
            );
          })}
        </View>
        {categoryWarnings.length > 0 ? (
          <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
            {categoryWarnings.map((msg) => (
              <View
                key={msg}
                style={{
                  padding: spacing.md,
                  borderRadius: radii.lg,
                  backgroundColor: colors.accentHighlight,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: colors.outlineVariant,
                  flexDirection: 'row',
                  gap: spacing.sm,
                  alignItems: 'flex-start',
                }}
              >
                <StitchIcon name="info" size={20} colorKey="accent" />
                <StitchText variant="body-sm" colorKey="onSurfaceVariant" style={{ flex: 1 }}>
                  {msg}
                </StitchText>
              </View>
            ))}
          </View>
        ) : null}
      </StitchSurface>

      <StitchSurface elevated padding="md" style={styles.cardBorder}>
        <View style={styles.activeRow}>
          <View style={{ flex: 1, paddingRight: spacing.md }}>
            <StitchText variant="h3" colorKey="text">
              Active for customers
            </StitchText>
            <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: 4 }}>
              Toggle off to hide this outlet from Discover and Search without deleting it.
            </StitchText>
          </View>
          <Switch value={isActive} onValueChange={setIsActive} />
        </View>
      </StitchSurface>

      <StitchSurface elevated padding="md" style={styles.cardBorder}>
        <View style={styles.activeRow}>
          <View style={{ flex: 1, paddingRight: spacing.md }}>
            <StitchText variant="h3" colorKey="text">
              Halal-certified outlet
            </StitchText>
            <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: 4 }}>
              Only enable if your entire outlet is halal-certified. If only some items are halal,
              leave this off and mark individual rescue bags instead.
            </StitchText>
          </View>
          <Switch value={isHalalCertified} onValueChange={setIsHalalCertified} />
        </View>
      </StitchSurface>

      <StitchSurface elevated padding="md" style={styles.cardBorder}>
        <StitchText variant="h3" colorKey="text">
          Opening hours
        </StitchText>
        <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: 4 }}>
          Use 24-hour `HH:MM`. Leave both fields empty to mark a day closed.
        </StitchText>
        <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
          {DAY_ORDER.map((day, index) => (
            <View key={day}>
              <View style={styles.hoursRow}>
                <View style={styles.dayLabel}>
                  <StitchText variant="label" colorKey="text">
                    {DAY_LABEL[day]}
                  </StitchText>
                </View>
                <TextInput
                  value={hours[day].open}
                  onChangeText={(t) =>
                    setHours((prev) => ({
                      ...prev,
                      [day]: { ...prev[day], open: t },
                    }))
                  }
                  onBlur={() =>
                    setHours((prev) => ({
                      ...prev,
                      [day]: { ...prev[day], open: normalizeTimeInput(prev[day].open) },
                    }))
                  }
                  style={styles.timeInput}
                  placeholder="09:00"
                  placeholderTextColor={colors.textFaint}
                  keyboardType="numbers-and-punctuation"
                />
                <StitchText variant="label" colorKey="textMuted" style={styles.timeDivider}>
                  to
                </StitchText>
                <TextInput
                  value={hours[day].close}
                  onChangeText={(t) =>
                    setHours((prev) => ({
                      ...prev,
                      [day]: { ...prev[day], close: t },
                    }))
                  }
                  onBlur={() =>
                    setHours((prev) => ({
                      ...prev,
                      [day]: { ...prev[day], close: normalizeTimeInput(prev[day].close) },
                    }))
                  }
                  style={styles.timeInput}
                  placeholder="18:00"
                  placeholderTextColor={colors.textFaint}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
              {index < DAY_ORDER.length - 1 ? (
                <StitchDivider style={{ marginTop: spacing.sm }} />
              ) : null}
            </View>
          ))}
        </View>
      </StitchSurface>

      <StitchSurface elevated padding="md" style={styles.cardBorder}>
        <StitchText variant="h3" colorKey="text">
          Location
        </StitchText>
        <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: 4 }}>
          Drag the pin to reposition, or type lat/lng directly. Saved as PostGIS geography
          (SRID 4326).
        </StitchText>
        {hasLatLng ? (
          <View style={styles.mapShell}>
            <MapView
              key={mapRegionKey}
              provider={PROVIDER_DEFAULT}
              style={StyleSheet.absoluteFill}
              initialRegion={initialRegion}
              region={initialRegion}
              /**
               * Matches the live Discover map: `customMapStyle` is the Aubergine
               * override on Android Google Maps in dark mode (undefined in
               * light), `userInterfaceStyle` flips Apple Maps on iOS when the
               * user overrides the theme via `ProfileTheme`, and
               * `showsBuildings` requests the platform 3D building layer.
               */
              customMapStyle={customMapStyle}
              userInterfaceStyle={colorScheme}
              showsBuildings
              showsPointsOfInterests
              pitchEnabled
            >
              <Marker
                coordinate={{ latitude: parsedLat, longitude: parsedLng }}
                draggable
                onDragEnd={(e) => {
                  const c = e.nativeEvent.coordinate;
                  setLat(String(c.latitude));
                  setLng(String(c.longitude));
                }}
              />
            </MapView>
          </View>
        ) : (
          <View style={[styles.mapShell, styles.mapPlaceholder]}>
            <StitchIcon name="map" size={36} colorKey="outline" />
            <StitchText variant="body-sm" colorKey="textMuted" style={{ textAlign: 'center', marginTop: spacing.xs }}>
              Enter lat/lng to drop a draggable pin.
            </StitchText>
          </View>
        )}
        <View style={styles.latLngRow}>
          <View style={[styles.fieldCol, { flex: 1 }]}>
            <StitchText variant="label-caps" colorKey="textMuted">
              Latitude
            </StitchText>
            <TextInput
              value={lat}
              onChangeText={setLat}
              style={styles.input}
              placeholder={String(FALLBACK_COORDS.lat)}
              placeholderTextColor={colors.textFaint}
              keyboardType="numbers-and-punctuation"
            />
          </View>
          <View style={[styles.fieldCol, { flex: 1 }]}>
            <StitchText variant="label-caps" colorKey="textMuted">
              Longitude
            </StitchText>
            <TextInput
              value={lng}
              onChangeText={setLng}
              style={styles.input}
              placeholder={String(FALLBACK_COORDS.lng)}
              placeholderTextColor={colors.textFaint}
              keyboardType="numbers-and-punctuation"
            />
          </View>
        </View>
      </StitchSurface>

      <View style={styles.footerActions}>
        <StitchButton
          title="Cancel"
          variant="secondary"
          onPress={() => navigation.goBack()}
          style={{ flex: 1 }}
        />
        <StitchButton
          title={saving ? 'Saving…' : 'Save changes'}
          onPress={() => void onSave()}
          disabled={saving}
          style={{ flex: 1 }}
        />
      </View>
    </StitchScreen>
  );
}

function createStyles(props: {
  colors: StitchTheme['colors'];
  radii: StitchTheme['radii'];
  spacing: StitchTheme['spacing'];
}) {
  const { colors, radii, spacing } = props;
  const inputBase: TextStyle = {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    color: colors.text,
    backgroundColor: colors.surface,
    fontSize: 15,
  };
  const cardBorder: ViewStyle = {
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  };
  return StyleSheet.create({
    content: {
      paddingHorizontal: spacing.pageMarginMobile,
      paddingTop: spacing.md,
      paddingBottom: spacing.xxl,
      gap: spacing.md,
    },
    headerBlock: { marginBottom: spacing.sm },
    centerFill: {
      flex: 1,
      paddingHorizontal: spacing.pageMarginMobile,
      paddingVertical: spacing.xxl,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.md,
    },
    centerCopy: { textAlign: 'center' },
    cardBorder,
    fieldCol: { gap: spacing.xs },
    input: inputBase,
    inputMultiline: { minHeight: 64 },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    chip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radii.full,
      borderWidth: 1,
    },
    activeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    hoursRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    dayLabel: {
      width: 48,
    },
    timeInput: {
      ...inputBase,
      flex: 1,
      textAlign: 'center',
    },
    timeDivider: { width: 24, textAlign: 'center' },
    mapShell: {
      height: 220,
      width: '100%',
      minWidth: 280,
      alignSelf: 'stretch',
      marginTop: spacing.md,
      borderRadius: radii.lg,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      backgroundColor: colors.surfaceContainerLow,
    },
    mapPlaceholder: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.md,
    },
    latLngRow: {
      flexDirection: 'row',
      gap: spacing.md,
      marginTop: spacing.md,
    },
    footerActions: {
      flexDirection: 'row',
      gap: spacing.md,
      marginTop: spacing.md,
    },
  });
}
