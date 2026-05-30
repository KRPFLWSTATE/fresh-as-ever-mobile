import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { isClearanceShelvesEnabled } from '@/config/clearanceShelves';
import { useAuthContext } from '@/context/AuthContext';
import { useMerchantContext } from '@/hooks/useMerchantContext';
import { useMerchantShelves } from '@/hooks/useMerchantShelves';
import { useMerchantShelfTemplates } from '@/hooks/useMerchantShelfTemplates';
import { merchantInventoryVisibility } from '@/lib/merchantInventoryVisibility';
import { useScrollContentBottomPad } from '@/lib/useScrollContentBottomPad';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import {
  StitchIcon,
  StitchScreen,
  StitchSurface,
  StitchText,
} from '@/ui/stitch';

type Props = {
  /** Mounted on merchant bottom tab — stack routes use parent navigator. */
  embeddedInTab?: boolean;
};

function formatPickupRange(start: unknown, end: unknown): string {
  if (typeof start !== 'string' || typeof end !== 'string') return 'Pickup not set';
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 'Pickup not set';
  const tf: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
  return `${s.toLocaleTimeString(undefined, tf)} – ${e.toLocaleTimeString(undefined, tf)}`;
}

function statusLabel(status: unknown): string {
  const s = String(status ?? '').toLowerCase();
  if (s === 'published') return 'Published';
  if (s === 'draft') return 'Draft';
  return s || 'Unknown';
}

