import EncryptedStorage from 'react-native-encrypted-storage';

/**
 * Supabase auth expects storage methods that never reject unexpectedly.
 * On iOS Simulator, Keychain-backed `removeItem` can throw even when the key
 * is absent; that surfaces as an unhandled rejection and breaks OTP flows.
 */
export const supabaseSecureStorage = {
  getItem: (key: string) => EncryptedStorage.getItem(key),
  setItem: (key: string, value: string) => EncryptedStorage.setItem(key, value),
  removeItem: async (key: string) => {
    try {
      await EncryptedStorage.removeItem(key);
    } catch {
      /* ignore — parity with Web Storage removeItem no-op */
    }
  },
};
