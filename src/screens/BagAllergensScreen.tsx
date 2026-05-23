import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import type { RootStackParamList } from '@/navigation/types';
import { bagAllergenParams } from '@/contracts/routeParams';
import { getSupabase } from '@/lib/supabase';
import { useAuthContext } from '@/context/AuthContext';
import { inferBagAllergensFromText } from '@/lib/bagAllergensFromText';
import type { StitchResolvedPalette } from '@/theme/StitchThemeContext';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import {
  StitchDivider,
  StitchIcon,
  type StitchIconName,
  StitchText,
} from '@/ui/stitch';
import { logError } from '@/observability/logError';

type IconTone = keyof Pick<
  StitchResolvedPalette,
  | 'tertiary'
  | 'primaryHover'
  | 'secondary'
  | 'darkAccent'
  | 'success'
  | 'onSurface'
>;

function allergenRowVisual(
  label: string,
): { icon: StitchIconName; colorKey: IconTone } {
  const l = label.toLowerCase();
  if (l.includes('gluten') || l.includes('wheat')) {
    return { icon: 'grass', colorKey: 'tertiary' };
  }
  if (l.includes('dairy') || l.includes('milk') || l.includes('cheese')) {
    return { icon: 'water_drop', colorKey: 'primaryHover' };
  }
  if (l.includes('nut') || l.includes('peanut') || l.includes('almond')) {
    return { icon: 'eco', colorKey: 'secondary' };
  }
  if (l.includes('egg')) {
    return { icon: 'egg', colorKey: 'darkAccent' };
  }
  if (l.includes('soy')) {
    return { icon: 'nutrition', colorKey: 'success' };
  }
  return { icon: 'info', colorKey: 'onSurface' };
}

function dietaryFlags(title: string, notes: string) {
  const t = `${title} ${notes}`.toLowerCase();
  return {
    vegan: /vegan|plant-based|plant based/.test(t),
    vegetarian: /vegetarian|veggie/.test(t),
    halal: /\bhalal\b/.test(t),
  };
}

