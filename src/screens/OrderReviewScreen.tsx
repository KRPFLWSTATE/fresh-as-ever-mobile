import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootStackParamList } from '@/navigation/types';
import { orderIdParam } from '@/contracts/routeParams';
import { getSupabase } from '@/lib/supabase';
import { useAuthContext } from '@/context/AuthContext';
import { orderDisplayTitle } from '@/lib/orderDisplay';
import { isOrderIdUuidShape } from '@/lib/orderStatus';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import {
  StitchButton,
  StitchIcon,
  StitchText,
} from '@/ui/stitch';

type BagJoin = {
  title?: string | null;
  category?: string | null;
  image_url?: string | null;
} | null;

type OutletJoin = {
  name?: string | null;
  merchant?: { business_name?: string | null } | null;
} | null;

type SummaryRow = {
  id: string;
  shelf_id?: string | null;
  order_items?: { name_snapshot?: string | null; quantity?: number | null }[] | null;
  bag: BagJoin;
  outlet: OutletJoin;
};

/**
 * Stitch `leave_review` uses per-star copy: 1: "Could be better", 2: "It was okay",
 * 3: "Good", 4: "Great", 5: "Excellent". The 4-star variant ("Great") is what the
 * HTML mockup shows.
 */
const RATING_WORDS = [
  '',
  'Could be better',
  'It was okay',
  'Good',
  'Great',
  'Excellent',
];

function ratingWord(n: number): string {
  return RATING_WORDS[n] ?? '';
}

