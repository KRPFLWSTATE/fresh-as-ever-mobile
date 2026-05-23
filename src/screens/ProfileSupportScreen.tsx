import React, { useLayoutEffect, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RootStackParamList } from '@/navigation/types';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import { stitchAmbientShadow } from '@/theme/stitchTokens';
import { stitchFonts } from '@/theme/stitchTokens';
import {
  StitchButton,
  StitchCard,
  StitchIcon,
  StitchText,
} from '@/ui/stitch';
import { SUPPORT_CATEGORY_FAQ_MAP, SUPPORT_FAQS } from '@/content/supportFaqs';
import { logError } from '@/observability/logError';

const SUPPORT_MAIL = 'hello@freshasever.com';
const SUPPORT_EMAIL_DISPLAY = 'hello@freshasever.com';
/**
 * Placeholder numbers shipped in the bundle. When the env-driven number resolves
 * to one of these, we surface an Alert telling the customer to email instead of
 * dialing a fake number.
 */
const PLACEHOLDER_NUMBER = '+94770000000';
const SUPPORT_WHATSAPP =
  process.env.EXPO_PUBLIC_SUPPORT_WHATSAPP ?? PLACEHOLDER_NUMBER;
const SUPPORT_PHONE =
  process.env.EXPO_PUBLIC_SUPPORT_PHONE ?? PLACEHOLDER_NUMBER;
const SUPPORT_FALLBACK_ALERT_MESSAGE =
  `Support number not configured. Email ${SUPPORT_EMAIL_DISPLAY} instead.`;

function isPlaceholderSupportNumber(value: string): boolean {
  return value === PLACEHOLDER_NUMBER;
}

function alertSupportNotConfigured(): void {
  Alert.alert('Support unavailable', SUPPORT_FALLBACK_ALERT_MESSAGE);
}

type SupportTopicTitle = keyof typeof SUPPORT_CATEGORY_FAQ_MAP;

type SupportCategory = {
  icon: 'shopping_bag' | 'account_balance_wallet' | 'shield';
  title: SupportTopicTitle;
  description: string;
  subject: string;
};

const SUPPORT_CATEGORIES: SupportCategory[] = [
  {
    icon: 'shopping_bag',
    title: 'Order Issues',
    description: 'Missing items, wrong orders, or delivery delays.',
    subject: 'Order issue – Fresh As Ever',
  },
  {
    icon: 'account_balance_wallet',
    title: 'Payments',
    description: 'Refunds, failed transactions, and billing inquiries.',
    subject: 'Payments – Fresh As Ever',
  },
  {
    icon: 'shield',
    title: 'Merchant Policies',
    description: 'Pickup rules, cancellations, and merchant ratings.',
    subject: 'Merchant policy question – Fresh As Ever',
  },
] satisfies SupportCategory[];

function faqMatchesQuery(
  faq: { question: string; answer: string },
  q: string,
): boolean {
  if (!q) return true;
  return (
    faq.question.toLowerCase().includes(q) ||
    faq.answer.toLowerCase().includes(q)
  );
}

