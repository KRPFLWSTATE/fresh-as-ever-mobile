import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type {
  CustomerTabParamList,
  RootStackParamList,
} from '@/navigation/types';
import { useAuthContext } from '@/context/AuthContext';
import { useCustomerImpact } from '@/hooks/useCustomerImpact';
import { useCustomerWeeklyStreak } from '@/hooks/useCustomerWeeklyStreak';
import { getSupabase } from '@/lib/supabase';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import { preferenceLabel } from '@/screens/ProfileThemeScreen';
import { stitchAmbientShadow } from '@/theme/stitchTokens';
import { WeeklyStreakRing } from '@/components/impact/WeeklyStreakRing';
import { StitchIcon } from '@/ui/stitch/StitchIcon';
import { StitchText } from '@/ui/stitch/StitchText';
import { StitchButton } from '@/ui/stitch/StitchButton';
import { logError } from '@/observability/logError';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<CustomerTabParamList, 'ProfileTab'>,
  NativeStackNavigationProp<RootStackParamList>
>;

function initialsFromUser(name: string | undefined, email: string | undefined) {
  const base = (name ?? email ?? '?').trim();
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
  }
  return base.slice(0, 2).toUpperCase() || '?';
}

export function ProfileScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<CustomerTabParamList, 'ProfileTab'>>();
  const { env, user, isSuspended, signOut, initializing } = useAuthContext();
  const suspended =
    isSuspended || (route.params != null && Boolean(route.params.suspended));
  /**
   * Stitch `profile_light_mode_2` centers the brand logo in the title row instead
   * of the tab title chrome. Honored via the route param so the deep link
   * `freshasever://profile?headerVariant=logo` lands on the `_2` composition.
   */
  const headerVariant: 'title' | 'logo' =
    (route.params as { headerVariant?: 'title' | 'logo' } | undefined)?.headerVariant ===
    'logo'
      ? 'logo'
      : 'title';

  const { bagsRescued, co2SavedKg, totalSavedRs, loading: impactLoading } =
    useCustomerImpact(env, user?.id ?? null);
  const { streak } = useCustomerWeeklyStreak(env, user?.id ?? null);

  /**
   * Stitch `profile_light_mode_1` hero swap — load the user's `profiles.avatar_url` so the
   * 96×96 hero card renders the saved photo (falls back to initials when null).
   */
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!user?.id) {
      setAvatarUrl(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const sb = getSupabase(env);
      const { data } = await sb
        .from('profiles')
        .select('avatar_url')
        .eq('id', user.id)
        .maybeSingle();
      if (cancelled) return;
      const raw = data?.avatar_url;
      setAvatarUrl(typeof raw === 'string' && /^https?:\/\//.test(raw) ? raw : null);
    })().catch((err) => logError(err, { context: 'ProfileScreen.op' }));
    return () => {
      cancelled = true;
    };
  }, [env, user?.id]);

  const { colors, spacing, radii, themePreference } = useStitchTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        scroll: { flex: 1 },
        pad: {
          paddingHorizontal: spacing.md,
          paddingTop: spacing.lg,
          paddingBottom: spacing.xl + spacing.lg,
          gap: spacing.xl,
        },
        warn: {
          backgroundColor: colors.errorContainer,
          padding: spacing.md,
          borderRadius: radii.lg,
        },
        header: { alignItems: 'center', gap: spacing.xs },
        avatar: {
          width: 96,
          height: 96,
          borderRadius: 48,
          borderWidth: 4,
          borderColor: colors.surface,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
          ...stitchAmbientShadow,
        },
        bentoRow: { gap: spacing.md },
        bentoTop: { minHeight: 128 },
        bentoBottom: { flexDirection: 'row', gap: spacing.md },
        bentoHalf: { flex: 1, minHeight: 128 },
        statInner: {
          flex: 1,
          padding: spacing.md,
          justifyContent: 'space-between',
          borderRadius: radii.xl,
          overflow: 'hidden',
          borderWidth: StyleSheet.hairlineWidth,
        },
        labelRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
        },
        co2Row: { flexDirection: 'row', alignItems: 'baseline' },
        menuShell: {
          borderRadius: radii.xl,
          overflow: 'hidden',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: `${colors.divider}80`,
          ...stitchAmbientShadow,
        },
        menuRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: spacing.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: `${colors.divider}80`,
        },
        menuRowLast: { borderBottomWidth: 0 },
        menuLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
        iconBubble: {
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: colors.surfaceContainer,
          alignItems: 'center',
          justifyContent: 'center',
        },
        logOut: {
          marginTop: spacing.md,
          minHeight: 48,
          borderRadius: radii.lg,
          borderWidth: 1.5,
          borderColor: colors.primaryContainer,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
        },
        guestBlock: { gap: spacing.md, alignItems: 'center' },
      }),
    [colors, radii, spacing],
  );

  const rescueYear = useMemo(() => {
    if (!user?.created_at) return null;
    const y = new Date(user.created_at).getFullYear();
    return Number.isFinite(y) ? String(y) : null;
  }, [user?.created_at]);

  const displayName =
    user?.full_name?.trim() ||
    user?.email?.split('@')[0] ||
    'Food Rescuer';

  const tintDefaults = useMemo(
    () => ({
      bagsBorder: `${colors.divider}80`,
      moneyBg: `${colors.accentHighlight}4D`,
      moneyBorder: `${colors.accent}33`,
      co2Bg: `${colors.primaryHighlight}4D`,
      co2Border: `${colors.primaryContainer}33`,
    }),
    [
      colors.accent,
      colors.accentHighlight,
      colors.divider,
      colors.primaryContainer,
      colors.primaryHighlight,
    ],
  );

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.pad}
    >
      {headerVariant === 'logo' ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            paddingBottom: spacing.md,
          }}
        >
          <StitchIcon name="eco" size={22} colorKey="primaryContainer" />
          <StitchText
            variant="h2"
            colorKey="primaryContainer"
            style={{ letterSpacing: -0.5 }}
          >
            Fresh As Ever
          </StitchText>
        </View>
      ) : null}
      {suspended ? (
        <View style={styles.warn}>
          <StitchText variant="body-sm" colorKey="onErrorContainer">
            Account suspended—checkout blocked.
          </StitchText>
        </View>
      ) : null}

      {!user ? (
        <View style={styles.guestBlock}>
          <View style={[styles.avatar, { backgroundColor: colors.surface2 }]}>
            <StitchIcon name="person" size={40} colorKey="textMuted" />
          </View>
          <StitchText variant="h2" colorKey="text" testID="profile.guestHeading">
            Guest
          </StitchText>
          <StitchText variant="body-md" colorKey="textMuted" style={{ textAlign: 'center' }}>
            Sign in to track rescues and see your impact.
          </StitchText>
          <StitchButton
            title="Sign in"
            testID="profile.guestSignIn"
            onPress={() => navigation.navigate('Login')}
            style={{ alignSelf: 'stretch' }}
          />
        </View>
      ) : (
        <>
          <View style={styles.header}>
            <View style={[styles.avatar, { backgroundColor: colors.primaryHighlight }]}>
              {avatarUrl ? (
                <Image
                  accessibilityLabel="Profile photo"
                  source={{ uri: avatarUrl }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                  onError={() => setAvatarUrl(null)}
                />
              ) : (
                <StitchText
                  variant="h2"
                  colorKey="primaryContainer"
                  style={{ fontSize: 28, lineHeight: 34 }}
                >
                  {initialsFromUser(user.full_name ?? undefined, user.email ?? undefined)}
                </StitchText>
              )}
            </View>
            <StitchText variant="h2" colorKey="text">
              {displayName}
            </StitchText>
            <StitchText variant="body-md" colorKey="textMuted">
              {rescueYear
                ? `Food Rescuer since ${rescueYear}`
                : 'Food Rescuer'}
            </StitchText>
          </View>

          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Open your full environmental impact"
            onPress={() => navigation.navigate('Impact')}
            style={({ pressed }) => [pressed ? { opacity: 0.85 } : null]}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: spacing.md,
              }}
            >
              <StitchText variant="h3" colorKey="text">
                Your Impact
              </StitchText>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 2,
                }}
              >
                <StitchText variant="label" colorKey="primaryContainer">
                  See details
                </StitchText>
                <StitchIcon
                  name="chevron_right"
                  size={18}
                  colorKey="primaryContainer"
                />
              </View>
            </View>
            {impactLoading && !bagsRescued ? (
              <ActivityIndicator color={colors.primaryContainer} />
            ) : (
              <>
                {user ? (
                  <View style={{ marginBottom: spacing.md, alignItems: 'center' }}>
                    <WeeklyStreakRing
                      compact
                      count={streak.count}
                      goal={streak.goal}
                      goalMet={streak.goalMet}
                      remaining={streak.remaining}
                      progress={streak.progress}
                    />
                  </View>
                ) : null}
              <View style={styles.bentoRow}>
                <View style={[styles.statInner, styles.bentoTop, { borderColor: tintDefaults.bagsBorder, backgroundColor: colors.surface }]}>
                  <View style={styles.labelRow}>
                    <StitchIcon name="shopping_bag" size={20} colorKey="textMuted" />
                    <StitchText variant="label-caps" colorKey="textMuted">
                      Bags rescued
                    </StitchText>
                  </View>
                  <StitchText variant="display" colorKey="text">
                    {bagsRescued}
                  </StitchText>
                </View>
                <View style={styles.bentoBottom}>
                  <View style={[styles.statInner, styles.bentoHalf, { borderColor: tintDefaults.moneyBorder }]}>
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: tintDefaults.moneyBg, borderRadius: radii.xl }]} />
                    <View style={{ flex: 1, justifyContent: 'space-between' }}>
                      <View style={styles.labelRow}>
                        <StitchIcon name="account_balance_wallet" size={20} colorKey="accent" />
                        <StitchText variant="label-caps" colorKey="accent">
                          Money saved
                        </StitchText>
                      </View>
                      <StitchText variant="price" colorKey="accent">
                        Rs. {totalSavedRs.toLocaleString()}
                      </StitchText>
                    </View>
                  </View>
                  <View style={[styles.statInner, styles.bentoHalf, { borderColor: tintDefaults.co2Border }]}>
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: tintDefaults.co2Bg, borderRadius: radii.xl }]} />
                    <View style={{ flex: 1, justifyContent: 'space-between' }}>
                      <View style={styles.labelRow}>
                        <StitchIcon name="eco" size={20} colorKey="primaryContainer" />
                        <StitchText
                          variant="label-caps"
                          colorKey="primaryContainer"
                          style={{ textTransform: 'none' }}
                        >
                          CO₂ prevented
                        </StitchText>
                      </View>
                      <View style={styles.co2Row}>
                        <StitchText variant="display" colorKey="primaryContainer">
                          {co2SavedKg}
                        </StitchText>
                        <StitchText
                          variant="h3"
                          colorKey="primaryContainer"
                          style={{ marginLeft: 4, fontWeight: '500' }}
                        >
                          kg
                        </StitchText>
                      </View>
                    </View>
                  </View>
                </View>
              </View>
              </>
            )}
          </Pressable>

          <View style={[styles.menuShell, { backgroundColor: colors.surface }]}>
            <Pressable
              style={({ pressed }) => [
                styles.menuRow,
                pressed && { backgroundColor: colors.surface2 },
              ]}
              onPress={() => navigation.navigate('ProfileDetails')}
            >
              <View style={styles.menuLeft}>
                <View style={styles.iconBubble}>
                  <StitchIcon name="manage_accounts" size={22} colorKey="textMuted" />
                </View>
                <View>
                  <StitchText variant="label" colorKey="text">
                    Account Details
                  </StitchText>
                  <StitchText variant="body-sm" colorKey="textMuted">
                    Email, Phone, Password
                  </StitchText>
                </View>
              </View>
              <StitchIcon name="chevron_right" size={22} colorKey="textFaint" />
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.menuRow,
                pressed && { backgroundColor: colors.surface2 },
              ]}
              onPress={() => navigation.navigate('ProfilePayments')}
            >
              <View style={styles.menuLeft}>
                <View style={styles.iconBubble}>
                  <StitchIcon name="credit_card" size={22} colorKey="textMuted" />
                </View>
                <View>
                  <StitchText variant="label" colorKey="text">
                    Payment Methods
                  </StitchText>
                  <StitchText variant="body-sm" colorKey="textMuted">
                    Manage saved cards
                  </StitchText>
                </View>
              </View>
              <StitchIcon name="chevron_right" size={22} colorKey="textFaint" />
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.menuRow,
                pressed && { backgroundColor: colors.surface2 },
              ]}
              onPress={() => navigation.navigate('ProfileNotifications')}
            >
              <View style={styles.menuLeft}>
                <View style={styles.iconBubble}>
                  <StitchIcon name="notifications" size={22} colorKey="textMuted" />
                </View>
                <View>
                  <StitchText variant="label" colorKey="text">
                    Notifications
                  </StitchText>
                  <StitchText variant="body-sm" colorKey="textMuted">
                    Rescue alerts & updates
                  </StitchText>
                </View>
              </View>
              <StitchIcon name="chevron_right" size={22} colorKey="textFaint" />
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.menuRow,
                pressed && { backgroundColor: colors.surface2 },
              ]}
              onPress={() => navigation.navigate('Favourites')}
            >
              <View style={styles.menuLeft}>
                <View style={styles.iconBubble}>
                  <StitchIcon
                    name="favorite_border"
                    size={22}
                    colorKey="textMuted"
                  />
                </View>
                <View>
                  <StitchText variant="label" colorKey="text">
                    Favourites
                  </StitchText>
                  <StitchText variant="body-sm" colorKey="textMuted">
                    Saved outlets & rescue spots
                  </StitchText>
                </View>
              </View>
              <StitchIcon name="chevron_right" size={22} colorKey="textFaint" />
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.menuRow,
                pressed && { backgroundColor: colors.surface2 },
              ]}
              onPress={() => navigation.navigate('ProfileTheme')}
              accessibilityRole="button"
              accessibilityLabel={`Appearance. Current preference: ${preferenceLabel(themePreference)}.`}
            >
              <View style={styles.menuLeft}>
                <View style={styles.iconBubble}>
                  <StitchIcon name="palette" size={22} colorKey="textMuted" />
                </View>
                <View>
                  <StitchText variant="label" colorKey="text">
                    Appearance
                  </StitchText>
                  <StitchText variant="body-sm" colorKey="textMuted">
                    {preferenceLabel(themePreference)}
                  </StitchText>
                </View>
              </View>
              <StitchIcon name="chevron_right" size={22} colorKey="textFaint" />
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.menuRow,
                styles.menuRowLast,
                pressed && { backgroundColor: colors.surface2 },
              ]}
              onPress={() => navigation.navigate('ProfileSupport')}
            >
              <View style={styles.menuLeft}>
                <View style={styles.iconBubble}>
                  <StitchIcon name="support_agent" size={22} colorKey="textMuted" />
                </View>
                <View style={{ flexShrink: 1 }}>
                  <StitchText variant="label" colorKey="text">
                    Support
                  </StitchText>
                  <StitchText variant="body-sm" colorKey="textMuted">
                    Help center & FAQs
                  </StitchText>
                </View>
              </View>
              <StitchIcon name="chevron_right" size={22} colorKey="textFaint" />
            </Pressable>
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={initializing}
            onPress={() => void signOut()}
            testID="profile.logOut"
            style={({ pressed }) => [
              styles.logOut,
              {
                backgroundColor: pressed
                  ? `${colors.primaryHighlight}33`
                  : 'transparent',
              },
              initializing && { opacity: 0.5 },
            ]}
          >
            <StitchIcon name="logout" size={20} colorKey="primaryContainer" />
            <StitchText variant="label" colorKey="primaryContainer">
              Log Out
            </StitchText>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}
