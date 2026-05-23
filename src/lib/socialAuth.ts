import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import { makeRedirectUri } from 'expo-auth-session';
import * as AppleAuthentication from 'expo-apple-authentication';
import type { SupabaseClient } from '@supabase/supabase-js';

WebBrowser.maybeCompleteAuthSession();

export type OAuthProvider = 'google' | 'apple';

/** Deep link / universal link target registered in Supabase Auth redirect URLs. */
export function getOAuthRedirectUri(): string {
  const uri = makeRedirectUri({
    scheme: 'freshasever',
    path: 'auth/callback',
  });
  if (uri && !uri.startsWith('exp://')) {
    return uri;
  }
  return 'freshasever://auth/callback';
}

export async function signInWithOAuthProvider(
  supabase: SupabaseClient,
  provider: OAuthProvider,
  redirectTo: string = getOAuthRedirectUri(),
): Promise<{ error?: string; cancelled?: boolean }> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });
  if (error) {
    return { error: error.message };
  }
  if (!data?.url) {
    return { error: 'Could not start sign in.' };
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type === 'cancel' || result.type === 'dismiss') {
    return { cancelled: true };
  }
  if (result.type !== 'success') {
    return { error: 'Sign in did not complete.' };
  }

  return completeOAuthRedirect(supabase, result.url);
}

/** Exchange PKCE code or tokens from an OAuth redirect URL. */
export async function completeOAuthRedirect(
  supabase: SupabaseClient,
  url: string,
): Promise<{ error?: string }> {
  const { params, errorCode } = QueryParams.getQueryParams(url);
  if (errorCode) {
    return { error: String(errorCode) };
  }
  if (params.error_description || params.error) {
    return {
      error: String(params.error_description ?? params.error),
    };
  }
  if (params.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(params.code);
    return error ? { error: error.message } : {};
  }
  const accessToken = params.access_token;
  const refreshToken = params.refresh_token;
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: String(accessToken),
      refresh_token: String(refreshToken),
    });
    return error ? { error: error.message } : {};
  }
  return { error: 'Missing sign-in credentials in redirect.' };
}

export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') {
    return false;
  }
  return AppleAuthentication.isAvailableAsync();
}

/** Native Sign in with Apple (iOS) — preferred on Apple devices. */
export async function signInWithAppleNative(
  supabase: SupabaseClient,
): Promise<{ error?: string; cancelled?: boolean }> {
  const available = await isAppleSignInAvailable();
  if (!available) {
    return { error: 'Apple Sign In is not available on this device.' };
  }

  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!credential.identityToken) {
      return { error: 'Apple did not return a sign-in token.' };
    }
    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
    });
    if (error) {
      return { error: error.message };
    }
    return {};
  } catch (e: unknown) {
    const code =
      e && typeof e === 'object' && 'code' in e
        ? String((e as { code?: string }).code)
        : '';
    if (code === 'ERR_REQUEST_CANCELED') {
      return { cancelled: true };
    }
    return {
      error: e instanceof Error ? e.message : 'Apple sign in failed.',
    };
  }
}