export function MerchantShelvesListScreen({ embeddedInTab }: Props = {}) {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const stackNav = navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
  const { env } = useAuthContext();
  const { activeOutlet, loading: contextLoading } = useMerchantContext(env);
  const outletId = activeOutlet?.id != null ? String(activeOutlet.id) : null;
  const outletLabel =
    typeof activeOutlet?.name === 'string' && activeOutlet.name
      ? activeOutlet.name
      : 'Active outlet';
  const outletCategory =
    typeof activeOutlet?.category === 'string' ? activeOutlet.category : '';
  const { showShelves: shelvesAllowed } = merchantInventoryVisibility(outletCategory);

  const {
    shelves,
    todayShelf,
    loading,
    error,
    refresh,
    cloneYesterday,
  } = useMerchantShelves(env, outletId);
  const {
    templates,
    loading: templatesLoading,
    cloneTemplateToToday,
    saveTemplateFromShelf,
  } = useMerchantShelfTemplates(env, outletId);

  const { colors, spacing, radii } = useStitchTheme();
  const scrollBottomPad = useScrollContentBottomPad();

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const yesterday = useMemo(
    () => shelves.find((s) => s.shelf_date !== todayShelf?.shelf_date),
    [shelves, todayShelf?.shelf_date],
  );

  const historyShelves = useMemo(
    () => shelves.filter((s) => s.shelf_date !== todayShelf?.shelf_date),
    [shelves, todayShelf?.shelf_date],
  );

  const onCloneYesterday = useCallback(() => {
    if (!yesterday?.id) return;
    const itemCount = Array.isArray(yesterday.items) ? yesterday.items.length : 0;
    const pickup = formatPickupRange(yesterday.pickup_start, yesterday.pickup_end);
    Alert.alert(
      'Clone yesterday',
      `Copy ${itemCount} item${itemCount === 1 ? '' : 's'} and pickup (${pickup}) to today's draft shelf?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clone to today',
          onPress: () => {
            void cloneYesterday(String(yesterday.id))
              .then((newId) => {
                Alert.alert(
                  'Shelf cloned',
                  "Today's shelf is ready as a draft. Review items before publishing.",
                  [
                    {
                      text: 'Open editor',
                      onPress: () => {
                        stackNav?.navigate('MerchantShelfEditor', {
                          shelfId: newId != null ? String(newId) : undefined,
                        });
                      },
                    },
                    { text: 'OK', style: 'cancel' },
                  ],
                );
              })
              .catch((e) => {
                Alert.alert(
                  'Could not clone',
                  e instanceof Error ? e.message : 'Try again.',
                );
              });
          },
        },
      ],
    );
  }, [cloneYesterday, stackNav, yesterday]);

  const customerShelvesLive = isClearanceShelvesEnabled();

  const todayStatus = statusLabel(todayShelf?.status);
  const todayItemCount = Array.isArray(todayShelf?.items)
    ? (todayShelf.items as unknown[]).length
    : 0;

  if (!contextLoading && !shelvesAllowed) {
    return (
      <StitchScreen
        scroll
        scrollProps={{
          contentContainerStyle: {
            padding: spacing.pageMarginMobile,
            gap: spacing.md,
          },
        }}
      >
        <StitchText variant="h2" colorKey="onBackground">
          This outlet publishes rescue bags only.
        </StitchText>
        <Pressable
          onPress={() => {
            if (embeddedInTab) {
              navigation.getParent()?.navigate('MerchantBagsTab');
              return;
            }
            (stackNav ?? navigation)?.navigate('MerchantBagsList');
          }}
        >
          <StitchText variant="label" colorKey="primary">
            Go to rescue bags
          </StitchText>
        </Pressable>
      </StitchScreen>
    );
  }

  return (
    <StitchScreen scroll={false} style={{ flex: 1 }}>
      <FlatList
        data={historyShelves}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{
          paddingHorizontal: spacing.pageMarginMobile,
          paddingTop: spacing.md,
          paddingBottom: scrollBottomPad + 80,
        }}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => {
              void refresh();
            }}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <View style={{ gap: spacing.lg, marginBottom: spacing.lg }}>
            {!activeOutlet && !contextLoading ? (
              <View
                style={{
                  padding: spacing.md,
                  borderRadius: radii.lg,
                  backgroundColor: colors.accentHighlight,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: colors.outlineVariant,
                }}
              >
                <StitchText variant="body-sm" colorKey="onSurfaceVariant">
                  No outlet linked to your merchant yet.
                </StitchText>
              </View>
            ) : null}

            {!customerShelvesLive ? (
              <View
                style={{
                  padding: spacing.md,
                  borderRadius: radii.lg,
                  backgroundColor: colors.accentHighlight,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: colors.outlineVariant,
                }}
              >
                <StitchText variant="body-sm" colorKey="onBackground">
                  Customers will not see clearance shelves on Discover until
                  EXPO_PUBLIC_CLEARANCE_SHELVES_ENABLED is enabled for this build.
                  You can still manage shelves here.
                </StitchText>
              </View>
            ) : null}

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                gap: spacing.md,
              }}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <StitchText variant="label-caps" colorKey="textMuted" style={{ marginBottom: spacing.xs }}>
                  {outletLabel}
                </StitchText>
                <StitchText variant="h1" colorKey="onBackground" style={{ marginBottom: spacing.xs }}>
                  Clearance shelves
                </StitchText>
                <StitchText variant="body-md" colorKey="textMuted">
                  Daily item-level clearance for your outlet.
                </StitchText>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  (embeddedInTab ? stackNav : navigation)?.navigate('MerchantShelfEditor', {})
                }
                style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.sm,
                    minHeight: 48,
                    paddingVertical: spacing.sm,
                    paddingHorizontal: spacing.lg,
                    borderRadius: radii.lg,
                    backgroundColor: colors.primary,
                  }}
                >
                  <StitchIcon name="edit" size={18} colorKey="onPrimary" />
                  <StitchText variant="label" colorKey="onPrimary">
                    Edit today
                  </StitchText>
                </View>
              </Pressable>
            </View>

            {error ? (
              <StitchText variant="body-sm" colorKey="error">
                {error}
              </StitchText>
            ) : null}

            <Pressable
              accessibilityRole="button"
              onPress={() =>
                (embeddedInTab ? stackNav : navigation)?.navigate('MerchantShelfEditor', {
                  shelfId: todayShelf?.id as string | undefined,
                })
              }
            >
              <StitchSurface
                elevated
                padding="md"
                style={{
                  borderWidth: 1,
                  borderColor: colors.outlineVariant,
                  gap: spacing.sm,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <StitchText variant="h3" colorKey="onBackground">
                    Today&apos;s shelf
                  </StitchText>
                  <View
                    style={{
                      paddingHorizontal: spacing.sm,
                      paddingVertical: 4,
                      borderRadius: 999,
                      backgroundColor:
                        todayStatus === 'Published'
                          ? colors.primaryHighlight
                          : colors.surfaceContainer,
                    }}
                  >
                    <StitchText
                      variant="label-caps"
                      colorKey={todayStatus === 'Published' ? 'primaryContainer' : 'textMuted'}
                    >
                      {todayShelf ? todayStatus : 'Not started'}
                    </StitchText>
                  </View>
                </View>
                <StitchText variant="body-sm" colorKey="textMuted">
                  {todayShelf
                    ? `${todayItemCount} item${todayItemCount === 1 ? '' : 's'} · ${formatPickupRange(todayShelf.pickup_start, todayShelf.pickup_end)}`
                    : 'Tap to create and publish today\'s clearance items.'}
                </StitchText>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                  <StitchIcon name="chevron_right" size={18} colorKey="primary" />
                  <StitchText variant="label" colorKey="primary">
                    {todayShelf ? 'Open editor' : 'Create shelf'}
                  </StitchText>
                </View>
              </StitchSurface>
            </Pressable>

            {yesterday ? (
              <Pressable
                accessibilityRole="button"
                onPress={onCloneYesterday}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <StitchIcon name="history" size={18} colorKey="primaryContainer" />
                <StitchText variant="label" colorKey="primaryContainer">
                  Clone yesterday&apos;s shelf to today
                </StitchText>
              </Pressable>
            ) : null}

            <View style={{ gap: spacing.sm }}>
              <StitchText variant="h3" colorKey="onBackground">
                Shelf templates
              </StitchText>
              <StitchText variant="body-sm" colorKey="textMuted">
                Reusable item sets — separate from clone yesterday.
              </StitchText>
              {templatesLoading ? (
                <ActivityIndicator color={colors.primary} />
              ) : templates.length === 0 ? (
                <StitchText variant="body-sm" colorKey="textMuted">
                  No templates yet. Save one from today&apos;s shelf in the editor.
                </StitchText>
              ) : (
                templates.map((tpl) => (
                  <Pressable
                    key={tpl.id}
                    onPress={() => {
                      Alert.alert(
                        'Apply template',
                        `Create today's draft from "${tpl.name}" (${tpl.item_count} items)?`,
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Apply',
                            onPress: () => {
                              void cloneTemplateToToday(tpl.id)
                                .then((newId) => {
                                  stackNav?.navigate('MerchantShelfEditor', {
                                    shelfId: String(newId),
                                  });
                                })
                                .catch((e) =>
                                  Alert.alert(
                                    'Could not apply template',
                                    e instanceof Error ? e.message : 'Try again.',
                                  ),
                                );
                            },
                          },
                        ],
                      );
                    }}
                  >
                    <StitchSurface elevated padding="md" style={{ borderWidth: 1, borderColor: colors.outlineVariant }}>
                      <StitchText variant="label" colorKey="onBackground">
                        {tpl.name}
                      </StitchText>
                      <StitchText variant="body-sm" colorKey="textMuted">
                        {tpl.item_count} item{tpl.item_count === 1 ? '' : 's'}
                      </StitchText>
                    </StitchSurface>
                  </Pressable>
                ))
              )}
              {todayShelf && Array.isArray(todayShelf.items) && todayShelf.items.length > 0 ? (
                <Pressable
                  onPress={() => {
                    Alert.prompt(
                      'Save template',
                      'Name this template',
                      (name) => {
                        if (!name?.trim()) return;
                        void saveTemplateFromShelf({
                          name: name.trim(),
                          notes: typeof todayShelf.notes === 'string' ? todayShelf.notes : null,
                          items: todayShelf.items as Record<string, unknown>[],
                        })
                          .then(() => Alert.alert('Saved', 'Template saved.'))
                          .catch((e) =>
                            Alert.alert(
                              'Could not save',
                              e instanceof Error ? e.message : 'Try again.',
                            ),
                          );
                      },
                    );
                  }}
                >
                  <StitchText variant="label" colorKey="primaryContainer">
                    Save today&apos;s shelf as template
                  </StitchText>
                </Pressable>
              ) : null}
            </View>

            <StitchText variant="h3" colorKey="onBackground">
              History
            </StitchText>
            {loading && shelves.length === 0 ? (
              <View style={{ padding: spacing.lg, alignItems: 'center' }}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <StitchSurface
            elevated
            padding="md"
            style={{
              marginBottom: spacing.sm,
              borderWidth: 1,
              borderColor: colors.outlineVariant,
              opacity: 0.9,
            }}
          >
            <StitchText variant="label" colorKey="onBackground">
              {String(item.shelf_date)}
            </StitchText>
            <StitchText variant="body-sm" colorKey="textMuted">
              {statusLabel(item.status)} ·{' '}
              {formatPickupRange(item.pickup_start, item.pickup_end)}
            </StitchText>
          </StitchSurface>
        )}
        ListEmptyComponent={
          !loading ? (
            <StitchText variant="body-sm" colorKey="textMuted">
              No past shelves yet.
            </StitchText>
          ) : null
        }
      />
    </StitchScreen>
  );
}
