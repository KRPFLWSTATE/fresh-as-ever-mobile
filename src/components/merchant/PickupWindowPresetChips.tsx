import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  applyPickupPresetLocal,
  formatPickupKindLabel,
  NAMED_PRESET_KINDS,
  type PickupWindowKind,
} from '@/lib/pickupWindowPresets';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import { StitchText } from '@/ui/stitch';

type ListingMode = 'bag' | 'shelf';

type Props = {
  selectedKind: PickupWindowKind;
  listingMode?: ListingMode;
  onSelectKind: (
    kind: PickupWindowKind,
    pickup_start: string,
    pickup_end: string,
  ) => void;
  onCustomOverride: () => void;
};

export function PickupWindowPresetChips({
  selectedKind,
  listingMode = 'bag',
  onSelectKind,
  onCustomOverride,
}: Props): React.ReactElement {
  const { colors, spacing, radii } = useStitchTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.sm,
        },
      }),
    [spacing.sm],
  );

  const legacyKind: PickupWindowKind =
    listingMode === 'shelf' ? 'now_4h' : 'immediately_2h';
  const legacyLabel =
    listingMode === 'shelf' ? 'Now (4h window)' : 'Immediately (2h window)';

  const chips: { kind: PickupWindowKind; label: string }[] = [
    ...NAMED_PRESET_KINDS.map((kind) => ({
      kind,
      label: formatPickupKindLabel(kind) ?? kind,
    })),
    { kind: legacyKind, label: legacyLabel },
    { kind: 'custom', label: 'Custom' },
  ];

  return (
    <View style={styles.row}>
      {chips.map((chip) => {
        const selected = selectedKind === chip.kind;
        return (
          <Pressable
            key={chip.kind}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => {
              if (chip.kind === 'custom') {
                onCustomOverride();
                return;
              }
              const times = applyPickupPresetLocal(chip.kind);
              onSelectKind(chip.kind, times.pickup_start, times.pickup_end);
            }}
            style={({ pressed }) => ({
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              borderRadius: radii.full,
              borderWidth: 1,
              borderColor: selected ? colors.primary : colors.outlineVariant,
              backgroundColor: selected
                ? colors.primaryHighlight
                : colors.surfaceBright,
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <StitchText
              variant={selected ? 'label' : 'body-sm'}
              colorKey={selected ? 'primaryContainer' : 'text'}
            >
              {chip.label}
            </StitchText>
          </Pressable>
        );
      })}
    </View>
  );
}
