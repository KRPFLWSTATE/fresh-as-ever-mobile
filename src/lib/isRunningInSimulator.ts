import { NativeModules, Platform } from 'react-native';

/** Cached after first read — simulator vs device does not change at runtime. */
let cached: boolean | null = null;

type DeviceInfoModule = {
  isEmulatorSync?: () => boolean;
};

type FreshAsEverEnvironmentModule = {
  isSimulator?: boolean;
};

function isAndroidEmulatorFromConstants(): boolean {
  const c = Platform.constants as {
    Brand?: string;
    Model?: string;
    Fingerprint?: string;
    Product?: string;
  };
  const fingerprint = (c.Fingerprint ?? '').toLowerCase();
  const model = (c.Model ?? '').toLowerCase();
  const product = (c.Product ?? '').toLowerCase();
  return (
    fingerprint.includes('generic') ||
    fingerprint.includes('unknown') ||
    model.includes('sdk') ||
    model.includes('emulator') ||
    product.includes('sdk') ||
    product.includes('emulator') ||
    product.includes('simulator')
  );
}

function readFromDeviceInfo(): boolean | null {
  try {
    const DeviceInfo = require('react-native-device-info') as DeviceInfoModule;
    if (typeof DeviceInfo.isEmulatorSync === 'function') {
      return DeviceInfo.isEmulatorSync();
    }
  } catch {
    // Optional dependency — not installed in this app.
  }
  return null;
}

function readIosSimulatorFromNative(): boolean | null {
  try {
    const mod = NativeModules.FreshAsEverEnvironment as
      | FreshAsEverEnvironmentModule
      | undefined;
    if (mod != null && mod.isSimulator != null) {
      // Bridge may expose @YES/@NO as boolean or 1/0 depending on RN version.
      return Boolean(mod.isSimulator);
    }
  } catch {
    // Native module unavailable (e.g. older build).
  }
  return null;
}

/**
 * True when the app runs on the iOS Simulator or an Android emulator.
 *
 * Detection order: optional `react-native-device-info` (`isEmulatorSync`),
 * iOS app native `FreshAsEverEnvironment`, then Android `Platform.constants`
 * heuristics. Never imports `expo-device` (not linked in this bare RN app).
 */
export function isRunningInSimulator(): boolean {
  if (cached !== null) return cached;

  const fromDeviceInfo = readFromDeviceInfo();
  if (fromDeviceInfo !== null) {
    cached = fromDeviceInfo;
    return cached;
  }

  if (Platform.OS === 'ios') {
    const fromNative = readIosSimulatorFromNative();
    if (fromNative !== null) {
      cached = fromNative;
      return cached;
    }
    // Bridge may not have registered constants yet on first JS tick — do not
    // cache `false` or global GPX / simctl coords stay rejected for the session.
    return false;
  }

  if (Platform.OS === 'android') {
    cached = isAndroidEmulatorFromConstants();
    return cached;
  }

  cached = false;
  return cached;
}

/** @internal Reset cache between Jest cases. */
export function resetIsRunningInSimulatorCacheForTests(): void {
  cached = null;
}
