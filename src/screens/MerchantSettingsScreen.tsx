import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Switch,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { useAuthContext } from '@/context/AuthContext';
import { useMerchantContext } from '@/hooks/useMerchantContext';
import { getSupabase } from '@/lib/supabase';
import type { RootStackParamList } from '@/navigation/types';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import {
  StitchButton,
  StitchIcon,
  StitchScreen,
  StitchSurface,
  StitchText,
} from '@/ui/stitch';
import { logError } from '@/observability/logError';

type StaffRow = {
  id: string;
  user_id: string | null;
  role: string | null;
  invited_email: string | null;
  display_name: string | null;
  status: string | null;
  created_at: string | null;
};

export function MerchantSettingsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { env, signOut } = useAuthContext();
  const { merchant } = useMerchantContext(env);
  const { colors, radii, spacing } = useStitchTheme();
  const [sound, setSound] = useState(true);
  const [quiet, setQuiet] = useState(false);
  const [pwToggle, setPwToggle] = useState(false);
  const [twoFa, setTwoFa] = useState(false);
  /**
   * Persistence for the four toggles. Hydrates from `merchants.merchant_notification_prefs`
   * (pickup alerts + quiet hours) and `merchants.merchant_security_settings` (publish
   * password + 2FA) on mount, writes through on each toggle, surfaces a "Saved" indicator
   * on success. Migration: `merchant_notification_prefs_v1` (additive jsonb columns).
   */
  const [prefsHydrated, setPrefsHydrated] = useState(false);
  const [savedTick, setSavedTick] = useState<string | null>(null);
  const [prefsError, setPrefsError] = useState<string | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Stitch `merchant_settings_refined` exposes Staff accounts via an inline list. */
  const [staffOpen, setStaffOpen] = useState(false);
  const [staffRows, setStaffRows] = useState<StaffRow[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);

  useEffect(() => {
    if (!merchant?.id) return;
    let cancelled = false;
    (async () => {
      const sb = getSupabase(env);
      const { data, error } = await sb
        .from('merchants')
        .select('merchant_notification_prefs, merchant_security_settings')
        .eq('id', String(merchant.id))
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        setPrefsError(error.message);
        setPrefsHydrated(true);
        return;
      }
      const np = (data?.merchant_notification_prefs ?? null) as Record<string, unknown> | null;
      const ss = (data?.merchant_security_settings ?? null) as Record<string, unknown> | null;
      if (np && typeof np === 'object') {
        if (typeof np.pickup_alerts === 'boolean') setSound(np.pickup_alerts);
        if (typeof np.quiet_hours === 'boolean') setQuiet(np.quiet_hours);
      }
      if (ss && typeof ss === 'object') {
        if (typeof ss.require_password_to_publish === 'boolean') {
          setPwToggle(ss.require_password_to_publish);
        }
        if (typeof ss.two_factor_signin === 'boolean') {
          setTwoFa(ss.two_factor_signin);
        }
      }
      setPrefsHydrated(true);
    })().catch(() => setPrefsHydrated(true));
    return () => {
      cancelled = true;
    };
  }, [env, merchant?.id]);

  const showSaved = useCallback((label: string) => {
    if (savedTimer.current) clearTimeout(savedTimer.current);
    setSavedTick(label);
    savedTimer.current = setTimeout(() => setSavedTick(null), 2400);
  }, []);

  const persistPrefs = useCallback(
    async (
      patch: { notifications?: Record<string, boolean>; security?: Record<string, boolean> },
      label: string,
    ) => {
      if (!merchant?.id) return;
      setPrefsError(null);
      const sb = getSupabase(env);
      const updates: Record<string, unknown> = {};
      if (patch.notifications) {
        updates.merchant_notification_prefs = {
          pickup_alerts: sound,
          quiet_hours: quiet,
          ...patch.notifications,
        };
      }
      if (patch.security) {
        updates.merchant_security_settings = {
          require_password_to_publish: pwToggle,
          two_factor_signin: twoFa,
          ...patch.security,
        };
      }
      updates.updated_at = new Date().toISOString();
      const { error } = await sb
        .from('merchants')
        .update(updates)
        .eq('id', String(merchant.id));
      if (error) {
        setPrefsError(error.message);
        return;
      }
      showSaved(label);
    },
    [env, merchant?.id, pwToggle, quiet, showSaved, sound, twoFa],
  );

  useEffect(
    () => () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    },
    [],
  );

  const loadStaff = useCallback(async () => {
    if (!merchant?.id) {
      setStaffRows([]);
      return;
    }
    setStaffLoading(true);
    setStaffError(null);
    try {
      const sb = getSupabase(env);
      const { data, error } = await sb
        .from('merchant_staff')
        .select(
          'id, user_id, role, invited_email, display_name, status, created_at',
        )
        .eq('merchant_id', String(merchant.id))
        .order('created_at', { ascending: false });
      if (error) throw error;
      setStaffRows((data ?? []) as StaffRow[]);
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : 'Could not load staff accounts.';
      // RLS/missing-table errors fall back to a friendly note so the sheet still
      // renders something during early staging.
      setStaffError(msg);
      setStaffRows([]);
    } finally {
      setStaffLoading(false);
    }
  }, [env, merchant?.id]);

  const inviteStaff = useCallback(async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!merchant?.id) {
      setStaffError('Merchant profile is still loading.');
      return;
    }
    if (!email || !email.includes('@')) {
      setStaffError('Enter a valid email address to invite.');
      return;
    }
    setInviteBusy(true);
    setStaffError(null);
    try {
      const sb = getSupabase(env);
      const { error } = await sb.from('merchant_staff').insert({
        merchant_id: String(merchant.id),
        invited_email: email,
        role: 'staff',
        status: 'invited',
      });
      if (error) throw error;
      setInviteEmail('');
      await loadStaff();
    } catch (e) {
      setStaffError(
        e instanceof Error ? e.message : 'Could not send staff invitation.',
      );
    } finally {
      setInviteBusy(false);
    }
  }, [env, inviteEmail, loadStaff, merchant?.id]);

  const updateStaffStatus = useCallback(
    async (staffId: string, status: 'active' | 'revoked' | 'invited') => {
      if (!merchant?.id) return;
      setStaffError(null);
      try {
        const sb = getSupabase(env);
        const { error } = await sb
          .from('merchant_staff')
          .update({ status, updated_at: new Date().toISOString() })
          .eq('id', staffId)
          .eq('merchant_id', String(merchant.id));
        if (error) throw error;
        await loadStaff();
      } catch (e) {
        setStaffError(
          e instanceof Error ? e.message : 'Could not update staff member.',
        );
      }
    },
    [env, loadStaff, merchant?.id],
  );

  useEffect(() => {
    if (!staffOpen) return;
    loadStaff().catch((err) => logError(err, { context: 'MerchantSettingsScreen.loadStaff' }));
  }, [staffOpen, loadStaff]);

  const styles = useMemo(() => {
    const pagePad = spacing.pageMarginMobile;
    const row: ViewStyle = {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    };
    const switchRow: ViewStyle = {
      ...row,
      alignItems: 'flex-start',
    };
    const cardBorder: ViewStyle = {
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      overflow: 'hidden',
    };
    const bentoRow: ViewStyle = {
      flexDirection: 'row',
      gap: spacing.md,
    };
    const bentoTile: ViewStyle = {
      flex: 1,
      minHeight: 152,
      borderRadius: radii.xl,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
    };
    const bentoIcon: ViewStyle = {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    };
    return {
      content: {
        paddingHorizontal: pagePad,
        paddingTop: spacing.md,
        paddingBottom: spacing.xxl,
        gap: spacing.lg,
      },
      headerBlock: { marginBottom: spacing.sm },
      row,
      switchRow,
      cardBorder,
      bentoRow,
      bentoTile,
      bentoIcon,
      switchCopy: { flex: 1, paddingRight: spacing.md, minWidth: 0 },
    };
  }, [colors, radii, spacing]);

  return (
    <StitchScreen
      scroll
      scrollProps={{
        contentContainerStyle: styles.content,
        keyboardShouldPersistTaps: 'handled',
      }}
    >
      {/*
        Stitch `merchant_settings_refined` opens with an "Account Settings" hero +
        Business profile + Security bento cards (and inline password / 2FA toggles).
        The refined variant sits above the original list so the base mobile chrome
        remains intact for `merchant_settings` parity.
      */}
      <View style={styles.headerBlock}>
        <StitchText variant="h1" colorKey="text">
          Account Settings
        </StitchText>
        <StitchText variant="body-md" colorKey="textMuted" style={{ marginTop: 4 }}>
          Manage your business profile and security
        </StitchText>
      </View>

      <View style={styles.bentoRow}>
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate('MerchantProfile')}
          style={({ pressed }) => [
            styles.bentoTile,
            { opacity: pressed ? 0.9 : 1, backgroundColor: colors.primaryHighlight },
          ]}
        >
          <View style={[styles.bentoIcon, { backgroundColor: colors.surface }]}>
            <StitchIcon name="storefront" size={22} colorKey="primaryContainer" />
          </View>
          <StitchText variant="label-caps" colorKey="primaryContainer" style={{ marginTop: spacing.md }}>
            Business profile
          </StitchText>
          <StitchText variant="h3" colorKey="text" style={{ marginTop: 2 }}>
            Edit outlets
          </StitchText>
          <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: 4 }}>
            Hours, location, contact
          </StitchText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            Alert.alert(
              'Security',
              'Use the password and 2FA toggles below to manage account security.',
            )
          }
          style={({ pressed }) => [
            styles.bentoTile,
            { opacity: pressed ? 0.9 : 1, backgroundColor: colors.accentHighlight },
          ]}
        >
          <View style={[styles.bentoIcon, { backgroundColor: colors.surface }]}>
            <StitchIcon name="shield" size={22} colorKey="accent" />
          </View>
          <StitchText variant="label-caps" colorKey="accent" style={{ marginTop: spacing.md }}>
            Security
          </StitchText>
          <StitchText variant="h3" colorKey="text" style={{ marginTop: 2 }}>
            {twoFa ? '2FA active' : 'Account guards'}
          </StitchText>
          <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: 4 }}>
            Password & 2FA
          </StitchText>
        </Pressable>
      </View>

      <StitchSurface elevated padding="none" style={styles.cardBorder}>
        <View style={styles.switchRow}>
          <View style={styles.switchCopy}>
            <StitchText variant="label" colorKey="text">
              Require password to publish
            </StitchText>
            <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: 4 }}>
              Re-prompts for password before publishing a rescue bag.
            </StitchText>
          </View>
          <Switch
            value={pwToggle}
            onValueChange={(v) => {
              setPwToggle(v);
              if (prefsHydrated) {
                void persistPrefs(
                  { security: { require_password_to_publish: v } },
                  'Publish password',
                );
              }
            }}
            trackColor={{ false: colors.outlineVariant, true: colors.primaryHighlight }}
            thumbColor={pwToggle ? colors.primaryContainer : colors.surfaceBright}
          />
        </View>
        <View style={[styles.switchRow, { borderBottomWidth: 0 }]}>
          <View style={styles.switchCopy}>
            <StitchText variant="label" colorKey="text">
              Two-factor authentication
            </StitchText>
            <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: 4 }}>
              Adds an SMS verification step on next sign-in.
            </StitchText>
          </View>
          <Switch
            value={twoFa}
            onValueChange={(v) => {
              setTwoFa(v);
              if (prefsHydrated) {
                void persistPrefs(
                  { security: { two_factor_signin: v } },
                  'Two-factor sign-in',
                );
              }
            }}
            trackColor={{ false: colors.outlineVariant, true: colors.primaryHighlight }}
            thumbColor={twoFa ? colors.primaryContainer : colors.surfaceBright}
          />
        </View>
      </StitchSurface>

      <StitchSurface elevated padding="none" style={styles.cardBorder}>
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate('MerchantProfile')}
          style={({ pressed }) => [styles.row, { opacity: pressed ? 0.88 : 1 }]}
        >
          <StitchText variant="body-md" colorKey="text">
            Outlet profile
          </StitchText>
          <StitchIcon name="chevron_right" size={22} colorKey="textFaint" />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate('MerchantStaff')}
          style={({ pressed }) => [styles.row, { opacity: pressed ? 0.88 : 1 }]}
        >
          <StitchText variant="body-md" colorKey="text">
            Staff accounts
          </StitchText>
          <StitchIcon name="chevron_right" size={22} colorKey="textFaint" />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            navigation.navigate('ProfileSupport', { audience: 'merchant' })
          }
          style={({ pressed }) => [styles.row, { opacity: pressed ? 0.88 : 1 }]}
        >
          <StitchText variant="body-md" colorKey="text">
            Help & support
          </StitchText>
          <StitchIcon name="chevron_right" size={22} colorKey="textFaint" />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate('MerchantProfile')}
          style={({ pressed }) => [
            styles.row,
            { borderBottomWidth: 0, opacity: pressed ? 0.88 : 1 },
          ]}
        >
          <StitchText variant="body-md" colorKey="text">
            Operating hours
          </StitchText>
          <StitchIcon name="chevron_right" size={22} colorKey="textFaint" />
        </Pressable>
      </StitchSurface>

      <View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: spacing.sm,
          }}
        >
          <StitchText variant="h3" colorKey="text">
            Pickup & alerts
          </StitchText>
          {savedTick ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingHorizontal: spacing.sm,
                paddingVertical: 2,
                borderRadius: 999,
                backgroundColor: colors.primaryHighlight,
              }}
            >
              <StitchIcon name="check_circle" size={14} colorKey="primaryContainer" />
              <StitchText variant="label-caps" colorKey="primaryContainer">
                Saved · {savedTick}
              </StitchText>
            </View>
          ) : null}
        </View>
        <StitchSurface elevated padding="none" style={styles.cardBorder}>
          <View style={styles.switchRow}>
            <View style={styles.switchCopy}>
              <StitchText variant="label" colorKey="text">
                Pickup alerts
              </StitchText>
              <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: 4 }}>
                Merchant tab badge when pickups go late
              </StitchText>
            </View>
            <Switch
              value={sound}
              onValueChange={(v) => {
                setSound(v);
                if (prefsHydrated) {
                  void persistPrefs(
                    { notifications: { pickup_alerts: v } },
                    'Pickup alerts',
                  );
                }
              }}
              trackColor={{ false: colors.outlineVariant, true: colors.primaryHighlight }}
              thumbColor={sound ? colors.primaryContainer : colors.surfaceBright}
            />
          </View>
          <View style={[styles.switchRow, { borderBottomWidth: 0 }]}>
            <View style={styles.switchCopy}>
              <StitchText variant="label" colorKey="text">
                Quiet hours reminder
              </StitchText>
              <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: 4 }}>
                Dim push volume during storefront prep
              </StitchText>
            </View>
            <Switch
              value={quiet}
              onValueChange={(v) => {
                setQuiet(v);
                if (prefsHydrated) {
                  void persistPrefs(
                    { notifications: { quiet_hours: v } },
                    'Quiet hours',
                  );
                }
              }}
              trackColor={{ false: colors.outlineVariant, true: colors.primaryHighlight }}
              thumbColor={quiet ? colors.primaryContainer : colors.surfaceBright}
            />
          </View>
        </StitchSurface>
        <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: spacing.sm }}>
          {prefsError
            ? `Couldn't save preferences (${prefsError}). Toggles still work locally.`
            : 'Your choices are saved to your merchant account.'}
        </StitchText>
      </View>

      <View style={{ alignItems: 'center', marginTop: spacing.md }}>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            signOut().catch((err) => logError(err, { context: 'MerchantSettingsScreen.signOut' }));
          }}
          style={({ pressed }) => ({
            paddingVertical: spacing.md,
            paddingHorizontal: spacing.lg,
            borderRadius: radii.default,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <StitchText variant="label" colorKey="textMuted">
            Log out
          </StitchText>
        </Pressable>
      </View>

      <Modal
        transparent
        visible={staffOpen}
        animationType="slide"
        onRequestClose={() => setStaffOpen(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: `${colors.inverseSurface}99`,
            justifyContent: 'flex-end',
          }}
          onPress={() => setStaffOpen(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              maxHeight: '80%',
              backgroundColor: colors.surface,
              borderTopLeftRadius: radii.xl,
              borderTopRightRadius: radii.xl,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.lg,
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
              <StitchText variant="h2" colorKey="text">
                Staff accounts
              </StitchText>
              <Pressable
                accessibilityLabel="Close"
                onPress={() => setStaffOpen(false)}
                style={{ padding: spacing.xs }}
              >
                <StitchIcon name="close" size={22} colorKey="textMuted" />
              </Pressable>
            </View>
            {staffLoading ? (
              <ActivityIndicator color={colors.primaryContainer} />
            ) : staffError ? (
              <StitchText variant="body-sm" colorKey="onErrorContainer">
                {staffError}
              </StitchText>
            ) : null}
            <View style={{ gap: spacing.sm }}>
              <StitchText variant="label" colorKey="text">
                Invite by email
              </StitchText>
              <TextInput
                value={inviteEmail}
                onChangeText={setInviteEmail}
                placeholder="colleague@example.com"
                placeholderTextColor={colors.textFaint}
                autoCapitalize="none"
                keyboardType="email-address"
                style={{
                  borderWidth: 1,
                  borderColor: colors.outlineVariant,
                  borderRadius: radii.lg,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  color: colors.text,
                  backgroundColor: colors.surfaceBright,
                }}
              />
              <StitchButton
                title={inviteBusy ? 'Sending…' : 'Send invite'}
                onPress={() => void inviteStaff()}
                disabled={inviteBusy}
              />
              <StitchText variant="body-sm" colorKey="textMuted">
                Invites also work from the merchant web console. Staff appear here once
                added.
              </StitchText>
            </View>
            {staffRows.length === 0 ? (
              <StitchText variant="body-md" colorKey="textMuted">
                No staff accounts yet.
              </StitchText>
            ) : (
              <ScrollView style={{ maxHeight: 360 }}>
                {staffRows.map((s) => (
                  <View
                    key={s.id}
                    style={{
                      paddingVertical: spacing.sm,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.divider,
                    }}
                  >
                    <StitchText variant="label" colorKey="text">
                      {s.display_name ?? s.invited_email ?? 'Staff member'}
                    </StitchText>
                    <StitchText variant="body-sm" colorKey="textMuted">
                      {s.role ?? 'staff'} · {s.status ?? 'invited'}
                      {s.created_at
                        ? ` · invited ${new Date(s.created_at).toLocaleDateString()}`
                        : ''}
                    </StitchText>
                    <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs, flexWrap: 'wrap' }}>
                      {s.status === 'invited' ? (
                        <Pressable onPress={() => void updateStaffStatus(s.id, 'active')}>
                          <StitchText variant="label" colorKey="primaryContainer">
                            Mark active
                          </StitchText>
                        </Pressable>
                      ) : null}
                      {s.status !== 'revoked' ? (
                        <Pressable onPress={() => void updateStaffStatus(s.id, 'revoked')}>
                          <StitchText variant="label" colorKey="error">
                            Revoke access
                          </StitchText>
                        </Pressable>
                      ) : (
                        <Pressable onPress={() => void updateStaffStatus(s.id, 'invited')}>
                          <StitchText variant="label" colorKey="primaryContainer">
                            Re-invite
                          </StitchText>
                        </Pressable>
                      )}
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </StitchScreen>
  );
}