export function BagAllergensScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'BagAllergens'>>();
  const parsed = bagAllergenParams.safeParse(route.params);
  const bagId = parsed.success ? parsed.data.bagId : '';
  const { env } = useAuthContext();
  const { colors, spacing, radii } = useStitchTheme();
  const insets = useSafeAreaInsets();

  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const styles = useMemo(
    () =>
      createStyles({
        colors,
        spacing,
        radii,
        bottomInset: insets.bottom,
      }),
    [colors, spacing, radii, insets.bottom],
  );

  const load = useCallback(async () => {
    if (!bagId) return;
    const sb = getSupabase(env);
    setLoading(true);
    setErr(null);
    try {
      const { data, error } = await sb
        .from('rescue_bags')
        .select('title, notes')
        .eq('id', bagId)
        .maybeSingle();
      if (error) {
        throw error;
      }
      setTitle(typeof data?.title === 'string' ? data.title : '');
      setNotes(typeof data?.notes === 'string' ? data.notes : '');
    } catch {
      setErr('Could not load bag.');
      setTitle('');
      setNotes('');
    } finally {
      setLoading(false);
    }
  }, [bagId, env]);

  useEffect(() => {
    if (!parsed.success || !bagId) {
      return;
    }
    load().catch((e) => logError(e, { context: 'BagAllergensScreen.load' }));
  }, [parsed.success, bagId, load]);

  const { allergens } = inferBagAllergensFromText(title, notes);
  const flags = dietaryFlags(title, notes);

  const suitability = useMemo(
    () => [
      {
        positiveLabel: 'Vegan',
        negativeLabel: 'Not Vegan',
        satisfied: flags.vegan,
      },
      {
        positiveLabel: 'Vegetarian',
        negativeLabel: 'Not Vegetarian',
        satisfied: flags.vegetarian,
      },
      {
        positiveLabel: 'Halal Certified',
        negativeLabel: 'Not Halal Certified',
        satisfied: flags.halal,
      },
    ],
    [flags.halal, flags.vegan, flags.vegetarian],
  );

  if (!parsed.success) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <StitchText variant="body-md" colorKey="onSurface">
          Missing bag reference.
        </StitchText>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primaryContainer} />
      </View>
    );
  }

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: spacing.pageMarginMobile,
          paddingBottom: 120 + insets.bottom,
        }}
      >
        <View style={styles.handleWrap}>
          <View
            style={[
              styles.handle,
              { backgroundColor: colors.surfaceVariant },
            ]}
          />
        </View>

        <View style={styles.headRow}>
          <View style={{ flex: 1, paddingRight: spacing.sm }}>
            <StitchText variant="h2" colorKey="text">
              Allergen & Dietary Info
            </StitchText>
            <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: 4 }}>
              Please review carefully before reserving.
            </StitchText>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [
              styles.iconHit,
              {
                backgroundColor: pressed ? colors.surface2 : 'transparent',
              },
            ]}
          >
            <StitchIcon name="close" size={22} colorKey="textMuted" />
          </Pressable>
        </View>

        {err ? (
          <StitchText variant="body-sm" colorKey="error" style={{ marginBottom: spacing.md }}>
            {err}
          </StitchText>
        ) : null}

        <View
          style={[
            styles.warningBanner,
            {
              backgroundColor: colors.surface2,
              borderColor: colors.divider,
            },
          ]}
        >
          <StitchIcon name="info" size={22} colorKey="primaryContainer" />
          <StitchText variant="body-sm" colorKey="onSurfaceVariant" style={{ flex: 1 }}>
            As rescue bags contain surplus food, we cannot guarantee items are entirely
            free from cross-contamination. Consume at your own discretion.
          </StitchText>
        </View>

        <StitchText
          variant="label-caps"
          colorKey="textMuted"
          style={{ marginBottom: spacing.md, marginTop: spacing.sm }}
        >
          Contains or may contain
        </StitchText>

        <View style={{ gap: spacing.sm }}>
          {allergens.map((a) => {
            const v = allergenRowVisual(a);
            return (
              <View
                key={a}
                style={[
                  styles.allergenRow,
                  {
                    borderColor: colors.surfaceVariant,
                  },
                ]}
              >
                <View
                  style={[
                    styles.allergenGlyph,
                    { backgroundColor: colors.surface2 },
                  ]}
                >
                  <StitchIcon name={v.icon} size={22} colorKey={v.colorKey} />
                </View>
                <StitchText variant="label" colorKey="text" style={{ flex: 1 }}>
                  {a}
                </StitchText>
              </View>
            );
          })}
        </View>

        <StitchDivider style={{ marginVertical: spacing.lg }} />

        <StitchText variant="label-caps" colorKey="textMuted" style={{ marginBottom: spacing.md }}>
          Dietary Suitability
        </StitchText>

        <View style={styles.dietWrap}>
          {suitability.map((row) => (
            <View
              key={row.positiveLabel}
              style={[
                styles.dietChip,
                {
                  backgroundColor: colors.surface2,
                  borderColor: colors.surfaceVariant,
                },
                !row.satisfied ? styles.dietChipMuted : null,
              ]}
            >
              <StitchIcon
                name={row.satisfied ? 'check_circle' : 'close'}
                size={18}
                colorKey={row.satisfied ? 'success' : 'onSurface'}
              />
              <StitchText variant="label" colorKey="text">
                {row.satisfied ? row.positiveLabel : row.negativeLabel}
              </StitchText>
            </View>
          ))}
        </View>
      </ScrollView>

      <View
        style={[
          styles.bottomDock,
          {
            borderTopColor: colors.divider,
            backgroundColor: colors.surface,
            paddingBottom: Math.max(insets.bottom, spacing.md),
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [
            styles.primaryAck,
            {
              backgroundColor: colors.primary,
              opacity: pressed ? 0.94 : 1,
            },
          ]}
        >
          <StitchText variant="label" colorKey="onPrimary">
            I understand
          </StitchText>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function createStyles(p: {
  colors: ReturnType<typeof useStitchTheme>['colors'];
  spacing: ReturnType<typeof useStitchTheme>['spacing'];
  radii: ReturnType<typeof useStitchTheme>['radii'];
  bottomInset: number;
}) {
  const { colors, spacing, radii } = p;
  return StyleSheet.create({
    root: { flex: 1 },
    center: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.lg,
    },
    handleWrap: {
      alignItems: 'center',
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
    },
    handle: {
      width: 48,
      height: 6,
      borderRadius: radii.full,
    },
    headRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    iconHit: {
      width: 40,
      height: 40,
      borderRadius: radii.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    warningBanner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: radii.lg,
      borderWidth: StyleSheet.hairlineWidth,
      marginBottom: spacing.lg,
    },
    allergenRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: radii.lg,
      borderWidth: StyleSheet.hairlineWidth,
      backgroundColor: colors.surface,
    },
    allergenGlyph: {
      width: 40,
      height: 40,
      borderRadius: radii.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dietWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginBottom: spacing.xl,
    },
    dietChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radii.full,
      borderWidth: StyleSheet.hairlineWidth,
    },
    dietChipMuted: {
      opacity: 0.55,
    },
    bottomDock: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      borderTopWidth: StyleSheet.hairlineWidth,
      paddingHorizontal: spacing.pageMarginMobile,
      paddingTop: spacing.md,
      ...Platform.select({
        ios: {
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.06,
          shadowRadius: 12,
        },
        android: { elevation: 10 },
      }),
    },
    primaryAck: {
      width: '100%',
      minHeight: 48,
      borderRadius: radii.default,
      alignItems: 'center',
      justifyContent: 'center',
      ...Platform.select({
        ios: {
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 6,
        },
        android: { elevation: 2 },
      }),
    },
  });
}
