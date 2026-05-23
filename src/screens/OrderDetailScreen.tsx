import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootStackParamList } from '@/navigation/types';
import { orderIdParam } from '@/contracts/routeParams';
import {
  ACTIVE_ORDER_STATUSES,
  isOrderIdUuidShape,
  normalizeOrderStatus,
} from '@/lib/orderStatus';
import { isCustomerArrivalEligible } from '@/domain/pickupWindow';
import { mapArrivalError } from '@/lib/messages/rpc';
import { ERROR } from '@/lib/messages/errors';
import { getSupabase } from '@/lib/supabase';
import { mapSupabaseError } from '@/lib/supabaseError';
import { useAuthContext } from '@/context/AuthContext';
import { FALLBACK_COORDS } from '@/lib/fallbackCoords';
import { openOutletDirections } from '@/lib/openOutletDirections';
import { parseOutletCoords } from '@/lib/parseOutletCoords';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import { ReportProblemModal } from '@/components/ReportProblemModal';
import {
  customerCanReportProblem,
  fetchCustomerComplaintForOrder,
  type ExistingOrderComplaint,
} from '@/lib/complaints/submitCustomerComplaint';
import { isOpenComplaintStatus } from '@/lib/adminComplaints';
import {
  StitchButton,
  StitchCard,
  StitchIcon,
  StitchText,
} from '@/ui/stitch';
import type { StitchIconName } from '@/ui/stitch/iconMap';

type BagJoin = {
  title?: string | null;
  category?: string | null;
  image_url?: string | null;
  pickup_start?: string | null;
  pickup_end?: string | null;
} | null;

type OutletJoin = {
  name?: string | null;
  address?: string | null;
  landmark?: string | null;
  /**
   * PostGIS `geography(Point)` field. Supabase returns it as a GeoJSON-ish
   * object on read (e.g. `{ type: 'Point', coordinates: [lng, lat] }`) or a
   * stringified WKB hex when raw. Tolerated as `unknown` here and parsed at
   * use-site by `parseOutletCoords`.
   */
  location?: unknown;
  merchant?: { business_name?: string | null } | null;
} | null;

type OrderRow = {
  id: string;
  order_status: string | null;
  total: number | null;
  subtotal: number | null;
  platform_fee: number | null;
  unit_price: number | null;
  quantity: number | null;
  created_at: string | null;
  payment_method: string | null;
  payment_status: string | null;
  reservation_code: string | null;
  customer_arrived_at: string | null;
  bag: BagJoin;
  outlet: OutletJoin;
};

function formatLKR(value: number): string {
  const n = Math.round(value);
  return `LKR ${n.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Re-export the canonical FALLBACK_COORDS so the static-map raster shares the
 * same Colombo anchor as the live-location hook. We keep the descriptive
 * local alias so the use-site stays self-documenting (`?? FALLBACK_OUTLET_COORDS`),
 * but the literal lat/lng lives in one place (`@/hooks/useUserLocation`).
 */
const FALLBACK_OUTLET_COORDS: { lat: number; lng: number } = FALLBACK_COORDS;

function formatVerificationCode(code: string | null | undefined): string {
  const c = String(code ?? '')
    .replace(/\s/g, '')
    .slice(0, 6)
    .toUpperCase();
  if (c.length <= 3) return c;
  return `${c.slice(0, 3)} ${c.slice(3)}`;
}

function formatOrderLabel(id: string, reservationCode: string | null): string {
  const tail = id.replace(/-/g, '').slice(-8).toUpperCase();
  const rc = reservationCode?.trim();
  if (rc) return `Order #FAE-${rc}`;
  return `Order #FAE-${tail.slice(0, 4)}-${tail.slice(4, 6)}`;
}

function formatPickupWindow(
  startIso: string | null | undefined,
  endIso: string | null | undefined,
): { window: string; day: string } {
  if (!startIso || !endIso) return { window: '—', day: '' };
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { window: '—', day: '' };
  }
  const tf: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
  };
  const window = `${start.toLocaleTimeString(undefined, tf)} - ${end.toLocaleTimeString(undefined, tf)}`;
  const today = new Date();
  const day =
    start.toDateString() === today.toDateString()
      ? 'Today'
      : start.toLocaleDateString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        });
  return { window, day };
}

