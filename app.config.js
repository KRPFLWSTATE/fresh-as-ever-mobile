/** Expo config for config plugins (Sign in with Apple, scheme). Used by `npx expo prebuild` / EAS. */
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
      },
    },
    android: {
      package: 'com.freshasever.mobile',
    },
  },
};
