import React, { useEffect, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { isoLocalRounded } from '@/lib/merchantBagForm';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import { StitchText } from '@/ui/stitch/StitchText';

type Props = {
  label: string;
  /** `YYYY-MM-DDTHH:mm` in local time, or `YYYY-MM-DD` when mode is `date` */
  value: string;
  onChange: (next: string) => void;
  /** When set, picker values before this instant are rejected. */
  minimumDate?: Date;
  mode?: 'datetime' | 'date';
};

function parseLocal(value: string): Date {
  const d = new Date(value);
  if (!Number.isNaN(d.getTime())) {
    return d;
  }
  return new Date();
}

type FieldStylesArgs = {
  spacing: ReturnType<typeof useStitchTheme>['spacing'];
  radii: ReturnType<typeof useStitchTheme>['radii'];
};

function createFieldStyles({ spacing, radii }: FieldStylesArgs) {
  return StyleSheet.create({
    wrap: { marginTop: spacing.xs },
    iosPick: {
      marginTop: spacing.sm,
      borderWidth: 1,
      borderRadius: radii.xl,
      minHeight: 252,
      width: '100%',
      alignSelf: 'stretch',
      zIndex: 2,
    },
    iosPicker: {
      width: '100%',
      height: 216,
    },
    doneBtn: {
      paddingVertical: spacing.md,
      alignItems: 'center',
      borderTopWidth: StyleSheet.hairlineWidth,
    },
  });
}

function clampToMinimum(picked: Date, minimumDate?: Date): Date {
  if (!minimumDate) return picked;
  return picked.getTime() < minimumDate.getTime() ? minimumDate : picked;
}

function formatOutput(picked: Date, mode: 'datetime' | 'date'): string {
  if (mode === 'date') {
    const y = picked.getFullYear();
    const m = String(picked.getMonth() + 1).padStart(2, '0');
    const d = String(picked.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return isoLocalRounded(picked);
}

export function PickupDateTimeField({
  label,
  value,
  onChange,
  minimumDate,
  mode = 'datetime',
}: Props) {
  const { colors, spacing, radii, colorScheme } = useStitchTheme();
  const styles = useMemo(
    () => createFieldStyles({ spacing, radii }),
    [spacing, radii],
  );

  /** Native picker does not inherit StitchText; force readable spinner labels. */
  const pickerAppearance = useMemo(
    () => ({
      themeVariant: (colorScheme === 'dark' ? 'dark' : 'light') as 'light' | 'dark',
      accentColor: colors.primaryContainer,
      ...(Platform.OS === 'ios' ? { textColor: colors.onBackground } : {}),
    }),
    [colorScheme, colors.onBackground, colors.primaryContainer],
  );

  const [iosOpen, setIosOpen] = useState(false);
  const [androidStep, setAndroidStep] = useState<'date' | 'time' | null>(
    null,
  );
  const [pending, setPending] = useState(() => parseLocal(value));

  useEffect(() => {
    setPending(parseLocal(value));
  }, [value]);

  const inputChrome = useMemo(
    () => ({
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      borderRadius: radii.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      backgroundColor: colors.surfaceBright,
    }),
    [colors.outlineVariant, colors.surfaceBright, radii.lg, spacing.md],
  );

  function openPicker() {
    setPending(parseLocal(value));
    if (Platform.OS === 'android') {
      setAndroidStep('date');
    } else {
      setIosOpen(true);
    }
  }

  return (
    <View style={styles.wrap}>
      <StitchText
        variant="label"
        colorKey="onBackground"
        style={{ marginBottom: spacing.xs, marginTop: spacing.sm }}
      >
        {label}
      </StitchText>
      <Pressable
        onPress={openPicker}
        style={({ pressed }) => [
          inputChrome,
          { opacity: pressed ? 0.92 : 1 },
        ]}
      >
        <StitchText variant="body-md" colorKey={value ? 'onBackground' : 'textFaint'}>
          {value ? value.replace('T', ' · ') : 'Tap to choose date & time'}
        </StitchText>
      </Pressable>

      {Platform.OS === 'android' && androidStep === 'date' ? (
        <DateTimePicker
          {...pickerAppearance}
          value={pending}
          mode="date"
          display="default"
          onChange={(ev, picked) => {
            if (ev.type === 'dismissed') {
              setAndroidStep(null);
              return;
            }
            if (picked) {
              const next = new Date(picked);
              next.setHours(
                pending.getHours(),
                pending.getMinutes(),
                0,
                0,
              );
              setPending(next);
              setAndroidStep('time');
            }
          }}
        />
      ) : null}

      {Platform.OS === 'android' && androidStep === 'time' ? (
        <DateTimePicker
          {...pickerAppearance}
          value={pending}
          mode="time"
          display="default"
          is24Hour
          onChange={(ev, picked) => {
            setAndroidStep(null);
            if (ev.type === 'dismissed') {
              return;
            }
            if (picked) {
              const next = clampToMinimum(
                (() => {
                  const n = new Date(pending);
                  n.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
                  return n;
                })(),
                minimumDate,
              );
              onChange(formatOutput(next, mode));
            }
          }}
        />
      ) : null}

      {iosOpen && Platform.OS === 'ios' ? (
        <View
          style={[
            styles.iosPick,
            {
              borderColor: colors.outlineVariant,
              backgroundColor: colors.surface,
            },
          ]}
        >
          <DateTimePicker
            {...pickerAppearance}
            value={pending}
            mode={mode === 'date' ? 'date' : 'datetime'}
            display="spinner"
            minimumDate={minimumDate}
            style={styles.iosPicker}
            onChange={(_ev, picked) => {
              if (picked) {
                const clamped = clampToMinimum(picked, minimumDate);
                const next = formatOutput(clamped, mode);
                setPending(parseLocal(next));
                onChange(next);
              }
            }}
          />
          <Pressable
            style={[
              styles.doneBtn,
              {
                borderTopColor: colors.outlineVariant,
                backgroundColor: colors.surfaceContainerLow,
              },
            ]}
            onPress={() => setIosOpen(false)}
          >
            <StitchText variant="label" colorKey="primary">
              Done
            </StitchText>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