function heroStatusIcon(normalized: string): StitchIconName {
  switch (normalized) {
    case 'ready_for_pickup':
      return 'check_circle';
    case 'paid':
      return 'schedule';
    case 'reserved':
      return 'info';
    default:
      return 'check_circle';
  }
}

function heroCopy(normalized: string): { badge: string; body: string } {
  switch (normalized) {
    case 'ready_for_pickup':
      return {
        badge: 'Ready to Collect',
        body: 'Show this code at the store to collect your rescue bag.',
      };
    case 'paid':
      return {
        badge: 'Preparing',
        body: 'Your order is being prepared. Show this code when you arrive for pickup.',
      };
    case 'reserved':
      return {
        badge: 'Reserved',
        body: 'Complete checkout to confirm your rescue. Your reservation code is below.',
      };
    default:
      return {
        badge: normalized.replace(/_/g, ' ').replace(/\b\w/g, (x) => x.toUpperCase()),
        body: 'Order details and pickup information.',
      };
  }
}

function paymentMethodLabel(
  method: string | null | undefined,
  paymentStatus: string | null | undefined,
): string {
  const m = String(method ?? '').toLowerCase();
  const ps = String(paymentStatus ?? '').toLowerCase();
  if (ps === 'pending' || ps === 'unpaid') {
    return m === 'cash' ? 'Pay at pickup' : 'Payment pending';
  }
  if (m === 'cash') return 'Pay at pickup';
  if (m === 'card') return 'Paid via card';
  return m ? `Paid via ${m}` : 'Paid';
}