export function OrderReviewScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'OrderReview'>>();
  const parsed = orderIdParam.safeParse({
    orderId: route.params.orderId,
  });
  const rawRef = parsed.success ? parsed.data.orderId : '';
  const { env, session, user } = useAuthContext();
  const { colors, spacing, radii } = useStitchTheme();
  const insets = useSafeAreaInsets();
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SummaryRow | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  const headerBorder = colors.headerBorder;

  const styles = useMemo(
    () =>
      createStyles({
        spacing,
        radii,
        headerBorder,
      }),
    [spacing, radii, headerBorder],
  );

  const loadSummary = useCallback(async () => {
    if (!parsed.success || !rawRef || !session?.user.id) {
      setSummary(null);
      setSummaryLoading(false);
      return;
    }
    setSummaryLoading(true);
    const sb = getSupabase(env);
    const isUuid = isOrderIdUuidShape(rawRef.trim());
    let q = sb
      .from('orders')
      .select(
        `
          id,
          shelf_id,
          order_items(name_snapshot, quantity),
          bag:rescue_bags(title, category, image_url),
          outlet:outlets(name, merchant:merchants(business_name))
        `,
      )
      .eq('customer_id', session.user.id);
    q = isUuid
      ? q.eq('id', rawRef.trim())
      : q.eq('reservation_code', rawRef.trim().toUpperCase());
    const { data } = await q.maybeSingle();
    setSummary(data as SummaryRow | null);
    setSummaryLoading(false);
  }, [env, parsed.success, rawRef, session?.user.id]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const submit = useCallback(async () => {
    if (!parsed.success || !rawRef) return;
    if (!session?.user) {
      setError('Please sign in to submit your review.');
      return;
    }
    if (!rating) {
      setError('Tap a star rating first.');
      return;
    }

    const customerIdCandidates = new Set<string>([session.user.id]);
    if (session.user.email) {
      const sb = getSupabase(env);
      const { data: profileByEmail } = await sb
        .from('profiles')
        .select('id')
        .eq('email', session.user.email)
        .maybeSingle();
      if (
        typeof profileByEmail?.id === 'string' ||
        typeof profileByEmail?.id === 'number'
      ) {
        customerIdCandidates.add(String(profileByEmail.id));
      }
    }
    const scopedIds = Array.from(customerIdCandidates);

    setBusy(true);
    setError(null);
    try {
      const sb = getSupabase(env);
      const isUuid = isOrderIdUuidShape(rawRef.trim());
      let q = sb
        .from('orders')
        .select('id, outlet_id')
        .in('customer_id', scopedIds);
      q = isUuid
        ? q.eq('id', rawRef.trim())
        : q.eq('reservation_code', rawRef.trim().toUpperCase());
      const { data: order, error: orderErr } = await q.maybeSingle();
      if (orderErr) throw orderErr;

      let verified = order as
        | { id: string; outlet_id: string }
        | null
        | undefined;

      if (!verified) {
        let fq = sb.from('orders').select('id, outlet_id');
        fq = isUuid
          ? fq.eq('id', rawRef.trim())
          : fq.eq('reservation_code', rawRef.trim().toUpperCase());
        const { data: fallback, error: fErr } = await fq.maybeSingle();
        if (fErr) {
          throw fErr;
        }
        if (
          fallback &&
          typeof fallback === 'object' &&
          'id' in fallback &&
          session.user.id
        ) {
          verified = fallback as { id: string; outlet_id: string };
        }
      }

      const customerFinal = user?.id ?? session.user.id;
      if (!verified || !customerFinal) {
        setError('We could not verify this order for review.');
        return;
      }

      const { data: existing, error: existingErr } = await sb
        .from('reviews')
        .select('id')
        .eq('order_id', verified.id)
        .eq('customer_id', customerFinal)
        .maybeSingle();
      if (existingErr) throw existingErr;

      const payload = {
        order_id: verified.id,
        outlet_id: verified.outlet_id,
        customer_id: customerFinal,
        rating,
        comment: review.trim() || null,
      };

      if (existing?.id) {
        const { error: updateError } = await sb
          .from('reviews')
          .update(payload)
          .eq('id', String((existing as { id: unknown }).id));
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await sb.from('reviews').insert(payload);
        if (insertError) throw insertError;
      }

      navigation.replace('OrderCelebration', {
        orderId: verified.id,
        variant: 'rescue',
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit review.');
    } finally {
      setBusy(false);
    }
  }, [
    parsed.success,
    rawRef,
    session?.user,
    env,
    rating,
    review,
    navigation,
    user?.id,
  ]);

  const bag = summary?.bag;
  const outlet = summary?.outlet;
  const venue =
    typeof outlet?.merchant?.business_name === 'string' &&
    outlet.merchant.business_name
      ? outlet.merchant.business_name
      : typeof outlet?.name === 'string'
        ? outlet.name
        : '';
  const title = orderDisplayTitle({
    shelf_id: summary?.shelf_id,
    bag,
    order_items: summary?.order_items,
  });
  const category =
    summary?.shelf_id
      ? 'Clearance shelf'
      : bag?.category != null
        ? String(bag.category).replace(/_/g, ' ')
        : '';

  if (!parsed.success) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <StitchText variant="body-md" colorKey="onSurface">
          Invalid review link.
        </StitchText>
      </View>
    );
  }

  if (!session) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <StitchText variant="body-md" colorKey="onSurface" style={{ marginBottom: spacing.sm }}>
          Sign in to leave a review.
        </StitchText>
        <StitchButton title="Sign in" onPress={() => navigation.navigate('Login')} />
      </View>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.topBar,
          {
            paddingTop: insets.top + spacing.sm,
            borderBottomColor: headerBorder,
            backgroundColor: colors.background,
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [
            styles.iconHit,
            { opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <StitchIcon name="close" size={28} colorKey="primaryContainer" />
        </Pressable>
        <StitchText variant="h2" colorKey="primaryContainer">
          Fresh As Ever
        </StitchText>
        <View style={styles.iconHit} />
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: spacing.xxl + Math.max(insets.bottom, spacing.md) },
        ]}
      >
        <View style={{ alignItems: 'center', marginBottom: spacing.md }}>
          <StitchText variant="display" colorKey="text">
            How was it?
          </StitchText>
          <StitchText
            variant="body-md"
            colorKey="textMuted"
            style={{ textAlign: 'center', marginTop: spacing.xs }}
          >
            Your feedback helps us rescue more food.
          </StitchText>
        </View>

        {summaryLoading ? (
          <View style={{ paddingVertical: spacing.xl, alignItems: 'center' }}>
            <ActivityIndicator color={colors.primaryContainer} />
          </View>
        ) : (
          <View
            style={[
              styles.summaryCard,
              {
                borderColor: colors.surfaceContainerLow,
                backgroundColor: colors.surface,
              },
            ]}
          >
            {typeof bag?.image_url === 'string' ? (
              <Image
                source={{ uri: bag.image_url }}
                style={styles.thumb}
                resizeMode="cover"
                accessibilityLabel={`${bag.title ?? 'Bag'} preview`}
              />
            ) : (
              <View
                style={[
                  styles.thumb,
                  { backgroundColor: colors.surfaceDim },
                ]}
              />
            )}
            <View style={{ flex: 1 }}>
              {category ? (
                <StitchText variant="label-caps" colorKey="textMuted">
                  {category}
                </StitchText>
              ) : null}
              {venue ? (
                <StitchText variant="label" colorKey="textMuted">
                  {venue}
                </StitchText>
              ) : null}
              <StitchText variant="h3" colorKey="text" style={{ marginTop: spacing.xs }}>
                {title}
              </StitchText>
            </View>
          </View>
        )}

        <View style={styles.starsBlock}>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Pressable
                key={star}
                accessibilityRole="button"
                accessibilityLabel={`Rate ${star} stars`}
                onPress={() => setRating(star)}
                style={({ pressed }) => ({
                  opacity: pressed ? 0.85 : 1,
                  paddingHorizontal: 2,
                })}
              >
                <StitchIcon
                  name={star <= rating ? 'star' : 'star_border'}
                  size={48}
                  color={star <= rating ? colors.accent : colors.outlineVariant}
                />
              </Pressable>
            ))}
          </View>
          {rating > 0 ? (
            <StitchText variant="label" colorKey="textMuted">
              {ratingWord(rating)}
            </StitchText>
          ) : null}
        </View>

        <View style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline' }}>
            <StitchText variant="label" colorKey="text">
              Add a comment{' '}
            </StitchText>
            <StitchText variant="label" colorKey="textFaint">
              (Optional)
            </StitchText>
          </View>
          <TextInput
            value={review}
            onChangeText={setReview}
            placeholder="What did you love about this rescue?"
            placeholderTextColor={colors.textFaint}
            multiline
            style={[
              styles.ta,
              {
                borderColor: colors.outlineVariant,
                backgroundColor: colors.surface,
                color: colors.text,
              },
            ]}
          />
        </View>

        {error ? (
          <StitchText variant="body-sm" colorKey="error" style={{ marginTop: spacing.sm }}>
            {error}
          </StitchText>
        ) : null}

        <View style={{ marginTop: spacing.lg }}>
          <StitchButton
            title="Submit Review"
            loading={busy}
            disabled={busy}
            onPress={() => {
              submit().catch(() => {});
            }}
          />
        </View>
      </ScrollView>
    </View>
  );
}

function createStyles({
  spacing,
  radii,
  headerBorder,
}: {
  spacing: typeof import('@/theme/stitchTokens').stitchSpacing;
  radii: typeof import('@/theme/stitchTokens').stitchRadii;
  headerBorder: string;
}) {
  return StyleSheet.create({
    flex: { flex: 1 },
    center: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.lg,
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.pageMarginMobile,
      paddingBottom: spacing.sm,
      minHeight: 56,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: headerBorder,
    },
    iconHit: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    scrollContent: {
      paddingHorizontal: spacing.pageMarginMobile,
      paddingTop: spacing.lg,
      gap: spacing.lg,
    },
    summaryCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: radii.xl,
      borderWidth: 1,
    },
    thumb: {
      width: 80,
      height: 80,
      borderRadius: radii.lg,
    },
    starsBlock: {
      alignItems: 'center',
      paddingVertical: spacing.md,
      gap: spacing.md,
    },
    starsRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      justifyContent: 'center',
    },
    ta: {
      minHeight: 140,
      borderWidth: 1,
      borderRadius: radii.lg,
      padding: spacing.md,
      fontFamily: 'PlusJakartaSans-Regular',
      fontSize: 15,
      textAlignVertical: 'top',
    },
  });
}
