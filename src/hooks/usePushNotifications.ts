import { useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';
import type { AppEnv } from '@/config/env';
import type { ResolvedRole } from '@/context/AuthContext';
import {
  isPushNativeModuleAvailable,
  loadExpoNotifications,
} from '@/lib/pushNativeModule';
import {
  persistPushToken,
  registerForPushNotificationsAsync,
  shelfIdFromNotificationData,
} from '@/lib/pushNotifications';
import { logError } from '@/observability/logError';
import { getSupabase } from '@/lib/supabase';

type Options = {
  env: AppEnv;
  userId: string | undefined;
  resolvedRole: ResolvedRole;
};

/**
 * Registers Expo push token for customers when push alerts are enabled.
 * Handles notification taps → shelf deep link.
 * No-ops when expo-notifications native modules are not linked.
 */
export function usePushNotifications({ env, userId, resolvedRole }: Options): void {
  const lastTokenRef = useRef<string | null>(null);
  const [pushEnabled, setPushEnabled] = useState(true);
  const pushNativeAvailable = isPushNativeModuleAvailable();

  useEffect(() => {
    if (!userId || resolvedRole !== 'customer') {
      setPushEnabled(false);
      return;
    }
    let cancelled = false;
    void fetchPushPrefEnabled(env, userId).then((enabled) => {
      if (!cancelled) setPushEnabled(enabled);
    });
    return () => {
      cancelled = true;
    };
  }, [env, resolvedRole, userId]);

  useEffect(() => {
    if (!pushNativeAvailable || !userId || resolvedRole !== 'customer' || !pushEnabled) {
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const token = await registerForPushNotificationsAsync();
        if (cancelled || !token || token === lastTokenRef.current) return;
        lastTokenRef.current = token;
        await persistPushToken(env, userId, token);
      } catch (err) {
        logError(err, { context: 'usePushNotifications.register' });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [env, pushEnabled, pushNativeAvailable, resolvedRole, userId]);

  useEffect(() => {
    if (!pushNativeAvailable) {
      return;
    }

    let cancelled = false;
    let removeListener: (() => void) | undefined;

    void (async () => {
      const Notifications = await loadExpoNotifications();
      if (cancelled || !Notifications) {
        return;
      }

      const sub = Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data as Record<string, unknown>;
        const shelfId = shelfIdFromNotificationData(data);
        if (shelfId) {
          void Linking.openURL(`freshasever://shelves/${shelfId}`);
          return;
        }
        const outletId = data.outletId ?? data.outlet_id;
        if (typeof outletId === 'string' && outletId.trim()) {
          void Linking.openURL(`freshasever://outlet/${outletId.trim()}`);
        }
      });
      removeListener = () => sub.remove();
    })();

    return () => {
      cancelled = true;
      removeListener?.();
    };
  }, [pushNativeAvailable]);

  useEffect(() => {
    if (!pushNativeAvailable || !userId || resolvedRole !== 'customer') {
      return;
    }

    let cancelled = false;
    let removeListener: (() => void) | undefined;

    void (async () => {
      const Notifications = await loadExpoNotifications();
      if (cancelled || !Notifications) {
        return;
      }

      const sub = Notifications.addPushTokenListener(async () => {
        if (!pushEnabled) return;
        try {
          const token = await registerForPushNotificationsAsync();
          if (token && token !== lastTokenRef.current) {
            lastTokenRef.current = token;
            await persistPushToken(env, userId, token);
          }
        } catch (err) {
          logError(err, { context: 'usePushNotifications.tokenRefresh' });
        }
      });
      removeListener = () => sub.remove();
    })();

    return () => {
      cancelled = true;
      removeListener?.();
    };
  }, [env, pushEnabled, pushNativeAvailable, resolvedRole, userId]);
}

export async function fetchPushPrefEnabled(env: AppEnv, userId: string): Promise<boolean> {
  const { data } = await getSupabase(env)
    .from('profiles')
    .select('notification_prefs')
    .eq('id', userId)
    .maybeSingle();
  const prefs = data?.notification_prefs as { push?: boolean } | null;
  if (prefs && typeof prefs.push === 'boolean') return prefs.push;
  return true;
}
