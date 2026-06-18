import React from 'react';
import { View } from 'react-native';
import {
  getOccasionLabel,
  parseSeasonalOccasionKind,
  shouldShowOccasionBadge,
  type SeasonalOccasionWindow,
} from '@/domain/seasonalOccasion';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import { StitchText } from '@/ui/stitch';

type Props = {
  occasionKind?: unknown;
  windows: SeasonalOccasionWindow[];
  featureEnabled: boolean;
  compact?: boolean;
  testID?: string;
};

export function SeasonalOccasionBadge({
  occasionKind,
  windows,
  featureEnabled,
  compact = false,
  testID = 'seasonal.occasionBadge',
}: Props) {
  const { colors, spacing, radii } = useStitchTheme();
  const kind = parseSeasonalOccasionKind(occasionKind);
  if (!shouldShowOccasionBadge(kind, windows, featureEnabled)) return null;
  const label = getOccasionLabel(kind, windows);
  if (!label) return null;

  return (
    <View
      testID={testID}
      accessibilityLabel={`${label} seasonal surplus`}
      style={{
        alignSelf: 'flex-start',
        paddingHorizontal: compact ? spacing.sm : spacing.md,
        paddingVertical: compact ? 3 : 4,
        borderRadius: radii.full,
        backgroundColor: colors.secondaryContainer,
      }}
    >
      <StitchText
        variant={compact ? 'body-sm' : 'label'}
        colorKey="onSecondaryContainer"
      >
        {label}
      </StitchText>
    </View>
  );
}
