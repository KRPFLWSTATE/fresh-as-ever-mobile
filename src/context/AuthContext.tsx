import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Linking, Platform } from 'react-native';
import type { Session, User } from '@supabase/supabase-js';
import { CommonActions } from '@react-navigation/native';
import { getSupabase } from '@/lib/supabase';
import {
  completeOAuthRedirect,
  signInWithAppleNative,
  signInWithOAuthProvider,
} from '@/lib/socialAuth';
import type { AppEnv } from '@/config/env';
import { ENABLE_QA_ROLE_OVERRIDES } from '@env';
import { navigationRef } from '@/navigation/navigationRef';
import { scheduleMicrotask } from '@/lib/microtask';
import { mapAuthError } from '@/lib/messages/auth';
import { ERROR } from '@/lib/messages/errors';
import { resetMerchantContextStore } from '@/hooks/useMerchantContext';
import { clearReservationCartStorage } from '@/hooks/useReservationCart';

export type ResolvedRole =
  | 'customer'
  | 'admin'
  | 'merchant_staff'
  | 'merchant';

export type AppUser =
  | (User & {
      role: ResolvedRole;
      isSuspended: boolean;
      full_name?: string | null;
    })
  | null;

type AuthContextValue = {
  env: AppEnv;
  initializing: boolean;
  session: Session | null;
  user: AppUser;
  resolvedRole: ResolvedRole;
  isSuspended: boolean;
  refreshProfile: () => Promise<void>;
  signInWithEmailPassword: (
    email: string,
    password: string,
    portalHint?: 'admin' | 'merchant' | null,
  ) => Promise<{ error?: string }>;
  requestPhoneOtp: (phoneDigits: string) => Promise<{ error?: string }>;
  verifyPhoneOtp: (phoneDigits: string, token: string) => Promise<{ error?: string }>;
  signUpWithEmail: (
    email: string,
    password: string,
  ) => Promise<{ error?: string }>;
  resetPasswordForEmail: (email: string) => Promise<{ error?: string }>;
  signInWithGoogle: () => Promise<{ error?: string }>;
  signInWithApple: () => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const allowQaEmailRoleOverrides =
  __DEV__ ||
  ENABLE_QA_ROLE_OVERRIDES === 'true' ||
  ENABLE_QA_ROLE_OVERRIDES === '1';

function formatPhoneLK(raw: string): string {
  const p = raw.replace(/\s/g, '');
  if (p.startsWith('+')) {
    return p;
  }
  return `+94${p.replace(/^0/, '')}`;
}

async function fetchResolvedUser(
  supabase: ReturnType<typeof getSupabase>,
): Promise<{ user: AppUser; resolvedRole: ResolvedRole; isSuspended: boolean }> {
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return {
      user: null,
      resolvedRole: 'customer',
      isSuspended: false,
    };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_suspended, full_name')
    .eq('id', authUser.id)
    .maybeSingle();

  let profileRole = profile?.role ?? null;
  let isSuspended = profile?.is_suspended === true;

  if (!profileRole && authUser.email) {
    const byEmail = await supabase
      .from('profiles')
      .select('role, is_suspended, full_name')
      .eq('email', authUser.email)
      .maybeSingle();
    if (byEmail.data) {
      profileRole = byEmail.data.role ?? profileRole;
      if (byEmail.data.is_suspended === true) {
        isSuspended = true;
      }
    }
  }

  const md =
    authUser.app_metadata?.role || authUser.user_metadata?.role || null;
  const qaEmailRole = allowQaEmailRoleOverrides
    ? authUser.email === 'qa.admin@freshasever.test'
      ? 'admin'
      : authUser.email === 'qa.merchant@freshasever.test'
        ? 'merchant_staff'
        : null
    : null;
  let normalized = (
    profileRole ||
    md ||
    qaEmailRole ||
    'customer'
  ).toLowerCase();

  const resolvedRole =
    normalized === 'merchant' ? 'merchant_staff' : (normalized as ResolvedRole);

  return {
    user: {
      ...authUser,
      role: resolvedRole,
      isSuspended,
      full_name: profile?.full_name ?? authUser.user_metadata?.full_name,
    },
    resolvedRole,
    isSuspended,
  };
}

export function AuthProvider({
  env,
  children,
}: {
  env: AppEnv;
  children: ReactNode;
}) {
  const supabase = useMemo(() => getSupabase(env), [env]);

  const [initializing, setInitializing] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AppUser>(null);
  const [resolvedRole, setResolvedRole] = useState<ResolvedRole>('customer');
  const [isSuspended, setIsSuspended] = useState(false);

  const hydrate = useCallback(async () => {
    const next = await fetchResolvedUser(supabase);
    setUser(next.user);
    setResolvedRole(next.resolvedRole);
    setIsSuspended(next.isSuspended);
  }, [supabase]);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const {
        data: { session: s },
      } = await supabase.auth.getSession();
      if (s?.access_token && s.refresh_token) {
        await supabase.auth.setSession({
          access_token: s.access_token,
          refresh_token: s.refresh_token,
        });
      }
      if (!mounted) return;
      setSession(s);
      setInitializing(false);
    })();

    const { data } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s);
      scheduleMicrotask(() => {
        void hydrate();
      });
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [supabase, hydrate]);

  useEffect(() => {
    if (!session) {
      setUser(null);
      setResolvedRole('customer');
      setIsSuspended(false);
      return;
    }
    scheduleMicrotask(() => {
      void hydrate();
    });
  }, [session, hydrate]);

  const refreshProfile = useCallback(async () => {
    await hydrate();
  }, [hydrate]);

  const signInWithEmailPassword = useCallback(
    async (
      email: string,
      password: string,
      portalHint: 'admin' | 'merchant' | null = null,
    ): Promise<{ error?: string }> => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error || !data.user) {
        return { error: mapAuthError(error?.message) };
      }
      if (data.session) {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
        setSession(data.session);
        resetMerchantContextStore(env);
      }
      let r =
        data.user.app_metadata?.role ||
        data.user.user_metadata?.role ||
        null;
      if (data.user.id && !r) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .maybeSingle();
        r = prof?.role ?? null;
      }
      const qa = allowQaEmailRoleOverrides
        ? email === 'qa.admin@freshasever.test'
          ? 'admin'
          : email === 'qa.merchant@freshasever.test'
            ? 'merchant_staff'
            : null
        : null;
      let norm = (r || qa || 'customer').toLowerCase();
      norm = norm === 'merchant' ? 'merchant_staff' : norm;

      if (portalHint === 'admin' && norm !== 'admin') {
        await supabase.auth.signOut();
        return { error: ERROR.auth.notAdmin };
      }
      if (
        portalHint === 'merchant' &&
        norm !== 'merchant_staff' &&
        norm !== 'admin'
      ) {
        await supabase.auth.signOut();
        return { error: ERROR.auth.notMerchant };
      }

      await hydrate();
      return {};
    },
    [supabase, hydrate, env],
  );

  const requestPhoneOtp = useCallback(
    async (phoneDigits: string): Promise<{ error?: string }> => {
      const phone = formatPhoneLK(phoneDigits);
      const { error } = await supabase.auth.signInWithOtp({ phone });
      if (error) {
        return { error: mapAuthError(error.message, ERROR.auth.otpFailed) };
      }
      return {};
    },
    [supabase],
  );

  const verifyPhoneOtp = useCallback(
    async (phoneDigits: string, token: string): Promise<{ error?: string }> => {
      const phone = formatPhoneLK(phoneDigits);
      const { error } = await supabase.auth.verifyOtp({
        phone,
        token,
        type: 'sms',
      });
      if (error) {
        return { error: mapAuthError(error.message, ERROR.auth.otpFailed) };
      }
      await hydrate();
      return {};
    },
    [supabase, hydrate],
  );

  const signUpWithEmail = useCallback(
    async (email: string, password: string): Promise<{ error?: string }> => {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        return { error: error.message };
      }
      return {};
    },
    [supabase],
  );

  const resetPasswordForEmail = useCallback(
    async (email: string): Promise<{ error?: string }> => {
      const redirectTo = env.apiBaseUrl
        ? `${env.apiBaseUrl.replace(/\/$/, '')}/auth/callback`
        : 'freshasever://login';
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo },
      );
      if (error) {
        return { error: error.message };
      }
      return {};
    },
    [supabase, env.apiBaseUrl],
  );

  const signInWithGoogle = useCallback(async (): Promise<{ error?: string }> => {
    const result = await signInWithOAuthProvider(supabase, 'google');
    if (result.cancelled) {
      return {};
    }
    if (result.error) {
      return { error: mapAuthError(result.error, ERROR.auth.oauthFailed) };
    }
    await hydrate();
    return {};
  }, [supabase, hydrate]);

  const signInWithApple = useCallback(async (): Promise<{ error?: string }> => {
    if (Platform.OS === 'ios') {
      const native = await signInWithAppleNative(supabase);
      if (native.cancelled) {
        return {};
      }
      if (!native.error) {
        await hydrate();
        return {};
      }
      const fallback = await signInWithOAuthProvider(supabase, 'apple');
      if (fallback.cancelled) {
        return {};
      }
      if (fallback.error) {
        return {
          error: mapAuthError(
            fallback.error ?? native.error,
            ERROR.auth.oauthFailed,
          ),
        };
      }
      await hydrate();
      return {};
    }
    const result = await signInWithOAuthProvider(supabase, 'apple');
    if (result.cancelled) {
      return {};
    }
    if (result.error) {
      return { error: mapAuthError(result.error, ERROR.auth.oauthFailed) };
    }
    await hydrate();
    return {};
  }, [supabase, hydrate]);

  useEffect(() => {
    const onUrl = (url: string) => {
      if (!url.includes('auth/callback')) {
        return;
      }
      void completeOAuthRedirect(supabase, url).then((r) => {
        if (!r.error) {
          void hydrate();
        }
      });
    };
    const sub = Linking.addEventListener('url', ({ url }) => onUrl(url));
    void Linking.getInitialURL().then((url) => {
      if (url) {
        onUrl(url);
      }
    });
    return () => sub.remove();
  }, [supabase, hydrate]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut({ scope: 'local' });
    await clearReservationCartStorage().catch(() => undefined);
    resetMerchantContextStore(env);
    setUser(null);
    setSession(null);
    setResolvedRole('customer');
    setIsSuspended(false);
    scheduleMicrotask(() => {
      if (!navigationRef.isReady()) {
        return;
      }
      navigationRef.dispatch(
        CommonActions.reset({ index: 0, routes: [{ name: 'MainTabs' }] }),
      );
    });
  }, [supabase, env]);

  const value = useMemo(
    (): AuthContextValue => ({
      env,
      initializing,
      session,
      user,
      resolvedRole,
      isSuspended,
      refreshProfile,
      signInWithEmailPassword,
      requestPhoneOtp,
      verifyPhoneOtp,
      signUpWithEmail,
      resetPasswordForEmail,
      signInWithGoogle,
      signInWithApple,
      signOut,
    }),
    [
      env,
      initializing,
      session,
      user,
      resolvedRole,
      isSuspended,
      refreshProfile,
      signInWithEmailPassword,
      requestPhoneOtp,
      verifyPhoneOtp,
      signUpWithEmail,
      resetPasswordForEmail,
      signInWithGoogle,
      signInWithApple,
      signOut,
    ],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('AuthProvider missing');
  }
  return ctx;
}
