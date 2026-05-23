import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  type ViewStyle,
  View,
} from 'react-native';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import { StitchText } from '@/ui/stitch/StitchText';

type Variant = 'primary' | 'secondary' | 'tertiary';

type Props = Omit<PressableProps, 'children' | 'style'> & {
  variant?: Variant;
  title: string;
  loading?: boolean;
  style?: ViewStyle;
};

export function StitchButton({
  variant = 'primary',
  title,
  loading,
  disabled,
  style,
  ...rest
}: Props): React.ReactElement {
  const { colors, radii, spacing } = useStitchTheme();

  const shell: ViewStyle =
    variant === 'primary'
      ? {
          backgroundColor: colors.primaryContainer,
          minHeight: 48,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          borderRadius: radii.lg,
          alignItems: 'center',
          justifyContent: 'center',
        }
      : variant === 'secondary'
        ? {
            backgroundColor: 'transparent',
            borderWidth: 1,
            borderColor: colors.outlineVariant,
            minHeight: 48,
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.md,
            borderRadius: radii.lg,
            alignItems: 'center',
            justifyContent: 'center',
          }
        : {
            backgroundColor: 'transparent',
            minHeight: 44,
            paddingVertical: spacing.xs,
            paddingHorizontal: spacing.sm,
            alignItems: 'center',
            justifyContent: 'center',
          };

  const labelColor =
    variant === 'primary'
      ? 'onPrimary'
      : variant === 'secondary'
        ? 'primaryContainer'
        : 'primaryContainer';

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      style={({ pressed }) => [
        shell,
        { opacity: pressed ? 0.92 : 1 },
        (disabled || loading) && { opacity: 0.5 },
        style,
      ]}
      {...rest}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {loading ? (
          <ActivityIndicator
            color={
              variant === 'primary' ? colors.onPrimary : colors.primaryContainer
            }
          />
        ) : (
          <StitchText variant="label" colorKey={labelColor}>
            {title}
          </StitchText>
        )}
      </View>
    </Pressable>
  );
}
