import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ImageStyle,
  type ViewStyle,
} from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { onboardingParams } from '@/contracts/routeParams';
import { getSupabase } from '@/lib/supabase';
import { useAuthContext } from '@/context/AuthContext';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import {
  StitchButton,
  StitchIcon,
  StitchScreen,
  StitchText,
} from '@/ui/stitch';
import { logError } from '@/observability/logError';
import {
  getOnboardingHeroSource,
  getOnboardingStep,
  ONBOARDING_TOTAL_STEPS,
} from '@/content/onboardingMoments';

export function OnboardingScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'Onboarding'>>();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { env } = useAuthContext();
  const supabase = useMemo(() => getSupabase(env), [env]);
  const { colors, spacing, ambientShadow, radii, mode } = useStitchTheme();

  const parsed = onboardingParams.safeParse({
    step: route.params?.step != null ? Number(route.params.step) : 1,
  });
  const initial = parsed.success
    ? Math.min(ONBOARDING_TOTAL_STEPS, Math.max(1, parsed.data.step ?? 1))
    : 1;
  const [step, setStep] = useState(initial);
  const [heroFailed, setHeroFailed] = useState(false);

  const meta = getOnboardingStep(step);
  const heroSource = getOnboardingHeroSource(step);

  useEffect(() => {
    setHeroFailed(false);
  }, [step]);

  const layoutStyles = useMemo(() => {
    const pagePad = spacing.pageMarginMobile;
    const headerBg = colors.background;
    const headerBorder =
      mode === 'dark' ? colors.inverseSurface : colors.background;

    const header: ViewStyle = {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: pagePad,
      height: 64,
      backgroundColor: headerBg,
      borderBottomWidth: mode === 'dark' ? 1 : 0,
      borderBottomColor: headerBorder,
    };

    const main: ViewStyle = {
      flex: 1,
      paddingHorizontal: pagePad,
      paddingTop: spacing.lg,
      paddingBottom: spacing.xxl,
    };

    const heroWrap: ViewStyle = {
      width: '100%',
      borderRadius: meta.heroBorderRadius,
      overflow: 'hidden',
      backgroundColor: colors.surface2,
      marginBottom: spacing.xl,
      ...ambientShadow,
    };

    const heroImage: ImageStyle = {
      width: '100%',
      aspectRatio: meta.heroAspect,
    };

    const dotsRow: ViewStyle = {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      marginBottom: spacing.md,
    };

    const dotInactive: ViewStyle = {
      width: 8,
      height: 8,
      borderRadius: radii.full,
      backgroundColor:
        meta.layout === 'hero-copy-dots'
          ? colors.surfaceDim
          : colors.outlineVariant,
    };

    const dotActive: ViewStyle = {
      width: 32,
      height: 8,
      borderRadius: radii.full,
      backgroundColor: colors.primaryContainer,
    };

    const fallbackHero: ViewStyle = {
      width: '100%',
      aspectRatio: meta.heroAspect,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceContainerLow,
    };

    return {
      header,
      main,
      heroWrap,
      heroImage,
      dotsRow,
      dotInactive,
      dotActive,
      fallbackHero,
    };
  }, [
    ambientShadow,
    colors,
    meta.heroAspect,
    meta.heroBorderRadius,
    meta.layout,
    mode,
    radii.full,
    spacing.lg,
    spacing.md,
    spacing.pageMarginMobile,
    spacing.sm,
    spacing.xl,
    spacing.xxl,
  ]);

  async function complete() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      navigation.replace('Login');
      return;
    }
    await supabase.auth.updateUser({
      data: { customer_onboarding_complete: true },
    });
    navigation.replace('MainTabs', { screen: 'DiscoverTab' });
  }

  function next() {
    if (step < ONBOARDING_TOTAL_STEPS) {
      setStep(step + 1);
      return;
    }
    complete().catch((err) => logError(err, { context: 'OnboardingScreen.complete' }));
  }

  function goBack() {
    if (step > 1) {
      setStep(step - 1);
    }
  }

  const isLast = step === ONBOARDING_TOTAL_STEPS;
  const ctaTitle = isLast ? 'Get started' : 'Next';

  const progressDots = (
    <View style={layoutStyles.dotsRow}>
      {Array.from({ length: ONBOARDING_TOTAL_STEPS }, (_, i) => {
        const n = i + 1;
        const active = n === step;
        return (
          <View
            key={n}
            style={active ? layoutStyles.dotActive : layoutStyles.dotInactive}
          />
        );
      })}
    </View>
  );

  const hero = (
    <View style={layoutStyles.heroWrap}>
      {heroFailed ? (
        <View style={[layoutStyles.heroImage, layoutStyles.fallbackHero]}>
          <StitchIcon name="eco" size={48} colorKey="primaryContainer" />
        </View>
      ) : (
        <Image
          accessibilityRole="image"
          accessibilityLabel={meta.heroAlt}
          source={heroSource}
          style={layoutStyles.heroImage}
          resizeMode="cover"
          onError={() => setHeroFailed(true)}
        />
      )}
      {step === 1 && !heroFailed ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: '35%',
            backgroundColor: 'rgba(0,0,0,0.2)',
          }}
        />
      ) : null}
    </View>
  );

  const mockupCode = ['4', '8', '1', '5', '9', '2'];

  const copyBlock = (
    <View
      style={{
        marginTop: spacing.md,
        marginBottom: spacing.md,
      }}
    >
      <StitchText
        variant={step === 3 ? 'h1' : 'display'}
        colorKey={step === 3 ? 'text' : 'onSurface'}
        style={{ textAlign: 'center', marginBottom: spacing.md }}
      >
        {meta.title}
      </StitchText>
      <StitchText
        variant="body-lg"
        colorKey="textMuted"
        style={{
          textAlign: 'center',
          maxWidth: meta.layout === 'dots-hero-copy' ? 280 : 320,
          alignSelf: 'center',
        }}
      >
        {meta.body}
      </StitchText>
      {/*
        Stitch `customer_onboarding_3_3_2` includes a phone-mockup of the
        6-digit order code beneath the copy. We surface the same visual on
        step 3 to close the parity gap.
      */}
      {step === 3 ? (
        <View
          style={{
            marginTop: spacing.xl,
            paddingVertical: spacing.lg,
            paddingHorizontal: spacing.md,
            borderRadius: radii.lg,
            backgroundColor: colors.surfaceContainerLow,
            borderWidth: 1,
            borderColor: colors.outlineVariant,
            alignItems: 'center',
            alignSelf: 'stretch',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.sm }}>
            <StitchIcon name="verified" size={16} colorKey="primaryContainer" />
            <StitchText variant="label-caps" colorKey="textMuted">
              Your mockup code
            </StitchText>
          </View>
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            {mockupCode.map((d, i) => (
              <React.Fragment key={`${d}-${i}`}>
                {i === 3 ? (
                  <StitchText variant="h3" colorKey="textMuted">−</StitchText>
                ) : null}
                <View
                  style={{
                    width: 36,
                    height: 48,
                    borderRadius: radii.default,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.outlineVariant,
                    alignItems: 'center',
                    justifyContent: 'center',
                    ...(ambientShadow ?? {}),
                  }}
                >
                  <StitchText variant="h2" colorKey="text">
                    {d}
                  </StitchText>
                </View>
              </React.Fragment>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );

  /*
    Stitch `customer_onboarding_2_3_2` overlaps the content card on top of the
    hero with a negative top margin + rounded-top edge. We toggle that on
    step 2 to match the alternate composition.
  */
  const overlapContentCard = step === 2 ? (
    <View
      style={{
        marginTop: -24,
        paddingTop: spacing.xl,
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.lg,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        backgroundColor: colors.surface,
      }}
    >
      {progressDots}
      {copyBlock}
    </View>
  ) : null;

  return (
    <StitchScreen edges={['left', 'right', 'bottom', 'top']} style={{ flex: 1 }}>
      <View style={layoutStyles.header}>
        <View style={{ width: 40, alignItems: 'flex-start' }}>
          {step > 1 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={12}
              onPress={goBack}
            >
              <StitchIcon name="arrow_back" size={24} colorKey="primaryContainer" />
            </Pressable>
          ) : null}
        </View>
        <StitchText
          variant="h2"
          colorKey="primaryContainer"
          style={{ fontSize: 20, lineHeight: 26 }}
        >
          Fresh As Ever
        </StitchText>
        <View style={{ width: 40, alignItems: 'flex-end' }}>
          {step < ONBOARDING_TOTAL_STEPS ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                complete().catch((err) => logError(err, { context: 'OnboardingScreen.complete' }));
              }}
            >
              <StitchText variant="label" colorKey="textMuted">
                Skip
              </StitchText>
            </Pressable>
          ) : (
            <View style={{ width: 40 }} />
          )}
        </View>
      </View>

      <View style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: spacing.pageMarginMobile,
            paddingTop: spacing.lg,
            paddingBottom: spacing.md,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {meta.layout === 'hero-copy-dots' ? (
            <>
              {hero}
              {copyBlock}
              {progressDots}
            </>
          ) : null}
          {meta.layout === 'hero-dots-copy' ? (
            step === 2 ? (
              <>
                {hero}
                {overlapContentCard}
              </>
            ) : (
              <>
                {hero}
                {progressDots}
                {copyBlock}
              </>
            )
          ) : null}
          {meta.layout === 'dots-hero-copy' ? (
            <>
              {progressDots}
              {hero}
              {copyBlock}
            </>
          ) : null}
        </ScrollView>

        <View
          style={{
            paddingHorizontal: spacing.pageMarginMobile,
            paddingTop: spacing.sm,
            paddingBottom: spacing.lg,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.divider,
            backgroundColor: colors.background,
          }}
        >
          <StitchButton title={ctaTitle} onPress={() => next()} />
        </View>
      </View>
    </StitchScreen>
  );
}
