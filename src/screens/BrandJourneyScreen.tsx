import React from 'react';
import { Pressable, View } from 'react-native';
import { CommonActions, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { StitchCard, StitchScreen, StitchText } from '@/ui/stitch';

/**
 * In-app counterpart to Stitch `prototype_journey_map` — high-level journey overview.
 * Deep link: `freshasever://journey`
 */
export function BrandJourneyScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <StitchScreen scroll edges={['top', 'left', 'right']}>
      <View style={{ padding: 16, gap: 16 }}>
        <StitchText variant="h1" colorKey="text">
          Your journey
        </StitchText>
        <StitchText variant="body-md" colorKey="textMuted">
          Discover surplus food near you, reserve a rescue bag, collect at pickup,
          and track your impact — aligned with the Stitch journey map prototype.
        </StitchText>
        <StitchCard>
          <StitchText variant="label-caps" colorKey="primaryContainer">
            Flow
          </StitchText>
          <StitchText variant="body-md" colorKey="onSurface" style={{ marginTop: 12 }}>
            1. Discover → 2. Bag detail → 3. Checkout → 4. Orders → 5. Impact
          </StitchText>
        </StitchCard>
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            navigation.dispatch(
              CommonActions.reset({
                index: 0,
                routes: [{ name: 'MainTabs' }],
              }),
            )
          }
        >
          <StitchText variant="label" colorKey="primaryContainer">
            Continue to Discover
          </StitchText>
        </Pressable>
      </View>
    </StitchScreen>
  );
}
