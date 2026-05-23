import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import type { BarcodeScanningResult } from 'expo-camera';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthContext } from '@/context/AuthContext';
import { useMerchantOrders } from '@/hooks/useMerchantOrders';
import { parseHandoverCodeFromScan } from '@/lib/handoverQr';
import type { RootStackParamList } from '@/navigation/types';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import {
  StitchButton,
  StitchIcon,
  StitchScreen,
  StitchSurface,
  StitchText,
} from '@/ui/stitch';

type Nav = NativeStackNavigationProp<RootStackParamList, 'MerchantScanHandover'>;

export function MerchantScanHandoverScreen(): React.ReactElement {
  const navigation = useNavigation<Nav>();
  const { env } = useAuthContext();
  const { authorizeHandoverByCode } = useMerchantOrders(env, 'verification');
  const { colors, spacing, radii } = useStitchTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [manualCode, setManualCode] = useState('');
  const [busy, setBusy] = useState(false);
  const lastScanRef = useRef<string | null>(null);

  const submitCode = useCallback(
    async (raw: string) => {
      const code = parseHandoverCodeFromScan(raw);
      if (!code) {
        Alert.alert(
          'Invalid code',
          'Scan the customer QR or enter their 6-character pickup code.',
        );
        return;
      }
      setBusy(true);
      try {
        const { error } = await authorizeHandoverByCode(code);
        if (error) {
          Alert.alert('Could not authorize', error);
          return;
        }
        Alert.alert('Handover complete', 'Order marked as collected.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } catch {
        Alert.alert('Could not authorize', 'Something went wrong. Try again.');
      } finally {
        setBusy(false);
      }
    },
    [authorizeHandoverByCode, navigation],
  );

  const onBarcodeScanned = useCallback(
    (result: BarcodeScanningResult) => {
      if (busy) return;
      const payload = String(result.data ?? '').trim();
      if (!payload || payload === lastScanRef.current) return;
      lastScanRef.current = payload;
      void submitCode(payload);
    },
    [busy, submitCode],
  );

  const cameraReady =
    permission?.granted === true && !busy;

  return (
    <StitchScreen scroll scrollProps={{ contentContainerStyle: { padding: spacing.pageMarginMobile, gap: spacing.md } }}>
      <StitchText variant="h1" colorKey="text">
        Scan pickup QR
      </StitchText>
      <StitchText variant="body-md" colorKey="textMuted">
        Point the camera at the customer&apos;s order QR, or enter their 6-digit code below.
      </StitchText>

      <StitchSurface elevated padding="none" style={{ borderRadius: radii.xl, overflow: 'hidden' }}>
        {!permission ? (
          <View style={styles.cameraPlaceholder}>
            <ActivityIndicator color={colors.primaryContainer} />
          </View>
        ) : !permission.granted ? (
          <View style={[styles.cameraPlaceholder, { padding: spacing.lg, gap: spacing.md }]}>
            <StitchIcon name="qr_code_scanner" size={40} colorKey="textMuted" />
            <StitchText variant="body-md" colorKey="textMuted" style={{ textAlign: 'center' }}>
              Camera access is needed to scan pickup QR codes.
            </StitchText>
            <StitchButton
              title="Allow camera"
              onPress={() => {
                void requestPermission();
              }}
            />
          </View>
        ) : (
          <View style={styles.cameraWrap}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={cameraReady ? onBarcodeScanned : undefined}
            />
            {busy ? (
              <View style={styles.cameraOverlay}>
                <ActivityIndicator color={colors.onPrimary} size="large" />
              </View>
            ) : null}
          </View>
        )}
      </StitchSurface>

      <StitchText variant="label" colorKey="textMuted">
        Or enter code manually
      </StitchText>
      <TextInput
        accessibilityLabel="Verification code"
        value={manualCode}
        onChangeText={setManualCode}
        placeholder="e.g. 849201"
        placeholderTextColor={colors.textFaint}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={6}
        editable={!busy}
        style={{
          minHeight: 48,
          paddingHorizontal: spacing.md,
          borderRadius: radii.lg,
          borderWidth: 1,
          borderColor: colors.outlineVariant,
          fontSize: 16,
          letterSpacing: 3.2,
          color: colors.text,
          backgroundColor: colors.surface,
        }}
      />

      <StitchButton
        title={busy ? 'Verifying…' : 'Authorize handover'}
        onPress={() => {
          void submitCode(manualCode);
        }}
        disabled={busy}
      />

      <Pressable
        accessibilityRole="button"
        onPress={() => navigation.goBack()}
        style={{ alignSelf: 'center', paddingVertical: spacing.sm }}
      >
        <StitchText variant="label" colorKey="textMuted">
          Cancel
        </StitchText>
      </Pressable>
    </StitchScreen>
  );
}

const styles = StyleSheet.create({
  cameraWrap: {
    width: '100%',
    minWidth: 280,
    aspectRatio: 3 / 4,
    backgroundColor: '#111',
  },
  cameraPlaceholder: {
    width: '100%',
    minWidth: 280,
    aspectRatio: 3 / 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111',
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
});
