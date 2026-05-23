import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useColorScheme,
  View,
  type ViewStyle,
} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { onboardingParams } from '@/contracts/routeParams';
import { useAuthContext } from '@/context/AuthContext';
import { FALLBACK_COORDS } from '@/lib/fallbackCoords';
import { mapStyleForScheme } from '@/lib/mapStyles';
import { getSupabase } from '@/lib/supabase';
import type { RootStackParamList } from '@/navigation/types';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import { stitchAmbientShadow } from '@/theme/stitchTokens';
import {
  StitchCard,
  StitchIcon,
  StitchSurface,
  StitchText,
} from '@/ui/stitch';
import { logError } from '@/observability/logError';
import { fetchLocationSearch } from '@/lib/locationApi';
import { buildRescueBagInsertPayload } from '@/lib/merchantBagForm';
import { MerchantBagFormFields } from '@/components/merchant/MerchantBagFormFields';

type Draft = {
  legalBusinessName: string;
  tradingName: string;
  tin: string;
  businessRegistrationNumber: string;
  primaryContactName: string;
  primaryContactEmail: string;
  outletName: string;
  locationSearch: string;
  outletLat: number;
  outletLng: number;
  opensAt: string;
  closesAt: string;
  accountHolderName: string;
  bankName: string;
  branchCode: string;
  accountNumber: string;
  skipFirstBag: boolean;
  firstBagTitle: string;
  firstBagPrice: string;
  firstBagQty: string;
};

const emptyDraft = (): Draft => ({
  legalBusinessName: '',
  tradingName: '',
  tin: '',
  businessRegistrationNumber: '',
  primaryContactName: '',
  primaryContactEmail: '',
  outletName: '',
  locationSearch: 'Galle Road, Colombo 03',
  outletLat: FALLBACK_COORDS.lat,
  outletLng: FALLBACK_COORDS.lng,
  opensAt: '10:00 AM',
  closesAt: '08:00 PM',
  accountHolderName: '',
  bankName: '',
  branchCode: '',
  accountNumber: '',
  skipFirstBag: true,
  firstBagTitle: '',
  firstBagPrice: '',
  firstBagQty: '1',
});

const STEP_SUBLABELS = [
  'Business Info',
  'Outlet Details',
  'First rescue bag',
  'Bank & Payout',
  'Final Review',
] as const;

const ONBOARDING_MAX_STEP = 5;

/**
 * Sri Lankan licensed commercial banks. Source: CBSL bank registry
 * (https://www.cbsl.gov.lk/en/financial-system/financial-system-stability/regulated-financial-entities).
 * Kept inline (no remote fetch) so the picker works offline during onboarding.
 */
const SRI_LANKAN_BANKS: readonly string[] = [
  'Amana Bank',
  'Axis Bank',
  'Bank of Ceylon',
  'Bank of China',
  'Cargills Bank',
  'Citibank',
  'Commercial Bank of Ceylon',
  'Deutsche Bank',
  'DFCC Bank',
  'Habib Bank',
  'Hatton National Bank',
  'HDFC Bank',
  'HSBC',
  'Indian Bank',
  'Indian Overseas Bank',
  'MCB Bank',
  'National Development Bank',
  'National Savings Bank',
  'Nations Trust Bank',
  'Pan Asia Banking Corporation',
  'People’s Bank',
  'Public Bank Berhad',
  'Sampath Bank',
  'Seylan Bank',
  'Standard Chartered Bank',
  'State Bank of India',
  'Union Bank of Colombo',
];

/**
 * Branch directories for the top Sri Lankan banks. Covers the main Colombo branches
 * (head office + commonly used neighbourhood branches). When the selected bank has no
 * entry here, the step falls back to the free-text branch input.
 */
const SRI_LANKAN_BANK_BRANCHES: Readonly<Record<string, readonly string[]>> = {
  'Bank of Ceylon': [
    'Head Office - Bank of Ceylon Square, Colombo 01',
    'Bambalapitiya, Colombo 04',
    'Borella, Colombo 08',
    'Cinnamon Gardens, Colombo 07',
    'Pettah, Colombo 11',
    'Wellawatte, Colombo 06',
  ],
  'Commercial Bank of Ceylon': [
    'Head Office - Commercial House, Colombo 02',
    'Bambalapitiya, Colombo 04',
    'Borella, Colombo 08',
    'Kollupitiya, Colombo 03',
    'Pettah, Colombo 11',
    'Wellawatte, Colombo 06',
  ],
  'Hatton National Bank': [
    'Head Office - HNB Towers, Colombo 10',
    'Bambalapitiya, Colombo 04',
    'Cinnamon Gardens, Colombo 07',
    'Kollupitiya, Colombo 03',
    'Nugegoda',
    'Pettah, Colombo 11',
  ],
  'People’s Bank': [
    'Head Office - Sir Chittampalam A. Gardiner Mawatha, Colombo 02',
    'Bambalapitiya, Colombo 04',
    'Borella, Colombo 08',
    'Pettah, Colombo 11',
    'Slave Island, Colombo 02',
    'Wellawatte, Colombo 06',
  ],
  'Sampath Bank': [
    'Head Office - Sir James Pieris Mawatha, Colombo 02',
    'Bambalapitiya, Colombo 04',
    'Cinnamon Gardens, Colombo 07',
    'Kollupitiya, Colombo 03',
    'Pettah, Colombo 11',
    'Wellawatte, Colombo 06',
  ],
  'Nations Trust Bank': [
    'Head Office - Union Place, Colombo 02',
    'Bambalapitiya, Colombo 04',
    'Cinnamon Gardens, Colombo 07',
    'Kollupitiya, Colombo 03',
    'Nawala',
    'Wellawatte, Colombo 06',
  ],
};

function LabeledField({
  label,
  placeholder,
  value,
  onChangeText,
  keyboardType = 'default',
  inputStyle,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  keyboardType?: 'default' | 'email-address';
  inputStyle: ViewStyle;
}): React.ReactElement {
  const { colors } = useStitchTheme();
  return (
    <View style={styles.fieldCol}>
      <StitchText variant="label" colorKey="onSurface">
        {label}
      </StitchText>
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
        keyboardType={keyboardType}
        value={value}
        onChangeText={onChangeText}
        style={inputStyle}
      />
    </View>
  );
}

