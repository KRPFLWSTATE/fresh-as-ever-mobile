/** Expo config for config plugins (Sign in with Apple, scheme). Used by `npx expo prebuild` / EAS. */
const isDevBuild =
  process.env.NODE_ENV !== 'production' &&
  process.env.EXPO_PUBLIC_ALLOW_LOCAL_NETWORKING !== '0';

const appTransportSecurity = {
  NSAllowsArbitraryLoads: false,
  ...(isDevBuild ? { NSAllowsLocalNetworking: true } : {}),
};

module.exports = {
  expo: {
    name: 'FreshAsEverMobile',
    slug: 'fresh-as-ever-mobile',
    scheme: 'freshasever',
    plugins: [
      'expo-apple-authentication',
      [
        'expo-notifications',
        {
          color: '#0d9488',
        },
      ],
    ],
    extra: {
      eas: {
        // Run `eas init` or set EXPO_PUBLIC_EAS_PROJECT_ID to your Expo project UUID.
        projectId:
          process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? 'c8f4e2a1-9b3d-4f6e-a7c2-1d5e8f0a2b4c',
      },
    },
    ios: {
      bundleIdentifier: 'com.freshasever.mobile',
      infoPlist: {
        UIBackgroundModes: ['remote-notification'],
        NSAppTransportSecurity: appTransportSecurity,
      },
    },
    android: {
      package: 'com.freshasever.mobile',
    },
  },
};
