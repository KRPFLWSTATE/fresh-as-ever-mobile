import React, { useCallback, useMemo } from 'react';
import { Alert, Pressable, View, type ViewStyle } from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { useAuthContext } from '@/context/AuthContext';
import { useMerchantContext, type MerchantOutlet } from '@/hooks/useMerchantContext';
import type { RootStackParamList } from '@/navigation/types';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import {
  StitchIcon,
  StitchScreen,
  StitchSurface,
  StitchText,
} from '@/ui/stitch';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function HubRow({
  label,
  last,
  onPress,
  rowStyle,
}: {
  label: string;
  last?: boolean;
  onPress: () => void;
  rowStyle: ViewStyle;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        rowStyle,
        last && { borderBottomWidth: 0 },
        { opacity: pressed ? 0.88 : 1 },
      ]}
    >
      <StitchText variant="body-md" colorKey="text">
        {label}
      </StitchText>
      <StitchIcon name="chevron_right" size={22} colorKey="textFaint" />
    </Pressable>
  );
}

function OutletEditRow({
  outlet,
  isCurrentOutlet,
  last,
  onEdit,
  onSwitch,
  rowStyle,
}: {
  outlet: MerchantOutlet;
  isCurrentOutlet: boolean;
  last?: boolean;
  onEdit: () => void;
  onSwitch: () => void;
  rowStyle: ViewStyle;
}): React.ReactElement {
  const { colors, radii, spacing } = useStitchTheme();
  const name = String(outlet.name ?? '').trim() || 'Outlet';
  const isActive = Boolean((outlet as Record<string, unknown>).is_active);
  return (
    <View style={[rowStyle, last && { borderBottomWidth: 0 }]}>
      <Pressable
        accessibilityRole="button"
        testID={`merchant.profile.outlet.${String(outlet.id)}`}
        onPress={onEdit}
        style={({ pressed }) => [
          {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            minWidth: 0,
            opacity: pressed ? 0.88 : 1,
          },
        ]}
      >
        <View style={{ flex: 1, paddingRight: spacing.sm, minWidth: 0 }}>
          <StitchText variant="label" colorKey="text" numberOfLines={1}>
            {name}
          </StitchText>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: isActive ? colors.success : colors.surfaceDim,
              }}
            />
            <StitchText variant="body-sm" colorKey="textMuted">
              {isActive ? 'Active' : 'Inactive'}
              {isCurrentOutlet ? ' · In use' : ''}
            </StitchText>
          </View>
        </View>
        <StitchIcon name="chevron_right" size={22} colorKey="textFaint" />
      </Pressable>
      <View style={{ marginTop: spacing.sm }}>
        {isCurrentOutlet ? (
          <View
            style={{
              alignSelf: 'flex-start',
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.xs,
              paddingHorizontal: spacing.sm,
              paddingVertical: spacing.xs,
              borderRadius: radii.full,
              backgroundColor: colors.accentHighlight,
            }}
          >
            <StitchIcon name="check_circle" size={16} colorKey="accent" />
            <StitchText variant="label-caps" colorKey="text">
              Current outlet
            </StitchText>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            testID={`merchant.profile.outlet.${String(outlet.id)}.switch`}
            onPress={onSwitch}
            style={({ pressed }) => ({
              alignSelf: 'flex-start',
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.xs,
              borderRadius: radii.full,
              borderWidth: 1,
              borderColor: colors.outlineVariant,
              opacity: pressed ? 0.88 : 1,
            })}
          >
            <StitchText variant="label" colorKey="primaryContainer">
              Switch to this outlet
            </StitchText>
          </Pressable>
        )}
      </View>
    </View>
  );
}

