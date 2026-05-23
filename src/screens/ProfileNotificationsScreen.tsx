import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RootStackParamList } from '@/navigation/types';
import { useAuthContext } from '@/context/AuthContext';
import { getSupabase } from '@/lib/supabase';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import { stitchAmbientShadow } from '@/theme/stitchTokens';
import { StitchCard, StitchIcon, StitchText } from '@/ui/stitch';
import { logError } from '@/observability/logError';

/**
 * Storage key for the notification preferences. The keys here are deliberately scoped per
 * auth user (suffix `:<uid>`) so multi-account installs don't share toggle state.
 * Values are JSON-encoded `{ push, email, sms }` booleans.
 */
const NOTIF_PREFS_PREFIX = 'fresh_as_ever.notification_prefs';
const DEFAULT_NOTIF_PREFS = { push: true, email: true, sms: false } as const;

function initialsFromUser(name: string | undefined, email: string | undefined) {
  const base = (name ?? email ?? '?').trim();
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
  }
  return base.slice(0, 2).toUpperCase() || '?';
}

export function ProfileNotificationsScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList, 'ProfileNotifications'>>();
  const { env, user } = useAuthContext();
  const { colors, spacing } = useStitchTheme();

  const [pushOn, setPushOn] = useState<boolean>(DEFAULT_NOTIF_PREFS.push);
  const [emailOn, setEmailOn] = useState<boolean>(DEFAULT_NOTIF_PREFS.email);
  const [smsOn, setSmsOn] = useState<boolean>(DEFAULT_NOTIF_PREFS.sms);
  const [profilePhone, setProfilePhone] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const prefsKey = useMemo(
    () => `${NOTIF_PREFS_PREFIX}:${user?.id ?? 'guest'}`,
    [user?.id],
  );

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const applyPrefs = (parsed: Partial<typeof DEFAULT_NOTIF_PREFS>) => {
    if (typeof parsed.push === 'boolean') setPushOn(parsed.push);
    if (typeof parsed.email === 'boolean') setEmailOn(parsed.email);
    if (typeof parsed.sms === 'boolean') setSmsOn(parsed.sms);
  };

  // Hydrate from `profiles.notification_prefs`, then AsyncStorage fallback.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (user?.id) {
          const { data } = await getSupabase(env)
            .from('profiles')
            .select('notification_prefs, phone')
            .eq('id', user.id)
            .maybeSingle();
          if (cancelled) return;
          if (typeof data?.phone === 'string') {
            setProfilePhone(data.phone);
          }
          const np = data?.notification_prefs as Partial<typeof DEFAULT_NOTIF_PREFS> | null;
          if (np && typeof np === 'object') {
            applyPrefs(np);
            setHydrated(true);
            return;
          }
        }
        const raw = await AsyncStorage.getItem(prefsKey);
        if (cancelled) return;
        if (raw) {
          applyPrefs(JSON.parse(raw) as Partial<typeof DEFAULT_NOTIF_PREFS>);
        }
      } catch {
        // ignore — defaults already applied
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [env, prefsKey, user?.id]);

  // Persist to profile jsonb + local cache after hydration.
  useEffect(() => {
    if (!hydrated) return;
    const prefs = { push: pushOn, email: emailOn, sms: smsOn };
    AsyncStorage.setItem(prefsKey, JSON.stringify(prefs)).catch((err) =>
      logError(err, { context: 'ProfileNotificationsScreen.asyncStorage' }),
    );
    if (!user?.id) return;
    void (async () => {
      try {
        const { error } = await getSupabase(env)
          .from('profiles')
          .update({ notification_prefs: prefs })
          .eq('id', user.id);
        if (error) {
          logError(error, { context: 'ProfileNotificationsScreen.notification_prefs' });
        }
      } catch (err: unknown) {
        logError(err, { context: 'ProfileNotificationsScreen.notification_prefs' });
      }
    })();
  }, [emailOn, env, hydrated, prefsKey, pushOn, smsOn, user?.id]);

  const onSmsChange = useCallback(
    (next: boolean) => {
      if (next) {
        const phone =
          profilePhone.trim() ||
          (typeof user?.phone === 'string' ? user.phone : '').trim();
        if (!phone) {
          Alert.alert(
            'Phone required',
            'Add a phone number under Profile → Account Details to receive SMS alerts.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Add phone',
                onPress: () => navigation.navigate('ProfileDetails'),
              },
            ],
          );
          return;
        }
      }
      setSmsOn(next);
    },
    [navigation, profilePhone, user?.phone],
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        topBar: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.md,
          height: 56,
        },
        titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
        hit: {
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
        },
        avatar: {
          width: 32,
          height: 32,
          borderRadius: 16,
          overflow: 'hidden',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: `${colors.divider}99`,
          ...stitchAmbientShadow,
          alignItems: 'center',
          justifyContent: 'center',
        },
        hero: {
          alignItems: 'center',
          marginTop: spacing.lg,
          marginBottom: spacing.xl,
          gap: spacing.lg,
        },
        heroCircle: {
          width: 224,
          height: 224,
          borderRadius: 112,
          backgroundColor: colors.surface2,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
          ...stitchAmbientShadow,
        },
        prefHeader: {
          paddingLeft: spacing.sm,
          marginBottom: spacing.md,
        },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: spacing.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: `${colors.divider}80`,
        },
        rowLast: { borderBottomWidth: 0 },
      }),
    [colors.divider, colors.surface2, spacing],
  );

  const trackColor = useMemo(
    () => ({ false: colors.surfaceDim, true: colors.primaryContainer }),
    [colors.primaryContainer, colors.surfaceDim],
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
      <View style={[styles.topBar, { backgroundColor: colors.background }]}>
        <View style={styles.titleRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [
              styles.hit,
              { backgroundColor: pressed ? colors.surface2 : 'transparent' },
            ]}
          >
            <StitchIcon name="arrow_back" size={24} colorKey="text" />
          </Pressable>
          <StitchText variant="h1" colorKey="text">
            Notifications
          </StitchText>
        </View>
        <View style={[styles.avatar, { backgroundColor: colors.surface2 }]}>
          {user &&
          typeof user.user_metadata?.avatar_url === 'string' &&
          user.user_metadata.avatar_url.length > 0 ? (
            <Image
              source={{ uri: user.user_metadata.avatar_url }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
              accessible={false}
            />
          ) : (
            <StitchText variant="label" colorKey="primaryContainer">
              {user
                ? initialsFromUser(user.full_name ?? undefined, user.email ?? undefined)
                : '?'}
            </StitchText>
          )}
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: spacing.pageMarginMobile,
          paddingBottom: spacing.xxl + spacing.lg,
        }}
      >
        <View style={styles.hero}>
          <View style={styles.heroCircle}>
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: `${colors.accentHighlight}80` },
              ]}
            />
            <Image
              source={{
                uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCOf6iEkVsvsITYI6Z_7B7-4WvwS7mjZL5aI9BpEK88JcjBL5-5s-exqIfKTdZ85UBEX0G3eRqBscLFC_k2APxQdEHlwhbA1p1rLhiTfSYeqPor6v0mESqcAJg3WcFDK84JVBJTrDL5nEZCm47BMUQ8Zp3H_15llmcbq5T-0V7XtKk-_7hbDIF1JiPmUlbFdRvA9yonEs4uYnRop-Q6UDlnxBGsatPrL5GcQE5eaeIsZV4kZu0hy4zhgUBEsqGNdQSkOR8VvGZqXgI',
              }}
              style={{ width: '90%', height: '90%' }}
              resizeMode="contain"
              accessible={false}
            />
          </View>
          <StitchText variant="h2" colorKey="text" style={{ marginBottom: spacing.sm }}>
            All caught up
          </StitchText>
          <StitchText variant="body-md" colorKey="textMuted" style={{ textAlign: 'center', maxWidth: 280 }}>
            You have no new alerts at the moment. Manage how we reach you below.
          </StitchText>
        </View>

        <View style={{ marginTop: spacing.xl }}>
          <View style={styles.prefHeader}>
            <StitchText variant="label-caps" colorKey="textMuted">
              Alert Preferences
            </StitchText>
          </View>
          <StitchCard padding="none" style={{ overflow: 'hidden' }}>
            <View style={styles.row}>
              <View style={{ flex: 1, gap: 4, paddingRight: spacing.sm }}>
                <StitchText variant="h3" colorKey="text">
                  Push Notifications
                </StitchText>
                <StitchText variant="body-sm" colorKey="textMuted">
                  Instant updates on your device
                </StitchText>
              </View>
              <Switch
                value={pushOn}
                onValueChange={setPushOn}
                trackColor={trackColor}
                thumbColor={colors.surface}
              />
            </View>
            <View style={styles.row}>
              <View style={{ flex: 1, gap: 4, paddingRight: spacing.sm }}>
                <StitchText variant="h3" colorKey="text">
                  Email Alerts
                </StitchText>
                <StitchText variant="body-sm" colorKey="textMuted">
                  Daily summaries and special offers
                </StitchText>
              </View>
              <Switch
                value={emailOn}
                onValueChange={setEmailOn}
                trackColor={trackColor}
                thumbColor={colors.surface}
              />
            </View>
            <View style={[styles.row, styles.rowLast]}>
              <View style={{ flex: 1, gap: 4, paddingRight: spacing.sm }}>
                <StitchText variant="h3" colorKey="text">
                  SMS Messages
                </StitchText>
                <StitchText variant="body-sm" colorKey="textMuted">
                  Urgent order tracking only
                </StitchText>
              </View>
              <Switch
                value={smsOn}
                onValueChange={onSmsChange}
                trackColor={trackColor}
                thumbColor={colors.surface}
              />
            </View>
          </StitchCard>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
