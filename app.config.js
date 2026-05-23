/** Expo config for config plugins (Sign in with Apple, scheme). Used by `npx expo prebuild` / EAS. */
module.exports = {
  expo: {
    name: 'FreshAsEverMobile',
    slug: 'fresh-as-ever-mobile',
    scheme: 'freshasever',
    plugins: ['expo-apple-authentication'],
    ios: {
      bundleIdentifier: 'com.freshasever.mobile',
    },
    android: {
      package: 'com.freshasever.mobile',
    },
  },
};
