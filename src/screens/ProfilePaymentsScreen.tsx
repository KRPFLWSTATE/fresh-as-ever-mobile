import React, { useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RootStackParamList } from '@/navigation/types';
import { useAuthContext } from '@/context/AuthContext';
import { usePaymentMethods } from '@/hooks/usePaymentMethods';
import { useCustomerOrdersHistory } from '@/hooks/useCustomerOrdersHistory';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import { stitchAmbientShadow } from '@/theme/stitchTokens';
import { stitchFonts } from '@/theme/stitchTokens';
import {
  StitchButton,
  StitchCard,
  StitchIcon,
  StitchText,
} from '@/ui/stitch';
import { CardBrandGlyph } from '@/ui/CardBrandGlyph';
import { logError } from '@/observability/logError';

export function ProfilePaymentsScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList, 'ProfilePayments'>>();
  const { env, session } = useAuthContext();
  const {
    methods,
    loading,
    error,
    addMethod,
    setDefault,
    removeMethod,
  } = usePaymentMethods(env, Boolean(session));
  const {
    rows: orderHistory,
    loading: historyLoading,
    error: historyError,
  } = useCustomerOrdersHistory(env);

  const { colors, radii, spacing } = useStitchTheme();

  const [modal, setModal] = useState(false);
  const [brand, setBrand] = useState('Visa');
  const [last4, setLast4] = useState('');
  const [expiry, setExpiry] = useState('');
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        topBar: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.md,
          height: 56,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: `${colors.divider}99`,
        },
        sectionHead: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: spacing.md,
        },
        cardGrid: { gap: spacing.md },
        payCard: {
          borderRadius: radii.xl,
          padding: spacing.md,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: 'transparent',
          ...stitchAmbientShadow,
        },
        cardTop: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: spacing.lg,
        },
        brandMark: {
          width: 48,
          height: 32,
          borderRadius: radii.default,
          backgroundColor: colors.surface2,
          alignItems: 'center',
          justifyContent: 'center',
        },
        defaultPill: {
          paddingHorizontal: spacing.sm,
          paddingVertical: 2,
          borderRadius: radii.full,
          backgroundColor: colors.primaryHighlight,
          alignSelf: 'flex-start',
        },
        addTile: {
          minHeight: 140,
          borderRadius: radii.xl,
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: colors.divider,
          backgroundColor: colors.surface2,
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
        },
        addBubble: {
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: colors.primaryContainer,
          alignItems: 'center',
          justifyContent: 'center',
        },
        skeletonRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          padding: spacing.md,
        },
        skBox: { borderRadius: radii.lg, backgroundColor: colors.surface2 },
        modalBg: {
          flex: 1,
          backgroundColor: `${colors.inverseSurface}99`,
          justifyContent: 'center',
          padding: spacing.lg,
        },
        modalCard: {
          borderRadius: radii.xl,
          padding: spacing.lg,
          gap: spacing.sm,
        },
      }),
    [colors, radii, spacing],
  );

  const inputStyle = useMemo(
    () => ({
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      borderRadius: radii.lg,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      fontSize: 15,
      fontFamily: stitchFonts.regular,
      color: colors.text,
      backgroundColor: colors.surface,
    }),
    [colors, radii, spacing],
  );

  async function submitAdd() {
    const digits = last4.replace(/\D/g, '');
    if (digits.length < 4) {
      Alert.alert('Cards', 'Enter the last 4 digits.');
      return;
    }
    setSaving(true);
    try {
      await addMethod({ brand, last4: digits.slice(-4), expiry, label });
      setModal(false);
      setLast4('');
      setExpiry('');
      setLabel('');
      setBrand('Visa');
    } catch {
      Alert.alert('Could not save', 'Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
      <View style={[styles.topBar, { backgroundColor: colors.background }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => navigation.goBack()}
          style={({ pressed }) => ({
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: pressed ? colors.surface2 : 'transparent',
          })}
        >
          <StitchIcon name="arrow_back" size={24} colorKey="primaryContainer" />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <StitchText variant="h2" colorKey="primaryContainer" style={{ letterSpacing: -0.5 }}>
            Fresh As Ever
          </StitchText>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {!session ? (
        <View style={{ flex: 1, padding: spacing.lg, justifyContent: 'center' }}>
          <StitchText variant="body-md" colorKey="textMuted" style={{ textAlign: 'center' }}>
            Sign in to manage saved labels for PayHere/checkout.
          </StitchText>
          <StitchButton
            title="Sign in"
            onPress={() => navigation.navigate('Login')}
            style={{ marginTop: spacing.lg }}
          />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: spacing.pageMarginMobile,
            paddingVertical: spacing.lg,
            paddingBottom: spacing.xxl + spacing.lg,
            gap: spacing.xl,
          }}
        >
          <View>
            <StitchText variant="display" colorKey="text">
              Payments
            </StitchText>
            <StitchText variant="body-lg" colorKey="textMuted" style={{ marginTop: spacing.sm }}>
              Manage your payment methods and view billing history.
            </StitchText>
          </View>

          {error ? (
            <StitchText variant="body-sm" colorKey="error">
              {error}
            </StitchText>
          ) : null}

          <View>
            <View style={styles.sectionHead}>
              <StitchText variant="h2" colorKey="text">
                Saved Cards
              </StitchText>
              <StitchIcon name="lock" size={22} colorKey="textMuted" />
            </View>

            {loading ? (
              <ActivityIndicator color={colors.primaryContainer} />
            ) : (
              <View style={styles.cardGrid}>
                {methods.map((item) => (
                  <StitchCard
                    key={item.id}
                    elevated
                    padding="md"
                    style={styles.payCard}
                  >
                    <View style={styles.cardTop}>
                      <CardBrandGlyph brand={item.brand} />

                      {item.isDefault ? (
                        <View style={styles.defaultPill}>
                          <StitchText variant="label-caps" colorKey="primaryContainer">
                            Default
                          </StitchText>
                        </View>
                      ) : (
                        <Pressable
                          onPress={() => setDefault(item.id)}
                          style={{ padding: spacing.xs }}
                        >
                          <StitchText variant="label" colorKey="primaryContainer">
                            Set default
                          </StitchText>
                        </Pressable>
                      )}
                    </View>
                    <View style={{ gap: spacing.xs }}>
                      <StitchText variant="h3" colorKey="text" style={{ letterSpacing: 4 }}>
                        **** **** **** {item.last4}
                      </StitchText>
                      <StitchText variant="body-sm" colorKey="textMuted">
                        Expires {item.expiry || '—'}
                      </StitchText>
                      {item.label ? (
                        <StitchText variant="body-sm" colorKey="textMuted">
                          {item.label}
                        </StitchText>
                      ) : null}
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Remove card"
                      onPress={() =>
                        Alert.alert('Remove', 'Forget this saved label?', [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Remove',
                            style: 'destructive',
                            onPress: () => removeMethod(item.id),
                          },
                        ])
                      }
                      style={{ position: 'absolute', top: spacing.md, right: spacing.md, padding: spacing.xs }}
                    >
                      <StitchIcon name="delete" size={20} colorKey="textFaint" />
                    </Pressable>
                  </StitchCard>
                ))}

                <Pressable
                  accessibilityRole="button"
                  onPress={() => setModal(true)}
                  style={({ pressed }) => [
                    styles.addTile,
                    pressed && { opacity: 0.92 },
                  ]}
                >
                  <View style={styles.addBubble}>
                    <StitchIcon name="add" size={22} colorKey="onPrimary" />
                  </View>
                  <StitchText variant="label" colorKey="textMuted">
                    Add New Card
                  </StitchText>
                </Pressable>
              </View>
            )}
          </View>

          <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
            <View style={styles.sectionHead}>
              <StitchText variant="h2" colorKey="text">
                Recent Transactions
              </StitchText>
              <Pressable
                accessibilityRole="button"
                onPress={() => navigation.navigate('MainTabs', { screen: 'OrdersTab' })}
              >
                <StitchText variant="label" colorKey="primaryContainer">
                  View All
                </StitchText>
              </Pressable>
            </View>
            {historyError ? (
              <StitchText variant="body-sm" colorKey="error">
                {historyError}
              </StitchText>
            ) : null}
            <StitchCard padding="none" style={{ overflow: 'hidden' }}>
              {historyLoading ? (
                <View style={styles.skeletonRow}>
                  <ActivityIndicator color={colors.primaryContainer} />
                </View>
              ) : orderHistory.length === 0 ? (
                <View style={{ padding: spacing.md }}>
                  <StitchText variant="body-sm" colorKey="textMuted">
                    No paid orders yet. Your rescue purchases will appear here.
                  </StitchText>
                </View>
              ) : (
                orderHistory.slice(0, 8).map((row, i) => (
                  <View
                    key={row.id}
                    style={[
                      styles.skeletonRow,
                      i < Math.min(orderHistory.length, 8) - 1 && {
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderBottomColor: `${colors.divider}80`,
                      },
                    ]}
                  >
                    <View style={{ flex: 1, gap: 4 }}>
                      <StitchText variant="label" colorKey="text" numberOfLines={1}>
                        {row.title}
                      </StitchText>
                      <StitchText variant="body-sm" colorKey="textMuted">
                        {row.outlet_name} · {row.reservation_code || row.id.slice(0, 8)}
                      </StitchText>
                      <StitchText variant="body-sm" colorKey="textFaint">
                        {row.created_at
                          ? new Date(row.created_at).toLocaleDateString()
                          : '—'}
                      </StitchText>
                    </View>
                    <StitchText variant="label" colorKey="primaryContainer">
                      LKR {Math.round(row.total).toLocaleString()}
                    </StitchText>
                  </View>
                ))
              )}
            </StitchCard>
          </View>
        </ScrollView>
      )}

      <Modal transparent visible={modal} animationType="fade">
        <Pressable style={styles.modalBg} onPress={() => setModal(false)}>
          <Pressable
            style={[styles.modalCard, { backgroundColor: colors.surface }]}
            onPress={(e) => e.stopPropagation()}
          >
            <StitchText variant="h3" colorKey="text">
              Quick add
            </StitchText>
            <StitchText variant="body-sm" colorKey="textMuted">
              Display-only placeholders — never full PAN (parity with web).
            </StitchText>
            <TextInput
              placeholder="Brand (Visa, MC…)"
              placeholderTextColor={colors.textMuted}
              value={brand}
              onChangeText={setBrand}
              style={inputStyle}
            />
            <TextInput
              placeholder="Last 4"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              maxLength={4}
              value={last4}
              onChangeText={setLast4}
              style={inputStyle}
            />
            <TextInput
              placeholder="Expiry"
              placeholderTextColor={colors.textMuted}
              value={expiry}
              onChangeText={setExpiry}
              style={inputStyle}
            />
            <TextInput
              placeholder="Label"
              placeholderTextColor={colors.textMuted}
              value={label}
              onChangeText={setLabel}
              style={inputStyle}
            />
            <StitchButton
              title="Save"
              loading={saving}
              disabled={saving}
              onPress={() => {
                submitAdd().catch((err) => logError(err, { context: 'ProfilePaymentsScreen.submitAdd' }));
              }}
            />
            <Pressable onPress={() => setModal(false)} style={{ padding: spacing.sm }}>
              <StitchText variant="label" colorKey="primaryContainer" style={{ textAlign: 'center' }}>
                Cancel
              </StitchText>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
