import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RootStackParamList } from '@/navigation/types';
import { useAuthContext } from '@/context/AuthContext';
import { getSupabase } from '@/lib/supabase';
import { avatarPath, pickAndUploadImage } from '@/lib/storage/uploadImage';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import { stitchAmbientShadow, stitchFonts } from '@/theme/stitchTokens';
import {
  StitchButton,
  StitchCard,
  StitchIcon,
  StitchText,
} from '@/ui/stitch';
import { logError } from '@/observability/logError';

const COUNTRY_CODES = ['+94', '+1', '+44'] as const;
const RESCUE_AREAS = [
  'Colombo 03',
  'Colombo 04',
  'Colombo 07',
  'Mount Lavinia',
  'Dehiwala',
] as const;

/**
 * Split a stored phone string like "+9477 123 4567" into `{ countryCode, local }`.
 * Defaults to `+94` if the input doesn't include a country code prefix.
 */
function splitPhone(stored: string | null | undefined): {
  countryCode: (typeof COUNTRY_CODES)[number];
  local: string;
} {
  const v = (stored ?? '').trim();
  for (const code of COUNTRY_CODES) {
    if (v.startsWith(code)) {
      return { countryCode: code, local: v.slice(code.length).trim() };
    }
  }
  return { countryCode: '+94', local: v };
}

function initialsFromUser(name: string | undefined, email: string | undefined) {
  const base = (name ?? email ?? '?').trim();
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
  }
  return base.slice(0, 2).toUpperCase() || '?';
}

