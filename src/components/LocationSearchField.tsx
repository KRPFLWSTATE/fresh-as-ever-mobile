import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import type { AppEnv } from '@/config/env';
import { useLocationSearch } from '@/hooks/useLocationSearch';
import type { LocationHit } from '@/lib/locationApi';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import { stitchFonts } from '@/theme/stitchTokens';
import { StitchIcon, StitchText } from '@/ui/stitch';

export type LocationSearchFieldProps = {
  env: AppEnv;
  value: string;
  onChangeText: (text: string) => void;
  onSelectHit: (hit: LocationHit) => void;
  placeholder?: string;
  testID?: string;
  multiline?: boolean;
  /** When false, suppresses debounced search (e.g. after a hit is picked). */
  searchEnabled?: boolean;
  inputStyle?: TextStyle;
  shellStyle?: ViewStyle;
};

/**
 * Address search with suggestion list — mirrors DiscoverScreen place-search UX.
 */
export function LocationSearchField({
  env,
  value,
  onChangeText,
  onSelectHit,
  placeholder = 'Neighbourhood or landmark…',
  testID = 'outlet.location.search',
  multiline = false,
  searchEnabled = true,
  inputStyle,
  shellStyle,
}: LocationSearchFieldProps): React.ReactElement {
  const { colors, spacing } = useStitchTheme();
  const { suggestions, busy, error, clearSuggestions, clearError } = useLocationSearch(
    env,
    value,
    { enabled: searchEnabled },
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        searchShell: {
          borderRadius: 999,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.outlineVariant,
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: 44,
        },
        searchIconWrap: {
          position: 'absolute',
          left: spacing.sm,
          top: 0,
          bottom: 0,
          justifyContent: 'center',
          zIndex: 1,
        },
        searchInput: {
          flex: 1,
          paddingLeft: 44,
          paddingRight: busy ? 40 : spacing.md,
          paddingVertical: multiline ? spacing.sm : 12,
          fontFamily: stitchFonts.regular,
          fontSize: 15,
          color: colors.text,
          minHeight: multiline ? 64 : 44,
        },
        searchBusy: {
          position: 'absolute',
          right: spacing.sm,
          top: 0,
          bottom: 0,
          justifyContent: 'center',
        },
        suggestionRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.xs,
        },
      }),
    [busy, colors, multiline, spacing],
  );

  const handleSelect = (hit: LocationHit) => {
    clearSuggestions();
    onSelectHit(hit);
  };

  return (
    <View style={{ gap: spacing.xs }}>
      <View style={[styles.searchShell, shellStyle]}>
        <View style={styles.searchIconWrap} pointerEvents="none">
          <StitchIcon name="search" size={22} colorKey="outline" />
        </View>
        <TextInput
          testID={testID}
          placeholder={placeholder}
          placeholderTextColor={colors.textFaint}
          value={value}
          onChangeText={(t) => {
            onChangeText(t);
            if (error && t.trim().length >= 2) clearError();
          }}
          style={[styles.searchInput, inputStyle]}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="words"
          multiline={multiline}
        />
        {busy ? (
          <View style={styles.searchBusy}>
            <ActivityIndicator size="small" color={colors.primaryContainer} />
          </View>
        ) : null}
      </View>
      {error ? (
        <StitchText variant="body-sm" colorKey="error">
          {error}
        </StitchText>
      ) : null}
      {suggestions.map((item, ix) => (
        <Pressable
          key={`${item.lat}-${item.lng}-${ix}`}
          testID={`outlet.location.suggestion.${ix}`}
          onPress={() => handleSelect(item)}
          style={({ pressed }) => [styles.suggestionRow, { opacity: pressed ? 0.88 : 1 }]}
        >
          <StitchIcon name="location_on" size={22} colorKey="primaryContainer" />
          <StitchText variant="body-sm" colorKey="onSurface" style={{ flex: 1 }}>
            {item.label}
          </StitchText>
        </Pressable>
      ))}
    </View>
  );
}
