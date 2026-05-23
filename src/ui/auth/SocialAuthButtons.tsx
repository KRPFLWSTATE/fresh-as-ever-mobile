import React, { useEffect, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { StitchText } from '@/ui/stitch';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import { stitchFonts } from '@/theme/stitchTokens';

export type SocialAuthButtonsProps = {
  busy: boolean;
  onGoogle: () => void;
  onApple: () => void;
};

export function SocialAuthButtons({
  busy,
  onGoogle,
  onApple,
}: SocialAuthButtonsProps): React.ReactElement {
  const { colors, spacing, radii } = useStitchTheme();
  const [showApple, setShowApple] = useState(Platform.OS === 'ios');

  useEffect(() => {
    if (Platform.OS !== 'ios') {
      setShowApple(false);
      return;
    }
    void AppleAuthentication.isAvailableAsync()
      .then(setShowApple)
      .catch(() => setShowApple(false));
  }, []);

  const buttonBase = {
    minHeight: 48,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: spacing.md,
    opacity: busy ? 0.6 : 1,
  };

  return (
    <View style={{ gap: spacing.sm }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          marginBottom: spacing.xs,
        }}
      >
        <View style={{ flex: 1, height: 1, backgroundColor: colors.divider }} />
        <StitchText variant="label" colorKey="textMuted">
          Or continue with
        </StitchText>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.divider }} />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Continue with Google"
        disabled={busy}
        onPress={onGoogle}
        style={({ pressed }) => [
          buttonBase,
          pressed && !busy ? { backgroundColor: colors.surfaceContainer } : null,
        ]}
      >
        <StitchText
          variant="label"
          colorKey="text"
          style={{ fontFamily: stitchFonts.semiBold }}
        >
          Continue with Google
        </StitchText>
      </Pressable>

      {showApple ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Continue with Apple"
          disabled={busy}
          onPress={onApple}
          style={({ pressed }) => [
            buttonBase,
            {
              backgroundColor: colors.text,
              borderColor: colors.text,
            },
            pressed && !busy ? { opacity: 0.88 } : null,
          ]}
        >
          <StitchText
            variant="label"
            colorKey="onPrimary"
            style={{ fontFamily: stitchFonts.semiBold, color: colors.surface }}
          >
            Continue with Apple
          </StitchText>
        </Pressable>
      ) : null}
    </View>
  );
}
