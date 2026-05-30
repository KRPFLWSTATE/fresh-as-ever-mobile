import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import type { AppEnv } from '@/config/env';
import {
  customerComplaintTypeOptions,
  type CustomerComplaintType,
} from '@/lib/complaints/customerComplaintTypes';
import { submitCustomerComplaint } from '@/lib/complaints/submitCustomerComplaint';
import {
  complaintImagePath,
  pickAndUploadImage,
} from '@/lib/storage/uploadImage';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import { StitchButton, StitchIcon, StitchText } from '@/ui/stitch';

const MAX_PHOTOS = 3;

type Props = {
  visible: boolean;
  onClose: () => void;
  env: AppEnv;
  orderId: string;
  userId: string;
  onSubmitted: () => void;
  isShelfOrder?: boolean;
};

export function ReportProblemModal({
  visible,
  onClose,
  env,
  orderId,
  userId,
  onSubmitted,
  isShelfOrder = false,
}: Props) {
  const typeOptions = useMemo(
    () => customerComplaintTypeOptions(isShelfOrder),
    [isShelfOrder],
  );
  const { colors, spacing, radii } = useStitchTheme();
  const [type, setType] = useState<CustomerComplaintType>('quality');
  const [description, setDescription] = useState('');
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const inputStyle = useMemo(
    () => ({
      borderWidth: 1,
      borderColor: colors.divider,
      borderRadius: radii.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontSize: 16,
      color: colors.text,
      backgroundColor: colors.surface,
      minHeight: 120,
      textAlignVertical: 'top' as const,
    }),
    [colors.divider, colors.surface, colors.text, radii.lg, spacing.md, spacing.sm],
  );

  const reset = useCallback(() => {
    setType('quality');
    setDescription('');
    setPhotoUrls([]);
    setBusy(false);
    setUploadingPhoto(false);
  }, []);

  const handleClose = useCallback(() => {
    if (busy) return;
    reset();
    onClose();
  }, [busy, onClose, reset]);

  const onAddPhoto = useCallback(async () => {
    if (photoUrls.length >= MAX_PHOTOS) {
      Alert.alert('Photo limit', `You can attach up to ${MAX_PHOTOS} photos.`);
      return;
    }
    setUploadingPhoto(true);
    const result = await pickAndUploadImage({
      env,
      bucket: 'complaint-images',
      path: complaintImagePath(userId, orderId),
    });
    setUploadingPhoto(false);
    if (result.kind === 'cancelled') return;
    if (result.kind === 'error') {
      Alert.alert('Upload failed', result.message);
      return;
    }
    setPhotoUrls((prev) => [...prev, result.publicUrl]);
  }, [env, orderId, photoUrls.length, userId]);

  const onSubmit = useCallback(async () => {
    setBusy(true);
    const result = await submitCustomerComplaint({
      env,
      orderId,
      reporterId: userId,
      type,
      description,
      photoUrls,
    });
    setBusy(false);
    if (!result.ok) {
      Alert.alert('Could not submit', result.message);
      return;
    }
    Alert.alert(
      'Report received',
      'Our team will review your report and follow up if needed.',
      [
        {
          text: 'OK',
          onPress: () => {
            reset();
            onSubmitted();
            onClose();
          },
        },
      ],
    );
  }, [
    description,
    env,
    onClose,
    onSubmitted,
    orderId,
    photoUrls,
    reset,
    type,
    userId,
  ]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={[styles.flex, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.header,
            {
              borderBottomColor: colors.divider,
              paddingHorizontal: spacing.pageMarginMobile,
            },
          ]}
        >
          <Pressable onPress={handleClose} accessibilityRole="button">
            <StitchText variant="label" colorKey="primaryContainer">
              Cancel
            </StitchText>
          </Pressable>
          <StitchText variant="h3" colorKey="text">
            Report a problem
          </StitchText>
          <View style={{ width: 56 }} />
        </View>

        <ScrollView
          contentContainerStyle={{
            padding: spacing.pageMarginMobile,
            paddingBottom: spacing.xxl,
            gap: spacing.lg,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <StitchText variant="body-sm" colorKey="textMuted">
            Tell us what went wrong with this order. Add a short description and
            optional photos so we can help faster.
          </StitchText>

          <View style={{ gap: spacing.sm }}>
            <StitchText variant="label-caps" colorKey="textMuted">
              Issue type
            </StitchText>
            {typeOptions.map((opt) => {
              const selected = type === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  accessibilityRole="button"
                  onPress={() => setType(opt.value)}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.sm,
                    padding: spacing.md,
                    borderRadius: radii.lg,
                    borderWidth: 1,
                    borderColor: selected ? colors.primaryContainer : colors.divider,
                    backgroundColor: selected
                      ? colors.primaryHighlight
                      : colors.surface,
                    opacity: pressed ? 0.9 : 1,
                  })}
                >
                  <View
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 9,
                      borderWidth: 2,
                      borderColor: colors.primaryContainer,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {selected ? (
                      <View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: colors.primaryContainer,
                        }}
                      />
                    ) : null}
                  </View>
                  <StitchText variant="label" colorKey="text">
                    {opt.label}
                  </StitchText>
                </Pressable>
              );
            })}
          </View>

          <View style={{ gap: spacing.sm }}>
            <StitchText variant="label-caps" colorKey="textMuted">
              What happened?
            </StitchText>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Describe the issue (at least 10 characters)…"
              placeholderTextColor={colors.textMuted}
              multiline
              style={inputStyle}
              editable={!busy}
            />
          </View>

          <View style={{ gap: spacing.sm }}>
            <StitchText variant="label-caps" colorKey="textMuted">
              Photos (optional)
            </StitchText>
            <View style={styles.photoRow}>
              {photoUrls.map((url) => (
                <Image
                  key={url}
                  source={{ uri: url }}
                  style={[
                    styles.photoThumb,
                    { borderRadius: radii.lg, backgroundColor: colors.surface2 },
                  ]}
                />
              ))}
              {photoUrls.length < MAX_PHOTOS ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void onAddPhoto()}
                  disabled={uploadingPhoto || busy}
                  style={({ pressed }) => [
                    styles.photoAdd,
                    {
                      borderRadius: radii.lg,
                      borderColor: colors.divider,
                      backgroundColor: colors.surface2,
                      opacity: pressed || uploadingPhoto ? 0.85 : 1,
                    },
                  ]}
                >
                  {uploadingPhoto ? (
                    <ActivityIndicator color={colors.primaryContainer} />
                  ) : (
                    <>
                      <StitchIcon name="photo_camera" size={28} colorKey="textMuted" />
                      <StitchText variant="body-sm" colorKey="textMuted">
                        Add photo
                      </StitchText>
                    </>
                  )}
                </Pressable>
              ) : null}
            </View>
          </View>

          <StitchButton
            title={busy ? 'Submitting…' : 'Submit report'}
            disabled={busy || description.trim().length < 10}
            onPress={() => void onSubmit()}
          />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  photoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  photoThumb: {
    width: 88,
    height: 88,
  },
  photoAdd: {
    width: 88,
    height: 88,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
});