export function MerchantProfileScreen() {
  const navigation = useNavigation<Nav>();
  const { env } = useAuthContext();
  const { merchant, activeOutlet, activeOutletId, outlets, loading, error, setActiveOutletId } =
    useMerchantContext(env);
  const { colors, radii, spacing } = useStitchTheme();

  const onSwitchOutlet = useCallback(
    (outlet: MerchantOutlet) => {
      const id = String(outlet.id);
      const label = String(outlet.name ?? '').trim() || 'This outlet';
      setActiveOutletId(id);
      Alert.alert(
        'Outlet switched',
        `${label} is now your active outlet for bags, orders, and dashboard.`,
      );
    },
    [setActiveOutletId],
  );

  const outletTitle = activeOutlet?.name?.trim() || 'Your outlet';
  const businessLine =
    merchant?.business_name && String(merchant.business_name).trim()
      ? String(merchant.business_name)
      : 'Outlet & compliance';

  const styles = useMemo(() => {
    const pagePad = spacing.pageMarginMobile;
    const row: ViewStyle = {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    };
    const outletRow: ViewStyle = {
      ...row,
      flexDirection: 'column',
      alignItems: 'stretch',
    };
    const cardBorder: ViewStyle = {
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      overflow: 'hidden',
    };
    const logo: ViewStyle = {
      width: 64,
      height: 64,
      borderRadius: radii.lg,
      backgroundColor: colors.surface2,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
    };
    const profileTop: ViewStyle = {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    };
    return {
      content: {
        paddingHorizontal: pagePad,
        paddingTop: spacing.md,
        paddingBottom: spacing.xxl,
        gap: spacing.lg,
      },
      headerBlock: { marginBottom: spacing.sm },
      row,
      outletRow,
      cardBorder,
      profileCard: {
        borderRadius: radii.xl,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.divider,
        backgroundColor: colors.surface,
        gap: spacing.md,
      },
      profileTop,
      logo,
      sectionTitle: { marginTop: spacing.sm, marginBottom: spacing.xs },
    };
  }, [colors, radii, spacing]);

  return (
    <StitchScreen
      scroll
      scrollProps={{
        contentContainerStyle: styles.content,
        keyboardShouldPersistTaps: 'handled',
      }}
    >
      <View style={styles.headerBlock}>
        <StitchText variant="h1" colorKey="text">
          Business profile
        </StitchText>
        <StitchText variant="body-md" colorKey="textMuted" style={{ marginTop: 4 }}>
          Branding, staff, and compliance uploads stay on desktop for now—mobile keeps
          shortcuts to daily operations and your outlet roster.
        </StitchText>
      </View>

      {error ? (
        <StitchText variant="body-sm" colorKey="error">
          {error}
        </StitchText>
      ) : null}
      {loading ? (
        <StitchText variant="body-sm" colorKey="textMuted">
          Loading outlet…
        </StitchText>
      ) : null}

      <View style={styles.profileCard}>
        <View style={styles.profileTop}>
          <View style={styles.logo} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <StitchText variant="h2" colorKey="text" numberOfLines={2}>
              {outletTitle}
            </StitchText>
            <StitchText variant="body-sm" colorKey="textMuted" numberOfLines={2} style={{ marginTop: 4 }}>
              {businessLine}
            </StitchText>
          </View>
        </View>
      </View>

      <View>
        <StitchText variant="label-caps" colorKey="textMuted" style={styles.sectionTitle}>
          Outlets
        </StitchText>
        <StitchText variant="body-sm" colorKey="textMuted" style={{ marginBottom: spacing.xs }}>
          Tap a row to edit details. Use Switch to change which outlet drives bags, orders, and
          the dashboard.
        </StitchText>
        <StitchSurface elevated padding="none" style={styles.cardBorder}>
          {outlets.length > 0 ? (
            outlets.map((o, ix) => (
              <OutletEditRow
                key={String(o.id)}
                outlet={o}
                isCurrentOutlet={activeOutletId != null && String(activeOutletId) === String(o.id)}
                last={ix === outlets.length - 1}
                onEdit={() => {
                  navigation.navigate('MerchantOutletEditor', {
                    outletId: String(o.id),
                  });
                }}
                onSwitch={() => onSwitchOutlet(o)}
                rowStyle={styles.outletRow}
              />
            ))
          ) : (
            <View style={[styles.row, { borderBottomWidth: 0 }]}>
              <StitchText variant="body-sm" colorKey="textMuted">
                {loading
                  ? 'Loading outlets…'
                  : 'No outlets yet. Finish onboarding to add your first outlet.'}
              </StitchText>
            </View>
          )}
        </StitchSurface>
      </View>

      <View>
        <StitchText variant="label-caps" colorKey="textMuted" style={styles.sectionTitle}>
          Operations
        </StitchText>
        <StitchSurface elevated padding="none" style={styles.cardBorder}>
          <HubRow
            label="Settings"
            onPress={() => navigation.navigate('MerchantSettings')}
            rowStyle={styles.row}
          />
          <HubRow
            label="Help & support"
            onPress={() =>
              navigation.navigate('ProfileSupport', { audience: 'merchant' })
            }
            rowStyle={styles.row}
          />
          <HubRow
            label="Disputes"
            onPress={() => navigation.navigate('MerchantDisputes')}
            rowStyle={styles.row}
          />
          <HubRow
            label="Promotions"
            onPress={() => navigation.navigate('MerchantPromotions')}
            rowStyle={styles.row}
          />
          <HubRow
            label="Re-open onboarding checklist"
            last
            onPress={() => navigation.navigate('MerchantOnboarding', { step: '1' })}
            rowStyle={styles.row}
          />
        </StitchSurface>
      </View>
    </StitchScreen>
  );
}
