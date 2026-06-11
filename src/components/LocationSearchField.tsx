import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputEndEditingEventData,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import type { AppEnv } from '@/config/env';
import { useLocationSearch } from '@/hooks/useLocationSearch';
import type { LocationHit } from '@/lib/locationApi';
import {
  dedupeLocationHits,
  geocodeTypedAddress,
  normalizeNativeEditText,
  pickForwardGeocodeHit,
} from '@/lib/locationSearchHelpers';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import { stitchFonts } from '@/theme/stitchTokens';
import { StitchIcon, StitchText } from '@/ui/stitch';

export type LocationSearchFieldProps = {
  env: AppEnv;
  value: string;
  onChangeText: (text: string) => void;
  onSelectHit: (hit: LocationHit) => void;
  /** Called when typed text is geocoded without picking a suggestion (coords only). */
  onCoordsFromText?: (coords: { lat: number; lng: number }) => void;
  /** Fires when the user starts/stops editing (focus/blur). */
  onEditingChange?: (editing: boolean) => void;
  placeholder?: string;
  testID?: string;
  multiline?: boolean;
  /** When false, suppresses debounced search (e.g. after a hit is picked). */
  searchEnabled?: boolean;
  /** Min chars before forward-geocode runs (default 4). */
  geocodeMinChars?: number;
  /** Debounce ms after typing stops before geocoding (default 800). */
  geocodeDebounceMs?: number;
  inputStyle?: TextStyle;
  shellStyle?: ViewStyle;
};

/**
 * Address search with suggestion list — mirrors DiscoverScreen place-search UX.
 * Uses a local draft while focused so external address updates never append mid-typing.
 */
