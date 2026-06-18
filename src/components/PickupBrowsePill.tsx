import React from 'react';
import { View } from 'react-native';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import { StitchText } from '@/ui/stitch';
import {
  formatPickupBrowsePill,
  formatPickupKindLabel,
} from '@/lib/pickupWindowPresets';

type PickupBrowsePillProps = {
  pickupStart?: string | null;
  pickupEnd?: string | null;
  pickupWindowKind?: string | null;
  soldOut?: boolean;
};

export function PickupBrowsePill({
  pickupStart,
  pickupEnd,
  pickupWindowKind,
  soldOut = false,
}: PickupBrowsePillProps): React.ReactElement | null {
  const { colors, spacing, radii } = useStitchTheme();
  const pill = formatPickupBrowsePill(Date.now(), pickupStart, pickupEnd);
  const kindLabel = formatPickupKindLabel(pickupWindowKind);
  if (!pill && !kindLabel) return null;

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, alignItems: 'center' }}>
      {pill ? (
        <View
          style={{
            paddingHorizontal: spacing.sm,
            paddingVertical: 4,
            borderRadius: radii.full,
            backgroundColor: pill === 'Open now' ? colors.primaryHighlight : colors.surfaceContainer,
          }}
        >
          <StitchText
            variant="label-caps"
            colorKey={soldOut ? 'textFaint' : pill === 'Open now' ? 'primaryContainer' : 'textMuted'}
          >
            {pill}
          </StitchText>
        </View>
      ) : null}
      {kindLabel ? (
        <StitchText variant="body-sm" colorKey={soldOut ? 'textFaint' : 'textMuted'}>
          {kindLabel}
        </StitchText>
      ) : null}
    </View>
  );
}
