/**
 * ProfileTheme — user-facing appearance picker. Three radio-style rows ("System
 * default", "Light", "Dark") on a single elevated surface, plus a preview chip
 * that reflects the resolved scheme so the user can see the choice apply live.
 *
 * The screen has no local state — it reads `themePreference` + the resolved
 * `colors` straight from `useStitchTheme()` and calls `setThemePreference(...)`
 * (which persists to AsyncStorage under `fae.themePreference.v1`) on tap. The
 * provider then re-renders every consumer with the new palette.
 */
import React, { useLayoutEffect, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RootStackParamList } from '@/navigation/types';
import {
  useStitchTheme,
  type ThemePreference,
} from '@/theme/StitchThemeContext';
import { logError } from '@/observability/logError';
import {
  StitchIcon,
  StitchSurface,
  StitchText,
  type StitchIconName,
} from '@/ui/stitch';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ProfileTheme'>;

type ThemeOption = {
  value: ThemePreference;
  label: string;
  description: string;
  icon: StitchIconName;
};

const THEME_OPTIONS: readonly ThemeOption[] = [
  {
    value: 'system',
    label: 'System default',
    description: 'Follow your device setting',
    icon: 'brightness_auto',
  },
  {
    value: 'light',
    label: 'Light',
    description: 'Bright, daytime palette',
    icon: 'light_mode',
  },
  {
    value: 'dark',
    label: 'Dark',
    description: 'Easier on the eyes after sundown',
    icon: 'dark_mode',
  },
] as const;

export function preferenceLabel(pref: ThemePreference): string {
  return (
    THEME_OPTIONS.find((opt) => opt.value === pref)?.label ?? 'System default'
  );
}

export function ProfileThemeScreen(): React.ReactElement {
  const navigation = useNavigation<Nav>();
  const { colors, spacing, radii, mode, themePreference, setThemePreference } =
    useStitchTheme();

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        topBar: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.md,
          height: 56,
        },
        hit: {
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
        },
        titleWrap: { flex: 1, marginLeft: spacing.sm },
        body: {
          paddingHorizontal: spacing.pageMarginMobile,
          paddingTop: spacing.md,
          gap: spacing.lg,
        },
        previewCard: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          padding: spacing.md,
          borderRadius: radii.xl,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: `${colors.divider}80`,
          backgroundColor: colors.surface,
        },
        previewSwatch: {
          width: 48,
          height: 48,
          borderRadius: radii.full,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.primaryHighlight,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: `${colors.primaryContainer}55`,
        },
        previewMeta: { flex: 1 },
        listShell: {
          borderRadius: radii.xl,
          overflow: 'hidden',
          padding: 0,
        },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          padding: spacing.md,
          gap: spacing.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: `${colors.divider}80`,
        },
        rowLast: { borderBottomWidth: 0 },
        iconBubble: {
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surfaceContainer,
        },
        rowText: { flex: 1 },
      }),
    [colors, radii, spacing],
  );

  const onPick = (next: ThemePreference) => {
    if (next === themePreference) return;
    setThemePreference(next).catch((err) =>
      logError(err, { context: 'ProfileThemeScreen.setPref' }),
    );
  };

  const resolvedLabel = mode === 'dark' ? 'Dark' : 'Light';

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={['top', 'left', 'right']}
    >
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
          <StitchIcon name="arrow_back" size={24} colorKey="text" />
        </Pressable>
        <View style={styles.titleWrap}>
          <StitchText variant="h1" colorKey="text">
            Appearance
          </StitchText>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.previewCard} accessibilityLiveRegion="polite">
          <View style={styles.previewSwatch}>
            <StitchIcon
              name={mode === 'dark' ? 'dark_mode' : 'light_mode'}
              size={24}
              colorKey="primaryContainer"
            />
          </View>
          <View style={styles.previewMeta}>
            <StitchText variant="label-caps" colorKey="textMuted">
              Currently showing
            </StitchText>
            <StitchText
              variant="h3"
              colorKey="text"
              accessibilityLabel={`Currently showing ${resolvedLabel} theme`}
            >
              {resolvedLabel}
            </StitchText>
            {themePreference === 'system' ? (
              <StitchText variant="body-sm" colorKey="textMuted">
                Synced with your device setting
              </StitchText>
            ) : null}
          </View>
        </View>

        <View>
          <StitchText
            variant="label-caps"
            colorKey="textMuted"
            style={{ paddingLeft: spacing.sm, marginBottom: spacing.sm }}
          >
            Theme
          </StitchText>
          <StitchSurface elevated padding="none" style={styles.listShell}>
            {THEME_OPTIONS.map((opt, idx) => {
              const selected = opt.value === themePreference;
              const last = idx === THEME_OPTIONS.length - 1;
              return (
                <Pressable
                  key={opt.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${opt.label}. ${opt.description}`}
                  onPress={() => onPick(opt.value)}
                  style={({ pressed }) => [
                    styles.row,
                    last && styles.rowLast,
                    pressed && { backgroundColor: colors.surface2 },
                  ]}
                >
                  <View style={styles.iconBubble}>
                    <StitchIcon
                      name={opt.icon}
                      size={22}
                      colorKey={selected ? 'primaryContainer' : 'textMuted'}
                    />
                  </View>
                  <View style={styles.rowText}>
                    <StitchText variant="label" colorKey="text">
                      {opt.label}
                    </StitchText>
                    <StitchText variant="body-sm" colorKey="textMuted">
                      {opt.description}
                    </StitchText>
                  </View>
                  <StitchIcon
                    name={selected ? 'check_circle' : 'radio_button_unchecked'}
                    size={24}
                    colorKey={selected ? 'primaryContainer' : 'textFaint'}
                  />
                </Pressable>
              );
            })}
          </StitchSurface>
        </View>
      </View>
    </SafeAreaView>
  );
}
