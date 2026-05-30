import React, { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useMerchantClearanceShelfGuard } from '@/hooks/useMerchantClearanceShelfGuard';
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
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { useAuthContext } from '@/context/AuthContext';
import { useBarcodeLookup } from '@/hooks/useBarcodeLookup';
import { newTempItemId } from '@/lib/merchantShelfForm';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import {
  StitchButton,
  StitchIcon,
  StitchScreen,
  StitchSurface,
  StitchText,
} from '@/ui/stitch';

type Props = NativeStackScreenProps<RootStackParamList, 'MerchantShelfScanItem'>;

export function MerchantShelfScanItemScreen({ navigation }: Props) {
  const { allowed: shelvesAllowed, goToBags } = useMerchantClearanceShelfGuard();

  useFocusEffect(
    useCallback(() => {
      if (!shelvesAllowed) {
        goToBags();
      }
    }, [goToBags, shelvesAllowed]),
  );

  const { env } = useAuthContext();
  const { lookup, loading, error, clear } = useBarcodeLookup(env);
  const { colors, spacing, radii } = useStitchTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [manualBarcode, setManualBarcode] = useState('');
  const lastScanRef = useRef<string | null>(null);

  const openManualItem = useCallback(() => {
    navigation.replace('MerchantShelfItemEditor', {
      prefill: {
        tempId: newTempItemId(),
        barcode: null,
        name_snapshot: '',
        allergens_snapshot: [],
        rescue_price: 100,
        quantity_total: 5,
        quantity_remaining: 5,
      },
      returnTo: 'scan',
    });
  }, [navigation]);

  const openItemEditor = useCallback(
    (barcode: string, product: Awaited<ReturnType<typeof lookup>>) => {
      navigation.replace('MerchantShelfItemEditor', {
        prefill: {
          tempId: newTempItemId(),
          barcode,
          product_id: product?.id ?? null,
          name_snapshot: product?.name ?? '',
          brand_snapshot: product?.brand ?? null,
          image_url_snapshot: product?.image_url ?? null,
          allergens_snapshot: product?.allergens ?? [],
          is_halal: product?.is_halal_hint ?? null,
          rescue_price: 100,
          retail_price: null,
          quantity_total: 5,
          quantity_remaining: 5,
          catalog_category: product?.category ?? null,
          catalog_weight_grams: product?.weight_grams ?? null,
          catalog_ingredients: product?.ingredients_summary ?? null,
        },
        returnTo: 'scan',
      });
    },
    [navigation],
  );

  const handleBarcode = useCallback(
    async (code: string) => {
      const trimmed = code.trim();
      if (!trimmed) return;
      const product = await lookup(trimmed);
      if (!product && !error) {
        Alert.alert(
          'Product not found',
          'We could not find this barcode. You can still add the item manually.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Add manually',
              onPress: () =>
                navigation.replace('MerchantShelfItemEditor', {
                  prefill: {
                    tempId: newTempItemId(),
                    barcode: trimmed,
                    name_snapshot: '',
                    allergens_snapshot: [],
                    rescue_price: 100,
                    quantity_total: 5,
                    quantity_remaining: 5,
                  },
                  returnTo: 'scan',
                }),
            },
          ],
        );
        return;
      }
      openItemEditor(trimmed, product);
    },
    [error, lookup, navigation, openItemEditor],
  );

  const onBarcodeScanned = useCallback(
    (result: BarcodeScanningResult) => {
      if (loading) return;
      const payload = String(result.data ?? '').trim();
      if (!payload || payload === lastScanRef.current) return;
      lastScanRef.current = payload;
      void handleBarcode(payload);
    },
    [handleBarcode, loading],
  );

  const cameraReady = permission?.granted === true && !loading;

  return (
    <StitchScreen
      scroll
      scrollProps={{
        contentContainerStyle: {
          padding: spacing.pageMarginMobile,
          gap: spacing.md,
        },
      }}
    >
      <StitchText variant="h1" colorKey="text">
        Scan barcode
      </StitchText>
      <StitchText variant="body-md" colorKey="textMuted">
        Scan a product barcode to prefill name, brand, and allergens.
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
              Camera access is needed to scan product barcodes.
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
              barcodeScannerSettings={{
                barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39'],
              }}
              onBarcodeScanned={cameraReady ? onBarcodeScanned : undefined}
            />
            {loading ? (
              <View style={styles.cameraOverlay}>
                <ActivityIndicator color={colors.onPrimary} size="large" />
                <StitchText variant="label" colorKey="onPrimary" style={{ marginTop: spacing.sm }}>
                  Looking up product…
                </StitchText>
              </View>
            ) : null}
          </View>
        )}
      </StitchSurface>

      <StitchText variant="label" colorKey="textMuted">
        Or enter barcode manually
      </StitchText>
      <TextInput
        accessibilityLabel="Barcode"
        value={manualBarcode}
        onChangeText={setManualBarcode}
        placeholder="e.g. 4790012345678"
        placeholderTextColor={colors.textFaint}
        autoCapitalize="none"
        autoCorrect={false}
        editable={!loading}
        style={{
          minHeight: 48,
          paddingHorizontal: spacing.md,
          borderRadius: radii.lg,
          borderWidth: 1,
          borderColor: colors.outlineVariant,
          fontSize: 16,
          color: colors.text,
          backgroundColor: colors.surface,
        }}
      />

      {error ? (
        <StitchText variant="body-sm" colorKey="error">
          {error}
        </StitchText>
      ) : null}

      <StitchButton
        title={loading ? 'Looking up…' : 'Look up barcode'}
        onPress={() => {
          clear();
          void handleBarcode(manualBarcode);
        }}
        disabled={loading || !manualBarcode.trim()}
      />

      <StitchButton
        variant="secondary"
        title="Add without barcode"
        onPress={openManualItem}
        disabled={loading}
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
