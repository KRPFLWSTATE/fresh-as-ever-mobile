import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { formatTrustScoreLabel } from '@/lib/outletTrust';
import type { StitchTheme } from '@/theme/StitchThemeContext';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import { stitchFonts } from '@/theme/stitchTokens';
import { StitchIcon, StitchText } from '@/ui/stitch';

export type OutletTrustBadgeProps = {
  trustScore?: number | null;
  averageRating?: number | null;
  totalReviews?: number | null;
  collectionRatePct?: number | null;
  complaintRatePct?: number | null;
  noShowRatePct?: number | null;
  size?: 'sm' | 'md';
  showInfo?: boolean;
};

export function OutletTrustBadge({
  trustScore,
  averageRating,
  totalReviews,
  collectionRatePct,
  complaintRatePct,
  noShowRatePct,
  size = 'md',
  showInfo = true,
}: OutletTrustBadgeProps) {
  const theme = useStitchTheme();
  const styles = makeStyles(theme);
  const [sheetOpen, setSheetOpen] = useState(false);

  const label = formatTrustScoreLabel(trustScore);
  const isNew = trustScore == null || !Number.isFinite(Number(trustScore));
  const compact = size === 'sm';

  const pill = (
    <View style={[styles.pill, compact && styles.pillSm]}>
      <StitchIcon
        name="star"
        size={compact ? 14 : 16}
        colorKey={isNew ? 'textMuted' : 'accent'}
      />
      <StitchText
        variant={compact ? 'body-sm' : 'label'}
        colorKey={isNew ? 'textMuted' : 'text'}
        style={{ fontFamily: stitchFonts.semiBold }}
      >
        {label}
      </StitchText>
      {showInfo && !isNew ? (
        <StitchIcon name="info" size={compact ? 12 : 14} colorKey="textMuted" />
      ) : null}
    </View>
  );

  if (!showInfo || isNew) {
    return pill;
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Outlet trust score details"
        onPress={() => setSheetOpen(true)}
        hitSlop={8}
      >
        {pill}
      </Pressable>
      <Modal
        visible={sheetOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSheetOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setSheetOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <StitchText variant="h3" colorKey="text">
              Outlet trust
            </StitchText>
            <StitchText variant="body-sm" colorKey="textMuted" style={styles.sheetLead}>
              Based on the last 90 days of pickups, reviews, and complaints.
            </StitchText>
            <View style={styles.metricRow}>
              <StitchText variant="label" colorKey="text">
                Trust score
              </StitchText>
              <StitchText variant="label" colorKey="accent">
                {label}
              </StitchText>
            </View>
            {averageRating != null && Number(averageRating) > 0 ? (
              <View style={styles.metricRow}>
                <StitchText variant="body-sm" colorKey="textMuted">
                  Star average
                </StitchText>
                <StitchText variant="body-sm" colorKey="text">
                  {Number(averageRating).toFixed(1)}
                  {totalReviews != null ? ` (${totalReviews} reviews)` : ''}
                </StitchText>
              </View>
            ) : null}
            {collectionRatePct != null ? (
              <View style={styles.metricRow}>
                <StitchText variant="body-sm" colorKey="textMuted">
                  Collection rate
                </StitchText>
                <StitchText variant="body-sm" colorKey="text">
                  {Number(collectionRatePct).toFixed(0)}%
                </StitchText>
              </View>
            ) : null}
            {noShowRatePct != null ? (
              <View style={styles.metricRow}>
                <StitchText variant="body-sm" colorKey="textMuted">
                  No-show rate
                </StitchText>
                <StitchText variant="body-sm" colorKey="text">
                  {Number(noShowRatePct).toFixed(0)}%
                </StitchText>
              </View>
            ) : null}
            {complaintRatePct != null ? (
              <View style={styles.metricRow}>
                <StitchText variant="body-sm" colorKey="textMuted">
                  Complaint rate
                </StitchText>
                <StitchText variant="body-sm" colorKey="text">
                  {Number(complaintRatePct).toFixed(0)}%
                </StitchText>
              </View>
            ) : null}
            <Pressable
              accessibilityRole="button"
              onPress={() => setSheetOpen(false)}
              style={styles.closeBtn}
            >
              <StitchText variant="label" colorKey="primary">
                Close
              </StitchText>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function makeStyles(theme: StitchTheme) {
  return StyleSheet.create({
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: theme.colors.surfaceContainer,
      borderWidth: 1,
      borderColor: theme.colors.outlineVariant,
    },
    pillSm: {
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 20,
      paddingBottom: 32,
      gap: 10,
    },
    sheetLead: { marginBottom: 8 },
    metricRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 4,
    },
    closeBtn: {
      marginTop: 12,
      alignSelf: 'center',
      paddingVertical: 10,
      paddingHorizontal: 20,
    },
  });
}
