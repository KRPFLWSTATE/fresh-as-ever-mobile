import { NativeModules, Platform } from 'react-native';

import {
  isRunningInSimulator,
  resetIsRunningInSimulatorCacheForTests,
} from '@/lib/isRunningInSimulator';

const originalPlatformOs = Platform.OS;
const originalConstants = Platform.constants;

describe('isRunningInSimulator', () => {
  beforeEach(() => {
    resetIsRunningInSimulatorCacheForTests();
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: originalPlatformOs,
    });
    Object.defineProperty(Platform, 'constants', {
      configurable: true,
      value: originalConstants,
    });
    delete NativeModules.FreshAsEverEnvironment;
  });

  it('returns true when the iOS native module reports simulator', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    NativeModules.FreshAsEverEnvironment = { isSimulator: true };
    expect(isRunningInSimulator()).toBe(true);
  });

  it('retries when the iOS native module is not ready on the first read', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    delete NativeModules.FreshAsEverEnvironment;
    expect(isRunningInSimulator()).toBe(false);
    NativeModules.FreshAsEverEnvironment = { isSimulator: true };
    expect(isRunningInSimulator()).toBe(true);
  });

  it('coerces numeric isSimulator from the bridge (1/0)', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    NativeModules.FreshAsEverEnvironment = { isSimulator: 1 as unknown as boolean };
    expect(isRunningInSimulator()).toBe(true);
    resetIsRunningInSimulatorCacheForTests();
    NativeModules.FreshAsEverEnvironment = { isSimulator: 0 as unknown as boolean };
    expect(isRunningInSimulator()).toBe(false);
  });

  it('returns false when the iOS native module reports a physical device', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    NativeModules.FreshAsEverEnvironment = { isSimulator: false };
    expect(isRunningInSimulator()).toBe(false);
  });

  it('detects Android emulators from Platform.constants heuristics', () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'android',
    });
    Object.defineProperty(Platform, 'constants', {
      configurable: true,
      value: {
        ...originalConstants,
        Fingerprint: 'generic/sdk_gphone64_arm64/userdebug',
        Model: 'sdk_gphone64_arm64',
        Product: 'sdk_gphone64_arm64',
      },
    });
    expect(isRunningInSimulator()).toBe(true);
  });

  it('returns false for a typical physical Android device', () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'android',
    });
    Object.defineProperty(Platform, 'constants', {
      configurable: true,
      value: {
        ...originalConstants,
        Fingerprint: 'samsung/beyond1ltexx/beyond1:13',
        Model: 'SM-G973F',
        Product: 'beyond1ltexx',
      },
    });
    expect(isRunningInSimulator()).toBe(false);
  });
});
