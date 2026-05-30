import React, { useMemo } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import {
  BAG_WEIGHT_PRESETS_KG,
  MAX_BAG_WEIGHT_KG,
  MIN_BAG_WEIGHT_KG,
} from '@/lib/co2Impact';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import { StitchText } from '@/ui/stitch';

type Props = {
  selectedKg: number | null;
  customKg: string;
  onSelectPreset: (kg: number) => void;
  onCustomChange: (value: string) => void;
};

export function BagWeightField({
  selectedKg,
  customKg,
  onSelectPreset,
  onCustomChange,
}: Props) {
  const { colors, spacing, radii } = useStitchTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        label: { marginBottom: spacing.xs },
        hint: { marginBottom: spacing.md, opacity: 0.72 },
        chipRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.sm,
          marginBottom: spacing.md,
          maxHeight: 160,
        },
        chip: {
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderRadius: radii.lg,
          borderWidth: 1,
        },
        chipActive: {
          backgroundColor: colors.primary,
          borderColor: colors.primary,
        },
        chipIdle: {
          backgroundColor: colors.surface,
          borderColor: colors.divider,
        },
        input: {
          borderWidth: 1,
          borderColor: colors.divider,
          borderRadius: radii.lg,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          fontSize: 16,
          color: colors.text,
        },
      }),
    [colors, radii, spacing],
  );

  return (
    <View>
      <StitchText variant="label" style={styles.label}>
        Estimated food weight
      </StitchText>
      <StitchText variant="body-sm" style={styles.hint}>
        Rough kg in the bag — used for CO₂ impact across the app.
      </StitchText>
      <View style={styles.chipRow}>
        {BAG_WEIGHT_PRESETS_KG.map((kg) => {
          const active = selectedKg === kg && !customKg.trim();
          return (
            <Pressable
              key={kg}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => onSelectPreset(kg)}
              style={[styles.chip, active ? styles.chipActive : styles.chipIdle]}
            >
              <StitchText
                variant="label"
                style={{
                  color: active ? '#fff' : colors.text,
                  fontSize: kg < 1 ? 13 : 14,
                }}
              >
                {kg} kg
              </StitchText>
            </Pressable>
          );
        })}
      </View>
      <TextInput
        style={styles.input}
        value={customKg}
        onChangeText={onCustomChange}
        placeholder={`Custom (${MIN_BAG_WEIGHT_KG}–${MAX_BAG_WEIGHT_KG} kg)`}
        placeholderTextColor={colors.textFaint}
        keyboardType="decimal-pad"
        accessibilityLabel="Custom bag weight in kilograms"
      />
    </View>
  );
}

export function resolveFormBagWeightKg(
  selectedKg: number | null,
  customKg: string,
): number | null {
  const custom = customKg.trim();
  if (custom) {
    const parsed = Number(custom.replace(',', '.'));
    if (
      !Number.isFinite(parsed) ||
      parsed < MIN_BAG_WEIGHT_KG ||
      parsed > MAX_BAG_WEIGHT_KG
    ) {
      return null;
    }
    return Math.round(parsed * 100) / 100;
  }
  if (selectedKg != null) return selectedKg;
  return null;
}
