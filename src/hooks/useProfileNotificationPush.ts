import { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import type { AppEnv } from '@/config/env';
import { isPushNativeModuleAvailable } from '@/lib/pushNativeModule';
import {
  getPushPermissionSnapshot,
  persistPushToken,
  registerForPushNotificationsAsync,
} from '@/lib/pushNotifications';
import { logError } from '@/observability/logError';

type Options = {
  env: AppEnv;
  userId: string | undefined;
  pushOn: boolean;
  setPushOn: (value: boolean) => void;
  /** Wait until profile/async prefs are loaded before syncing OS permission. */
  hydrated: boolean;
};

/**
 * Re-checks OS push permission when the notifications screen gains focus and
 * re-registers the device token when push alerts are enabled.
 */
export function useProfileNotificationPush({
  env,
  userId,
  pushOn,
  setPushOn,
  hydrated,
}: Options): void {
  const tryRegisterPushToken = useCallback(async () => {
    if (!userId || !isPushNativeModuleAvailable()) {
      return;
    }

    const token = await registerForPushNotificationsAsync();
    if (!token) {
      return;
    }
    await persistPushToken(env, userId, token);
  }, [env, userId]);

  useFocusEffect(
    useCallback(() => {
      if (!hydrated || !pushOn || !userId || !isPushNativeModuleAvailable()) {
        return;
      }

      let cancelled = false;
      void (async () => {
        try {
          const permission = await getPushPermissionSnapshot();
          if (cancelled) return;
          if (!permission?.granted) {
            setPushOn(false);
            return;
          }
          await tryRegisterPushToken();
        } catch (err) {
          logError(err, { context: 'useProfileNotificationPush.focus' });
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [hydrated, pushOn, setPushOn, tryRegisterPushToken, userId]),
  );
}
