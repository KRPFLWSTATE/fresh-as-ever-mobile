import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { useAuthContext } from '@/context/AuthContext';
import { useMerchantContext } from '@/hooks/useMerchantContext';
import { getSupabase } from '@/lib/supabase';
import type { RootStackParamList } from '@/navigation/types';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import { StitchIcon, StitchScreen, StitchSurface, StitchText } from '@/ui/stitch';

type StaffRow = {
  id: string;
  user_id: string | null;
  role: string | null;
  invited_email: string | null;
  display_name: string | null;
  status: string | null;
  created_at: string | null;
};

export function MerchantStaffScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { env } = useAuthContext();
  const { merchant, loading: ctxLoading } = useMerchantContext(env);
  const { colors, spacing, radii } = useStitchTheme();

  const [rows, setRows] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);

  const loadStaff = useCallback(async () => {
    if (!merchant?.id) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const sb = getSupabase(env);
      const { data, error: fetchErr } = await sb
        .from('merchant_staff')
        .select(
          'id, user_id, role, invited_email, display_name, status, created_at',
        )
        .eq('merchant_id', String(merchant.id))
        .order('created_at', { ascending: false });
      if (fetchErr) throw fetchErr;
      setRows((data ?? []) as StaffRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load staff.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [env, merchant?.id]);

  useEffect(() => {
    if (ctxLoading) return;
    void loadStaff();
  }, [ctxLoading, loadStaff]);

  const inviteStaff = useCallback(async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!merchant?.id) {
      setError('Merchant profile is still loading.');
      return;
    }
    if (!email.includes('@')) {
      setError('Enter a valid email to invite.');
      return;
    }
    setInviteBusy(true);
    setError(null);
    try {
      const sb = getSupabase(env);
      const res = await fetch(`${env.apiBaseUrl}/api/merchant/invite-staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchant_id: String(merchant.id),
          email,
          role: 'staff',
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        const { error: insertErr } = await sb.from('merchant_staff').insert({
          merchant_id: String(merchant.id),
          invited_email: email,
          role: 'staff',
          status: 'invited',
        });
        if (insertErr) throw new Error(payload.error ?? insertErr.message);
      }
      setInviteEmail('');
      await loadStaff();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send invitation.');
    } finally {
      setInviteBusy(false);
    }
  }, [env, inviteEmail, loadStaff, merchant?.id]);

  const updateStatus = useCallback(
    async (staffId: string, status: 'active' | 'revoked' | 'invited') => {
      if (!merchant?.id) return;
      setError(null);
      try {
        const sb = getSupabase(env);
        const { error: updErr } = await sb
          .from('merchant_staff')
          .update({ status, updated_at: new Date().toISOString() })
          .eq('id', staffId)
          .eq('merchant_id', String(merchant.id));
        if (updErr) throw updErr;
        await loadStaff();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not update staff.');
      }
    },
    [env, loadStaff, merchant?.id],
  );

  const styles = useMemo(() => {
    const row: ViewStyle = {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    };
    return { row };
  }, [colors.divider, spacing]);

  return (
    <StitchScreen
      scroll
      scrollProps={{
        contentContainerStyle: {
          padding: spacing.pageMarginMobile,
          paddingBottom: spacing.xxl,
          gap: spacing.lg,
        },
      }}
    >
      <Pressable
        accessibilityRole="button"
        onPress={() => navigation.goBack()}
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}
      >
        <StitchIcon name="arrow_back" size={22} colorKey="primaryContainer" />
        <StitchText variant="label" colorKey="primaryContainer">
          Back
        </StitchText>
      </Pressable>

      <StitchText variant="h1" colorKey="text">
        Staff accounts
      </StitchText>
      <StitchText variant="body-md" colorKey="textMuted">
        Invite colleagues, activate accounts, or revoke access. Invited users cannot operate until
        marked active.
      </StitchText>

      <StitchSurface elevated padding="md" style={{ gap: spacing.md }}>
        <StitchText variant="label" colorKey="textMuted">
          Invite by email
        </StitchText>
        <TextInput
          value={inviteEmail}
          onChangeText={setInviteEmail}
          placeholder="colleague@outlet.lk"
          placeholderTextColor={colors.textFaint}
          autoCapitalize="none"
          keyboardType="email-address"
          style={{
            minHeight: 48,
            borderWidth: 1,
            borderColor: colors.outlineVariant,
            borderRadius: radii.lg,
            paddingHorizontal: spacing.md,
            color: colors.onBackground,
          }}
        />
        <Pressable
          accessibilityRole="button"
          disabled={inviteBusy}
          onPress={() => void inviteStaff()}
          style={{
            minHeight: 48,
            borderRadius: radii.lg,
            backgroundColor: colors.primaryContainer,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: inviteBusy ? 0.7 : 1,
          }}
        >
          <StitchText variant="label" colorKey="onPrimary">
            {inviteBusy ? 'Sending…' : 'Send invite'}
          </StitchText>
        </Pressable>
        {error ? (
          <StitchText variant="body-sm" colorKey="error">
            {error}
          </StitchText>
        ) : null}
      </StitchSurface>

      {loading ? (
        <ActivityIndicator color={colors.primaryContainer} />
      ) : (
        <StitchSurface elevated padding="none">
          {rows.length === 0 ? (
            <View style={{ padding: spacing.lg }}>
              <StitchText variant="body-md" colorKey="textMuted">
                No staff yet. Invites appear here once sent.
              </StitchText>
            </View>
          ) : (
            rows.map((s) => (
              <View key={s.id} style={[styles.row, { paddingHorizontal: spacing.md }]}>
                <View style={{ flex: 1 }}>
                  <StitchText variant="label" colorKey="text">
                    {s.display_name ?? s.invited_email ?? 'Staff member'}
                  </StitchText>
                  <StitchText variant="body-sm" colorKey="textMuted">
                    {s.role ?? 'staff'} · {s.status ?? 'invited'}
                  </StitchText>
                </View>
                {s.status === 'invited' ? (
                  <Pressable onPress={() => void updateStatus(s.id, 'active')}>
                    <StitchText variant="label" colorKey="primaryContainer">
                      Activate
                    </StitchText>
                  </Pressable>
                ) : null}
                {s.status === 'active' ? (
                  <Pressable onPress={() => void updateStatus(s.id, 'revoked')}>
                    <StitchText variant="label" colorKey="error">
                      Revoke
                    </StitchText>
                  </Pressable>
                ) : null}
                {s.status === 'revoked' ? (
                  <Pressable onPress={() => void updateStatus(s.id, 'invited')}>
                    <StitchText variant="label" colorKey="textMuted">
                      Re-invite
                    </StitchText>
                  </Pressable>
                ) : null}
              </View>
            ))
          )}
        </StitchSurface>
      )}
    </StitchScreen>
  );
}
