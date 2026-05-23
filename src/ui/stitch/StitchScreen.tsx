import React from 'react';
import { ScrollView, type ScrollViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStitchTheme } from '@/theme/StitchThemeContext';

type Props = {
  children: React.ReactNode;
  scroll?: boolean;
  scrollProps?: Omit<ScrollViewProps, 'children'>;
  edges?: React.ComponentProps<typeof SafeAreaView>['edges'];
  style?: React.ComponentProps<typeof SafeAreaView>['style'];
};

export function StitchScreen({
  scroll,
  scrollProps,
  children,
  style,
  edges,
}: Props): React.ReactElement {
  const { colors } = useStitchTheme();
  const bg = { flex: 1, backgroundColor: colors.background };
  if (scroll) {
    return (
      <SafeAreaView style={[bg, style]} edges={edges ?? ['top', 'left', 'right']}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          {...scrollProps}
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={[bg, style]} edges={edges}>
      {children}
    </SafeAreaView>
  );
}
