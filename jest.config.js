module.exports = {
  preset: '@react-native/jest-preset',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@react-navigation|react-native-url-polyfill|@react-native|react-native|react-native-screens|react-native-safe-area-context|react-native-maps|react-native-webview)/)',
  ],
};
