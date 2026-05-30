const { webcrypto } = require('node:crypto');
if (!global.crypto?.getRandomValues) {
  global.crypto = webcrypto;
}

jest.mock(
  '@env',
  () => ({
    SUPABASE_URL: 'http://localhost.test',
    SUPABASE_ANON_KEY: 'test-anon-key',
    API_BASE_URL: 'http://localhost.test',
    PAYHERE_RETURN_URL_HOST: '',
    ENABLE_QA_ROLE_OVERRIDES: undefined,
    EXPO_PUBLIC_GROUP_RESERVATIONS_ENABLED: undefined,
    EXPO_PUBLIC_CLEARANCE_SHELVES_ENABLED: undefined,
  }),
  { virtual: true },
);

jest.mock('react-native-encrypted-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
    clear: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock('react-native-get-random-values', () => ({}));

jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: jest.fn(() => Promise.resolve({ type: 'cancel' })),
}));

jest.mock('expo-auth-session', () => ({
  makeRedirectUri: jest.fn(() => 'freshasever://auth/callback'),
}));

jest.mock('expo-auth-session/build/QueryParams', () => ({
  getQueryParams: jest.fn(() => ({ params: {}, errorCode: null })),
}));

jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: jest.fn(() => Promise.resolve(false)),
  signInAsync: jest.fn(),
  AppleAuthenticationScope: {
    FULL_NAME: 0,
    EMAIL: 1,
  },
}));

jest.mock('@react-native-async-storage/async-storage', () => {
  /** @type {Record<string, string>} */
  let store = {};
  return {
    __esModule: true,
    default: {
      getItem: jest.fn((k) => Promise.resolve(store[k] ?? null)),
      setItem: jest.fn((k, v) => {
        store[k] = String(v);
        return Promise.resolve();
      }),
      removeItem: jest.fn((k) => {
        delete store[k];
        return Promise.resolve();
      }),
      clear: jest.fn(() => {
        store = {};
        return Promise.resolve();
      }),
    },
  };
});

jest.mock('react-native-maps', () => {
  const React = require('react');
  /**
   * @param {{children?: React.ReactNode}} props
   */
  function MockMap({ children }) {
    return React.createElement('mock-map', null, children);
  }
  return {
    __esModule: true,
    default: MockMap,
    Marker: () => React.createElement('mock-marker'),
    PROVIDER_DEFAULT: 'default',
  };
});

jest.mock('react-native-webview', () => ({
  __esModule: true,
  WebView: 'WebView',
}));

jest.mock('react-native-vector-icons/MaterialIcons', () => {
  const React = require('react');
  return React.forwardRef((props, ref) =>
    React.createElement('Icon', { ...props, ref }),
  );
});

jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  /** @returns {null} */
  default: () => null,
}));

jest.mock('@react-native-clipboard/clipboard', () => ({
  __esModule: true,
  default: {
    setString: jest.fn(),
    getString: jest.fn(() => Promise.resolve('')),
  },
}));

jest.mock('@/hooks/usePlatformSettings', () => ({
  usePlatformSettings: () => ({
    flags: {
      maintenance: false,
      merchant_signups: true,
      fraud_guard_strict: false,
    },
    loading: false,
    refresh: jest.fn(),
  }),
}));

jest.mock('expo-camera', () => ({
  __esModule: true,
  CameraView: 'CameraView',
  useCameraPermissions: jest.fn(() => [
    { granted: true, canAskAgain: true, status: 'granted' },
    jest.fn(),
  ]),
}));

jest.mock('expo-haptics', () => ({
  __esModule: true,
  ImpactFeedbackStyle: { Light: 'light' },
  impactAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('expo-image-picker', () => ({
  __esModule: true,
  PermissionStatus: {
    UNDETERMINED: 'undetermined',
    GRANTED: 'granted',
    DENIED: 'denied',
  },
  requestMediaLibraryPermissionsAsync: jest.fn(() =>
    Promise.resolve({ status: 'granted', granted: true, canAskAgain: true }),
  ),
  getMediaLibraryPermissionsAsync: jest.fn(() =>
    Promise.resolve({ status: 'granted', granted: true, canAskAgain: true }),
  ),
  launchImageLibraryAsync: jest.fn(() =>
    Promise.resolve({ canceled: true, assets: null }),
  ),
}));

jest.mock('@react-native-community/geolocation', () => ({
  __esModule: true,
  default: {
    setRNConfiguration: jest.fn(),
    requestAuthorization: jest.fn((_success, error) => {
      // Mirror "user has not granted" by default. Individual tests can override
      // via `jest.mocked(Geolocation.requestAuthorization).mockImplementation(...)`.
      if (typeof error === 'function') {
        error({
          code: 1,
          message: 'denied',
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        });
      }
    }),
    getCurrentPosition: jest.fn((_success, error) => {
      if (typeof error === 'function') {
        error({
          code: 1,
          message: 'denied',
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        });
      }
    }),
    watchPosition: jest.fn(() => 1),
    clearWatch: jest.fn(),
    stopObserving: jest.fn(),
  },
}));

jest.mock('react-native-qrcode-svg', () => {
  const React = require('react');
  /**
   * @param {Record<string, unknown>} props
   */
  function MockQR(props) {
    return React.createElement('mock-qrcode', props);
  }
  return { __esModule: true, default: MockQR };
});

jest.mock('react-native-svg', () => {
  const React = require('react');
  /** @returns {React.ReactElement} */
  function Svg(props) {
    return React.createElement('svg', props, props && props.children);
  }
  /** @returns {null} */
  function passthrough() {
    return null;
  }
  return {
    __esModule: true,
    default: Svg,
    Svg,
    Path: passthrough,
    Rect: passthrough,
    G: passthrough,
    Defs: passthrough,
    LinearGradient: passthrough,
    Stop: passthrough,
    Circle: passthrough,
  };
});

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  /**
   * @param {{children: React.ReactNode}} props
   */
  function SAP({ children }) {
    return children;
  }
  return {
    SafeAreaProvider: SAP,
    useSafeAreaInsets: () => ({
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
    }),
  };
});
