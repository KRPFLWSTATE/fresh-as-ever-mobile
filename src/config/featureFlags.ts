import {
  EXPO_PUBLIC_LISTING_WHATSAPP_SHARE,
  EXPO_PUBLIC_MONTHLY_SAVINGS_PUSH,
  EXPO_PUBLIC_NEIGHBOURHOOD_BROWSE,
  EXPO_PUBLIC_ON_MY_WAY,
  EXPO_PUBLIC_PICKUP_WINDOW_PRESETS,
  EXPO_PUBLIC_SEASONAL_BADGES,
} from '@env';
import { parseDemoModeFlag } from '@/config/parseDemoModeFlag';

/** Pass 26 — Sri Lanka expansion feature flags (default off until integration QA). */
export const PASS26_FEATURE_FLAGS = {
  PICKUP_WINDOW_PRESETS: 'EXPO_PUBLIC_PICKUP_WINDOW_PRESETS',
  LISTING_WHATSAPP_SHARE: 'EXPO_PUBLIC_LISTING_WHATSAPP_SHARE',
  NEIGHBOURHOOD_BROWSE: 'EXPO_PUBLIC_NEIGHBOURHOOD_BROWSE',
  SEASONAL_BADGES: 'EXPO_PUBLIC_SEASONAL_BADGES',
  ON_MY_WAY: 'EXPO_PUBLIC_ON_MY_WAY',
  MONTHLY_SAVINGS_PUSH: 'EXPO_PUBLIC_MONTHLY_SAVINGS_PUSH',
} as const;

export type Pass26FeatureFlagKey = keyof typeof PASS26_FEATURE_FLAGS;

/** Runtime flag reads — use in UI gates. */
export const featureFlags = {
  get PICKUP_WINDOW_PRESETS(): boolean {
    return isPickupWindowPresetsEnabled();
  },
  get LISTING_WHATSAPP_SHARE(): boolean {
    return isListingWhatsAppShareEnabled();
  },
  get NEIGHBOURHOOD_BROWSE(): boolean {
    return isNeighbourhoodBrowseEnabled();
  },
  get SEASONAL_BADGES(): boolean {
    return isSeasonalBadgesEnabled();
  },
  get ON_MY_WAY(): boolean {
    return isOnMyWayEnabled();
  },
  get MONTHLY_SAVINGS_PUSH(): boolean {
    return isMonthlySavingsPushEnabled();
  },
};

export function isPickupWindowPresetsEnabled(): boolean {
  return parseDemoModeFlag(EXPO_PUBLIC_PICKUP_WINDOW_PRESETS);
}

export function isListingWhatsAppShareEnabled(): boolean {
  return parseDemoModeFlag(EXPO_PUBLIC_LISTING_WHATSAPP_SHARE);
}

export function isNeighbourhoodBrowseEnabled(): boolean {
  return parseDemoModeFlag(EXPO_PUBLIC_NEIGHBOURHOOD_BROWSE);
}

export function isSeasonalBadgesEnabled(): boolean {
  return parseDemoModeFlag(EXPO_PUBLIC_SEASONAL_BADGES);
}

export function isOnMyWayEnabled(): boolean {
  return parseDemoModeFlag(EXPO_PUBLIC_ON_MY_WAY);
}

/** Server-side cron / push; mobile reads for in-app notification prefs only. */
export function isMonthlySavingsPushEnabled(): boolean {
  return parseDemoModeFlag(EXPO_PUBLIC_MONTHLY_SAVINGS_PUSH);
}