export function ProfileDetailsScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList, 'ProfileDetails'>>();
  const { env, user, refreshProfile } = useAuthContext();
  const { colors, radii, spacing } = useStitchTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 480;

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneLocal, setPhoneLocal] = useState('');
  const [countryCode, setCountryCode] = useState<(typeof COUNTRY_CODES)[number]>('+94');
  const [area, setArea] = useState<(typeof RESCUE_AREAS)[number]>('Colombo 03');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [codePickerOpen, setCodePickerOpen] = useState(false);
  const [areaPickerOpen, setAreaPickerOpen] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    if (!user) return;
    setFullName(user.full_name?.trim() ?? '');
    setEmail(user.email ?? '');
    let cancelled = false;
    (async () => {
      const sb = getSupabase(env);
      const { data } = await sb
        .from('profiles')
        .select('phone, city, avatar_url')
        .eq('id', user.id)
        .maybeSingle();
      if (cancelled) return;
      const { countryCode: cc, local } = splitPhone(
        typeof data?.phone === 'string' ? data.phone : '',
      );
      setCountryCode(cc);
      setPhoneLocal(local || '');
      const city =
        typeof data?.city === 'string' && data.city.trim().length > 0
          ? data.city.trim()
          : '';
      const matched = RESCUE_AREAS.find((a) => a === city);
      if (matched) setArea(matched);
      const storedAvatar =
        typeof data?.avatar_url === 'string' && data.avatar_url.length > 0
          ? data.avatar_url
          : typeof user.user_metadata?.avatar_url === 'string' &&
            user.user_metadata.avatar_url.length > 0
            ? user.user_metadata.avatar_url
            : null;
      setAvatarUrl(storedAvatar);
    })().catch((err) => logError(err, { context: 'ProfileDetailsScreen.op' }));
    return () => {
      cancelled = true;
    };
  }, [env, user]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1 },
        topBar: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.md,
          height: 56,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: `${colors.divider}99`,
        },
        hit: {
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
        },
        scrollContent: {
          paddingHorizontal: spacing.pageMarginMobile,
          paddingTop: spacing.lg,
          paddingBottom: spacing.xxl + spacing.lg,
          gap: spacing.lg,
        },
        photoCard: {
          alignItems: 'center',
          gap: spacing.md,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: `${colors.divider}66`,
          overflow: 'hidden',
        },
        photoInner: { alignItems: 'center', gap: spacing.md },
        avatarWrap: { position: 'relative' },
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
        fabEdit: {
          position: 'absolute',
          right: 0,
          bottom: 0,
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: colors.primaryContainer,
          borderWidth: 2,
          borderColor: colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
          ...stitchAmbientShadow,
        },
        formBlock: { gap: spacing.md },
        sectionTitle: {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: `${colors.divider}80`,
          paddingBottom: spacing.sm,
        },
        field: { gap: spacing.xs },
        inputRow: {
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: 48,
          borderWidth: 1,
          borderRadius: radii.lg,
          borderColor: colors.outlineVariant,
          backgroundColor: colors.surface,
          paddingHorizontal: spacing.md,
        },
        inputIconPad: { paddingLeft: 28 },
        phoneRow: { flexDirection: 'row', alignItems: 'stretch' },
        codeBtn: {
          width: 96,
          borderWidth: 1,
          borderRightWidth: 0,
          borderColor: colors.outlineVariant,
          borderTopLeftRadius: radii.lg,
          borderBottomLeftRadius: radii.lg,
          backgroundColor: colors.surfaceContainerLow,
          justifyContent: 'center',
          paddingHorizontal: spacing.sm,
        },
        phoneInput: {
          flex: 1,
          borderWidth: 1,
          borderColor: colors.outlineVariant,
          borderTopRightRadius: radii.lg,
          borderBottomRightRadius: radii.lg,
          backgroundColor: colors.surface,
          paddingHorizontal: spacing.md,
          minHeight: 48,
        },
        actions: {
          flexDirection: wide ? 'row' : 'column',
          gap: spacing.md,
          paddingTop: spacing.lg,
        },
      }),
    [colors, radii, spacing, wide],
  );

  const inputTypography = useMemo(
    () => ({
      fontFamily: stitchFonts.regular,
      fontSize: 15,
      lineHeight: 22,
      color: colors.text,
      flex: 1,
      paddingVertical: spacing.sm,
      minHeight: 48,
    }),
    [colors.text, spacing.sm],
  );

  const onSave = useCallback(async () => {
    if (!user) return;
    setSaving(true);
    try {
      const sb = getSupabase(env);
      const trimmedLocal = phoneLocal.trim();
      const fullPhone = trimmedLocal ? `${countryCode}${trimmedLocal}` : null;
      if (!fullPhone) {
        const { count } = await sb
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('customer_id', user.id)
          .in('order_status', ['reserved', 'paid', 'ready_for_pickup']);
        if ((count ?? 0) > 0) {
          Alert.alert(
            'Phone required',
            'You have active orders. Keep a phone number on your profile so merchants can reach you at pickup.',
          );
          return;
        }
      }
      const { error } = await sb
        .from('profiles')
        .update({
          full_name: fullName.trim() || null,
          phone: fullPhone,
          city: area,
          avatar_url: avatarUrl,
        })
        .eq('id', user.id);
      if (error) {
        Alert.alert('Could not save', error.message);
        return;
      }
      await refreshProfile();
      Alert.alert('Saved', 'Your profile was updated.');
    } finally {
      setSaving(false);
    }
  }, [
    area,
    avatarUrl,
    countryCode,
    env,
    fullName,
    phoneLocal,
    refreshProfile,
    user,
  ]);

  const onPickAvatar = useCallback(async () => {
    if (!user?.id) {
      Alert.alert('Sign in required', 'Sign in to change your profile photo.');
      return;
    }
    setUploadingAvatar(true);
    try {
      const result = await pickAndUploadImage({
        env,
        bucket: 'avatars',
        path: avatarPath(user.id),
      });
      if (result.kind === 'uploaded') {
        setAvatarUrl(result.publicUrl);
      } else if (result.kind === 'error') {
        Alert.alert('Upload failed', result.message);
      }
    } finally {
      setUploadingAvatar(false);
    }
  }, [env, user?.id]);

  const pickModalStyle = useMemo(
    () => ({
      flex: 1,
      backgroundColor: `${colors.inverseSurface}66`,
      justifyContent: 'flex-end' as const,
    }),
    [colors.inverseSurface],
  );

  const pickSheet = useMemo(
    () => ({
      backgroundColor: colors.surface,
      borderTopLeftRadius: radii.xl,
      borderTopRightRadius: radii.xl,
      padding: spacing.lg,
      gap: spacing.sm,
      maxHeight: '70%' as const,
    }),
    [colors.surface, radii.xl, spacing.lg, spacing.sm],
  );

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <View style={[styles.topBar, { backgroundColor: colors.background }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [
            styles.hit,
            { backgroundColor: pressed ? colors.surface2 : 'transparent' },
          ]}
        >
          <StitchIcon name="arrow_back" size={24} colorKey="primaryContainer" />
        </Pressable>
        <StitchText variant="h2" colorKey="primaryContainer" style={{ letterSpacing: -0.3 }}>
          Edit Profile
        </StitchText>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {!user ? (
          <StitchCard style={styles.photoCard}>
            <StitchText variant="body-md" colorKey="textMuted" style={{ textAlign: 'center' }}>
              Sign in to edit your profile and rescue preferences.
            </StitchText>
            <StitchButton title="Sign in" onPress={() => navigation.navigate('Login')} />
          </StitchCard>
        ) : (
          <>
            <StitchCard elevated padding="md" style={styles.photoCard}>
              <View
                style={[StyleSheet.absoluteFill, { backgroundColor: `${colors.primaryHighlight}33` }]}
              />
              <View style={styles.photoInner}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Change profile photo"
                  accessibilityState={{
                    busy: uploadingAvatar,
                    disabled: uploadingAvatar,
                  }}
                  disabled={uploadingAvatar}
                  onPress={() => {
                    void onPickAvatar();
                  }}
                  style={styles.avatarWrap}
                >
                  <View
                    style={[
                      styles.avatar,
                      { backgroundColor: colors.surface2 },
                    ]}
                  >
                    {avatarUrl && avatarUrl.length > 0 ? (
                      <Image
                        source={{ uri: avatarUrl }}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode="cover"
                      />
                    ) : (
                      <StitchText variant="h1" colorKey="primaryContainer">
                        {initialsFromUser(
                          user.full_name ?? undefined,
                          user.email ?? undefined,
                        )}
                      </StitchText>
                    )}
                    {uploadingAvatar ? (
                      <View
                        style={[
                          StyleSheet.absoluteFill,
                          {
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: `${colors.inverseSurface}66`,
                          },
                        ]}
                      >
                        <ActivityIndicator color={colors.onPrimary} />
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.fabEdit}>
                    <StitchIcon name="edit" size={18} colorKey="onPrimary" />
                  </View>
                </Pressable>
                <View style={{ alignItems: 'center', gap: 2 }}>
                  <StitchText
                    variant="body-sm"
                    colorKey="textMuted"
                    style={{ textAlign: 'center' }}
                  >
                    {uploadingAvatar
                      ? 'Uploading photo…'
                      : 'Tap to update your photo'}
                  </StitchText>
                  <StitchText
                    variant="body-sm"
                    colorKey="textMuted"
                    style={{ textAlign: 'center', fontSize: 11 }}
                  >
                    JPG / PNG, ~5MB max
                  </StitchText>
                </View>
              </View>
            </StitchCard>

            <StitchCard elevated padding="lg" style={{ borderWidth: StyleSheet.hairlineWidth, borderColor: `${colors.divider}66` }}>
              <View style={styles.formBlock}>
                <View style={styles.sectionTitle}>
                  <StitchText variant="h3" colorKey="text">
                    Personal Information
                  </StitchText>
                </View>

                <View style={styles.field}>
                  <StitchText variant="label" colorKey="text">
                    Full Name
                  </StitchText>
                  <View style={styles.inputRow}>
                    <View style={{ position: 'absolute', left: spacing.md, top: 13 }}>
                      <StitchIcon name="person" size={20} colorKey="textMuted" />
                    </View>
                    <TextInput
                      value={fullName}
                      onChangeText={setFullName}
                      placeholder="Enter your full name"
                      placeholderTextColor={colors.textMuted}
                      style={[inputTypography, styles.inputIconPad]}
                      autoCapitalize="words"
                      autoCorrect
                    />
                  </View>
                </View>

                <View style={styles.field}>
                  <StitchText variant="label" colorKey="text">
                    Email Address
                  </StitchText>
                  <View style={styles.inputRow}>
                    <View style={{ position: 'absolute', left: spacing.md, top: 13 }}>
                      <StitchIcon name="mail" size={20} colorKey="textMuted" />
                    </View>
                    <TextInput
                      value={email}
                      editable={false}
                      placeholder="Enter your email"
                      placeholderTextColor={colors.textMuted}
                      style={[inputTypography, styles.inputIconPad, { opacity: 0.85 }]}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>
                </View>

                <View style={styles.field}>
                  <StitchText variant="label" colorKey="text">
                    Phone Number
                  </StitchText>
                  <View style={styles.phoneRow}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => setCodePickerOpen(true)}
                      style={({ pressed }) => [
                        styles.codeBtn,
                        pressed && { opacity: 0.9 },
                      ]}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <StitchText variant="body-md" colorKey="text">
                          {countryCode}
                        </StitchText>
                        <StitchIcon name="expand_more" size={20} colorKey="textMuted" />
                      </View>
                    </Pressable>
                    <TextInput
                      value={phoneLocal}
                      onChangeText={setPhoneLocal}
                      placeholder="77 123 4567"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="phone-pad"
                      style={[inputTypography, styles.phoneInput]}
                    />
                  </View>
                  <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: 4, fontSize: 12 }}>
                    Used for order updates and recovery.
                  </StitchText>
                </View>
              </View>

              <View style={[styles.formBlock, { paddingTop: spacing.sm }]}>
                <View style={styles.sectionTitle}>
                  <StitchText variant="h3" colorKey="text">
                    Location Preferences
                  </StitchText>
                </View>
                <View style={styles.field}>
                  <StitchText variant="label" colorKey="text">
                    Default Rescue Area
                  </StitchText>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setAreaPickerOpen(true)}
                    style={({ pressed }) => [
                      styles.inputRow,
                      pressed && { opacity: 0.95 },
                    ]}
                  >
                    <View style={{ position: 'absolute', left: spacing.md, top: 13 }}>
                      <StitchIcon name="location_on" size={20} colorKey="textMuted" />
                    </View>
                    <StitchText variant="body-md" colorKey="text" style={[styles.inputIconPad, { flex: 1 }]}>
                      {area}
                    </StitchText>
                    <StitchIcon name="expand_more" size={22} colorKey="textMuted" />
                  </Pressable>
                </View>
              </View>

              <View style={styles.actions}>
                <View style={wide ? { flex: 2 } : { alignSelf: 'stretch' }}>
                  <StitchButton title="Save Changes" loading={saving} onPress={() => void onSave()} />
                </View>
                <View style={wide ? { flex: 1 } : { alignSelf: 'stretch' }}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => navigation.goBack()}
                    style={({ pressed }) => ({
                      minHeight: 48,
                      borderRadius: radii.lg,
                      borderWidth: 1.5,
                      borderColor: colors.primaryContainer,
                      backgroundColor: 'transparent',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: pressed ? 0.92 : 1,
                    })}
                  >
                    <StitchText variant="label" colorKey="primaryContainer">
                      Cancel
                    </StitchText>
                  </Pressable>
                </View>
              </View>

              <View style={{ paddingTop: spacing.sm, alignItems: 'center' }}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    Alert.alert(
                      'Delete account',
                      'Contact support or use the web app to delete your account.',
                    )
                  }
                >
                  <StitchText variant="label" colorKey="error">
                    Delete Account
                  </StitchText>
                </Pressable>
              </View>
            </StitchCard>
          </>
        )}
      </ScrollView>

      <Modal transparent visible={codePickerOpen} animationType="fade">
        <Pressable style={pickModalStyle} onPress={() => setCodePickerOpen(false)}>
          <Pressable style={pickSheet} onPress={(e) => e.stopPropagation()}>
            <StitchText variant="h3" colorKey="text">
              Country code
            </StitchText>
            {COUNTRY_CODES.map((c) => (
              <Pressable
                key={c}
                onPress={() => {
                  setCountryCode(c);
                  setCodePickerOpen(false);
                }}
                style={{ paddingVertical: spacing.sm }}
              >
                <StitchText
                  variant="body-md"
                  colorKey={c === countryCode ? 'primaryContainer' : 'text'}
                >
                  {c}
                </StitchText>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal transparent visible={areaPickerOpen} animationType="fade">
        <Pressable style={pickModalStyle} onPress={() => setAreaPickerOpen(false)}>
          <Pressable style={pickSheet} onPress={(e) => e.stopPropagation()}>
            <StitchText variant="h3" colorKey="text">
              Default rescue area
            </StitchText>
            {RESCUE_AREAS.map((a) => (
              <Pressable
                key={a}
                onPress={() => {
                  setArea(a);
                  setAreaPickerOpen(false);
                }}
                style={{ paddingVertical: spacing.sm }}
              >
                <StitchText
                  variant="body-md"
                  colorKey={a === area ? 'primaryContainer' : 'text'}
                >
                  {a}
                </StitchText>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