function ReviewSection({
  icon,
  iconBg,
  iconColorKey,
  title,
  subtitle,
  onEdit,
  children,
}: {
  icon: React.ComponentProps<typeof StitchIcon>['name'];
  iconBg: string;
  iconColorKey: React.ComponentProps<typeof StitchIcon>['colorKey'];
  title: string;
  subtitle: string;
  onEdit: () => void;
  children: React.ReactNode;
}): React.ReactElement {
  const { colors, radii, spacing } = useStitchTheme();
  return (
    <StitchSurface
      elevated
      padding="md"
      style={{
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: `${colors.outlineVariant}4d`,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: spacing.lg,
          paddingBottom: spacing.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.divider,
        }}
      >
        <View style={{ flexDirection: 'row', gap: spacing.sm, flex: 1 }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: radii.lg,
              backgroundColor: iconBg,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <StitchIcon name={icon} size={22} colorKey={iconColorKey} />
          </View>
          <View style={{ flex: 1 }}>
            <StitchText variant="h3" colorKey="text">
              {title}
            </StitchText>
            <StitchText variant="body-sm" colorKey="textMuted">
              {subtitle}
            </StitchText>
          </View>
        </View>
        <Pressable
          onPress={onEdit}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: radii.default,
            backgroundColor: pressed ? colors.primaryHighlight : 'transparent',
          })}
        >
          <StitchIcon name="edit" size={16} colorKey="primaryContainer" />
          <StitchText variant="label" colorKey="primaryContainer">
            Edit
          </StitchText>
        </Pressable>
      </View>
      {children}
    </StitchSurface>
  );
}

function SummaryRow({
  k,
  v,
}: {
  k: string;
  v: string;
}): React.ReactElement {
  const { spacing } = useStitchTheme();
  const display = v.trim() || '—';
  return (
    <View style={{ gap: spacing.xs, marginBottom: spacing.lg }}>
      <StitchText variant="label-caps" colorKey="textMuted">
        {k}
      </StitchText>
      <StitchText variant="body-md" colorKey="text">
        {display}
      </StitchText>
    </View>
  );
}

