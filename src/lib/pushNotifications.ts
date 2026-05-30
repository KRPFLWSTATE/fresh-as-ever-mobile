import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import type { AppEnv } from '@/config/env';
import { getSupabase } from '@/lib/supabase';
import { logError } from '@/observability/logError';
import {
  ensureNotificationHandler,
  isPushNativeModuleAvailable,
  loadExpoNotifications,
} from '@/lib/pushNativeModule';

function resolveExpoProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  const fromExtra = extra?.eas?.projectId?.trim();
  if (fromExtra) return fromExtra;
  const envId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim();
  return envId || undefined;
}

export type PushPermissionSnapshot = {
  granted: boolean;
  canAskAgain: boolean;
  status: string;
};

/** Current OS notification permission (null when push native module unavailable). */
export async function getPushPermissionSnapshot(): Promise<PushPermissionSnapshot | null> {
  if (!isPushNativeModuleAvailable()) {
    return null;
  }

  const Notifications = await loadExpoNotifications();
  if (!Notifications || !Device.isDevice) {
    return null;
  }

  const permission = await Notifications.getPermissionsAsync();
  return {
    granted: permission.granted,
    canAskAgain: permission.canAskAgain ?? true,
    status: permission.status,
  };
}

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!isPushNativeModuleAvailable()) {
    return null;
  }

  const Notifications = await loadExpoNotifications();
  if (!Notifications) {
    return null;
  }

  await ensureNotificationHandler();

  if (!Device.isDevice) {
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Fresh As Ever',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    return null;
  }

  const projectId = resolveExpoProjectId();
  if (!projectId) {
    logError(new Error('Missing Expo projectId (extra.eas.projectId)'), {
      context: 'pushNotifications.register',
    });
    return null;
  }

  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  return token.data;
}

export async function persistPushToken(
  env: AppEnv,
  userId: string,
  expoPushToken: string,
): Promise<void> {
  const supabase = getSupabase(env);
  const platform =
    Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
  const { error } = await supabase.from('push_device_tokens').upsert(
    {
      user_id: userId,
      expo_push_token: expoPushToken,
      platform,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,expo_push_token' },
  );
  if (error) {
    throw error;
  }
}

export async function removePushToken(env: AppEnv, userId: string, expoPushToken: string) {
  const supabase = getSupabase(env);
  await supabase
    .from('push_device_tokens')
    .delete()
    .eq('user_id', userId)
    .eq('expo_push_token', expoPushToken);
}

export function shelfIdFromNotificationData(
  data: Record<string, unknown> | undefined,
): string | null {
  if (!data) return null;
  const raw = data.shelfId ?? data.shelf_id;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
}
