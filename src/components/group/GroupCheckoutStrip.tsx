import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import { headlineOnGreenSurface, textOnGreenSurface } from '@/lib/stitchContrast';
import { StitchIcon, StitchSurface, StitchText } from '@/ui/stitch';

export type GroupCheckoutBag = {
  id: string;
  title: string;
  rescue_price?: number | null;
};

export type GroupCheckoutStripProps = {
  bags: GroupCheckoutBag[];
  reservationCodePreview?: string | null;
  onRemove: (bagId: string) => void;
};

function formatLkr(n: number): string {
  return `LKR ${Math.round(n).toLocaleString('en-LK')}`;
}

export function GroupCheckoutStrip({
  bags,
  reservationCodePreview,
  onRemove,
}: GroupCheckoutStripProps): React.ReactElement | null {
  const { colors, spacing, radii, mode } = useStitchTheme();
  const total = bags.reduce((sum, b) => sum + Number(b.rescue_price ?? 0), 0);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        shell: { gap: spacing.md },
        codeCard: {
          borderRadius: radii.lg,
          padding: spacing.md,
          backgroundColor: colors.primaryHighlight,
          borderWidth: 1,
          borderColor: `${colors.primaryContainer}44`,
          gap: spacing.xs,
        },
        strip: { gap: spacing.sm },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingVertical: spacing.sm,
        },
        thumb: {
          width: 44,
          height: 44,
          borderRadius: radii.default,
          backgroundColor: colors.surfaceContainerHigh,
          alignItems: 'center',
          justifyContent: 'center',
        },
        copy: { flex: 1, gap: 2 },
      }),
    [colors.primaryContainer, colors.primaryHighlight, colors.surfaceContainerHigh, radii.lg, radii.default, spacing.md, spacing.sm, spacing.xs],
  );

  if (bags.length <= 1) return null;

  return (
    <View style={styles.shell} testID="checkout.groupStrip">
      <View style={styles.codeCard}>
        <StitchText variant="label-caps" colorKey={textOnGreenSurface(mode)}>
          One code for all {bags.length} bags
        </StitchText>
        <StitchText variant="h3" colorKey={headlineOnGreenSurface(mode)}>
          {reservationCodePreview?.trim() || 'Generated at payment'}
        </StitchText>
        <StitchText variant="body-sm" colorKey="textMuted">
          Show this code once at pickup — staff hand over every bag in your group.
        </StitchText>
      </View>
      <StitchSurface elevated padding="md" style={{ gap: spacing.sm }}>
        <StitchText variant="h3" colorKey="onBackground">
          Your group ({bags.length})
        </StitchText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.strip}>
            {bags.map((bag) => (
              <View key={bag.id} style={styles.row}>
                <View style={styles.thumb}>
                  <StitchIcon name="shopping_bag" size={22} colorKey="primary" />
                </View>
                <View style={styles.copy}>
                  <StitchText variant="label" colorKey="onBackground" numberOfLines={1}>
                    {bag.title}
                  </StitchText>
                  <StitchText variant="body-sm" colorKey="accent">
                    {formatLkr(Number(bag.rescue_price ?? 0))}
                  </StitchText>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${bag.title}`}
                  testID={`checkout.removeBag.${bag.id}`}
                  onPress={() => onRemove(bag.id)}
                  hitSlop={8}
                >
                  <StitchIcon name="close" size={20} colorKey="textMuted" />
                </Pressable>
              </View>
            ))}
          </View>
        </ScrollView>
        <StitchText variant="h3" colorKey="primary" style={{ textAlign: 'right' }}>
          Group total {formatLkr(total)}
        </StitchText>
      </StitchSurface>
    </View>
  );
}