export function MerchantOnboardingScreen(): React.ReactElement {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'MerchantOnboarding'>>();
  const parsed = onboardingParams.safeParse({
    step: route.params?.step != null ? Number(route.params.step) : 1,
  });
  const start = parsed.success
    ? Math.min(ONBOARDING_MAX_STEP, Math.max(1, parsed.data.step ?? 1))
    : 1;

  const [step, setStep] = useState(start);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [submitting, setSubmitting] = useState(false);
  const [bankPickerOpen, setBankPickerOpen] = useState(false);
  const [bankFilter, setBankFilter] = useState('');
  const [branchPickerOpen, setBranchPickerOpen] = useState(false);
  const [branchFilter, setBranchFilter] = useState('');
  /** Tracks `merchant_onboarding_drafts` hydration so first-paint doesn't overwrite. */
  const [draftHydrated, setDraftHydrated] = useState(false);
  const { env } = useAuthContext();
  const { colors, spacing, radii } = useStitchTheme();
  const systemScheme = useColorScheme();
  const customMapStyle = useMemo(
    () => mapStyleForScheme(systemScheme === 'dark' ? 'dark' : 'light'),
    [systemScheme],
  );

  const filteredBanks = useMemo(() => {
    const q = bankFilter.trim().toLowerCase();
    if (!q) return SRI_LANKAN_BANKS;
    return SRI_LANKAN_BANKS.filter((b) => b.toLowerCase().includes(q));
  }, [bankFilter]);

  const branchOptions = useMemo(
    () => SRI_LANKAN_BANK_BRANCHES[draft.bankName] ?? [],
    [draft.bankName],
  );

  const filteredBranches = useMemo(() => {
    const q = branchFilter.trim().toLowerCase();
    if (!q) return branchOptions;
    return branchOptions.filter((b) => b.toLowerCase().includes(q));
  }, [branchFilter, branchOptions]);

  /**
   * `merchant_onboarding_drafts` resume — hydrates the form once on mount from the user's
   * draft row (if any), then write-throughs on every step change. Drafts are scoped to the
   * authenticated owner via RLS (`owner_id = auth.uid()`); failures degrade silently so the
   * onboarding flow never blocks behind a network hiccup.
   */
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const sb = getSupabase(env);
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (!user || cancelled) {
        setDraftHydrated(true);
        return;
      }
      try {
        const { data } = await sb
          .from('merchant_onboarding_drafts')
          .select('draft, step')
          .eq('owner_id', user.id)
          .maybeSingle();
        if (cancelled) return;
        if (data?.draft && typeof data.draft === 'object') {
          const raw = data.draft as Partial<Draft>;
          setDraft((prev) => ({ ...prev, ...raw }));
          const resumedStep = Number(data.step);
          if (Number.isFinite(resumedStep)) {
            setStep((s) =>
              Math.max(s, Math.min(ONBOARDING_MAX_STEP, Math.max(1, resumedStep))),
            );
          }
        }
      } catch {
        // Treat all read failures as "no draft" — empty form is the safe fallback.
      }
      if (!cancelled) setDraftHydrated(true);
    })().catch(() => setDraftHydrated(true));
    return () => {
      cancelled = true;
    };
  }, [env]);

  /** Best-effort write-through on every step / draft change after hydration completes. */
  React.useEffect(() => {
    if (!draftHydrated) return;
    let cancelled = false;
    const t = setTimeout(() => {
      (async () => {
        const sb = getSupabase(env);
        const {
          data: { user },
        } = await sb.auth.getUser();
        if (!user || cancelled) return;
        try {
          await sb
            .from('merchant_onboarding_drafts')
            .upsert(
              {
                owner_id: user.id,
                draft,
                step,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'owner_id' },
            );
        } catch {
          // Silent: draft persistence is best-effort, surfaced loosely in admin tooling.
        }
      })().catch((err) => logError(err, { context: 'MerchantOnboardingScreen.op' }));
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [draft, env, step, draftHydrated]);

  const inputShell = useMemo(
    () => ({
      width: '100%' as const,
      minHeight: 48,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      borderRadius: radii.lg,
      backgroundColor: colors.surface,
      color: colors.onSurface,
      fontSize: 15,
      fontFamily: 'PlusJakartaSans-Regular',
    }),
    [colors.onSurface, colors.outlineVariant, colors.surface, radii.lg, spacing.sm],
  );

  const inputShellMd = useMemo(
    () => ({
      ...inputShell,
      paddingHorizontal: spacing.md,
    }),
    [inputShell, spacing.md],
  );

  const progressFill = useMemo(
    () => ({
      height: '100%' as const,
      width: `${(step / ONBOARDING_MAX_STEP) * 100}%` as const,
      backgroundColor: colors.surfaceTint,
      borderRadius: radii.full,
    }),
    [colors.surfaceTint, radii.full, step],
  );

  const progressTrack = useMemo(
    (): ViewStyle => ({
      height: 8,
      width: '100%',
      backgroundColor: colors.surfaceVariant,
      borderRadius: radii.full,
      overflow: 'hidden',
    }),
    [colors.surfaceVariant, radii.full],
  );

  const primaryCta = useMemo(
    (): ViewStyle => ({
      minHeight: 48,
      paddingHorizontal: spacing.xl,
      borderRadius: radii.lg,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: spacing.sm,
    }),
    [radii.lg, spacing.sm, spacing.xl],
  );

  const outlineCta = useMemo(
    (): ViewStyle => ({
      ...primaryCta,
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderColor: colors.primary,
    }),
    [colors.primary, primaryCta],
  );

  const mapShell = useMemo(
    (): ViewStyle => ({
      height: 240,
      borderRadius: radii.lg,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      backgroundColor: colors.surfaceContainerLow,
    }),
    [colors.outlineVariant, colors.surfaceContainerLow, radii.lg],
  );

  const outletMapRegion = useMemo(
    () => ({
      latitude: draft.outletLat,
      longitude: draft.outletLng,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    }),
    [draft.outletLat, draft.outletLng],
  );

  const detectOutletLocation = useCallback(() => {
    Geolocation.getCurrentPosition(
      (pos) => {
        setDraft((d) => ({
          ...d,
          outletLat: pos.coords.latitude,
          outletLng: pos.coords.longitude,
        }));
      },
      () => {
        Alert.alert(
          'Location unavailable',
          'Enable location services or drag the pin on the map to set your outlet.',
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60_000 },
    );
  }, []);

  const footerBar = useMemo(
    (): ViewStyle => ({
      borderTopWidth: 1,
      borderTopColor: colors.divider,
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.pageMarginMobile,
      paddingTop: spacing.md,
      paddingBottom: spacing.lg,
      ...stitchAmbientShadow,
      shadowOffset: { width: 0, height: -4 },
    }),
    [colors.divider, colors.surface, spacing.lg, spacing.md, spacing.pageMarginMobile],
  );

  const exit = () => {
    navigation.replace('MerchantTabs');
  };

  /**
   * Best-effort persistence at the final submit step. Writes a `merchants` row keyed by the
   * current user's `owner_id` (one merchant per auth user) and then, if that succeeds and we
   * can resolve a `merchant_id`, a matching `outlets` row keyed by `(merchant_id, name)`.
   *
   * Either write can fail under RLS (e.g. user not yet granted merchant role, or no
   * `is_merchant_staff_for(merchant_id)` match yet). Both failures are reported back to the
   * caller via separate `error` / `outletError` strings; the screen surfaces them as Alerts
   * but always advances to MerchantTabs per the parity brief.
   */
  const persistMerchantApplication = useCallback(async (): Promise<{
    ok: boolean;
    error?: string;
    outletError?: string;
  }> => {
    const sb = getSupabase(env);
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) return { ok: false, error: 'Not signed in.' };

    const bankDetails: Record<string, unknown> = {};
    if (draft.bankName.trim()) bankDetails.bank_name = draft.bankName.trim();
    if (draft.accountHolderName.trim()) bankDetails.account_holder = draft.accountHolderName.trim();
    if (draft.accountNumber.trim()) bankDetails.account_number = draft.accountNumber.trim();
    if (draft.branchCode.trim()) bankDetails.branch_code = draft.branchCode.trim();

    const businessName = draft.legalBusinessName.trim();
    const tradingName = draft.tradingName.trim();
    const payload: Record<string, unknown> = {
      owner_id: user.id,
      business_name:
        tradingName || businessName || draft.outletName.trim() || 'Pending merchant',
      legal_name: businessName,
      business_registration_number: draft.businessRegistrationNumber.trim(),
      contact_name: draft.primaryContactName.trim(),
      contact_email: draft.primaryContactEmail.trim(),
      payout_method: 'bank_transfer',
      status: 'pending',
      updated_at: new Date().toISOString(),
    };
    if (tradingName) payload.trading_name = tradingName;
    const tin = draft.tin.trim();
    if (tin) payload.tin = tin;
    if (Object.keys(bankDetails).length > 0) payload.bank_details = bankDetails;

    let merchantId: string | null = null;
    let merchantWriteError: string | undefined;

    // Try upsert by owner_id (one-to-one); if the unique constraint isn't present, fall back
    // to a manual select-then-insert/update path.
    const upsertRes = await sb
      .from('merchants')
      .upsert(payload, { onConflict: 'owner_id' })
      .select('id')
      .maybeSingle();

    if (upsertRes.error) {
      const { data: existing } = await sb
        .from('merchants')
        .select('id')
        .eq('owner_id', user.id)
        .limit(1)
        .maybeSingle();
      if (existing?.id) {
        const { data, error } = await sb
          .from('merchants')
          .update(payload)
          .eq('id', existing.id)
          .select('id')
          .maybeSingle();
        if (error) merchantWriteError = error.message;
        else merchantId = data?.id ?? existing.id;
      } else {
        const { data, error } = await sb
          .from('merchants')
          .insert(payload)
          .select('id')
          .maybeSingle();
        if (error) merchantWriteError = error.message;
        else merchantId = data?.id ?? null;
      }
    } else {
      merchantId = upsertRes.data?.id ?? null;
    }

    if (merchantWriteError) return { ok: false, error: merchantWriteError };

    // ---- Outlet + opening_hours upsert. Best-effort: failures surface but don't block. ----
    const outletName = draft.outletName.trim();
    const outletAddress = draft.locationSearch.trim();
    let outletError: string | undefined;
    let createdOutletId: string | null = null;

    if (merchantId && outletName.length > 0) {
      // Schema diverges from the brief's exact `opening_hours` column — closest match in
      // `public.outlets` is `business_hours jsonb`. We persist a uniform 7-day pattern from
      // step 2's free-text Opens/Closes inputs (no per-day editor exists yet).
      const opens = draft.opensAt.trim() || '10:00 AM';
      const closes = draft.closesAt.trim() || '08:00 PM';
      const dayHours = { open: opens, close: closes };
      const businessHours = {
        mon: dayHours,
        tue: dayHours,
        wed: dayHours,
        thu: dayHours,
        fri: dayHours,
        sat: dayHours,
        sun: dayHours,
      };

      const outletPayload: Record<string, unknown> = {
        merchant_id: merchantId,
        name: outletName,
        // `address` is NOT NULL — fall back to a clear placeholder so the row is accepted and
        // the merchant can correct it from MerchantProfile later.
        address: outletAddress || 'Address pending — update from outlet profile',
        category: 'other',
        business_hours: businessHours,
        is_active: false, // hold the outlet inactive until ops approve the merchant
      };

      const outletRes = await sb
        .from('outlets')
        .upsert(outletPayload, { onConflict: 'merchant_id,name' })
        .select('id')
        .maybeSingle();
      if (outletRes.error) {
        outletError = outletRes.error.message;
      } else if (outletRes.data?.id) {
        createdOutletId = String(outletRes.data.id);
        const lat = draft.outletLat;
        const lng = draft.outletLng;
        const hasCoords =
          Number.isFinite(lat) &&
          Number.isFinite(lng) &&
          lat >= -90 &&
          lat <= 90 &&
          lng >= -180 &&
          lng <= 180;
        if (hasCoords) {
          const wktLiteral = `SRID=4326;POINT(${lng} ${lat})`;
          const locRes = await sb
            .from('outlets')
            .update({ location: wktLiteral })
            .eq('id', outletRes.data.id);
          if (locRes.error) {
            outletError = locRes.error.message;
          }
        }
      }
    } else if (merchantId && outletName.length === 0) {
      outletError = 'Outlet name was empty; skipped outlet persistence.';
    }

    if (
      merchantId &&
      createdOutletId &&
      !draft.skipFirstBag &&
      draft.firstBagTitle.trim().length > 0
    ) {
      const price = Number(draft.firstBagPrice.replace(/[^\d.]/g, ''));
      if (Number.isFinite(price) && price > 0) {
        const now = new Date();
        const end = new Date(now.getTime() + 2 * 60 * 60 * 1000);
        const payload = buildRescueBagInsertPayload(createdOutletId, {
          title: draft.firstBagTitle,
          rescuePrice: draft.firstBagPrice,
          quantity: draft.firstBagQty,
          pickupStart: now,
          pickupEnd: end,
        });
        if (payload) {
          await sb.from('rescue_bags').insert(payload);
        }
      }
    }

    return { ok: true, outletError };
  }, [draft, env]);

  useEffect(() => {
    if (step !== 2) return;
    const q = draft.locationSearch.trim();
    if (q.length < 4) return;
    let cancelled = false;
    void fetchLocationSearch(env, q)
      .then(({ results }) => {
        if (cancelled || !results[0]) return;
        setDraft((d) => ({
          ...d,
          outletLat: results[0].lat,
          outletLng: results[0].lng,
        }));
      })
      .catch((err) => logError(err, { context: 'MerchantOnboarding.geocode' }));
    return () => {
      cancelled = true;
    };
  }, [draft.locationSearch, env, step]);

  const next = useCallback(async () => {
    if (step < ONBOARDING_MAX_STEP) {
      setStep((s) => Math.min(ONBOARDING_MAX_STEP, s + 1));
      return;
    }
    setSubmitting(true);
    const result = await persistMerchantApplication();
    setSubmitting(false);
    if (!result.ok && result.error) {
      Alert.alert(
        'Saved locally only',
        `We couldn't persist your application yet (${result.error}). You'll be taken to the dashboard; please contact support if approval is delayed.`,
      );
    } else if (result.outletError) {
      Alert.alert(
        'Outlet details not saved',
        `Your business details are saved, but we couldn't persist the outlet yet (${result.outletError}). You can edit outlet details from the Merchant Profile after approval.`,
      );
    }
    navigation.replace('MerchantTabs');
  }, [navigation, persistMerchantApplication, step]);

  const renderStep1 = () => (
    <>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: spacing.xl,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <StitchIcon name="eco" size={22} colorKey="surfaceTint" />
          <StitchText variant="h3" colorKey="surfaceTint">
            Fresh As Ever
          </StitchText>
        </View>
        <Pressable
          onPress={exit}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <StitchIcon name="close" size={18} colorKey="textMuted" />
          <StitchText variant="label" colorKey="textMuted">
            Exit
          </StitchText>
        </Pressable>
      </View>

      <View style={{ marginBottom: spacing.xl }}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: spacing.sm,
          }}
        >
          <StitchText variant="label-caps" colorKey="surfaceTint">
            Step 1 of 5
          </StitchText>
          <StitchText variant="label-caps" colorKey="textMuted">
            {STEP_SUBLABELS[0]}
          </StitchText>
        </View>
        <View style={progressTrack}>
          <View style={progressFill} />
        </View>
      </View>

      <StitchCard>
        <View style={{ marginBottom: spacing.lg }}>
          <StitchText variant="h1" colorKey="onSurface" style={{ marginBottom: spacing.xs }}>
            Business Information
          </StitchText>
          <StitchText variant="body-md" colorKey="textMuted">
            Tell us about your establishment to help us verify your account.
          </StitchText>
        </View>
        <View style={{ gap: spacing.lg }}>
          <LabeledField
            label="Legal Business Name"
            placeholder="e.g. The Colombo Bakery Ltd"
            value={draft.legalBusinessName}
            onChangeText={(t) => setDraft((d) => ({ ...d, legalBusinessName: t }))}
            inputStyle={inputShell}
          />
          <LabeledField
            label="Trading / Brand Name (optional)"
            placeholder="e.g. Fresh Bakery"
            value={draft.tradingName}
            onChangeText={(t) => setDraft((d) => ({ ...d, tradingName: t }))}
            inputStyle={inputShell}
          />
          <LabeledField
            label="Business Registration Number"
            placeholder="BR-XXXXXXX"
            value={draft.businessRegistrationNumber}
            onChangeText={(t) => setDraft((d) => ({ ...d, businessRegistrationNumber: t }))}
            inputStyle={inputShell}
          />
          <LabeledField
            label="Taxpayer Identification Number (TIN)"
            placeholder="e.g. 134567890"
            value={draft.tin}
            onChangeText={(t) => setDraft((d) => ({ ...d, tin: t }))}
            inputStyle={inputShell}
          />
          <LabeledField
            label="Primary Contact Name"
            placeholder="Full Name"
            value={draft.primaryContactName}
            onChangeText={(t) => setDraft((d) => ({ ...d, primaryContactName: t }))}
            inputStyle={inputShell}
          />
          <LabeledField
            label="Primary Contact Email"
            placeholder="hello@bakery.lk"
            keyboardType="email-address"
            value={draft.primaryContactEmail}
            onChangeText={(t) => setDraft((d) => ({ ...d, primaryContactEmail: t }))}
            inputStyle={inputShell}
          />
          <View style={{ paddingTop: spacing.md, marginTop: spacing.sm }}>
            <Pressable
              onPress={next}
              style={({ pressed }) => [
                primaryCta,
                {
                  backgroundColor: colors.surfaceTint,
                  opacity: pressed ? 0.92 : 1,
                  alignSelf: 'stretch',
                },
              ]}
            >
              <StitchText variant="label" colorKey="onPrimary">
                Next
              </StitchText>
              <StitchIcon name="arrow_forward" size={18} colorKey="onPrimary" />
            </Pressable>
          </View>
        </View>
      </StitchCard>
    </>
  );

  const renderStep2 = () => (
    <>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: spacing.xl,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <StitchIcon name="eco" size={22} colorKey="primaryContainer" />
          <StitchText variant="h2" colorKey="primaryContainer" style={{ fontFamily: 'PlusJakartaSans-Bold' }}>
            Fresh As Ever
          </StitchText>
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <View
              key={i}
              style={{
                height: 4,
                width: 48,
                borderRadius: radii.full,
                backgroundColor: step >= i ? colors.primary : colors.surfaceDim,
              }}
            />
          ))}
        </View>
      </View>

      <View style={{ marginBottom: spacing.xl }}>
        <StitchText variant="display" colorKey="onSurface" style={{ marginBottom: spacing.sm }}>
          Outlet Details
        </StitchText>
        <StitchText variant="body-lg" colorKey="onSurfaceVariant">
          Where will customers pick up their rescue bags? Provide the specifics for this location.
        </StitchText>
      </View>

      <StitchSurface
        elevated
        padding="xl"
        style={{
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: `${colors.divider}66`,
          gap: spacing.xl,
        }}
      >
        <LabeledField
          label="Outlet Name"
          placeholder="e.g. Fresh Bakery - Colombo 03"
          value={draft.outletName}
          onChangeText={(t) => setDraft((d) => ({ ...d, outletName: t }))}
          inputStyle={inputShellMd}
        />

        <View style={{ gap: spacing.xs }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <StitchText variant="label" colorKey="onSurfaceVariant">
              Location
            </StitchText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Auto-detect location"
              onPress={detectOutletLocation}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.xs,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <StitchIcon name="my_location" size={16} colorKey="textMuted" />
              <StitchText variant="body-sm" colorKey="textMuted">
                Auto-detect
              </StitchText>
            </Pressable>
          </View>
          <View style={mapShell}>
            <MapView
              style={StyleSheet.absoluteFill}
              provider={PROVIDER_DEFAULT}
              customMapStyle={customMapStyle}
              initialRegion={outletMapRegion}
              region={outletMapRegion}
              scrollEnabled
              zoomEnabled
            >
              <Marker
                coordinate={{
                  latitude: draft.outletLat,
                  longitude: draft.outletLng,
                }}
                draggable
                onDragEnd={(e) => {
                  const { latitude, longitude } = e.nativeEvent.coordinate;
                  setDraft((d) => ({
                    ...d,
                    outletLat: latitude,
                    outletLng: longitude,
                  }));
                }}
              />
            </MapView>
            <View style={{ position: 'absolute', top: spacing.sm, left: spacing.sm, right: spacing.sm }}>
              <View style={{ position: 'relative' }}>
                <View style={{ position: 'absolute', left: spacing.sm, top: 13, zIndex: 1 }}>
                  <StitchIcon name="search" size={20} colorKey="textMuted" />
                </View>
                <TextInput
                  placeholder="Search address"
                  placeholderTextColor={colors.textFaint}
                  value={draft.locationSearch}
                  onChangeText={(t) => setDraft((d) => ({ ...d, locationSearch: t }))}
                  style={{
                    ...inputShellMd,
                    paddingLeft: 40,
                    backgroundColor: `${colors.surface}e6`,
                  }}
                />
              </View>
            </View>
          </View>
        </View>

        <View style={{ gap: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider }}>
          <StitchText variant="label" colorKey="onSurfaceVariant">
            Standard Operating Hours
          </StitchText>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <View style={{ flex: 1, gap: spacing.xs }}>
              <StitchText variant="label-caps" colorKey="textMuted">
                Opens At
              </StitchText>
              <View style={{ position: 'relative' }}>
                <View style={{ position: 'absolute', left: spacing.sm, top: 13, zIndex: 1 }}>
                  <StitchIcon name="schedule" size={20} colorKey="textMuted" />
                </View>
                <TextInput
                  value={draft.opensAt}
                  onChangeText={(t) => setDraft((d) => ({ ...d, opensAt: t }))}
                  placeholderTextColor={colors.textFaint}
                  style={{ ...inputShellMd, paddingLeft: 40 }}
                />
              </View>
            </View>
            <View style={{ flex: 1, gap: spacing.xs }}>
              <StitchText variant="label-caps" colorKey="textMuted">
                Closes At
              </StitchText>
              <View style={{ position: 'relative' }}>
                <View style={{ position: 'absolute', left: spacing.sm, top: 13, zIndex: 1 }}>
                  <StitchIcon name="schedule" size={20} colorKey="textMuted" />
                </View>
                <TextInput
                  value={draft.closesAt}
                  onChangeText={(t) => setDraft((d) => ({ ...d, closesAt: t }))}
                  placeholderTextColor={colors.textFaint}
                  style={{ ...inputShellMd, paddingLeft: 40 }}
                />
              </View>
            </View>
          </View>
        </View>
      </StitchSurface>

      <View
        style={{
          flexDirection: 'column-reverse',
          gap: spacing.md,
          marginTop: spacing.lg,
        }}
      >
        <Pressable
          onPress={() => setStep((s) => Math.max(1, s - 1))}
          style={({ pressed }) => [outlineCta, { opacity: pressed ? 0.9 : 1, alignSelf: 'stretch' }]}
        >
          <StitchText variant="label" colorKey="primary">
            Back
          </StitchText>
        </Pressable>
        <Pressable
          onPress={next}
          style={({ pressed }) => [
            primaryCta,
            {
              backgroundColor: colors.primary,
              opacity: pressed ? 0.92 : 1,
              alignSelf: 'stretch',
            },
          ]}
        >
          <StitchText variant="label" colorKey="onPrimary">
            Continue to first rescue bag
          </StitchText>
          <StitchIcon name="arrow_forward" size={18} colorKey="onPrimary" />
        </Pressable>
      </View>
    </>
  );

  const renderStep3Inventory = () => (
      <>
        <View style={{ marginBottom: spacing.xl }}>
          <StitchText variant="display" colorKey="onSurface" style={{ marginBottom: spacing.sm }}>
            Your first rescue bag
          </StitchText>
          <StitchText variant="body-lg" colorKey="onSurfaceVariant">
            Optional — list surplus now or skip and add bags later from the Bags tab.
          </StitchText>
        </View>
        <MerchantBagFormFields
          values={{
            title: draft.firstBagTitle,
            rescuePrice: draft.firstBagPrice,
            quantity: draft.firstBagQty,
          }}
          onChange={(patch) =>
            setDraft((d) => ({
              ...d,
              ...patch,
              skipFirstBag: false,
            }))
          }
          pickupHint="Pickup window defaults to starting now for 2 hours when you submit."
        />
        <View style={{ flexDirection: 'column-reverse', gap: spacing.md, marginTop: spacing.lg }}>
          <Pressable
            onPress={() => setStep(2)}
            style={({ pressed }) => [outlineCta, { opacity: pressed ? 0.9 : 1, alignSelf: 'stretch' }]}
          >
            <StitchText variant="label" colorKey="primary">
              Back
            </StitchText>
          </Pressable>
          <Pressable
            onPress={() => setStep(4)}
            style={({ pressed }) => [
              primaryCta,
              { backgroundColor: colors.primary, opacity: pressed ? 0.92 : 1, alignSelf: 'stretch' },
            ]}
          >
            <StitchText variant="label" colorKey="onPrimary">
              Continue to bank details
            </StitchText>
            <StitchIcon name="arrow_forward" size={18} colorKey="onPrimary" />
          </Pressable>
          <Pressable
            onPress={() => {
              setDraft((d) => ({ ...d, skipFirstBag: true, firstBagTitle: '' }));
              setStep(4);
            }}
            style={{ alignSelf: 'center', paddingVertical: spacing.sm }}
          >
            <StitchText variant="label" colorKey="primaryContainer">
              Skip for now
            </StitchText>
          </Pressable>
        </View>
      </>
  );

  const renderStep4Bank = () => (
    <View style={{ alignItems: 'center' }}>
      <StitchSurface
        elevated
        padding="none"
        style={{
          width: '100%',
          maxWidth: 520,
          overflow: 'hidden',
          borderRadius: radii.xl,
        }}
      >
        <View
          style={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.lg,
            paddingBottom: spacing.md,
            borderBottomWidth: 1,
            borderBottomColor: colors.divider,
            gap: spacing.sm,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Pressable
              onPress={() => setStep(3)}
              style={({ pressed }) => ({
                width: 40,
                height: 40,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: radii.full,
                backgroundColor: pressed ? colors.surfaceContainer : 'transparent',
              })}
            >
              <StitchIcon name="arrow_back" size={22} colorKey="textMuted" />
            </Pressable>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: radii.full,
                  backgroundColor: colors.primary,
                }}
              />
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: radii.full,
                  backgroundColor: colors.primary,
                }}
              />
              <View
                style={{
                  width: 24,
                  height: 8,
                  borderRadius: radii.full,
                  backgroundColor: colors.primary,
                }}
              />
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: radii.full,
                  backgroundColor: colors.surfaceContainerHigh,
                }}
              />
            </View>
            <View style={{ width: 40 }} />
          </View>
          <View style={{ marginTop: spacing.md }}>
            <StitchText variant="label-caps" colorKey="primaryContainer">
              Step 4 of 5
            </StitchText>
            <StitchText variant="h1" colorKey="text" style={{ marginTop: 4 }}>
              Bank & Payout Information
            </StitchText>
            <StitchText variant="body-md" colorKey="textMuted" style={{ marginTop: spacing.sm }}>
              Where should we send your earnings? This account must belong to the registered business or owner.
            </StitchText>
          </View>
        </View>

        <View style={{ padding: spacing.lg, gap: spacing.lg }}>
          <LabeledField
            label="Account Holder Name"
            placeholder="e.g. Fresh Foods Ltd."
            value={draft.accountHolderName}
            onChangeText={(t) => setDraft((d) => ({ ...d, accountHolderName: t }))}
            inputStyle={inputShellMd}
          />
          <View style={styles.fieldCol}>
            <StitchText variant="label" colorKey="text">
              Bank Name
            </StitchText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open bank picker"
              onPress={() => {
                setBankFilter('');
                setBankPickerOpen(true);
              }}
              style={({ pressed }) => [
                {
                  ...inputShellMd,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingRight: spacing.md,
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
            >
              <StitchText
                variant="body-md"
                colorKey={draft.bankName ? 'text' : 'textFaint'}
              >
                {draft.bankName || 'Select your bank'}
              </StitchText>
              <StitchIcon name="expand_more" size={22} colorKey="textMuted" />
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              {branchOptions.length > 0 ? (
                <View style={styles.fieldCol}>
                  <StitchText variant="label" colorKey="text">
                    Branch
                  </StitchText>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Pick branch for ${draft.bankName}`}
                    onPress={() => {
                      setBranchFilter('');
                      setBranchPickerOpen(true);
                    }}
                    style={({ pressed }) => [
                      {
                        ...inputShellMd,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingRight: spacing.md,
                        opacity: pressed ? 0.9 : 1,
                      },
                    ]}
                  >
                    <StitchText
                      variant="body-md"
                      colorKey={draft.branchCode ? 'text' : 'textFaint'}
                      numberOfLines={1}
                    >
                      {draft.branchCode || 'Select branch'}
                    </StitchText>
                    <StitchIcon name="expand_more" size={22} colorKey="textMuted" />
                  </Pressable>
                </View>
              ) : (
                <LabeledField
                  label="Branch / Code"
                  placeholder="e.g. 012 / Bambalapitiya"
                  value={draft.branchCode}
                  onChangeText={(t) => setDraft((d) => ({ ...d, branchCode: t }))}
                  inputStyle={inputShellMd}
                />
              )}
              {draft.bankName && branchOptions.length === 0 ? (
                <StitchText
                  variant="body-sm"
                  colorKey="textMuted"
                  style={{ marginTop: 4 }}
                >
                  No branch list for {draft.bankName} yet — type the branch directly.
                </StitchText>
              ) : null}
            </View>
            <View style={{ flex: 1 }}>
              <LabeledField
                label="Account Number"
                placeholder="Enter account number"
                value={draft.accountNumber}
                onChangeText={(t) => setDraft((d) => ({ ...d, accountNumber: t }))}
                inputStyle={inputShellMd}
              />
            </View>
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: spacing.md,
              padding: spacing.md,
              borderRadius: radii.lg,
              backgroundColor: colors.surface2,
              borderWidth: 1,
              borderColor: colors.surfaceContainerHigh,
            }}
          >
            <StitchIcon name="info" size={22} colorKey="primaryContainer" style={{ marginTop: 2 }} />
            <StitchText variant="body-sm" colorKey="textMuted" style={{ flex: 1 }}>
              Payouts are processed weekly. Ensure these details are accurate to avoid delays in receiving your funds.
            </StitchText>
          </View>

          <View
            style={{
              paddingTop: spacing.md,
              marginTop: spacing.sm,
              borderTopWidth: 1,
              borderTopColor: colors.divider,
              gap: spacing.sm,
            }}
          >
            <Pressable
              onPress={next}
              style={({ pressed }) => [
                primaryCta,
                {
                  width: '100%',
                  backgroundColor: colors.primary,
                  opacity: pressed ? 0.92 : 1,
                },
              ]}
            >
              <StitchText variant="h3" colorKey="onPrimary">
                Continue to Review
              </StitchText>
            </Pressable>
            <Pressable
              onPress={exit}
              style={({ pressed }) => [
                outlineCta,
                { width: '100%', opacity: pressed ? 0.9 : 1 },
              ]}
            >
              <StitchText variant="h3" colorKey="primary">
                Save for later
              </StitchText>
            </Pressable>
          </View>
        </View>
      </StitchSurface>
    </View>
  );

  const renderStep5Review = () => (
    <>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: spacing.lg,
          minHeight: 48,
        }}
      >
        <Pressable
          onPress={() => setStep(4)}
          style={({ pressed }) => ({
            width: 40,
            height: 40,
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: -8,
            borderRadius: radii.full,
            backgroundColor: pressed ? colors.surface2 : 'transparent',
          })}
        >
          <StitchIcon name="arrow_back" size={24} colorKey="text" />
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <StitchText variant="label-caps" colorKey="textMuted">
            Step 5 of 5
          </StitchText>
          <StitchText variant="label" colorKey="text">
            Final Review
          </StitchText>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <View style={{ marginBottom: spacing.xl }}>
        <StitchText variant="h1" colorKey="text" style={{ marginBottom: spacing.sm }}>
          Review your application
        </StitchText>
        <StitchText variant="body-md" colorKey="textMuted">
          Please ensure all business, outlet, and bank details are correct. You can edit any section before final submission.
        </StitchText>
      </View>

      <View style={{ gap: spacing.md }}>
        <ReviewSection
          icon="corporate_fare"
          iconBg={`${colors.primaryHighlight}4d`}
          iconColorKey="primary"
          title="Business Entity"
          subtitle="Registered corporate information"
          onEdit={() => setStep(1)}
        >
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg }}>
            <SummaryRow k="Legal Name" v={draft.legalBusinessName} />
            <SummaryRow
              k="Trading Name"
              v={draft.tradingName.trim() || 'Same as legal'}
            />
            <SummaryRow k="Registration No." v={draft.businessRegistrationNumber} />
            <SummaryRow k="TIN" v={draft.tin.trim() || 'Not provided'} />
            <SummaryRow k="Primary contact" v={draft.primaryContactName} />
            <SummaryRow k="Email" v={draft.primaryContactEmail} />
          </View>
        </ReviewSection>

        <ReviewSection
          icon="storefront"
          iconBg={`${colors.accentHighlight}80`}
          iconColorKey="accent"
          title="Primary Outlet"
          subtitle="Main pickup location"
          onEdit={() => setStep(2)}
        >
          <View style={{ gap: spacing.lg }}>
            <SummaryRow k="Outlet Name" v={draft.outletName} />
            <SummaryRow k="Physical Address" v={draft.locationSearch} />
            <View style={{ gap: spacing.xs }}>
              <StitchText variant="label-caps" colorKey="textMuted">
                Default Pickup Window
              </StitchText>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                  alignSelf: 'flex-start',
                  paddingHorizontal: spacing.sm,
                  paddingVertical: 6,
                  borderRadius: radii.default,
                  backgroundColor: colors.surface2,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: `${colors.outlineVariant}33`,
                }}
              >
                <StitchIcon name="schedule" size={16} colorKey="textMuted" />
                <StitchText variant="body-md" colorKey="text">
                  {draft.opensAt} - {draft.closesAt}
                </StitchText>
              </View>
            </View>
          </View>
        </ReviewSection>

        <ReviewSection
          icon="account_balance"
          iconBg={colors.surfaceContainer}
          iconColorKey="primaryActive"
          title="Payout Details"
          subtitle="For revenue transfers"
          onEdit={() => setStep(3)}
        >
          <View
            style={{
              borderRadius: radii.lg,
              padding: spacing.md,
              marginBottom: spacing.lg,
              backgroundColor: colors.surface2,
              borderWidth: 1,
              borderColor: colors.divider,
            }}
          >
            <StitchText variant="label" colorKey="text">
              {draft.bankName.trim() || 'Bank not selected'}
            </StitchText>
            <StitchText variant="body-sm" colorKey="textMuted">
              Branch ({draft.branchCode || '—'})
            </StitchText>
            <View style={{ marginTop: spacing.md }}>
              <StitchText variant="label-caps" colorKey="textMuted">
                Account Number
              </StitchText>
              <StitchText variant="h3" colorKey="text">
                {draft.accountNumber.trim() || '—'}
              </StitchText>
            </View>
          </View>
          <SummaryRow k="Registered Account Name" v={draft.accountHolderName} />
        </ReviewSection>
      </View>
    </>
  );

  const body =
    step === 1
      ? renderStep1()
      : step === 2
        ? renderStep2()
        : step === 3
          ? renderStep3Inventory()
          : step === 4
            ? renderStep4Bank()
            : renderStep5Review();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: spacing.pageMarginMobile,
          paddingTop: step === 4 ? spacing.xl : spacing.lg,
          paddingBottom: step === 5 ? 120 : spacing.xxl,
        }}
      >
        {body}
        {step !== 5 && step !== 4 ? (
          <Pressable onPress={exit} style={{ alignSelf: 'center', marginTop: spacing.lg }}>
            <StitchText variant="label" colorKey="primaryContainer">
              Skip for now
            </StitchText>
          </Pressable>
        ) : null}
      </ScrollView>

      {step === 5 ? (
        <View style={footerBar}>
          <Pressable
            onPress={() => void next()}
            disabled={submitting}
            style={({ pressed }) => [
              primaryCta,
              {
                width: '100%',
                backgroundColor: colors.primary,
                opacity: submitting ? 0.7 : pressed ? 0.92 : 1,
              },
            ]}
          >
            {submitting ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <>
                <StitchText variant="label" colorKey="onPrimary">
                  Submit Application
                </StitchText>
                <StitchIcon name="arrow_forward" size={18} colorKey="onPrimary" />
              </>
            )}
          </Pressable>
          <StitchText
            variant="body-sm"
            colorKey="textMuted"
            style={{ textAlign: 'center', marginTop: spacing.sm }}
          >
            By submitting, you agree to the Terms of Service.
          </StitchText>
        </View>
      ) : null}

      <Modal
        visible={bankPickerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setBankPickerOpen(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.4)',
            justifyContent: 'flex-end',
          }}
        >
          <View
            style={{
              backgroundColor: colors.background,
              borderTopLeftRadius: radii.lg,
              borderTopRightRadius: radii.lg,
              maxHeight: '80%',
              paddingHorizontal: spacing.md,
              paddingTop: spacing.md,
              paddingBottom: spacing.lg,
              gap: spacing.sm,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <StitchText variant="h3" colorKey="text">
                Select your bank
              </StitchText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close bank picker"
                onPress={() => setBankPickerOpen(false)}
                style={{ padding: 6 }}
              >
                <StitchIcon name="close" size={22} colorKey="textMuted" />
              </Pressable>
            </View>
            <TextInput
              value={bankFilter}
              onChangeText={setBankFilter}
              placeholder="Search banks…"
              placeholderTextColor={colors.textFaint}
              autoCorrect={false}
              autoCapitalize="words"
              style={{
                ...inputShellMd,
                marginTop: spacing.xs,
              }}
            />
            <FlatList
              data={filteredBanks}
              keyExtractor={(item) => item}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <View style={{ paddingVertical: spacing.lg }}>
                  <StitchText
                    variant="body-md"
                    colorKey="textMuted"
                    style={{ textAlign: 'center' }}
                  >
                    No bank matches “{bankFilter.trim()}”.
                  </StitchText>
                </View>
              }
              renderItem={({ item }) => {
                const selected = draft.bankName === item;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => {
                      setDraft((d) => ({
                        ...d,
                        bankName: item,
                        // Clear stale branch when bank changes so the user can re-pick from
                        // the new bank's branch list.
                        branchCode: d.bankName === item ? d.branchCode : '',
                      }));
                      setBankPickerOpen(false);
                    }}
                    style={({ pressed }) => ({
                      paddingHorizontal: spacing.md,
                      paddingVertical: 14,
                      borderRadius: radii.default,
                      backgroundColor: selected
                        ? colors.primaryHighlight
                        : pressed
                          ? colors.surface2
                          : 'transparent',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    })}
                  >
                    <StitchText
                      variant="body-md"
                      colorKey={selected ? 'primaryContainer' : 'text'}
                    >
                      {item}
                    </StitchText>
                    {selected ? (
                      <StitchIcon name="check" size={18} colorKey="primaryContainer" />
                    ) : null}
                  </Pressable>
                );
              }}
            />
          </View>
        </View>
      </Modal>

      <Modal
        visible={branchPickerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setBranchPickerOpen(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.4)',
            justifyContent: 'flex-end',
          }}
        >
          <View
            style={{
              backgroundColor: colors.background,
              borderTopLeftRadius: radii.lg,
              borderTopRightRadius: radii.lg,
              maxHeight: '80%',
              paddingHorizontal: spacing.md,
              paddingTop: spacing.md,
              paddingBottom: spacing.lg,
              gap: spacing.sm,
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
                  Select your branch
                </StitchText>
                <StitchText variant="body-sm" colorKey="textMuted">
                  {draft.bankName || 'No bank selected'}
                </StitchText>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close branch picker"
                onPress={() => setBranchPickerOpen(false)}
                style={{ padding: 6 }}
              >
                <StitchIcon name="close" size={22} colorKey="textMuted" />
              </Pressable>
            </View>
            <TextInput
              value={branchFilter}
              onChangeText={setBranchFilter}
              placeholder="Search branches…"
              placeholderTextColor={colors.textFaint}
              autoCorrect={false}
              autoCapitalize="words"
              style={{ ...inputShellMd, marginTop: spacing.xs }}
            />
            <FlatList
              data={filteredBranches}
              keyExtractor={(item) => item}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <View style={{ paddingVertical: spacing.lg }}>
                  <StitchText
                    variant="body-md"
                    colorKey="textMuted"
                    style={{ textAlign: 'center' }}
                  >
                    No branch matches “{branchFilter.trim()}”.
                  </StitchText>
                </View>
              }
              renderItem={({ item }) => {
                const selected = draft.branchCode === item;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => {
                      setDraft((d) => ({ ...d, branchCode: item }));
                      setBranchPickerOpen(false);
                    }}
                    style={({ pressed }) => ({
                      paddingHorizontal: spacing.md,
                      paddingVertical: 14,
                      borderRadius: radii.default,
                      backgroundColor: selected
                        ? colors.primaryHighlight
                        : pressed
                          ? colors.surface2
                          : 'transparent',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    })}
                  >
                    <StitchText
                      variant="body-md"
                      colorKey={selected ? 'primaryContainer' : 'text'}
                    >
                      {item}
                    </StitchText>
                    {selected ? (
                      <StitchIcon name="check" size={18} colorKey="primaryContainer" />
                    ) : null}
                  </Pressable>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fieldCol: {
    gap: 4,
  },
});
