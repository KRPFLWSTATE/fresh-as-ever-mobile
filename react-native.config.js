module.exports = {
  project: {
    ios: {},
    android: {},
  },
  assets: ['./assets/fonts/'],
  // Bare RN app: we only need expo-modules-core + feature modules (camera, image-picker).
  // The top-level `expo` pod pulls ExpoReactNativeFactory.swift, which targets a different RN API than 0.85.
  dependencies: {
    expo: {
      platforms: {
        ios: null,
        android: null,
      },
    },
  },
};
