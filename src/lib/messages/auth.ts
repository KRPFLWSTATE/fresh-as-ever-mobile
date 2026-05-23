import { ERROR } from '@/lib/messages/errors';

export function mapAuthError(
  message: unknown,
  fallback: string = ERROR.auth.loginFailed,
): string {
  const m = String(message ?? '').toLowerCase();
  if (m.includes('invalid login credentials') || m.includes('invalid_credentials')) {
    return ERROR.auth.invalidCredentials;
  }
  if (m.includes('email not confirmed')) {
    return 'Confirm your email first, then sign in.';
  }
  return fallback;
}
