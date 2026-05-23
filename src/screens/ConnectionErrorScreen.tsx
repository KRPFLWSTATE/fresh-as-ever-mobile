import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import type { RootStackParamList } from '@/navigation/types';
import { useAuthContext } from '@/context/AuthContext';
import { getSupabase } from '@/lib/supabase';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import { stitchAmbientShadow } from '@/theme/stitchTokens';
import { StitchIcon } from '@/ui/stitch/StitchIcon';
import { StitchText } from '@/ui/stitch/StitchText';
import { logError } from '@/observability/logError';
import { ERROR } from '@/lib/messages/errors';
import { mapSupabaseError } from '@/lib/supabaseError';

export function ConnectionErrorScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { env } = useAuthContext();
  const { colors, spacing, radii } = useStitchTheme();
  const [probing, setProbing] = useState(false);
  const [probeError, setProbeError] = useState<string | null>(null);
  const retryAttempt = useRef(0);
  const maxRetries = 3;

  const tryAgain = useCallback(async () => {
    const attempt = retryAttempt.current;
    if (attempt >= maxRetries) {
      setProbeError(ERROR.common.network);
      return;
    }
    if (attempt > 0) {
      const delayMs = Math.min(1000 * 2 ** (attempt - 1), 8000);
      await new Promise<void>((resolve) => {
        setTimeout(resolve, delayMs);
      });
    }
    setProbing(true);
    setProbeError(null);
    try {
      const sb = getSupabase(env);
      const { error } = await sb
        .from('outlets')
        .select('id', { count: 'exact', head: true })
        .limit(1);
      if (error) {
        retryAttempt.current = attempt + 1;
        setProbeError(mapSupabaseError(error, ERROR.common.network));
        return;
      }
      retryAttempt.current = 0;
      navigation.navigate('MainTabs');
    } catch (e) {
      retryAttempt.current = attempt + 1;
      setProbeError(mapSupabaseError(e as Error, ERROR.common.network));
    } finally {
      setProbing(false);
    }
  }, [env, navigation]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        flex: {
          flex: 1,
          backgroundColor: colors.background,
          paddingHorizontal: spacing.md,
          justifyContent: 'center',
          alignItems: 'center',
        },
        max: { width: '100%', maxWidth: 448, alignItems: 'center', gap: spacing.lg },
        halo: {
          width: 192,
          height: 192,
          marginBottom: spacing.sm,
          alignItems: 'center',
          justifyContent: 'center',
        },
        glow: {
          position: 'absolute',
          width: 192,
          height: 192,
          borderRadius: 96,
          backgroundColor: colors.primaryHighlight,
          opacity: 0.2,
        },
        iconDisc: {
          width: 128,
          height: 128,
          borderRadius: 64,
          backgroundColor: colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: `${colors.surfaceVariant}80`,
          ...stitchAmbientShadow,
        },
        textBlock: { gap: spacing.sm, alignItems: 'center' },
        tryBtn: {
          width: '100%',
          minHeight: 48,
          marginTop: spacing.md,
          borderRadius: radii.lg,
          backgroundColor: colors.primaryContainer,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
          paddingHorizontal: spacing.md,
        },
      }),
    [colors, radii, spacing],
  );

  return (
    <View style={styles.flex}>
      <View style={styles.max}>
        <View style={styles.halo}>
          <View style={styles.glow} />
          <View style={styles.iconDisc}>
            <StitchIcon name="wifi_off" size={64} colorKey="primaryContainer" />
          </View>
        </View>
        <View style={styles.textBlock}>
          <StitchText variant="display" colorKey="onSurface" style={{ textAlign: 'center' }}>
            Connection Lost
          </StitchText>
          <StitchText
            variant="body-lg"
            colorKey="textMuted"
            style={{ textAlign: 'center', maxWidth: 360 }}
          >
            {
              "Oops! It looks like you're offline. Please check your internet connection and try again."
            }
          </StitchText>
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={probing}
          style={({ pressed }) => [
            styles.tryBtn,
            { opacity: probing ? 0.75 : pressed ? 0.92 : 1 },
          ]}
          onPress={() => {
            tryAgain().catch((err) => logError(err, { context: 'ConnectionErrorScreen.tryAgain' }));
          }}
        >
          {probing ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <>
              <StitchIcon name="refresh" size={22} colorKey="onPrimary" />
              <StitchText variant="label" colorKey="onPrimary">
                Try Again
              </StitchText>
            </>
          )}
        </Pressable>
        {probeError ? (
          <StitchText
            variant="body-sm"
            colorKey="error"
            style={{ textAlign: 'center', marginTop: spacing.sm }}
          >
            Still offline: {probeError}
          </StitchText>
        ) : null}
      </View>
    </View>
  );
}
