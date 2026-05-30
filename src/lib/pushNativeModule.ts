import { requireOptionalNativeModule } from 'expo-modules-core';

let cachedAvailability: boolean | undefined;

/** True when expo-notifications native code is linked in the current binary. */
export function isPushNativeModuleAvailable(): boolean {
  if (cachedAvailability !== undefined) {
    return cachedAvailability;
  }
  cachedAvailability = requireOptionalNativeModule('ExpoPushTokenManager') != null;
  return cachedAvailability;
}

export const PUSH_REBUILD_MESSAGE =
  'Push notifications need a native rebuild. Run `npx expo prebuild` (if needed), then rebuild in Xcode or with `npm run ios`. Your app works normally until then.';

type ExpoNotificationsModule = typeof import('expo-notifications');

let notificationsModulePromise: Promise<ExpoNotificationsModule | null> | undefined;
let notificationHandlerConfigured = false;

/** Lazy-load expo-notifications only when native modules are present. */
export async function loadExpoNotifications(): Promise<ExpoNotificationsModule | null> {
  if (!isPushNativeModuleAvailable()) {
    return null;
  }
  if (!notificationsModulePromise) {
    notificationsModulePromise = import('expo-notifications').catch(() => null);
  }
  return notificationsModulePromise;
}

export async function ensureNotificationHandler(): Promise<void> {
  if (notificationHandlerConfigured || !isPushNativeModuleAvailable()) {
    return;
  }
  const Notifications = await loadExpoNotifications();
  if (!Notifications) {
    return;
  }
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
  notificationHandlerConfigured = true;
}
