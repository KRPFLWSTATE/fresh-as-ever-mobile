import React from 'react';
import { View, type ViewProps } from 'react-native';
import { useStitchTheme } from '@/theme/StitchThemeContext';

type Props = ViewProps & {
  inset?: boolean;
};

export function StitchDivider({
  inset,
  style,
  ...rest
}: Props): React.ReactElement {
  const { colors } = useStitchTheme();
  return (
    <View
      style={[
        {
          height: 1,
          backgroundColor: colors.divider,
          marginVertical: 8,
          marginHorizontal: inset ? 16 : 0,
        },
        style,
      ]}
      {...rest}
    />
  );
}
