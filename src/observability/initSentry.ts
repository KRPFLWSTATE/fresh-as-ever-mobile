import * as Sentry from '@sentry/react-native';
import { SENTRY_DSN } from '@env';

const dsn = (SENTRY_DSN ?? '').trim();

if (dsn) {
  Sentry.init({
    dsn,
    environment: __DEV__ ? 'development' : 'production',
    // Performance: lower in production; full sampling in dev when debugging.
    tracesSampleRate: __DEV__ ? 1.0 : 0.2,
    enableAutoSessionTracking: true,
    enableNative: true,
    enableNativeCrashHandling: true,
  });
}

export { Sentry };

export function isSentryEnabled(): boolean {
  return Boolean(dsn);
}