export function ProfileSupportScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList, 'ProfileSupport'>>();
  const route = useRoute<RouteProp<RootStackParamList, 'ProfileSupport'>>();
  const audience = route.params?.audience === 'merchant' ? 'merchant' : 'customer';
  const { colors, radii, spacing } = useStitchTheme();

  const topicCategories = useMemo(() => {
    if (audience === 'merchant') {
      return [
        ...SUPPORT_CATEGORIES.filter((c) => c.title === 'Merchant Policies'),
        ...SUPPORT_CATEGORIES.filter((c) => c.title !== 'Merchant Policies'),
      ];
    }
    return SUPPORT_CATEGORIES;
  }, [audience]);
  const [query, setQuery] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [expandedCategory, setExpandedCategory] =
    useState<SupportTopicTitle | null>(null);
  const [expandedFaqId, setExpandedFaqId] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        topBar: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.md,
          height: 56,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: `${colors.divider}99`,
        },
        hit: {
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
        },
        searchWrap: {
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: colors.outlineVariant,
          borderRadius: radii.lg,
          paddingHorizontal: spacing.md,
          backgroundColor: colors.surface,
          ...stitchAmbientShadow,
        },
        catCard: {
          borderRadius: radii.xl,
          padding: spacing.lg,
          gap: spacing.md,
          ...stitchAmbientShadow,
        },
        catBubble: {
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: colors.surfaceContainer,
          alignItems: 'center',
          justifyContent: 'center',
        },
        cta: {
          alignItems: 'center',
          padding: spacing.lg,
          borderRadius: radii.xl,
          maxWidth: 512,
          alignSelf: 'center',
          width: '100%',
          ...stitchAmbientShadow,
        },
      }),
    [colors, radii, spacing],
  );

  const inputStyle = useMemo(
    () => ({
      flex: 1,
      minHeight: 48,
      paddingLeft: 40,
      paddingRight: spacing.md,
      fontFamily: stitchFonts.regular,
      fontSize: 15,
      lineHeight: 22,
      color: colors.text,
    }),
    [colors.text, spacing.md],
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
      <View style={[styles.topBar, { backgroundColor: colors.background }]}>
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [
            styles.hit,
            { backgroundColor: pressed ? colors.surface2 : 'transparent' },
          ]}
        >
          <StitchIcon name="arrow_back" size={24} colorKey="primaryContainer" />
        </Pressable>
        <StitchText variant="h2" colorKey="primaryContainer" style={{ letterSpacing: -0.5 }}>
          Fresh As Ever
        </StitchText>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: spacing.pageMarginMobile,
          paddingVertical: spacing.lg,
          paddingBottom: spacing.xxl + spacing.lg,
          gap: spacing.lg,
        }}
      >
        <View>
          <StitchText variant="h1" colorKey="onSurface">
            Help & Support
          </StitchText>
          <StitchText variant="body-lg" colorKey="textMuted" style={{ marginTop: 8 }}>
            {audience === 'merchant'
              ? 'Pickup, handover, staff, and outlet operations.'
              : 'How can we assist you today?'}
          </StitchText>
        </View>

        <View style={styles.searchWrap}>
          <View style={{ position: 'absolute', left: spacing.md, top: 12, zIndex: 1 }}>
            <StitchIcon name="search" size={22} colorKey="textMuted" />
          </View>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search for answers..."
            placeholderTextColor={colors.textMuted}
            style={inputStyle}
            returnKeyType="search"
          />
        </View>

        <View style={{ gap: spacing.lg }}>
          <StitchText variant="label-caps" colorKey="textMuted">
            Browse by topic
          </StitchText>
          {topicCategories.map((cat) => {
            const q = query.trim().toLowerCase();
            const faqKey = SUPPORT_CATEGORY_FAQ_MAP[cat.title];
            const topicFaqs = SUPPORT_FAQS.filter(
              (faq) =>
                faq.category === faqKey && faqMatchesQuery(faq, q),
            );
            const cardMatches =
              !q ||
              cat.title.toLowerCase().includes(q) ||
              cat.description.toLowerCase().includes(q) ||
              topicFaqs.length > 0;
            if (!cardMatches) return null;
            const isOpen = expandedCategory === cat.title;
            const autoExpand =
              q.length > 0 &&
              topicFaqs.length > 0 &&
              expandedCategory === null;
            const showFaqs = isOpen || autoExpand;
            return (
              <StitchCard key={cat.title} elevated padding="none">
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: showFaqs }}
                  onPress={() =>
                    setExpandedCategory((prev) =>
                      prev === cat.title ? null : cat.title,
                    )
                  }
                  style={({ pressed }) => [
                    styles.catCard,
                    { opacity: pressed ? 0.92 : 1 },
                  ]}
                >
                  <View style={styles.catBubble}>
                    <StitchIcon name={cat.icon} size={28} colorKey="surfaceTint" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <StitchText variant="h3" colorKey="onSurface" style={{ marginBottom: 4 }}>
                      {cat.title}
                    </StitchText>
                    <StitchText variant="body-sm" colorKey="textMuted">
                      {cat.description}
                    </StitchText>
                  </View>
                  <StitchIcon name="expand_more" size={24} colorKey="textMuted" />
                </Pressable>
                {showFaqs ? (
                  <View
                    style={{
                      paddingHorizontal: spacing.lg,
                      paddingBottom: spacing.lg,
                      gap: spacing.sm,
                    }}
                  >
                    {topicFaqs.length === 0 ? (
                      <StitchText variant="body-sm" colorKey="textMuted">
                        No articles match your search in this topic.
                      </StitchText>
                    ) : (
                      topicFaqs.map((faq) => {
                        const open = expandedFaqId === faq.id || (q.length > 0 && topicFaqs.length === 1);
                        return (
                          <View key={faq.id}>
                            <Pressable
                              onPress={() =>
                                setExpandedFaqId((id) =>
                                  id === faq.id ? null : faq.id,
                                )
                              }
                              style={{ paddingVertical: spacing.sm }}
                            >
                              <StitchText variant="label" colorKey="onSurface">
                                {faq.question}
                              </StitchText>
                            </Pressable>
                            {open ? (
                              <StitchText
                                variant="body-sm"
                                colorKey="textMuted"
                                style={{ paddingBottom: spacing.sm }}
                              >
                                {faq.answer}
                              </StitchText>
                            ) : null}
                          </View>
                        );
                      })
                    )}
                    <Pressable
                      onPress={() =>
                        Linking.openURL(
                          `mailto:${SUPPORT_MAIL}?subject=${encodeURIComponent(cat.subject)}`,
                        ).catch((err) =>
                          logError(err, { context: 'ProfileSupportScreen.mailto' }),
                        )
                      }
                      style={{ paddingTop: spacing.xs }}
                    >
                      <StitchText variant="label" colorKey="primaryContainer">
                        Still stuck? Email us about {cat.title.toLowerCase()}
                      </StitchText>
                    </Pressable>
                  </View>
                ) : null}
              </StitchCard>
            );
          })}
          {query.trim().length > 0 &&
          SUPPORT_CATEGORIES.every((c) => {
            const q = query.trim().toLowerCase();
            const faqKey = SUPPORT_CATEGORY_FAQ_MAP[c.title];
            const hasFaqs = SUPPORT_FAQS.some(
              (f) => f.category === faqKey && faqMatchesQuery(f, q),
            );
            return (
              !c.title.toLowerCase().includes(q) &&
              !c.description.toLowerCase().includes(q) &&
              !hasFaqs
            );
          }) ? (
            <StitchText variant="body-sm" colorKey="textMuted" style={{ textAlign: 'center' }}>
              Nothing matched "{query.trim()}". Try "pickup", "PayHere", or "refund".
            </StitchText>
          ) : null}
        </View>

        <View style={{ gap: spacing.md }}>
          <StitchText variant="label-caps" colorKey="textMuted">
            Quick answers
          </StitchText>
          {SUPPORT_FAQS.filter((faq) => faq.category === 'general' && faqMatchesQuery(faq, query.trim().toLowerCase())).map((faq) => (
            <StitchCard key={faq.id} elevated padding="lg" style={{ gap: spacing.sm }}>
              <StitchText variant="h3" colorKey="onSurface">
                {faq.question}
              </StitchText>
              <StitchText variant="body-sm" colorKey="textMuted">
                {faq.answer}
              </StitchText>
            </StitchCard>
          ))}
        </View>

        <StitchCard elevated padding="lg" style={styles.cta}>
          <StitchIcon name="support_agent" size={40} colorKey="surfaceTint" />
          <StitchText variant="h2" colorKey="onSurface" style={{ marginBottom: 8 }}>
            Still need help?
          </StitchText>
          <StitchText variant="body-md" colorKey="textMuted" style={{ textAlign: 'center', marginBottom: spacing.lg }}>
            Our support team is available from 8 AM to 8 PM to assist you with any inquiries.
          </StitchText>
          <StitchButton
            title="Chat with Us"
            onPress={() => setChatOpen(true)}
            style={{ alignSelf: 'stretch' }}
          />
        </StitchCard>

        <Pressable
          onPress={() => Linking.openURL('https://freshasever.com').catch((err) => logError(err, { context: 'ProfileSupportScreen.openURL' }))}
          style={{ paddingVertical: spacing.sm }}
        >
          <StitchText variant="label" colorKey="primaryContainer" style={{ textAlign: 'center' }}>
            freshasever.com
          </StitchText>
        </Pressable>
      </ScrollView>

      <Modal transparent visible={chatOpen} animationType="fade">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          onPress={() => setChatOpen(false)}
          style={{
            flex: 1,
            backgroundColor: `${colors.inverseSurface}66`,
            justifyContent: 'flex-end',
          }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: radii.xl,
              borderTopRightRadius: radii.xl,
              padding: spacing.lg,
              gap: spacing.md,
            }}
          >
            <View style={{ alignItems: 'center', marginBottom: spacing.xs }}>
              <View
                style={{
                  width: 36,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: colors.outlineVariant,
                }}
              />
            </View>
            <StitchText variant="h2" colorKey="onSurface">
              Chat with us
            </StitchText>
            <StitchText variant="body-sm" colorKey="textMuted">
              Pick the channel that works best for you. Our team replies during 8 AM – 8 PM (LKT).
            </StitchText>

            <Pressable
              accessibilityRole="button"
              onPress={() => {
                if (isPlaceholderSupportNumber(SUPPORT_WHATSAPP)) {
                  alertSupportNotConfigured();
                  setChatOpen(false);
                  return;
                }
                const num = SUPPORT_WHATSAPP.replace(/[^0-9]/g, '');
                const url = `whatsapp://send?phone=${num}&text=${encodeURIComponent('Hi Fresh As Ever support team,')}`;
                Linking.openURL(url).catch(() => {
                  Linking.openURL(`https://wa.me/${num}`).catch((err) => logError(err, { context: 'ProfileSupportScreen.openURL' }));
                });
                setChatOpen(false);
              }}
              style={({ pressed }) => [
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  paddingVertical: spacing.md,
                  paddingHorizontal: spacing.md,
                  borderRadius: radii.lg,
                  backgroundColor: pressed ? colors.surfaceContainer : colors.surface2,
                },
              ]}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: '#25D36622',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <StitchIcon name="chat" size={22} colorKey="primaryContainer" />
              </View>
              <View style={{ flex: 1 }}>
                <StitchText variant="label" colorKey="onSurface">
                  WhatsApp
                </StitchText>
                <StitchText variant="body-sm" colorKey="textMuted">
                  Typical reply under 10 minutes.
                </StitchText>
              </View>
              <StitchIcon name="chevron_right" size={20} colorKey="textMuted" />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => {
                Linking.openURL(
                  `mailto:${SUPPORT_MAIL}?subject=Fresh%20As%20Ever%20support`,
                ).catch((err) => logError(err, { context: 'ProfileSupportScreen.openURL' }));
                setChatOpen(false);
              }}
              style={({ pressed }) => [
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  paddingVertical: spacing.md,
                  paddingHorizontal: spacing.md,
                  borderRadius: radii.lg,
                  backgroundColor: pressed ? colors.surfaceContainer : colors.surface2,
                },
              ]}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: colors.primaryHighlight,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <StitchIcon name="mail" size={22} colorKey="primaryContainer" />
              </View>
              <View style={{ flex: 1 }}>
                <StitchText variant="label" colorKey="onSurface">
                  Email
                </StitchText>
                <StitchText variant="body-sm" colorKey="textMuted">
                  {SUPPORT_MAIL}
                </StitchText>
              </View>
              <StitchIcon name="chevron_right" size={20} colorKey="textMuted" />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => {
                if (isPlaceholderSupportNumber(SUPPORT_PHONE)) {
                  alertSupportNotConfigured();
                  setChatOpen(false);
                  return;
                }
                Linking.openURL(`tel:${SUPPORT_PHONE}`).catch((err) =>
                  logError(err, { context: 'ProfileSupportScreen.openURL' }),
                );
                setChatOpen(false);
              }}
              style={({ pressed }) => [
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  paddingVertical: spacing.md,
                  paddingHorizontal: spacing.md,
                  borderRadius: radii.lg,
                  backgroundColor: pressed ? colors.surfaceContainer : colors.surface2,
                },
              ]}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: colors.accentHighlight,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <StitchIcon name="support_agent" size={22} colorKey="primaryContainer" />
              </View>
              <View style={{ flex: 1 }}>
                <StitchText variant="label" colorKey="onSurface">
                  Call hotline
                </StitchText>
                <StitchText variant="body-sm" colorKey="textMuted">
                  Mon–Sun, 8 AM – 8 PM (LKT)
                </StitchText>
              </View>
              <StitchIcon name="chevron_right" size={20} colorKey="textMuted" />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => setChatOpen(false)}
              style={{ paddingVertical: spacing.sm, alignItems: 'center' }}
            >
              <StitchText variant="label" colorKey="textMuted">
                Cancel
              </StitchText>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
