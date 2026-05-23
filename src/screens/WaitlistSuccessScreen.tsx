import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import type { RootStackParamList } from '@/navigation/types';
import { useAuthContext } from '@/context/AuthContext';
import { getSupabase } from '@/lib/supabase';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import { stitchAmbientShadow } from '@/theme/stitchTokens';
import { StitchButton } from '@/ui/stitch/StitchButton';
import { StitchIcon } from '@/ui/stitch/StitchIcon';
import { StitchText } from '@/ui/stitch/StitchText';
import { logError } from '@/observability/logError';

const HERO_URI =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuC1TlY1AC2Xf082ajqVo_fkN3vpdiVtOR1obrt7kbTQ_JKHK9ke8n1dKDzu9vdTQBe2Hp1rS0Xb6VjaR7i1kFVED5EGxzzsuhw_NdB5wP0sFU6xxZOmEWVbAiRYPur_hjmk0FxzR2HFzsYELuutgjKQRYS8B6W46lV-Ti3QveH8ge2VLa85Y4yyjgFri6NBMkgLDFRShKE1BVphjoLKPRNnMEoupIfbxUQqFTAaDnXCm6btFrXkAwnhRHtgboZ1eKyZPMA8kmTOyEk';

const FALLBACK_POSITION = 1241;

function formatPosition(rank: number): string {
  return `#${rank.toLocaleString('en-LK')}`;
}

/**
 * Animated overlay that pans a horizontal SVG LinearGradient across the position
 * card to mimic the Stitch HTML gradient wash. No native deps — RN `Animated` only.
 */
function GradientWash({ tint }: { tint: string }): React.ReactElement {
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(x, {
          toValue: 1,
          duration: 3200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(x, {
          toValue: 0,
          duration: 3200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [x]);

  const tx = x.interpolate({
    inputRange: [0, 1],
    outputRange: [-80, 80],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { transform: [{ translateX: tx }] }]}
    >
      <Svg height="100%" width="100%" viewBox="0 0 100 60" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="wash" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={tint} stopOpacity={0} />
            <Stop offset="0.5" stopColor={tint} stopOpacity={0.65} />
            <Stop offset="1" stopColor={tint} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="60" fill="url(#wash)" />
      </Svg>
    </Animated.View>
  );
}

function useWaitlistPosition(): { rank: number; total: number | null; loading: boolean } {
  const { env, user } = useAuthContext();
  const [rank, setRank] = useState<number>(FALLBACK_POSITION);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sb = getSupabase(env);
        const { count: totalCount } = await sb
          .from('waitlist_signups')
          .select('id', { count: 'exact', head: true });
        if (cancelled) return;
        if (typeof totalCount === 'number') setTotal(totalCount);
        const email = user?.email ?? null;
        if (!email) {
          if (typeof totalCount === 'number' && totalCount > 0) {
            setRank(totalCount);
          }
          return;
        }
        const { data: own } = await sb
          .from('waitlist_signups')
          .select('id, created_at')
          .eq('email', email)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();
        const createdAt = (own as { created_at?: string } | null)?.created_at;
        if (!createdAt) {
          if (typeof totalCount === 'number' && totalCount > 0) {
            setRank(totalCount);
          }
          return;
        }
        const { count: rankCount } = await sb
          .from('waitlist_signups')
          .select('id', { count: 'exact', head: true })
          .lte('created_at', createdAt);
        if (!cancelled && typeof rankCount === 'number' && rankCount > 0) {
          setRank(rankCount);
        }
      } catch {
        // keep fallback rank
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [env, user?.email]);

  return { rank, total, loading };
}

export function WaitlistSuccessScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors, spacing, radii } = useStitchTheme();
  const { rank, total } = useWaitlistPosition();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        scroll: { flex: 1, backgroundColor: colors.background },
        inner: {
          flexGrow: 1,
          maxWidth: 448,
          width: '100%',
          alignSelf: 'center',
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.xxl,
          alignItems: 'center',
        },
        hero: {
          width: '100%',
          maxWidth: 320,
          aspectRatio: 4 / 3,
          marginBottom: spacing.xl,
          borderRadius: radii.xl,
          overflow: 'hidden',
          backgroundColor: colors.surfaceContainerHighest,
          ...stitchAmbientShadow,
        },
        heroImg: { width: '100%', height: '100%' },
        positionCard: {
          width: '100%',
          borderRadius: radii.xl,
          padding: spacing.lg,
          marginBottom: spacing.xxl,
          alignItems: 'center',
          gap: spacing.xs,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: `${colors.divider}66`,
          backgroundColor: colors.surface,
          overflow: 'hidden',
          ...stitchAmbientShadow,
        },
        actions: { width: '100%', gap: spacing.sm },
        shareBtn: {
          width: '100%',
          minHeight: 48,
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
    <ScrollView
      contentContainerStyle={styles.inner}
      style={styles.scroll}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.hero}>
        <Image
          source={{ uri: HERO_URI }}
          style={styles.heroImg}
          resizeMode="cover"
          accessible={false}
        />
      </View>
      <StitchText variant="display" colorKey="text" style={{ textAlign: 'center', marginBottom: spacing.sm }}>
        {"You're on the list!"}
      </StitchText>
      <StitchText
        variant="body-md"
        colorKey="textMuted"
        style={{ textAlign: 'center', marginBottom: spacing.xl, maxWidth: 360 }}
      >
        {
          "Thank you for joining. We'll send you an invite as soon as a spot opens up to rescue premium meals in your area."
        }
      </StitchText>
      <View style={styles.positionCard}>
        <GradientWash tint={colors.primaryHighlight} />
        <StitchText variant="label-caps" colorKey="textMuted" style={{ zIndex: 1 }}>
          Your Position
        </StitchText>
        <StitchText variant="display" colorKey="primaryContainer" style={{ zIndex: 1 }}>
          {formatPosition(rank)}
        </StitchText>
        {total != null ? (
          <StitchText variant="body-sm" colorKey="textMuted" style={{ zIndex: 1 }}>
            of {total.toLocaleString('en-LK')} waiting
          </StitchText>
        ) : null}
      </View>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.shareBtn, { opacity: pressed ? 0.92 : 1 }]}
          onPress={() => {
            Share.share({
              message:
                "I'm on the Fresh As Ever waitlist—join me to rescue surplus meals.",
            }).catch((err) => logError(err, { context: 'WaitlistSuccessScreen.share' }));
          }}
        >
          <StitchIcon name="ios_share" size={20} colorKey="onPrimary" />
          <StitchText variant="label" colorKey="onPrimary">
            Share with Friends
          </StitchText>
        </Pressable>
        <StitchButton
          title="Return to Home"
          variant="secondary"
          onPress={() => navigation.navigate('MainTabs')}
          style={{ width: '100%', borderWidth: 1.5, borderColor: colors.primaryContainer }}
        />
      </View>
    </ScrollView>
  );
}