function formatOrderedAt(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const date = d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
  const time = d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${date}, ${time}`;
}

export function OrderDetailScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route =
    useRoute<RouteProp<RootStackParamList, 'OrderDetail'>>();
  const parsed = orderIdParam.safeParse({ orderId: route.params.orderId });
  const orderId = parsed.success ? parsed.data.orderId : '';
  /**
   * Stitch ships an `_2` variant of order detail that centers the brand logo in the
   * title bar instead of the "Order Detail" title. Honored via the route param so
   * the deep link `freshasever://orders/<id>?headerVariant=logo` lands on `_2`.
   */
  const headerVariant: 'title' | 'logo' =
    route.params.headerVariant === 'logo' ? 'logo' : 'title';
  const { env, session } = useAuthContext();
  const { colors, spacing, radii, mode } = useStitchTheme();
  const insets = useSafeAreaInsets();
  const [row, setRow] = useState<OrderRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [signalingArrival, setSignalingArrival] = useState(false);
  const [qrEnlarged, setQrEnlarged] = useState(false);
  const [existingComplaint, setExistingComplaint] =
    useState<ExistingOrderComplaint | null>(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);

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

  const primaryHighlightSoft = useMemo(
    () =>
      mode === 'dark'
        ? 'rgba(1, 105, 111, 0.22)'
        : 'rgba(208, 232, 230, 0.35)',
    [mode],
  );

  const load = useCallback(async () => {
    if (!session?.user.id || !parsed.success) {
      setRow(null);
      setLoading(false);
      return;
    }
    const ref = String(orderId).trim();
    if (!ref) {
      setRow(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const sb = getSupabase(env);
    const uuid = isOrderIdUuidShape(ref);
    let q = sb
      .from('orders')
      .select(
        `
          id,
          order_status,
          total,
          subtotal,
          platform_fee,
          unit_price,
          quantity,
          created_at,
          payment_method,
          payment_status,
          reservation_code,
          customer_arrived_at,
          bag:rescue_bags(title, category, image_url, pickup_start, pickup_end),
          outlet:outlets(name, address, landmark, location, merchant:merchants(business_name))
        `,
      )
      .eq('customer_id', session.user.id);
    q = uuid ? q.eq('id', ref) : q.eq('reservation_code', ref.toUpperCase());

    const { data, error } = await q.maybeSingle();
    setLoading(false);
    const orderRow = error ? null : (data as OrderRow);
    setRow(orderRow);
    if (orderRow?.id && session?.user.id) {
      const complaint = await fetchCustomerComplaintForOrder(
        env,
        orderRow.id,
        session.user.id,
      );
      setExistingComplaint(complaint);
    } else {
      setExistingComplaint(null);
    }
  }, [env, orderId, parsed.success, session?.user.id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!row?.id) return;
    const st = normalizeOrderStatus(String(row.order_status ?? ''));
    const ps = String(row.payment_status ?? '').toLowerCase();
    if (st !== 'reserved' || ps !== 'paid') return;
    const timer = setInterval(() => {
      void load();
    }, 10_000);
    return () => clearInterval(timer);
  }, [load, row?.id, row?.order_status, row?.payment_status]);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const onCancel = useCallback(() => {
    if (!row?.id || !session?.user.id) return;
    Alert.alert(
      'Cancel order',
      'Are you sure you want to cancel this order?',
      [
        { text: 'Keep order', style: 'cancel' },
        {
          text: 'Cancel order',
          style: 'destructive',
          onPress: () => {
            setCancelling(true);
            void (async () => {
              try {
                const sb = getSupabase(env);
                const { error } = await sb
                  .from('orders')
                  .update({
                    order_status: 'cancelled',
                    cancelled_at: new Date().toISOString(),
                    cancelled_by: session.user.id,
                    cancellation_reason: 'customer_requested',
                  })
                  .eq('id', row.id)
                  .eq('customer_id', session.user.id);
                if (error) throw error;
                await load();
              } catch (e) {
                Alert.alert(
                  'Could not cancel',
                  mapSupabaseError(e as Error, ERROR.common.fallback),
                );
              } finally {
                setCancelling(false);
              }
            })();
          },
        },
      ],
    );
  }, [env, load, row?.id, session?.user.id]);

  const scrollBottomPad = spacing.xxl + Math.max(insets.bottom, spacing.md);

  if (!parsed.success) {
    return (
      <View style={[styles.centerFill, { backgroundColor: colors.background }]}>
        <StitchText variant="body-md" colorKey="onSurface">
          Invalid order.
        </StitchText>
      </View>
    );
  }

  if (!session) {
    return (
      <View style={[styles.centerFill, { backgroundColor: colors.background }]}>
        <StitchText variant="body-md" colorKey="onSurface">
          Please sign in.
        </StitchText>
        <StitchButton
          title="Sign in"
          onPress={() => navigation.navigate('Login')}
        />
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.centerFill, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primaryContainer} />
      </View>
    );
  }

  if (!row) {
    return (
      <View style={[styles.centerFill, { backgroundColor: colors.background }]}>
        <StitchText variant="body-md" colorKey="onSurface">
          We couldn’t load this order.
        </StitchText>
        <StitchButton title="Retry" onPress={() => void load()} />
      </View>
    );
  }

  const normalized = normalizeOrderStatus(String(row.order_status ?? ''));
  const bag = row.bag;
  const outlet = row.outlet;
  const venue =
    typeof outlet?.merchant?.business_name === 'string' &&
    outlet.merchant.business_name
      ? outlet.merchant.business_name
      : typeof outlet?.name === 'string'
        ? outlet.name
        : '';
  const outletTitle =
    typeof outlet?.name === 'string' && outlet.name ? outlet.name : venue;
  const title =
    typeof bag?.title === 'string' && bag.title ? bag.title : 'Rescue bag';
  const category =
    bag?.category != null ? String(bag.category).replace(/_/g, ' ') : '';
  const { window: pickupWindow, day: pickupDay } = formatPickupWindow(
    bag?.pickup_start,
    bag?.pickup_end,
  );
  const pickupLine =
    pickupDay && pickupWindow !== '—'
      ? `${pickupDay}, ${pickupWindow}`
      : pickupWindow;

  const addressParts = [
    outlet?.address != null ? String(outlet.address) : '',
    outlet?.landmark != null ? String(outlet.landmark) : '',
  ].filter(Boolean);
  const addressBlock = addressParts.join('\n');

  const qty =
    typeof row.quantity === 'number' && row.quantity > 0 ? row.quantity : 1;
  const subtotal =
    typeof row.subtotal === 'number'
      ? row.subtotal
      : (typeof row.unit_price === 'number' ? row.unit_price : 0) * qty;
  const platformFee =
    typeof row.platform_fee === 'number' ? row.platform_fee : 0;
  const total =
    typeof row.total === 'number' ? row.total : subtotal + platformFee;

  const onDirections = () => {
    openOutletDirections({
      name: outletTitle,
      address: outlet?.address != null ? String(outlet.address) : null,
      landmark: outlet?.landmark != null ? String(outlet.landmark) : null,
    });
  };

  const { badge: heroBadge, body: heroBody } = heroCopy(normalized);
  const verCode = formatVerificationCode(row.reservation_code);
  const orderLabel = formatOrderLabel(row.id, row.reservation_code);
  const canCancel = ACTIVE_ORDER_STATUSES.includes(
    normalized as (typeof ACTIVE_ORDER_STATUSES)[number],
  );
  const showReview = normalized === 'collected';
  const canReportProblem = customerCanReportProblem(
    normalized,
    existingComplaint,
  );
  const openComplaintOnFile =
    existingComplaint != null &&
    isOpenComplaintStatus(existingComplaint.status);
  const paymentStatus = String(row.payment_status ?? '').toLowerCase();
  const nowMs = Date.now();
  const pickupStart = bag?.pickup_start ?? null;
  const pickupEnd = bag?.pickup_end ?? null;
  const arrivalWindowOpen = isCustomerArrivalEligible(nowMs, pickupStart, pickupEnd);
  const isCollectibleForArrival =
    ['reserved', 'paid', 'ready_for_pickup'].includes(normalized) &&
    (normalized !== 'reserved' || paymentStatus === 'paid');
  const canSignalArrival =
    isCollectibleForArrival && arrivalWindowOpen && !row.customer_arrived_at;
  const showArrivalCta = isCollectibleForArrival && !row.customer_arrived_at;
  const arrivalDisabledReason = !isCollectibleForArrival
    ? null
    : paymentStatus !== 'paid' && normalized === 'reserved'
      ? 'Complete payment first'
      : !arrivalWindowOpen
        ? 'Available when pickup opens'
        : null;

  const onSignalArrival = () => {
    if (!row?.id || !session?.user.id) return;
    setSignalingArrival(true);
    void (async () => {
      try {
        const sb = getSupabase(env);
        const { error } = await sb.rpc('customer_signal_arrival', {
          p_order_id: row.id,
        });
        if (error) throw error;
        await load();
        Alert.alert(
          'Outlet notified',
          'Staff can see that you have arrived. Show your code or QR when ready.',
        );
      } catch (e) {
        Alert.alert(
          'Could not notify outlet',
          mapArrivalError(
            e instanceof Error ? e.message : null,
            ERROR.arrival.failed,
          ),
        );
      } finally {
        setSignalingArrival(false);
      }
    })();
  };

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
          accessibilityLabel="Go back"
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [
            styles.iconHit,
            { opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <StitchIcon name="arrow_back" size={28} colorKey="primaryContainer" />
        </Pressable>
        {headerVariant === 'logo' ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <StitchIcon name="eco" size={22} colorKey="primaryContainer" />
            <StitchText
              variant="h2"
              colorKey="primaryContainer"
              style={{ letterSpacing: -0.5 }}
            >
              Fresh As Ever
            </StitchText>
          </View>
        ) : (
          <StitchText variant="h2" colorKey="primaryContainer">
            Order Detail
          </StitchText>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Help"
          onPress={() => navigation.navigate('ProfileSupport')}
          style={({ pressed }) => [
            styles.iconHit,
            { opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <StitchIcon name="help" size={28} colorKey="outline" />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: scrollBottomPad },
        ]}
      >
        <StitchCard style={styles.heroCard}>
          <View
            style={[
              styles.statusPill,
              { backgroundColor: colors.primaryHighlight },
            ]}
          >
            <StitchIcon
              name={heroStatusIcon(normalized)}
              size={18}
              colorKey="primaryContainer"
            />
            <StitchText variant="label" colorKey="primaryContainer">
              {heroBadge}
            </StitchText>
          </View>
          <StitchText
            variant="body-md"
            colorKey="textMuted"
            style={{ textAlign: 'center', marginBottom: spacing.lg }}
          >
            {heroBody}
          </StitchText>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Enlarge QR code"
            onPress={() => setQrEnlarged(true)}
            style={({ pressed }) => [
              styles.qrShell,
              {
                borderColor: colors.divider,
                backgroundColor: colors.surface,
                opacity: pressed ? 0.92 : 1,
              },
            ]}
          >
            <View
              style={[
                styles.qrInner,
                {
                  borderColor: colors.outlineVariant,
                  backgroundColor: colors.surface,
                },
              ]}
            >
              <QRCode
                value={(row.reservation_code || row.id || 'FAE').toString()}
                size={172}
                color={mode === 'dark' ? colors.qrBackground : colors.qrForeground}
                backgroundColor={
                  mode === 'dark' ? colors.surface : colors.qrBackground
                }
              />
            </View>
          </Pressable>

          <StitchText
            variant="body-sm"
            colorKey="textFaint"
            style={{ textAlign: 'center', marginBottom: spacing.xs }}
          >
            Show at pickup · Tap to enlarge
          </StitchText>

          <StitchText
            variant="label-caps"
            colorKey="textMuted"
            style={{ textAlign: 'center', marginBottom: spacing.xs }}
          >
            Verification Code
          </StitchText>
          <View
            style={[
              styles.codeChip,
              { backgroundColor: colors.surface2 },
            ]}
          >
            <StitchText variant="display" colorKey="text">
              {verCode || '—— ——'}
            </StitchText>
          </View>
          <StitchText
            variant="body-sm"
            colorKey="textFaint"
            style={{ textAlign: 'center', marginTop: spacing.md }}
          >
            {orderLabel}
          </StitchText>
        </StitchCard>

        <StitchCard style={{ marginBottom: spacing.lg }}>
          <View style={styles.bagRow}>
            {typeof bag?.image_url === 'string' ? (
              <Image
                source={{ uri: bag.image_url }}
                style={styles.bagThumb}
                resizeMode="cover"
                accessibilityLabel={`${bag.title ?? 'Bag'} preview`}
              />
            ) : (
              <View
                style={[
                  styles.bagThumb,
                  { backgroundColor: colors.surfaceContainerHigh },
                ]}
              />
            )}
            <View style={styles.bagCopy}>
              <View>
                {category ? (
                  <View
                    style={[
                      styles.categoryPill,
                      { backgroundColor: colors.primaryHighlight },
                    ]}
                  >
                    <StitchText variant="label-caps" colorKey="primaryContainer">
                      {category}
                    </StitchText>
                  </View>
                ) : null}
                <StitchText variant="h3" colorKey="text" style={{ marginTop: spacing.xs }}>
                  {title}
                </StitchText>
                {venue ? (
                  <StitchText variant="body-sm" colorKey="textMuted">
                    {venue}
                  </StitchText>
                ) : null}
              </View>
              <View style={styles.pickupRow}>
                <StitchIcon name="schedule" size={18} colorKey="textMuted" />
                <StitchText variant="body-sm" colorKey="textMuted">
                  {pickupLine}
                </StitchText>
              </View>
            </View>
          </View>
        </StitchCard>

        <StitchCard style={{ marginBottom: spacing.lg }}>
          <View style={[styles.sectionHead, { borderBottomColor: colors.divider }]}>
            <StitchText variant="h3" colorKey="text">
              Pickup Location
            </StitchText>
          </View>
          <View style={styles.locationRow}>
            <View style={{ flex: 1 }}>
              <StitchText variant="label" colorKey="text">
                {outletTitle || 'Outlet'}
              </StitchText>
              {addressBlock ? (
                <StitchText
                  variant="body-sm"
                  colorKey="textMuted"
                  style={{ marginTop: spacing.xs, marginBottom: spacing.sm }}
                >
                  {addressBlock}
                </StitchText>
              ) : null}
              <Pressable
                accessibilityRole="button"
                onPress={() => void onDirections()}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <StitchIcon name="location_on" size={18} colorKey="primaryContainer" />
                <StitchText variant="label" colorKey="primaryContainer">
                  Get Directions
                </StitchText>
              </Pressable>
            </View>
            <View
              style={[
                styles.mapThumb,
                {
                  borderColor: colors.divider,
                  backgroundColor: colors.surface2,
                },
              ]}
            >
              {/*
                Static OpenStreetMap raster centred on the outlet's PostGIS
                `geography(Point)` location, falling back to Colombo centre if
                the row has no location (legacy seed data). The pin overlay sits
                on top of the raster — both are decorative thumbnails; tapping
                this surface fires the directions intent up the tree.
              */}
              {(() => {
                const parsedCoords = parseOutletCoords(row.outlet?.location);
                const c = parsedCoords ?? FALLBACK_OUTLET_COORDS;
                return (
                  <Image
                    source={{
                      uri: `https://staticmap.openstreetmap.de/staticmap.php?center=${c.lat},${c.lng}&zoom=14&size=192x192&maptype=mapnik`,
                    }}
                    style={StyleSheet.absoluteFill}
                    resizeMode="cover"
                    accessible={false}
                  />
                );
              })()}
              <View style={styles.mapPinOverlay}>
                <StitchIcon name="location_on" size={28} colorKey="primaryContainer" />
              </View>
            </View>
          </View>
        </StitchCard>

        <StitchCard style={{ marginBottom: spacing.lg }}>
          <View style={[styles.sectionHead, { borderBottomColor: colors.divider }]}>
            <StitchText variant="h3" colorKey="text">
              Payment Summary
            </StitchText>
          </View>
          <View style={{ gap: spacing.sm }}>
            <View style={styles.priceRow}>
              <StitchText variant="body-md" colorKey="textMuted">
                {title} (×{qty})
              </StitchText>
              <StitchText variant="body-md" colorKey="textMuted">
                {formatLKR(subtotal)}
              </StitchText>
            </View>
            <View style={styles.priceRow}>
              <StitchText variant="body-md" colorKey="textMuted">
                Platform Fee
              </StitchText>
              <StitchText variant="body-md" colorKey="textMuted">
                {formatLKR(platformFee)}
              </StitchText>
            </View>
            <View
              style={[
                styles.totalRow,
                { borderTopColor: colors.divider },
              ]}
            >
              <StitchText variant="label" colorKey="text">
                Total Paid
              </StitchText>
              <StitchText variant="price" colorKey="text">
                {formatLKR(total)}
              </StitchText>
            </View>
            <View style={styles.priceRow}>
              <StitchText variant="body-sm" colorKey="textFaint">
                {paymentMethodLabel(row.payment_method, row.payment_status)}
              </StitchText>
              <StitchText variant="body-sm" colorKey="textFaint">
                {formatOrderedAt(row.created_at)}
              </StitchText>
            </View>
          </View>
        </StitchCard>

        {row.customer_arrived_at ? (
          <StitchText variant="body-sm" colorKey="secondary" style={{ textAlign: 'center' }}>
            You let the outlet know you are here. Show your code or QR at the counter.
          </StitchText>
        ) : null}

        {showArrivalCta ? (
          <>
            <StitchButton
              title={signalingArrival ? 'Notifying…' : "I'm at the outlet"}
              disabled={signalingArrival || !canSignalArrival}
              onPress={onSignalArrival}
            />
            {arrivalDisabledReason && !canSignalArrival ? (
              <StitchText
                variant="body-sm"
                colorKey="textFaint"
                style={{ textAlign: 'center', marginTop: -spacing.sm }}
              >
                {arrivalDisabledReason}
              </StitchText>
            ) : null}
          </>
        ) : null}

        {showReview ? (
          <StitchButton
            title="Leave a review"
            onPress={() =>
              navigation.navigate('OrderReview', { orderId: row.id })
            }
          />
        ) : null}

        {openComplaintOnFile ? (
          <StitchCard style={{ marginTop: spacing.sm }}>
            <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
              <StitchIcon name="support_agent" size={22} colorKey="primaryContainer" />
              <View style={{ flex: 1, gap: spacing.xs }}>
                <StitchText variant="label" colorKey="text">
                  Problem report submitted
                </StitchText>
                <StitchText variant="body-sm" colorKey="textMuted">
                  Status: {existingComplaint?.status.replace(/_/g, ' ') ?? 'open'}.
                  Our team is reviewing your case.
                </StitchText>
              </View>
            </View>
          </StitchCard>
        ) : null}

        {canReportProblem ? (
          <StitchButton
            title="Report a problem"
            variant="secondary"
            onPress={() => setReportModalOpen(true)}
          />
        ) : null}

        {session?.user.id ? (
          <ReportProblemModal
            visible={reportModalOpen}
            onClose={() => setReportModalOpen(false)}
            env={env}
            orderId={row.id}
            userId={session.user.id}
            onSubmitted={() => void load()}
          />
        ) : null}

        <Modal
          visible={qrEnlarged}
          transparent
          animationType="fade"
          onRequestClose={() => setQrEnlarged(false)}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss enlarged QR"
            onPress={() => setQrEnlarged(false)}
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: 'rgba(0,0,0,0.8)',
                alignItems: 'center',
                justifyContent: 'center',
                padding: spacing.xl,
              },
            ]}
          >
            <View
              style={{
                backgroundColor: colors.qrBackground,
                padding: spacing.xl,
                borderRadius: radii.xl,
                alignItems: 'center',
                gap: spacing.md,
              }}
            >
              <QRCode
                value={(row.reservation_code || row.id || 'FAE').toString()}
                size={280}
                color={colors.qrForeground}
                backgroundColor={colors.qrBackground}
              />
              <StitchText variant="label-caps" colorKey="textMuted" style={{ color: '#6b6762' }}>
                {(row.reservation_code || formatOrderLabel(row.id, null))}
              </StitchText>
              <StitchText variant="body-sm" colorKey="textFaint" style={{ color: '#6b6762' }}>
                Tap anywhere to dismiss
              </StitchText>
            </View>
          </Pressable>
        </Modal>

        {canCancel ? (
          <View style={{ gap: spacing.sm }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel order"
              disabled={cancelling}
              onPress={onCancel}
              style={({ pressed }) => ({
                minHeight: 48,
                borderRadius: radii.lg,
                borderWidth: 1.5,
                borderColor: colors.primaryContainer,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: pressed ? primaryHighlightSoft : 'transparent',
                opacity: cancelling ? 0.55 : 1,
              })}
            >
              <StitchText variant="label" colorKey="primaryContainer">
                Cancel Order
              </StitchText>
            </Pressable>
            <StitchText
              variant="body-sm"
              colorKey="textFaint"
              style={{ textAlign: 'center', paddingHorizontal: spacing.md }}
            >
              You can cancel up to 2 hours before the pickup window begins.
            </StitchText>
          </View>
        ) : null}
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
    centerFill: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.pageMarginMobile,
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
    },
    heroCard: {
      alignItems: 'center',
      marginBottom: spacing.lg,
    },
    statusPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.sm + spacing.xs,
      paddingVertical: spacing.xs,
      borderRadius: radii.full,
      marginBottom: spacing.md,
    },
    qrShell: {
      padding: spacing.md,
      borderRadius: radii.lg,
      borderWidth: 1,
      marginBottom: spacing.md,
    },
    qrInner: {
      width: 192,
      height: 192,
      borderRadius: radii.lg,
      borderWidth: 2,
      borderStyle: 'dashed',
      alignItems: 'center',
      justifyContent: 'center',
    },
    codeChip: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: radii.lg,
    },
    bagRow: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    bagThumb: {
      width: 96,
      height: 96,
      borderRadius: radii.lg,
    },
    bagCopy: {
      flex: 1,
      justifyContent: 'space-between',
      paddingVertical: 2,
    },
    categoryPill: {
      alignSelf: 'flex-start',
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: radii.default,
      marginBottom: spacing.xs,
    },
    pickupRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: spacing.sm,
    },
    sectionHead: {
      marginBottom: spacing.md,
      paddingBottom: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    locationRow: {
      flexDirection: 'row',
      gap: spacing.md,
      alignItems: 'flex-start',
    },
    mapThumb: {
      position: 'relative',
      width: 96,
      height: 96,
      borderRadius: radii.lg,
      borderWidth: 1,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
    },
    mapPinOverlay: {
      ...StyleSheet.absoluteFill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    priceRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    totalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: spacing.sm,
      marginTop: spacing.xs,
      borderTopWidth: 1,
      borderStyle: 'dashed',
    },
  });
}
