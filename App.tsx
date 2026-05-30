/**
 * Fresh as Ever mobile — sibling to Next.js store app (see docs/migration).
 *
 * @format
 */

import React, { useEffect, useMemo } from 'react';
import {
  ActivityIndicator,
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuthContext } from '@/context/AuthContext';
import { usePlatformSettings } from '@/hooks/usePlatformSettings';
import { readEnv } from '@/config/env';
import { appEnvSchema } from '@/config/envSchema';
import { RootErrorBoundary } from '@/errors/RootErrorBoundary';
import { installReactNativeGlobalHandlers } from '@/observability/installGlobalHandlers';
import { PushNotificationsBridge } from '@/components/PushNotificationsBridge';
import { RootNavigator } from '@/navigation/RootNavigator';
import { StitchThemeProvider } from '@/theme/StitchThemeContext';

function EnvMissingGate() {
  return (
    <View style={styles.envGate}>
      <Text style={styles.envTitle}>Missing env</Text>
      <Text style={styles.envSub}>
        Copy `.env.example` to `.env` and fill Supabase + API URLs.
      </Text>
    </View>
  );
}

function MaintenanceBanner({ env }: { env: ReturnType<typeof readEnv> }) {
  const { flags } = usePlatformSettings(env);
  if (!flags.maintenance) return null;
  return (
    <View style={styles.maintenanceBanner}>
      <Text style={styles.maintenanceText}>
        Fresh As Ever is in maintenance mode. Some actions may be unavailable.
      </Text>
    </View>
  );
}

function AuthHydrateOverlay(): React.ReactElement | null {
  const { initializing } = useAuthContext();
  if (!initializing) return null;
  return (
    <View style={styles.overlay} pointerEvents="none">
      <ActivityIndicator size="large" />
    </View>
  );
}

function App(): React.ReactElement {
  const isDarkMode = useColorScheme() === 'dark';
  const env = useMemo(() => readEnv(), []);
  useEffect(() => {
    installReactNativeGlobalHandlers();
  }, []);

  const envOk =
    !!env.supabaseUrl && !!env.supabaseAnonKey && !!env.apiBaseUrl;

  const envShape = appEnvSchema.safeParse({
    supabaseUrl: env.supabaseUrl,
    supabaseAnonKey: env.supabaseAnonKey,
    apiBaseUrl: env.apiBaseUrl,
    payHereReturnHost:
      typeof env.payHereReturnHost === 'string' ? env.payHereReturnHost : '',
  });

  if (envOk && !envShape.success) {
    return (
      <SafeAreaProvider>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <View style={styles.envGate}>
          <Text style={styles.envTitle}>Invalid env URLs</Text>
          <Text style={styles.envSub}>
            {envShape.error.issues.map((i) => i.message).join('\n')}
          </Text>
        </View>
      </SafeAreaProvider>
    );
  }

  if (!envOk) {
    return (
      <SafeAreaProvider>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <EnvMissingGate />
      </SafeAreaProvider>
    );
  }

  return (
    <RootErrorBoundary>
      <SafeAreaProvider>
        <StitchThemeProvider>
          <AuthProvider env={env}>
            <StatusBar
              barStyle={isDarkMode ? 'light-content' : 'dark-content'}
            />
            <MaintenanceBanner env={env} />
            <PushNotificationsBridge />
            <RootNavigator />
            <AuthHydrateOverlay />
          </AuthProvider>
        </StitchThemeProvider>
      </SafeAreaProvider>
    </RootErrorBoundary>
  );
}

const styles = StyleSheet.create({
  envGate: {
    flex: 1,
    justifyContent: 'center',
    padding: 28,
    gap: 8,
    backgroundColor: '#fafafa',
  },
  envTitle: { fontSize: 20, fontWeight: '700' },
  envSub: { opacity: 0.75, fontSize: 15 },
  overlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff88',
  },
  maintenanceBanner: {
    backgroundColor: '#8b4513',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  maintenanceText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default App;
