import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuthContext } from '@/context/AuthContext';
import { useMerchantContext } from '@/hooks/useMerchantContext';
import { getSupabase } from '@/lib/supabase';
import { ERROR } from '@/lib/messages/errors';
import { postOrderRefund } from '@/lib/refundApi';
import { mapSupabaseError } from '@/lib/supabaseError';
import type { RootStackParamList } from '@/navigation/types';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import {
  StitchButton,
  StitchIcon,
  StitchScreen,
  StitchSurface,
  StitchText,
} from '@/ui/stitch';

type Detail = {
  id: string;
  type: string;
  description: string;
  status: string;
  merchant_notes: string;
  photos: string[];
  created_at: string | null;
  order_id: string;
  order_code: string;
  order_total: number;
  outlet_name: string;
  reporter_name: string;
};

export function MerchantComplaintDetailScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList, 'MerchantComplaintDetail'>>();
  const route = useRoute<RouteProp<RootStackParamList, 'MerchantComplaintDetail'>>();
  const { env } = useAuthContext();
  const { outletScopeIds, merchant, loading: merchantLoading } = useMerchantContext(env);
  const { colors, spacing, radii } = useStitchTheme();
  const [complaint, setComplaint] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!merchant || outletScopeIds.length === 0) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      const sb = getSupabase(env);
      const { data, error } = await sb
        .from('complaints')
        .select(
          `
          id, type, description, status, merchant_notes, photos, created_at,
          order:orders(
            id, reservation_code, total, outlet_id,
            outlet:outlets(name)
          ),
          reporter:profiles!complaints_reporter_id_fkey(full_name)
        `,
        )
        .eq('id', route.params.complaintId)
        .maybeSingle();

      if (cancelled) return;
      if (error || !data) {
        setErr(error?.message ?? 'Complaint not found');
        setComplaint(null);
        setLoading(false);
        return;
      }

      const r = data as Record<string, unknown>;
      const order = r.order as Record<string, unknown> | undefined;
      const outletId = String(order?.outlet_id ?? '');
      if (!outletScopeIds.includes(outletId)) {
        setErr('This complaint is not for one of your outlets.');
        setComplaint(null);
        setLoading(false);
        return;
      }

      const outlet = order?.outlet as Record<string, unknown> | undefined;
      const reporter = r.reporter as Record<string, unknown> | undefined;
      const detail: Detail = {
        id: String(r.id ?? ''),
        type: String(r.type ?? 'Complaint'),
        description: String(r.description ?? ''),
        status: String(r.status ?? 'open'),
        merchant_notes: String(r.merchant_notes ?? ''),
        photos: Array.isArray(r.photos) ? (r.photos as unknown[]).map((p) => String(p)) : [],
        created_at: typeof r.created_at === 'string' ? r.created_at : null,
        order_id: String(order?.id ?? ''),
        order_code: String(order?.reservation_code ?? ''),
        order_total: Number(order?.total ?? 0),
        outlet_name: String(outlet?.name ?? '') || 'Outlet',
        reporter_name: String(reporter?.full_name ?? '') || 'Customer',
      };
      setComplaint(detail);
      setNoteDraft(detail.merchant_notes);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [env, merchant, outletScopeIds, route.params.complaintId, reloadKey]);

  const escalate = useCallback(async () => {
    if (!complaint) return;
    setBusy(true);
    const sb = getSupabase(env);
    const { error } = await sb
      .from('complaints')
      .update({
        status: 'escalated',
        merchant_notes: noteDraft.trim() || null,
      })
      .eq('id', complaint.id);
    setBusy(false);
    if (error) {
      Alert.alert('Escalation failed', mapSupabaseError(error, ERROR.merchant.complaintEscalate));
      return;
    }
    Alert.alert('Escalated', 'Fresh As Ever support will follow up.');
    setReloadKey((k) => k + 1);
  }, [complaint, env, noteDraft]);

  const issueRefund = useCallback(async () => {
    if (!complaint?.order_id) {
      Alert.alert('No order linked', 'This complaint is not tied to an order.');
      return;
    }
    Alert.alert(
      'Refund customer',
      `Refund Rs. ${complaint.order_total.toFixed(0)} for order ${complaint.order_code || complaint.order_id.slice(0, 8)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Refund',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            const token = (await getSupabase(env).auth.getSession()).data.session?.access_token;
            if (!token) {
              setBusy(false);
              Alert.alert('Refund failed', 'Not signed in.');
              return;
            }
            const result = await postOrderRefund(env.apiBaseUrl, token, {
              order_id: complaint.order_id,
              complaint_id: complaint.id,
              reason: noteDraft.trim() || 'Merchant refund via dispute',
            });
            setBusy(false);
            if (result.error) {
              Alert.alert(
                'Refund failed',
                mapSupabaseError(
                  { message: result.error } as Error,
                  ERROR.merchant.complaintRefund,
                ),
              );
              return;
            }
            Alert.alert('Refunded', 'The customer will receive their refund per payment method.');
            setReloadKey((k) => k + 1);
          },
        },
      ],
    );
  }, [complaint, env, noteDraft]);

  const styles = useMemo(
    () => ({
      input: {
        borderWidth: 1,
        borderColor: colors.divider,
        borderRadius: radii.lg,
        padding: spacing.md,
        color: colors.text,
        minHeight: 88,
        textAlignVertical: 'top' as const,
      },
    }),
    [colors, radii, spacing],
  );

  if (!merchantLoading && !merchant) {
    return (
      <StitchScreen scroll scrollProps={{ contentContainerStyle: { padding: spacing.pageMarginMobile } }}>
        <StitchText variant="h3" colorKey="text">
          Merchant access required
        </StitchText>
        <StitchButton title="Go back" variant="secondary" onPress={() => navigation.goBack()} />
      </StitchScreen>
    );
  }

  if (loading) {
    return (
      <StitchScreen scroll scrollProps={{ contentContainerStyle: { padding: spacing.pageMarginMobile } }}>
        <ActivityIndicator color={colors.primaryContainer} />
      </StitchScreen>
    );
  }

  if (err || !complaint) {
    return (
      <StitchScreen scroll scrollProps={{ contentContainerStyle: { padding: spacing.pageMarginMobile, gap: spacing.md } }}>
        <StitchText variant="body-md" colorKey="error">
          {err ?? 'Complaint not found'}
        </StitchText>
        <StitchButton title="Back" variant="secondary" onPress={() => navigation.goBack()} />
      </StitchScreen>
    );
  }

  const resolved = ['resolved', 'closed', 'dismissed'].includes(complaint.status.toLowerCase());

  return (
    <StitchScreen
      scroll
      scrollProps={{
        contentContainerStyle: {
          padding: spacing.pageMarginMobile,
          gap: spacing.md,
          paddingBottom: spacing.xxl,
        },
      }}
    >
      <StitchText variant="h1" colorKey="text">
        {complaint.type}
      </StitchText>
      <StitchText variant="body-sm" colorKey="textMuted">
        {complaint.outlet_name} · {complaint.order_code ? `#${complaint.order_code}` : 'Order'} ·{' '}
        {complaint.created_at ? new Date(complaint.created_at).toLocaleString() : '—'}
      </StitchText>
      <StitchText variant="label" colorKey="textMuted">
        Status: {complaint.status}
      </StitchText>

      <StitchSurface elevated padding="md">
        <StitchText variant="h3" colorKey="text">
          Customer report
        </StitchText>
        <StitchText variant="body-md" colorKey="text" style={{ marginTop: spacing.sm }}>
          {complaint.description || '—'}
        </StitchText>
        <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: spacing.sm }}>
          {complaint.reporter_name}
        </StitchText>
        {complaint.photos.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md }}>
            {complaint.photos.map((url) => (
              <Image
                key={url}
                source={{ uri: url }}
                style={{ width: 96, height: 96, borderRadius: radii.default }}
                accessibilityLabel="Evidence"
              />
            ))}
          </View>
        ) : null}
      </StitchSurface>

      <StitchSurface elevated padding="md">
        <StitchText variant="h3" colorKey="text">
          Your response
        </StitchText>
        <TextInput
          multiline
          editable={!resolved && !busy}
          value={noteDraft}
          onChangeText={setNoteDraft}
          placeholder="Notes for Fresh As Ever or the customer…"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />
      </StitchSurface>

      {!resolved ? (
        <View style={{ gap: spacing.sm }}>
          <StitchButton
            title={busy ? 'Working…' : 'Refund customer'}
            variant="primary"
            disabled={busy}
            onPress={() => void issueRefund()}
          />
          <StitchButton
            title="Escalate to Fresh As Ever"
            variant="secondary"
            disabled={busy}
            onPress={() => void escalate()}
          />
        </View>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <StitchIcon name="check_circle" size={20} colorKey="success" />
          <StitchText variant="body-md" colorKey="textMuted">
            This dispute is closed.
          </StitchText>
        </View>
      )}
    </StitchScreen>
  );
}
