import React from 'react';
import { TextInput, View } from 'react-native';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import { StitchSurface, StitchText } from '@/ui/stitch';
import type { MerchantBagFormValues } from '@/lib/merchantBagForm';

type Props = {
  values: MerchantBagFormValues;
  onChange: (patch: Partial<MerchantBagFormValues>) => void;
  pickupHint?: string;
};

function LabeledField({
  label,
  placeholder,
  value,
  onChangeText,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
}) {
  const { colors, spacing, radii } = useStitchTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      <StitchText variant="label" colorKey="textMuted">
        {label}
      </StitchText>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
        style={{
          minHeight: 48,
          borderWidth: 1,
          borderColor: colors.outlineVariant,
          borderRadius: radii.lg,
          paddingHorizontal: spacing.md,
          color: colors.onBackground,
          backgroundColor: colors.surface,
        }}
      />
    </View>
  );
}

export function MerchantBagFormFields({ values, onChange, pickupHint }: Props) {
  const { spacing } = useStitchTheme();
  return (
    <StitchSurface elevated padding="xl" style={{ gap: spacing.lg }}>
      <LabeledField
        label="Bag title"
        placeholder="e.g. Mixed pastries box"
        value={values.title}
        onChangeText={(title) => onChange({ title })}
      />
      <LabeledField
        label="Rescue price (LKR)"
        placeholder="500"
        value={values.rescuePrice}
        onChangeText={(rescuePrice) => onChange({ rescuePrice })}
      />
      <LabeledField
        label="Quantity today"
        placeholder="5"
        value={values.quantity}
        onChangeText={(quantity) => onChange({ quantity })}
      />
      <StitchText variant="body-sm" colorKey="textMuted">
        {pickupHint ??
          'Pickup window defaults to starting now for 2 hours when you publish.'}
      </StitchText>
    </StitchSurface>
  );
}
