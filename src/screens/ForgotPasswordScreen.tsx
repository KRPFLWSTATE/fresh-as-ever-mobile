import React, { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { useAuthContext } from '@/context/AuthContext';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import { stitchFonts } from '@/theme/stitchTokens';
import { StitchButton, StitchCard, StitchScreen, StitchText } from '@/ui/stitch';

export function ForgotPasswordScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { resetPasswordForEmail } = useAuthContext();
  const { colors, radii, spacing } = useStitchTheme();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function submit() {
    setErr(null);
    setInfo(null);
    setBusy(true);
    const r = await resetPasswordForEmail(email);
    setBusy(false);
    if (r.error) {
      setErr(r.error);
      return;
    }
    setInfo('If an account exists, a reset link was sent to your email.');
  }

  const inputStyle = {
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radii.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    fontSize: 15,
    fontFamily: stitchFonts.regular,
    color: colors.text,
    backgroundColor: colors.surface,
  };

  return (
    <StitchScreen scroll scrollProps={{ contentContainerStyle: { flexGrow: 1 } }}>
      <View
        style={{
          flex: 1,
          paddingHorizontal: spacing.pageMarginMobile,
          paddingVertical: spacing.xl,
          justifyContent: 'center',
          gap: spacing.md,
        }}
      >
        <View style={{ alignItems: 'center', marginBottom: spacing.sm }}>
          <StitchText variant="h1" colorKey="text">
            Forgot password
          </StitchText>
          <StitchText variant="body-md" colorKey="textMuted" style={{ marginTop: spacing.sm }}>
            Enter your email and we&apos;ll send a reset link.
          </StitchText>
        </View>

        {err ? (
          <StitchText variant="body-sm" colorKey="error" style={{ textAlign: 'center' }}>
            {err}
          </StitchText>
        ) : null}
        {info ? (
          <StitchText variant="body-sm" colorKey="primaryContainer" style={{ textAlign: 'center' }}>
            {info}
          </StitchText>
        ) : null}

        <StitchCard>
          <View style={{ gap: spacing.lg }}>
            <View style={{ gap: spacing.xs }}>
              <StitchText variant="label" colorKey="onSurfaceVariant">
                Email
              </StitchText>
              <TextInput
                placeholder="you@example.com"
                placeholderTextColor={colors.textFaint}
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                style={inputStyle}
              />
            </View>
            <StitchButton
              title="Send reset link"
              onPress={() => void submit()}
              disabled={busy}
              loading={busy}
            />
          </View>
        </StitchCard>

        <Pressable onPress={() => navigation.navigate('Login')} style={{ alignItems: 'center' }}>
          <StitchText variant="body-sm" colorKey="primaryContainer" style={{ fontFamily: stitchFonts.medium }}>
            Back to sign in
          </StitchText>
        </Pressable>
      </View>
    </StitchScreen>
  );
}
