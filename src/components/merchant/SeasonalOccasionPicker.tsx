import React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import {
  getActiveSeasonalWindows,
  parseSeasonalOccasionKind,
  type SeasonalOccasionKind,
  type SeasonalOccasionWindow,
} from '@/domain/seasonalOccasion';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import { StitchSurface, StitchText } from '@/ui/stitch';

type Props = {
  value: SeasonalOccasionKind;
  onChange: (value: SeasonalOccasionKind) => void;
  windows?: SeasonalOccasionWindow[];
  activeWindows?: SeasonalOccasionWindow[];
  loading?: boolean;
  testID?: string;
};

export function SeasonalOccasionPicker({
  value,
  onChange,
  windows = [],
  activeWindows,
  loading = false,
  testID = 'merchant.occasionPicker',
}: Props) {
  const { colors, spacing, radii } = useStitchTheme();
  const options = activeWindows ?? getActiveSeasonalWindows(windows);

  if (loading) {
    return (
      <StitchSurface elevated padding="md" testID={testID}>
        <ActivityIndicator color={colors.primary} />
      </StitchSurface>
    );
  }

  if (!options.length) return null;

  const selected = parseSeasonalOccasionKind(value);

  return (
    <StitchSurface elevated padding="md" testID={testID}>
      <StitchText variant="h3" colorKey="onBackground" style={{ marginBottom: spacing.xs }}>
        Seasonal occasion
      </StitchText>
      <StitchText variant="body-sm" colorKey="textMuted" style={{ marginBottom: spacing.md }}>
        Optional tag for surplus tied to an active festival window.
      </StitchText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: selected === 'none' }}
          onPress={() => onChange('none')}
          style={{
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderRadius: radii.full,
            borderWidth: 1,
            borderColor: selected === 'none' ? colors.primary : colors.outlineVariant,
            backgroundColor: selected === 'none' ? colors.primaryContainer : colors.surface,
          }}
        >
          <StitchText
            variant="label"
            colorKey={selected === 'none' ? 'onPrimaryContainer' : 'text'}
          >
            None
          </StitchText>
        </Pressable>
        {options.map((window) => {
          const on = selected === window.occasion;
          return (
            <Pressable
              key={window.occasion}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              testID={`merchant.occasionOption.${window.occasion}`}
              onPress={() => onChange(window.occasion)}
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                borderRadius: radii.full,
                borderWidth: 1,
                borderColor: on ? colors.primary : colors.outlineVariant,
                backgroundColor: on ? colors.primaryContainer : colors.surface,
              }}
            >
              <StitchText variant="label" colorKey={on ? 'onPrimaryContainer' : 'text'}>
                {window.label}
              </StitchText>
            </Pressable>
          );
        })}
      </View>
    </StitchSurface>
  );
}