export function LocationSearchField({
  env,
  value,
  onChangeText,
  onSelectHit,
  onCoordsFromText,
  onEditingChange,
  placeholder = 'Neighbourhood or landmark…',
  testID = 'outlet.location.search',
  multiline = false,
  searchEnabled = true,
  geocodeMinChars = 4,
  geocodeDebounceMs = 800,
  inputStyle,
  shellStyle,
}: LocationSearchFieldProps): React.ReactElement {
  const { colors, spacing } = useStitchTheme();
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);
  const { suggestions, busy, error, clearSuggestions, clearError } = useLocationSearch(
    env,
    draft,
    { enabled: searchEnabled },
  );
  const [geocodeBusy, setGeocodeBusy] = useState(false);
  const pickedRef = useRef(false);
  const lastGeocodedQueryRef = useRef('');
  const geocodeRequestIdRef = useRef(0);
  const inputEpochRef = useRef(0);
  const inputRef = useRef<TextInput>(null);
  const focusBaselineRef = useRef('');
  const pendingNativeTextRef = useRef<string | null>(null);

  // Sync parent value only when the field is not being edited.
  useEffect(() => {
    if (focused) return;
    if (value !== draft) {
      setDraft(value);
      inputEpochRef.current += 1;
      lastGeocodedQueryRef.current = '';
      pickedRef.current = false;
    }
  }, [draft, focused, value]);

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
          paddingRight: busy || geocodeBusy ? 40 : spacing.md,
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
        locatingHint: {
          paddingHorizontal: spacing.xs,
        },
      }),
    [busy, colors, geocodeBusy, multiline, spacing],
  );

  const applyGeocodeHit = useCallback(
    (hit: LocationHit | null, query: string) => {
      if (!hit || !onCoordsFromText) return;
      lastGeocodedQueryRef.current = query;
      onCoordsFromText({ lat: hit.lat, lng: hit.lng });
    },
    [onCoordsFromText],
  );

  const runGeocode = useCallback(
    async (query: string, preferSuggestions = true) => {
      if (!onCoordsFromText) return;
      const q = query.trim();
      if (q.length < geocodeMinChars) return;
      if (lastGeocodedQueryRef.current === q) return;

      const requestId = ++geocodeRequestIdRef.current;
      setGeocodeBusy(true);
      try {
        let hit: LocationHit | null = null;
        if (preferSuggestions && suggestions.length > 0) {
          hit = pickForwardGeocodeHit(q, dedupeLocationHits(suggestions));
        }
        if (!hit) {
          hit = await geocodeTypedAddress(env, q, geocodeMinChars);
        }
        if (requestId !== geocodeRequestIdRef.current || draft.trim() !== q) return;
        applyGeocodeHit(hit, q);
      } finally {
        if (requestId === geocodeRequestIdRef.current) {
          setGeocodeBusy(false);
        }
      }
    },
    [
      applyGeocodeHit,
      draft,
      env,
      geocodeMinChars,
      onCoordsFromText,
      suggestions,
    ],
  );

  useEffect(() => {
    if (!searchEnabled || !onCoordsFromText) return;
    if (pickedRef.current) {
      pickedRef.current = false;
      return;
    }
    const q = draft.trim();
    if (q.length < geocodeMinChars) return;
    if (lastGeocodedQueryRef.current === q) return;

    const timer = setTimeout(() => {
      void runGeocode(q, true);
    }, geocodeDebounceMs);
    return () => clearTimeout(timer);
  }, [
    draft,
    geocodeDebounceMs,
    geocodeMinChars,
    onCoordsFromText,
    runGeocode,
    searchEnabled,
  ]);

  const commitDraft = useCallback(
    (next: string) => {
      setDraft(next);
      onChangeText(next);
    },
    [onChangeText],
  );

  const handleSelect = (hit: LocationHit) => {
    pickedRef.current = true;
    lastGeocodedQueryRef.current = hit.label.trim();
    clearSuggestions();
    commitDraft(hit.label);
    onSelectHit(hit);
  };

  const handleFocus = () => {
    focusBaselineRef.current = value;
    setDraft(value);
    setFocused(true);
    onEditingChange?.(true);
  };

  const handleBlur = () => {
    const committed =
      pendingNativeTextRef.current != null
        ? pendingNativeTextRef.current
        : normalizeNativeEditText(draft, focusBaselineRef.current);
    pendingNativeTextRef.current = null;

    setDraft(committed);
    if (committed !== value) {
      onChangeText(committed);
    }
    setFocused(false);
    inputEpochRef.current += 1;
    onEditingChange?.(false);
    requestAnimationFrame(() => {
      inputRef.current?.setNativeProps({ text: committed });
    });
  };

  const handleEndEditing = (e: NativeSyntheticEvent<TextInputEndEditingEventData>) => {
    const cleaned = normalizeNativeEditText(
      e.nativeEvent.text ?? draft,
      focusBaselineRef.current,
    );
    pendingNativeTextRef.current = cleaned;
    void runGeocode(cleaned, true);
  };

  const handleSubmitEditing = () => {
    void runGeocode(draft, true);
  };

  const showLocating = geocodeBusy && !busy;

  return (
    <View style={{ gap: spacing.xs }}>
      <View style={[styles.searchShell, shellStyle]}>
        <View style={styles.searchIconWrap} pointerEvents="none">
          <StitchIcon name="search" size={22} colorKey="outline" />
        </View>
        <TextInput
          ref={inputRef}
          key={focused ? `edit-${inputEpochRef.current}` : `show-${inputEpochRef.current}-${draft}`}
          testID={testID}
          placeholder={placeholder}
          placeholderTextColor={colors.textFaint}
          value={draft}
          onChangeText={(t) => {
            commitDraft(t);
            if (error && t.trim().length >= 2) clearError();
          }}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onEndEditing={handleEndEditing}
          onSubmitEditing={handleSubmitEditing}
          selectTextOnFocus={!multiline}
          style={[styles.searchInput, inputStyle]}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="words"
          multiline={multiline}
        />
        {busy || geocodeBusy ? (
          <View style={styles.searchBusy}>
            <ActivityIndicator size="small" color={colors.primaryContainer} />
          </View>
        ) : null}
      </View>
      {showLocating ? (
        <StitchText variant="body-sm" colorKey="textMuted" style={styles.locatingHint}>
          Locating…
        </StitchText>
      ) : null}
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
