import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { checkoutParams } from '@/contracts/routeParams';
import { getSupabase } from '@/lib/supabase';
import { useAuthContext } from '@/context/AuthContext';
import { usePlatformSettings } from '@/hooks/usePlatformSettings';
import { buildSandboxPayHereCheckoutHtml } from '@/lib/payHereHtml';
import { fetchPayHereHash, PayHereApiError } from '@/lib/payhereApi';
import { scheduleMicrotask } from '@/lib/microtask';
import { logError } from '@/observability/logError';
import { ERROR } from '@/lib/messages/errors';
import { mapCheckoutError } from '@/lib/messages/rpc';
import { mapSupabaseError } from '@/lib/supabaseError';
import { isBagCustomerVisible, isShelfCustomerVisible } from '@/domain/listingVisibility';
import { randomReservationCode } from '@/lib/secureRandom';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import {
  StitchButton,
  StitchCard,
  StitchDivider,
  StitchIcon,
  StitchText,
} from '@/ui/stitch';
import { isGroupReservationsEnabled } from '@/config/groupReservations';
import { describePickupOverlapIssue } from '@/lib/groupPickupOverlap';
import { useReservationCart } from '@/hooks/useReservationCart';
import { GroupCheckoutStrip } from '@/components/group/GroupCheckoutStrip';
import { isClearanceShelvesEnabled } from '@/config/clearanceShelves';
import { CLEARANCE_FOOD_SAFETY_NOTICE } from '@/lib/foodSafetyCopy';
import { formatPickupByLabel } from '@/lib/shelfDisplay';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Customer-facing price formatter. Stitch HTML uses the Sri Lankan rupee glyph
 * "Rs." (not the ISO `LKR`) — kept here local to the checkout flow so we don't
 * accidentally diverge from the rest of the customer surfaces.
 */
function formatLKR(value: number): string {
  const n = Math.round(value);
  return `Rs. ${n.toLocaleString('en-LK')}`;
}

function formatPickupWindow(
  startIso: string | null | undefined,
  endIso: string | null | undefined,
): string {
  if (!startIso || !endIso) return 'Pickup time TBC';
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 'Pickup time TBC';
  }
  const tf: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
  return `${start.toLocaleTimeString(undefined, tf)} - ${end.toLocaleTimeString(undefined, tf)}`;
}

