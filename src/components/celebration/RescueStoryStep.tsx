import React, { forwardRef, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import ViewShot from 'react-native-view-shot';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import { StitchButton, StitchIcon, StitchText } from '@/ui/stitch';
import { captureViewShot, shareCardGraphic } from '@/lib/shareCard';

const CAPTION_MAX = 280;

export type RescueStoryStepProps = {
  outletName: string;
  impactLine: string;
  saving: boolean;
  onSkip: () => void;
  onSave: (input: { localPhotoUri: string; caption: string }) => Promise<void>;
};

export const RescueStoryGraphic = forwardRef<
  React.ElementRef<typeof ViewShot>,
  { photoUri: string; outletName: string; impactLine: string }
>(function RescueStoryGraphic({ photoUri, outletName, impactLine }, ref) {
  const { colors, spacing, radii } = useStitchTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        shot: { width: 360, borderRadius: radii.xl, overflow: 'hidden' },
        inner: { padding: spacing.lg, gap: spacing.md, backgroundColor: colors.background },
        photo: { width: '100%', height: 220, borderRadius: radii.lg },
      }),
    [colors.background, radii.lg, radii.xl, spacing.lg, spacing.md],
  );

  return (
    <ViewShot ref={ref} options={{ format: 'png', quality: 1 }} style={styles.shot}>
      <View style={styles.inner} testID="celebration.storyGraphic">
        <Svg height={80} width="100%" style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="storyWash" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={colors.primaryContainer} stopOpacity={0.2} />
              <Stop offset="1" stopColor={colors.accent} stopOpacity={0.15} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="80" fill="url(#storyWash)" />
        </Svg>
        <StitchText variant="label-caps" colorKey="primary">
          My rescue story
        </StitchText>
        <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" />
        <StitchText variant="h3" colorKey="onSurface">
          {outletName}
        </StitchText>
        <StitchText variant="body-md" colorKey="textMuted">
          {impactLine}
        </StitchText>
      </View>
    </ViewShot>
  );
});

export function RescueStoryStep({
  outletName,
  impactLine,
  saving,
  onSkip,
  onSave,
}: RescueStoryStepProps): React.ReactElement {
  const { colors, spacing, radii } = useStitchTheme();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const graphicRef = React.useRef<React.ElementRef<typeof ViewShot>>(null);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        shell: { gap: spacing.lg },
        photoBtn: {
          height: 180,
          borderRadius: radii.lg,
          borderWidth: 2,
          borderStyle: 'dashed',
          borderColor: colors.divider,
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
          overflow: 'hidden',
        },
        photoPreview: { width: '100%', height: '100%' },
        input: {
          minHeight: 88,
          borderRadius: radii.default,
          borderWidth: 1,
          borderColor: colors.divider,
          padding: spacing.md,
          color: colors.onSurface,
          textAlignVertical: 'top',
        },
        actions: { gap: spacing.sm },
        offscreen: { position: 'absolute', left: -9999, top: 0 },
      }),
    [colors.divider, colors.onSurface, radii.lg, radii.default, spacing.lg, spacing.md, spacing.sm],
  );

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    if (!photoUri) return;
    await onSave({ localPhotoUri: photoUri, caption });
    const uri = await captureViewShot(graphicRef);
    if (uri) {
      await shareCardGraphic({
        title: 'My rescue story',
        message: caption.trim() || `Rescued at ${outletName} with Fresh As Ever`,
        imageUri: uri,
      });
    }
  };

  return (
    <View style={styles.shell} testID="celebration.storyStep">
      <StitchText variant="h2" colorKey="primary">
        Share your rescue moment?
      </StitchText>
      <StitchText variant="body-md" colorKey="textMuted">
        Optional — snap your haul, add a caption, and inspire the next rescuer.
      </StitchText>
      <Pressable
        accessibilityRole="button"
        onPress={() => void pickPhoto()}
        style={styles.photoBtn}
        testID="celebration.storyAddPhoto"
      >
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.photoPreview} resizeMode="cover" />
        ) : (
          <>
            <StitchIcon name="photo_camera" size={32} colorKey="primary" />
            <StitchText variant="label" colorKey="primary">
              Add a photo
            </StitchText>
          </>
        )}
      </Pressable>
      <TextInput
        value={caption}
        onChangeText={(t) => setCaption(t.slice(0, CAPTION_MAX))}
        placeholder="What made this rescue special?"
        placeholderTextColor={colors.textFaint}
        multiline
        style={styles.input}
        testID="celebration.storyCaption"
      />
      <StitchText variant="body-sm" colorKey="textMuted">
        {caption.length}/{CAPTION_MAX}
      </StitchText>
      <View style={styles.actions}>
        <StitchButton
          title={saving ? 'Saving…' : 'Save story'}
          onPress={() => void handleSave()}
          disabled={!photoUri || saving}
        />
        <StitchButton
          title="Skip for now"
          variant="secondary"
          onPress={onSkip}
          disabled={saving}
          testID="celebration.storySkip"
        />
      </View>
      {photoUri ? (
        <View style={styles.offscreen} pointerEvents="none">
          <RescueStoryGraphic
            ref={graphicRef}
            photoUri={photoUri}
            outletName={outletName}
            impactLine={impactLine}
          />
        </View>
      ) : null}
      {saving ? <ActivityIndicator color={colors.primaryContainer} /> : null}
    </View>
  );
}