export function CheckoutScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'Checkout'>>();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { env, user, refreshProfile, session } = useAuthContext();
  const { colors, spacing, radii, mode } = useStitchTheme();
  const insets = useSafeAreaInsets();
  const params = checkoutParams.safeParse(route.params ?? {});
  const bagId = params.success ? params.data.draft ?? '' : '';
  const groupRaw = params.success ? params.data.group ?? '' : '';
  const groupBagIds = useMemo(() => {
    if (groupRaw.trim()) {
      return groupRaw
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
        .slice(0, 5);
    }
    return bagId ? [bagId] : [];
  }, [groupRaw, bagId]);
  const shelfId = params.success ? params.data.shelf ?? '' : '';
  const shelfItemsRaw = params.success ? params.data.shelfItems ?? '' : '';
  const shelfItems = useMemo(() => {
    if (!shelfId || !shelfItemsRaw) return [];
    try {
      const parsed = JSON.parse(shelfItemsRaw) as { shelf_item_id: string; quantity: number }[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [shelfId, shelfItemsRaw]);
  const isShelfCheckout = Boolean(shelfId && shelfItems.length > 0);
  const isGroupCheckout = !isShelfCheckout && groupBagIds.length > 1;
  const hasCheckoutTarget = Boolean(bagId) || groupBagIds.length > 0 || isShelfCheckout;
  const reservationCart = useReservationCart();
  /**
   * Stitch ships two header variants for checkout: `_1` keeps a title-bar header,
   * `_2` centers the brand logo. We honor either via the route param so deep links
   * (`freshasever://checkout?headerVariant=logo`) flip the chrome without forking
   * the screen.
   */
  const headerVariant: 'title' | 'logo' =
    (route.params as { headerVariant?: 'title' | 'logo' } | undefined)?.headerVariant ===
    'logo'
      ? 'logo'
      : 'title';

  const sb = getSupabase(env);
  const { flags: platformFlags } = usePlatformSettings(env);

  const [bag, setBag] = useState<Record<string, unknown> | null>(null);
  const [groupBags, setGroupBags] = useState<Record<string, unknown>[]>([]);
  const [completedPickups, setCompletedPickups] = useState(0);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('card');
  const [payHtml, setPayHtml] = useState<string | null>(null);
  const [promoDraft, setPromoDraft] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<{
    id: string;
    code: string;
    discountAmount: number;
  } | null>(null);
  const [promoMsg, setPromoMsg] = useState<string | null>(null);

  const bottomBarReserve = 48 + spacing.md * 2 + Math.max(insets.bottom, spacing.md);

  const styles = useMemo(
    () =>
      createStyles({
        colors,
        spacing,
        radii,
        insetsTop: insets.top,
      }),
    [colors, spacing, radii, insets.top],
  );

  const primaryHighlightSoft = useMemo(
    () => (mode === 'dark' ? 'rgba(1, 105, 111, 0.22)' : 'rgba(208, 232, 230, 0.35)'),
    [mode],
  );

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const suspendRedirect = useCallback(async () => {
    const {
      data: { user: u },
    } = await sb.auth.getUser();
    if (!u?.id) return false;
    const { data } = await sb
      .from('profiles')
      .select('is_suspended')
      .eq('id', u.id)
      .maybeSingle();
    if (data?.is_suspended === true) {
      navigation.navigate('MainTabs', {
        screen: 'ProfileTab',
        params: { suspended: '1' },
      });
      return true;
    }
    return false;
  }, [navigation, sb]);

  const hydrate = useCallback(async () => {
    if (isShelfCheckout) {
      setLoading(true);
      setErr(null);
      try {
        if (await suspendRedirect()) {
          setLoading(false);
          return;
        }
        const { data: shelfRow, error: shelfErr } = await sb
          .from('clearance_shelves')
          .select(
            `*, shelf_date, seed_demo, outlet:outlets (id, name, is_active, use_demo_listings, merchant:merchants(status)), items:clearance_shelf_items (*)`,
          )
          .eq('id', shelfId)
          .eq('status', 'published')
          .maybeSingle();
        if (shelfErr) throw shelfErr;
        if (!shelfRow || !isShelfCustomerVisible(shelfRow as Record<string, unknown>)) {
          throw new Error('Shelf not found');
        }
        const byId = new Map(
          ((shelfRow.items ?? []) as Record<string, unknown>[]).map((i) => [String(i.id), i]),
        );
        const firstSelectedItem = shelfItems
          .map((row) => byId.get(row.shelf_item_id))
          .find((item) => item != null);
        let subtotal = 0;
        let retailSum = 0;
        for (const row of shelfItems) {
          const item = byId.get(row.shelf_item_id);
          if (!item || Number(item.quantity_remaining ?? 0) < row.quantity) {
            throw new Error('Some items just sold out.');
          }
          subtotal += Number(item.rescue_price ?? 0) * row.quantity;
          const retail = Number(item.retail_price ?? 0);
          const rescue = Number(item.rescue_price ?? 0);
          if (retail > rescue) {
            retailSum += retail * row.quantity;
          } else {
            retailSum += rescue * row.quantity;
          }
        }
        setBag({
          id: shelfRow.id,
          title: `Clearance shelf · ${shelfItems.length} items`,
          rescue_price: subtotal,
          retail_value_estimate: retailSum > subtotal ? retailSum : null,
          category: 'Clearance shelf',
          pickup_start: shelfRow.pickup_start,
          pickup_end: shelfRow.pickup_end,
          image_url:
            firstSelectedItem && typeof firstSelectedItem.image_url_snapshot === 'string'
              ? firstSelectedItem.image_url_snapshot
              : null,
          outlet_id: shelfRow.outlet_id,
          outlet: shelfRow.outlet,
        });
        setGroupBags([]);
      } catch (e) {
        setErr(mapCheckoutError(e, ERROR.checkout.loadBag));
      } finally {
        setLoading(false);
      }
      return;
    }
    if (groupBagIds.length === 0) return;
    setLoading(true);
    setErr(null);
    try {
      if (await suspendRedirect()) {
        setLoading(false);
        return;
      }
      await refreshProfile();

      const { data: rows, error } = await sb
        .from('rescue_bags')
        .select(
          `*, outlet:outlets ( id, name, address, landmark, is_active, use_demo_listings, merchant:merchants(business_name, status) )`,
        )
        .in('id', [...new Set(groupBagIds)]);
      if (error) throw error;
      const byId = new Map(
        ((rows ?? []) as Record<string, unknown>[]).map((row) => [String(row.id), row]),
      );
      const list: Record<string, unknown>[] = [];
      for (const id of groupBagIds) {
        const row = byId.get(id);
        if (!row || !isBagCustomerVisible(row)) {
          throw new Error('One or more bags are no longer available.');
        }
        list.push(row);
      }
      setGroupBags(list);
      setBag(list[0] ?? null);

      const {
        data: { user: u },
      } = await sb.auth.getUser();
      let cnt = 0;
      if (u?.id) {
        const { count } = await sb
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('customer_id', u.id)
          .eq('order_status', 'collected');
        cnt = typeof count === 'number' ? count : 0;
      }
      setCompletedPickups(cnt);
    } catch (e) {
      setErr(mapSupabaseError(e as Error, ERROR.checkout.loadBag));
    } finally {
      setLoading(false);
    }
  }, [groupBagIds, isShelfCheckout, refreshProfile, sb, shelfId, shelfItems, suspendRedirect]);

  useEffect(() => {
    if (!hasCheckoutTarget) {
      navigation.replace('MainTabs', { screen: 'DiscoverTab' });
      return;
    }
    scheduleMicrotask(() => {
      void hydrate();
    });
  }, [hasCheckoutTarget, hydrate, navigation]);

  /** PayHere may complete via system browser / app link — same path logic as WebView. */
  useEffect(() => {
    const sub = Linking.addEventListener('url', ({ url }) => {
      const path = url.split('?')[0] ?? url;
      if (path.includes('/orders/')) {
        const m = path.match(/orders\/([^/?]+)/);
        if (m?.[1]) {
          setPayHtml(null);
          navigation.replace('OrderCelebration', {
            orderId: m[1],
            variant: 'reservation',
          });
        }
      }
    });
    return () => sub.remove();
  }, [navigation]);

  useEffect(() => {
    if (isGroupCheckout) {
      setPaymentMethod('card');
      return;
    }
    if (paymentMethod === 'cash' && completedPickups < 1) {
      setPaymentMethod('card');
    }
  }, [completedPickups, paymentMethod, isGroupCheckout]);

  async function applyPromoCode() {
    const code = promoDraft.trim().toUpperCase();
    if (!code) {
      setAppliedPromo(null);
      setPromoMsg(null);
      return;
    }
    setPromoMsg(null);
    const rescuePricePreview = isGroupCheckout
      ? groupBags.reduce((sum, b) => sum + Number(b.rescue_price ?? 0), 0)
      : Number(bag?.rescue_price ?? 0);
    const { data, error } = await sb
      .from('promo_codes')
      .select(
        'id, code, discount_type, discount_value, min_order_value, max_uses, used_count, valid_from, valid_until, is_active',
      )
      .eq('code', code)
      .eq('is_active', true)
      .maybeSingle();
    if (error || !data) {
      setAppliedPromo(null);
      setPromoMsg(ERROR.promo.invalid);
      return;
    }
    const now = Date.now();
    if (data.valid_from && new Date(String(data.valid_from)).getTime() > now) {
      setPromoMsg('This promo is not active yet.');
      setAppliedPromo(null);
      return;
    }
    if (data.valid_until && new Date(String(data.valid_until)).getTime() < now) {
      setPromoMsg(ERROR.promo.expired);
      setAppliedPromo(null);
      return;
    }
    const minOrder = Number(data.min_order_value ?? 0);
    if (minOrder > 0 && rescuePricePreview < minOrder) {
      setPromoMsg(`Minimum order Rs. ${Math.round(minOrder).toLocaleString()} required.`);
      setAppliedPromo(null);
      return;
    }
    const maxUses = data.max_uses as number | null;
    const used = Number(data.used_count ?? 0);
    if (maxUses != null && used >= maxUses) {
      setPromoMsg('This promo has reached its usage limit.');
      setAppliedPromo(null);
      return;
    }
    const dtype = String(data.discount_type ?? 'percent');
    const dval = Number(data.discount_value ?? 0);
    let discountAmount =
      dtype === 'fixed'
        ? Math.min(dval, rescuePricePreview)
        : Math.round((rescuePricePreview * dval) / 100);
    discountAmount = Math.max(0, Math.min(discountAmount, rescuePricePreview));
    setAppliedPromo({
      code,
      discountAmount,
      id: typeof data.id === 'string' ? data.id : String(data.id ?? ''),
    });
    setPromoMsg(`Applied ${code} (−Rs. ${discountAmount.toLocaleString()})`);
  }

  async function confirm() {
    if (!bag?.id) return;
    if (platformFlags.maintenance) {
      setErr('Reservations are paused during maintenance. Try again soon.');
      return;
    }
    setProcessing(true);
    setErr(null);
    try {
      const {
        data: { user: u },
      } = await sb.auth.getUser();
      if (!u) {
        navigation.navigate('Login');
        throw new Error('Sign in required');
      }

      if (isGroupCheckout && paymentMethod === 'cash') {
        throw new Error('Group reservations require card payment.');
      }

      if (pickupOverlapIssue) {
        throw new Error(pickupOverlapIssue);
      }

      if (paymentMethod === 'cash' && completedPickups < 1) {
        throw new Error('Pickup once before cash-at-pickup.');
      }

      const { data: profileRow } = await sb
        .from('profiles')
        .select('phone')
        .eq('id', u.id)
        .maybeSingle();
      const phoneRaw =
        (typeof profileRow?.phone === 'string' ? profileRow.phone : '') ||
        (typeof u.phone === 'string' ? u.phone : '');
      if (!phoneRaw.trim()) {
        throw new Error(
          'A phone number is required on your profile before you can reserve. Add it under Profile → Account Details.',
        );
      }

      const outletIdRaw =
        (typeof bag.outlet_id === 'string' ? bag.outlet_id : '') ||
        (typeof (bag.outlet as { id?: string } | null)?.id === 'string'
          ? (bag.outlet as { id: string }).id
          : '');

      if (!outletIdRaw) {
        throw new Error('Missing outlet.');
      }

      const rescuePrice = isGroupCheckout
        ? groupBags.reduce((sum, b) => sum + Number(b.rescue_price ?? 0), 0)
        : Number(bag.rescue_price ?? 0);
      const discountAmount = appliedPromo?.discountAmount ?? 0;
      const totalCost = Math.max(0, rescuePrice - discountAmount);

      if (isShelfCheckout) {
        if (!isClearanceShelvesEnabled()) {
          throw new Error('Clearance shelves are not available right now.');
        }
        const { data: liveShelf, error: liveErr } = await sb
          .from('clearance_shelves')
          .select('items:clearance_shelf_items(id, quantity_remaining, status)')
          .eq('id', shelfId)
          .eq('status', 'published')
          .maybeSingle();
        if (liveErr) throw liveErr;
        if (!liveShelf) throw new Error('Shelf not found');
        const liveById = new Map(
          ((liveShelf.items ?? []) as Record<string, unknown>[]).map((row) => [
            String(row.id),
            row,
          ]),
        );
        for (const row of shelfItems) {
          const live = liveById.get(row.shelf_item_id);
          const max = Number(live?.quantity_remaining ?? 0);
          const soldOut = live?.status === 'sold_out' || max < row.quantity;
          if (!live || soldOut) {
            throw new Error('Some items just sold out.');
          }
        }
        const { data: reserveRows, error: shelfErr } = await sb.rpc(
          'create_clearance_reservation',
          {
            p_shelf_id: shelfId,
            p_items: shelfItems,
            p_payment_method: paymentMethod,
            p_promo_code: appliedPromo?.code ?? null,
          },
        );
        if (shelfErr) throw shelfErr;
        const reserveRow = Array.isArray(reserveRows) ? reserveRows[0] : reserveRows;
        const clearanceOrderId =
          reserveRow && typeof reserveRow === 'object' && 'order_id' in reserveRow
            ? String((reserveRow as { order_id: string }).order_id)
            : '';
        if (!clearanceOrderId) {
          throw new Error('Could not create shelf reservation.');
        }
        if (paymentMethod === 'cash' || totalCost <= 0) {
          await sb
            .from('orders')
            .update({ payment_status: 'paid', order_status: 'paid' })
            .eq('id', clearanceOrderId);
          navigation.replace('OrderCelebration', {
            orderId: clearanceOrderId,
            variant: 'reservation',
          });
          return;
        }
        const accessToken = session?.access_token;
        if (!accessToken) throw new Error('Session expired. Sign in again.');
        const data = await fetchPayHereHash(env.apiBaseUrl, accessToken, {
          order_id: clearanceOrderId,
          amount: totalCost,
          currency: 'LKR',
        });
        const base = env.payHereReturnHost || env.apiBaseUrl;
        const returnUrl = `${base}/orders/${clearanceOrderId}?payment=success`;
        const cancelQuery = new URLSearchParams({
          shelf: shelfId,
          shelfItems: shelfItemsRaw,
          payment: 'cancelled',
        });
        const cancelUrl = `${base}/checkout?${cancelQuery.toString()}`;
        const notifyUrl = `${env.apiBaseUrl}/api/payhere/webhook`;
        const html = buildSandboxPayHereCheckoutHtml({
          merchant_id: String(data.merchant_id),
          return_url: returnUrl,
          cancel_url: cancelUrl,
          notify_url: notifyUrl,
          order_id: clearanceOrderId,
          items: 'Clearance shelf order',
          amount: String(data.amount),
          currency: String(data.currency ?? 'LKR'),
          hash: String(data.hash),
          first_name: 'Customer',
          last_name: '',
          email: user?.email ?? '',
          phone: (user?.phone as string | undefined) ?? '',
          address: 'Colombo',
          city: 'Colombo',
          country: 'Sri Lanka',
        });
        setPayHtml(html);
        return;
      }

      if (isGroupCheckout && !isGroupReservationsEnabled()) {
        throw new Error('Group reservations are not available right now.');
      }

      if (isGroupCheckout) {
        const { data: groupRows, error: groupErr } = await sb.rpc(
          'create_group_reservation',
          {
            p_bag_ids: groupBagIds,
            p_payment_method: paymentMethod,
            p_promo_code: appliedPromo?.code ?? null,
          },
        );
        if (groupErr) throw groupErr;
        const groupRow = Array.isArray(groupRows) ? groupRows[0] : groupRows;
        const groupId =
          groupRow && typeof groupRow === 'object' && 'group_id' in groupRow
            ? String((groupRow as { group_id: string }).group_id)
            : '';
        if (!groupId) {
          throw new Error('Could not create group reservation.');
        }

        if (paymentMethod === 'cash' || totalCost <= 0) {
          await sb
            .from('reservation_groups')
            .update({ payment_status: 'paid', order_status: 'paid' })
            .eq('id', groupId);
          const { data: child } = await sb
            .from('orders')
            .select('id')
            .eq('group_id', groupId)
            .limit(1)
            .maybeSingle();
          await sb
            .from('orders')
            .update({ payment_status: 'paid', order_status: 'paid' })
            .eq('group_id', groupId);
          navigation.replace('OrderCelebration', {
            orderId: String(child?.id ?? groupId),
            variant: 'reservation',
          });
          return;
        }

        const accessToken = session?.access_token;
        if (!accessToken) {
          throw new Error('Session expired. Sign in again.');
        }

        const data = await fetchPayHereHash(env.apiBaseUrl, accessToken, {
          group_id: groupId,
          amount: totalCost,
          currency: 'LKR',
        });

        const base = env.payHereReturnHost || env.apiBaseUrl;
        const returnUrl = `${base}/orders/${groupId}?payment=success`;
        const cancelUrl = `${base}/checkout?group=${groupBagIds.join(',')}&payment=cancelled`;
        const notifyUrl = `${env.apiBaseUrl}/api/payhere/webhook`;

        const fname =
          typeof user?.user_metadata?.full_name === 'string'
            ? user.user_metadata.full_name.split(' ')[0]
            : 'Customer';
        const lname =
          typeof user?.user_metadata?.full_name === 'string'
            ? user.user_metadata.full_name.split(' ')[1] ?? ''
            : '';

        const html = buildSandboxPayHereCheckoutHtml({
          merchant_id: String(data.merchant_id),
          return_url: returnUrl,
          cancel_url: cancelUrl,
          notify_url: notifyUrl,
          order_id: groupId,
          items: `${groupBagIds.length} rescue bags`,
          amount: String(data.amount),
          currency: String(data.currency ?? 'LKR'),
          hash: String(data.hash),
          first_name: fname,
          last_name: lname,
          email: user?.email ?? '',
          phone: (user?.phone as string | undefined) ?? '',
          address: 'Colombo',
          city: 'Colombo',
          country: 'Sri Lanka',
        });
        setPayHtml(html);
        return;
      }

      const isReservationCodeConflict = (e: {
        code?: string;
        message?: string;
      }): boolean =>
        e.code === '23505' &&
        (e.message?.includes('reservation_code') ?? false);

      let orderId: string | null = null;
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const code = randomReservationCode(6);
        const { data: order, error: insertErr } = await sb
          .from('orders')
          .insert({
            bag_id: bag.id,
            customer_id: u.id,
            outlet_id: outletIdRaw,
            quantity: 1,
            unit_price: rescuePrice,
            subtotal: rescuePrice,
            platform_fee: 0,
            total: totalCost,
            payment_method: paymentMethod,
            payment_status: 'pending',
            order_status: 'reserved',
            reservation_code: code,
            discount_amount: discountAmount,
            ...(appliedPromo?.id ? { promo_code_id: appliedPromo.id } : {}),
          })
          .select()
          .single();

        if (!insertErr && order) {
          orderId = String(order.id);
          break;
        }
        if (insertErr && isReservationCodeConflict(insertErr)) {
          continue;
        }
        if (insertErr) throw insertErr;
      }

      if (!orderId) {
        throw new Error('Could not create reservation. Please try again.');
      }

      if (paymentMethod === 'cash' || totalCost <= 0) {
        await sb
          .from('orders')
          .update({ payment_status: 'paid', order_status: 'paid' })
          .eq('id', orderId);
        navigation.replace('OrderCelebration', {
          orderId,
          variant: 'reservation',
        });
        return;
      }

      const accessToken = session?.access_token;
      if (!accessToken) {
        throw new Error('Session expired. Sign in again.');
      }

      const data = await fetchPayHereHash(env.apiBaseUrl, accessToken, {
        order_id: orderId,
        amount: totalCost,
        currency: 'LKR',
      });

      const base = env.payHereReturnHost || env.apiBaseUrl;
      const returnUrl = `${base}/orders/${orderId}?payment=success`;
      const cancelUrl = `${base}/checkout?draft=${bagId}&payment=cancelled`;
      const notifyUrl = `${env.apiBaseUrl}/api/payhere/webhook`;

      const fname =
        typeof user?.user_metadata?.full_name === 'string'
          ? user.user_metadata.full_name.split(' ')[0]
          : 'Customer';
      const lname =
        typeof user?.user_metadata?.full_name === 'string'
          ? user.user_metadata.full_name.split(' ')[1] ?? ''
          : '';

      const html = buildSandboxPayHereCheckoutHtml({
        merchant_id: String(data.merchant_id),
        return_url: returnUrl,
        cancel_url: cancelUrl,
        notify_url: notifyUrl,
        order_id: orderId,
        items: String(bag.title ?? 'Rescue bag'),
        amount: String(data.amount),
        currency: String(data.currency ?? 'LKR'),
        hash: String(data.hash),
        first_name: fname,
        last_name: lname,
        email: user?.email ?? '',
        phone: (user?.phone as string | undefined) ?? '',
        address: 'Colombo',
        city: 'Colombo',
        country: 'Sri Lanka',
      });
      setPayHtml(html);
    } catch (e) {
      logError(e, {
        context: 'CheckoutScreen.confirm',
        extra: {
          bagId,
          paymentMethod,
          isGroupCheckout,
          isShelfCheckout,
          apiBaseUrlConfigured: Boolean(env.apiBaseUrl?.trim()),
        },
      });
      const msg =
        e instanceof PayHereApiError
          ? e.message
          : e instanceof Error && e.name === 'AbortError'
            ? ERROR.checkout.paymentTimeout
            : mapCheckoutError(
                e instanceof Error ? e.message : e,
                mapSupabaseError(e as Error, ERROR.checkout.reserveFailed),
                isShelfCheckout ? 'shelf' : 'bag',
              );
      setErr(msg);
    } finally {
      setProcessing(false);
    }
  }

  function onPaymentNavState(url: string) {
    try {
      const u = url.split('?')[0];
      if (u.includes('/orders/')) {
        const m = u.match(/orders\/([^/?]+)/);
        if (m?.[1]) {
          setPayHtml(null);
          navigation.replace('OrderCelebration', {
            orderId: m[1],
            variant: 'reservation',
          });
        }
      }
    } catch {
      /* noop */
    }
  }

  const allowPaymentWebViewRequest = useCallback((requestUrl: string) => {
    if (requestUrl === 'about:blank') return true;
    try {
      const parsed = new URL(requestUrl);
      if (parsed.protocol !== 'https:') return false;
      const host = parsed.hostname.toLowerCase();
      if (host.endsWith('payhere.lk')) return true;
      if (host.endsWith('freshasever.com') || host.endsWith('freshasever.lk')) {
        return true;
      }
      if (__DEV__ && (host === 'localhost' || host.endsWith('.test'))) {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  const pickupOverlapIssue = useMemo(() => {
    if (!isGroupCheckout) return null;
    return describePickupOverlapIssue(
      groupBags.map((b) => ({
        pickup_start: typeof b.pickup_start === 'string' ? b.pickup_start : null,
        pickup_end: typeof b.pickup_end === 'string' ? b.pickup_end : null,
      })),
    );
  }, [groupBags, isGroupCheckout]);

  const cashAllowed = completedPickups >= 1;

  const reserveButtonTitle = useMemo(() => {
    if (platformFlags.maintenance) return 'Paused';
    if (isGroupCheckout) {
      const n = groupBagIds.length;
      return n === 1 ? 'Reserve 1 bag (card only)' : `Reserve ${n} bags (card only)`;
    }
    if (isShelfCheckout) return 'Reserve Now';
    if (cashAllowed && paymentMethod === 'cash') return 'Reserve · Pay at store';
    if (cashAllowed) return 'Reserve Now';
    return 'Reserve Now (card only)';
  }, [
    cashAllowed,
    groupBagIds.length,
    isGroupCheckout,
    isShelfCheckout,
    paymentMethod,
    platformFlags.maintenance,
  ]);

  if (!hasCheckoutTarget) {
    return null;
  }

  if (loading || !bag) {
    const loadMessage = err
      ? err
      : isShelfCheckout
        ? 'Could not load shelf checkout.'
        : 'Could not load checkout.';
    return (
      <View style={[styles.flex, { backgroundColor: colors.background }]}>
        <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
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
          <StitchText variant="h2" colorKey="primaryContainer">
            Checkout
          </StitchText>
          <View style={styles.iconHit} />
        </View>
        <View style={[styles.centerFill, { flex: 1 }]}>
          {loading ? (
            <ActivityIndicator color={colors.primaryContainer} />
          ) : (
            <>
              <StitchText
                variant="body-md"
                colorKey="error"
                style={{ marginTop: spacing.md, textAlign: 'center', paddingHorizontal: spacing.lg }}
              >
                {loadMessage}
              </StitchText>
              <StitchButton
                title="Go back"
                variant="secondary"
                onPress={() => navigation.goBack()}
                style={{ marginTop: spacing.lg }}
              />
            </>
          )}
        </View>
      </View>
    );
  }

  const title = typeof bag.title === 'string' ? bag.title : 'Rescue bag';
  const outlet = bag.outlet as {
    name?: string;
    merchant?: { business_name?: string };
  } | null;
  const venue =
    typeof outlet?.merchant?.business_name === 'string' && outlet.merchant.business_name
      ? outlet.merchant.business_name
      : typeof outlet?.name === 'string'
        ? outlet.name
        : '';
  const category =
    bag.category != null ? String(bag.category).replace(/_/g, ' ') : '';
  const rescuePrice = isGroupCheckout
    ? groupBags.reduce((sum, b) => sum + Number(b.rescue_price ?? 0), 0)
    : typeof bag.rescue_price === 'number'
      ? bag.rescue_price
      : 0;
  const retailRaw = bag.retail_value_estimate;
  const retail =
    typeof retailRaw === 'number' && Number.isFinite(retailRaw) ? retailRaw : null;
  const pickupStart =
    typeof bag.pickup_start === 'string' ? bag.pickup_start : null;
  const pickupEnd =
    typeof bag.pickup_end === 'string' ? bag.pickup_end : null;
  const pickupByShelf = isShelfCheckout ? formatPickupByLabel(pickupEnd) : null;
  const pickupLine = pickupByShelf
    ? pickupByShelf
    : `Pickup: ${formatPickupWindow(pickupStart, pickupEnd)}`;
  const youSave =
    retail != null && retail > rescuePrice ? retail - rescuePrice : null;
  const promoDiscount = appliedPromo?.discountAmount ?? 0;
  const totalToPay = Math.max(0, rescuePrice - promoDiscount);
  const priceBreakdownLabel = isShelfCheckout
    ? 'Shelf total'
    : isGroupCheckout
      ? 'Bag total'
      : 'Rescue Bag Price';

  const cardSelected = paymentMethod === 'card';
  const cashSelected = paymentMethod === 'cash';

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.flex, { backgroundColor: colors.background }]}>
        {/* Stitch checkout_light_mode_* header */}
        <View style={styles.topBar}>
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
              Checkout
            </StitchText>
          )}
          <View style={styles.iconHit} />
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: bottomBarReserve },
          ]}
        >
          {/* Order summary — checkout_light_mode_1 */}
          <StitchCard style={styles.sectionCard}>
            <StitchText variant="h2" colorKey="onBackground" style={{ marginBottom: spacing.md }}>
              Order Summary
            </StitchText>
            <View style={styles.summaryRow}>
              {typeof bag.image_url === 'string' ? (
                <Image
                  source={{ uri: bag.image_url }}
                  style={styles.summaryThumb}
                  resizeMode="cover"
                  accessibilityLabel={`${bag.title} preview`}
                />
              ) : (
                <View
                  style={[
                    styles.summaryThumb,
                    { backgroundColor: colors.surfaceContainerHigh },
                  ]}
                />
              )}
              <View style={styles.summaryCopy}>
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
                  {venue ? (
                    <StitchText
                      variant="body-sm"
                      colorKey="textMuted"
                      style={{ marginTop: category ? spacing.sm : 0 }}
                    >
                      {venue}
                    </StitchText>
                  ) : null}
                  <StitchText
                    variant="h3"
                    colorKey="onBackground"
                    style={{ marginTop: venue || category ? spacing.sm : 0 }}
                  >
                    {title}
                  </StitchText>
                </View>
                <View style={styles.pickupRow}>
                  <StitchIcon name="schedule" size={20} colorKey="textMuted" />
                  <StitchText variant="body-sm" colorKey="textMuted" style={{ marginLeft: 4 }}>
                    {pickupLine}
                  </StitchText>
                </View>
                {isShelfCheckout ? (
                  <StitchText
                    variant="body-sm"
                    colorKey="textMuted"
                    style={{ marginTop: spacing.sm }}
                  >
                    {CLEARANCE_FOOD_SAFETY_NOTICE}
                  </StitchText>
                ) : null}
              </View>
            </View>
          </StitchCard>

          {isGroupCheckout ? (
            <View style={{ marginTop: spacing.lg }}>
              <GroupCheckoutStrip
                bags={groupBags.map((b) => ({
                  id: String(b.id),
                  title: typeof b.title === 'string' ? b.title : 'Rescue bag',
                  rescue_price: typeof b.rescue_price === 'number' ? b.rescue_price : null,
                }))}
                onRemove={async (removeId) => {
                  await reservationCart.removeBag(removeId);
                  const next = groupBagIds.filter((id) => id !== removeId);
                  if (next.length === 0) {
                    navigation.goBack();
                    return;
                  }
                  if (next.length === 1) {
                    navigation.replace('Checkout', { draft: next[0] });
                    return;
                  }
                  navigation.replace('Checkout', { draft: next[0], group: next.join(',') });
                }}
              />
              {pickupOverlapIssue ? (
                <StitchText
                  variant="body-sm"
                  colorKey="error"
                  style={{ marginTop: spacing.sm }}
                  testID="checkout.overlapError"
                >
                  {pickupOverlapIssue}
                </StitchText>
              ) : null}
            </View>
          ) : null}

          {/* Payment method */}
          <View style={{ marginTop: spacing.lg }}>
            <StitchText variant="h2" colorKey="onBackground" style={{ marginBottom: spacing.md }}>
              Payment Method
            </StitchText>
            <View style={styles.payGrid}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setPaymentMethod('card')}
                style={({ pressed }) => [
                  styles.payTile,
                  {
                    borderColor: cardSelected ? colors.primaryContainer : colors.divider,
                    backgroundColor: cardSelected ? primaryHighlightSoft : colors.surface,
                    opacity: pressed ? 0.92 : 1,
                  },
                ]}
              >
                <StitchIcon name="credit_card" size={28} colorKey="primaryContainer" />
                <StitchText variant="label" colorKey="onBackground" style={{ marginTop: spacing.sm }}>
                  Card Payment
                </StitchText>
                <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: 4 }}>
                  Pay securely now
                </StitchText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={!cashAllowed || isGroupCheckout}
                onPress={() => cashAllowed && !isGroupCheckout && setPaymentMethod('cash')}
                style={({ pressed }) => [
                  styles.payTile,
                  {
                    borderColor: cashSelected ? colors.primaryContainer : colors.divider,
                    backgroundColor: cashSelected ? primaryHighlightSoft : colors.surface,
                    opacity: !cashAllowed ? 0.45 : pressed ? 0.92 : 1,
                  },
                ]}
              >
                <StitchIcon name="attach_money" size={28} colorKey="primaryContainer" />
                <StitchText variant="label" colorKey="onBackground" style={{ marginTop: spacing.sm }}>
                  Pay at Store
                </StitchText>
                <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: 4 }}>
                  {cashAllowed ? 'Cash on pickup' : 'After your first pickup'}
                </StitchText>
              </Pressable>
            </View>
          </View>

          <View style={{ marginTop: spacing.lg }}>
            <View style={styles.promoRow}>
              <TextInput
                value={promoDraft}
                onChangeText={setPromoDraft}
                placeholder="Enter promo code"
                placeholderTextColor={colors.textFaint}
                autoCapitalize="characters"
                style={[
                  styles.promoInput,
                  {
                    borderColor: colors.outlineVariant,
                    backgroundColor: colors.surface,
                    color: colors.onBackground,
                  },
                ]}
              />
              <Pressable
                accessibilityRole="button"
                onPress={() => void applyPromoCode()}
                style={({ pressed }) => [
                  styles.applyBtn,
                  {
                    borderColor: colors.primaryContainer,
                    opacity: pressed ? 0.88 : 1,
                  },
                ]}
              >
                <StitchText variant="label" colorKey="primaryContainer">
                  Apply
                </StitchText>
              </Pressable>
            </View>
            {promoMsg ? (
              <StitchText variant="body-sm" colorKey={appliedPromo ? 'primaryContainer' : 'error'}>
                {promoMsg}
              </StitchText>
            ) : null}
          </View>

          {/* Price breakdown */}
          <StitchCard style={{ marginTop: spacing.lg }}>
            {retail != null && retail > 0 ? (
              <View style={styles.priceRow}>
                <StitchText variant="body-md" colorKey="textMuted">
                  Original Value
                </StitchText>
                <StitchText variant="price-original" colorKey="textMuted">
                  {formatLKR(retail)}
                </StitchText>
              </View>
            ) : null}
            <View style={styles.priceRow}>
              <StitchText variant="body-md" colorKey="textMuted">
                {priceBreakdownLabel}
              </StitchText>
              <StitchText variant="body-md" colorKey="textMuted">
                {formatLKR(rescuePrice)}
              </StitchText>
            </View>
            {youSave != null && youSave > 0 ? (
              <View style={styles.priceRow}>
                <StitchText variant="body-md" colorKey="accent">
                  You Save
                </StitchText>
                <StitchText variant="body-md" colorKey="accent">
                  − {formatLKR(youSave)}
                </StitchText>
              </View>
            ) : null}
            {appliedPromo && appliedPromo.discountAmount > 0 ? (
              <View style={styles.priceRow}>
                <StitchText variant="body-md" colorKey="primaryContainer">
                  Promo ({appliedPromo.code})
                </StitchText>
                <StitchText variant="body-md" colorKey="primaryContainer">
                  − {formatLKR(appliedPromo.discountAmount)}
                </StitchText>
              </View>
            ) : null}
            <StitchDivider />
            <View style={[styles.priceRow, { alignItems: 'flex-end' }]}>
              <StitchText variant="h3" colorKey="onBackground">
                Total to Pay
              </StitchText>
              <StitchText variant="price" colorKey="onBackground">
                {formatLKR(totalToPay)}
              </StitchText>
            </View>
          </StitchCard>

          {err ? (
            <StitchText variant="body-sm" colorKey="error" style={{ marginTop: spacing.md }}>
              {err}
            </StitchText>
          ) : null}
        </ScrollView>

        {/* Fixed bottom bar — Stitch */}
        <View
          style={[
            styles.bottomBar,
            {
              paddingBottom: Math.max(insets.bottom, spacing.md),
              backgroundColor: colors.surface,
              borderTopColor: colors.divider,
            },
          ]}
        >
          <View style={styles.bottomInner}>
            <View>
              <StitchText variant="body-sm" colorKey="textMuted">
                Total
              </StitchText>
              <StitchText variant="price" colorKey="onBackground">
                {formatLKR(totalToPay)}
              </StitchText>
            </View>
            <StitchButton
              testID="checkout.reserveNow"
              title={reserveButtonTitle}
              loading={processing}
              disabled={processing || platformFlags.maintenance || Boolean(pickupOverlapIssue)}
              onPress={() => void confirm()}
              style={styles.reserveBtn}
            />
          </View>
        </View>
      </View>

      <Modal visible={!!payHtml} animationType="slide">
        <View style={[styles.flex, { backgroundColor: colors.surface }]}>
          <View
            style={[
              styles.modalHeader,
              {
                paddingTop: insets.top + spacing.sm,
                borderBottomColor: colors.divider,
                backgroundColor: colors.background,
              },
            ]}
          >
            <View style={styles.iconHit} />
            <StitchText variant="label" colorKey="onSurfaceVariant">
              Secure payment
            </StitchText>
            <Pressable
              accessibilityRole="button"
              onPress={() => setPayHtml(null)}
              style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1, padding: spacing.sm }]}
            >
              <StitchText variant="label" colorKey="primaryContainer">
                Close
              </StitchText>
            </Pressable>
          </View>
          {payHtml ? (
            <WebView
              style={{ flex: 1, backgroundColor: colors.surface }}
              originWhitelist={['https://*']}
              source={{ html: payHtml, baseUrl: 'https://freshasever.com' }}
              javaScriptEnabled
              domStorageEnabled={false}
              geolocationEnabled={false}
              setSupportMultipleWindows={false}
              mixedContentMode="never"
              allowsInlineMediaPlayback={false}
              onShouldStartLoadWithRequest={(event) =>
                allowPaymentWebViewRequest(event.url)
              }
              onNavigationStateChange={(navState) =>
                onPaymentNavState(navState.url)
              }
            />
          ) : null}
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function createStyles({
  colors,
  spacing,
  radii,
  insetsTop,
}: {
  colors: Record<string, string>;
  spacing: typeof import('@/theme/stitchTokens').stitchSpacing;
  radii: typeof import('@/theme/stitchTokens').stitchRadii;
  insetsTop: number;
}) {
  const headerBorder = colors.headerBorder;
  return StyleSheet.create({
    flex: { flex: 1 },
    centerFill: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.pageMarginMobile,
      paddingTop: insetsTop + spacing.sm,
      paddingBottom: spacing.sm,
      minHeight: 56,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: headerBorder,
      backgroundColor: colors.background,
    },
    iconHit: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    scrollContent: {
      paddingHorizontal: spacing.pageMarginMobile,
      paddingTop: spacing.lg,
      flexGrow: 1,
      gap: 0,
    },
    sectionCard: {
      marginBottom: 0,
    },
    summaryRow: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    summaryThumb: {
      width: 96,
      height: 96,
      borderRadius: radii.lg,
    },
    summaryCopy: {
      flex: 1,
      justifyContent: 'space-between',
      paddingVertical: 4,
    },
    categoryPill: {
      alignSelf: 'flex-start',
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: radii.default,
    },
    pickupRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: spacing.sm,
    },
    payGrid: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    payTile: {
      flex: 1,
      borderWidth: 1,
      borderRadius: radii.xl,
      padding: spacing.md,
    },
    promoRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      alignItems: 'center',
    },
    promoInput: {
      flex: 1,
      height: 48,
      paddingHorizontal: spacing.md,
      borderRadius: radii.lg,
      borderWidth: 1,
      fontFamily: 'PlusJakartaSans-Regular',
      fontSize: 15,
    },
    applyBtn: {
      height: 48,
      paddingHorizontal: spacing.lg,
      borderRadius: radii.lg,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
    },
    priceRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    bottomBar: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: spacing.pageMarginMobile,
      paddingTop: spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 12,
    },
    bottomInner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    reserveBtn: {
      flexGrow: 1,
      maxWidth: 200,
      alignSelf: 'stretch',
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.pageMarginMobile,
      paddingBottom: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
  });
}
