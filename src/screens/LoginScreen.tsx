import React, { useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { CommonActions, useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { useAuthContext } from '@/context/AuthContext';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import { stitchFonts } from '@/theme/stitchTokens';
import {
  StitchButton,
  StitchCard,
  StitchIcon,
  StitchScreen,
  StitchText,
} from '@/ui/stitch';
import { SocialAuthButtons } from '@/ui/auth/SocialAuthButtons';

type Portal = 'customer' | 'merchant' | 'admin';

export function LoginScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList, 'Login'>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Login'>>();
  const {
    signInWithEmailPassword,
    requestPhoneOtp,
    verifyPhoneOtp,
    signInWithGoogle,
    signInWithApple,
  } = useAuthContext();
  const { colors, radii, spacing } = useStitchTheme();

  const [portal, setPortal] = useState<Portal>(
    route.params?.portal ?? 'customer',
  );
  const [useEmailCustomer, setUseEmailCustomer] = useState(false);

  useEffect(() => {
    const hinted = route.params?.portal;
    if (hinted === 'customer' || hinted === 'merchant' || hinted === 'admin') {
      setPortal(hinted);
      setErr(null);
    }
  }, [route.params?.portal]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const qaAutofillLogin = process.env.EXPO_PUBLIC_QA_AUTOFILL_LOGIN === 'true';
  const qaCustomerPassword =
    process.env.EXPO_PUBLIC_QA_CUSTOMER_PASSWORD?.trim() ?? '';
  const qaMerchantPassword =
    process.env.EXPO_PUBLIC_QA_MERCHANT_PASSWORD?.trim() ?? '';

  function qaMerchantCredentials(
    merchantHint?: 'bakehouse' | 'kumbuk',
  ): { email: string; password: string } | null {
    if (!qaMerchantPassword) return null;
    const envEmail = process.env.EXPO_PUBLIC_QA_MERCHANT_EMAIL?.trim();
    if (envEmail) {
      return { email: envEmail, password: qaMerchantPassword };
    }
    if (merchantHint === 'kumbuk') {
      return {
        email: 'qa.kumbuk@freshasever.test',
        password: qaMerchantPassword,
      };
    }
    return {
      email: 'qa.merchant@freshasever.test',
      password: qaMerchantPassword,
    };
  }

  function applyQaAutofill(
    hintedPortal: Portal,
    merchantHint?: 'bakehouse' | 'kumbuk',
  ) {
    if (!qaAutofillLogin) return;
    setUseEmailCustomer(true);
    if (hintedPortal === 'customer') {
      if (!qaCustomerPassword) return;
      setEmail('qa.customer@freshasever.test');
      setPassword(qaCustomerPassword);
      return;
    }
    if (hintedPortal === 'merchant') {
      const creds = qaMerchantCredentials(merchantHint);
      if (!creds) return;
      setEmail(creds.email);
      setPassword(creds.password);
    }
  }

  useEffect(() => {
    if (!qaAutofillLogin) return;
    const hinted = route.params?.portal ?? portal;
    applyQaAutofill(hinted, route.params?.merchant);
  }, [route.params?.portal, route.params?.merchant, portal, qaAutofillLogin]);

  const inputStyle = {
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radii.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    fontSize: 15,
    fontFamily: stitchFonts.regular,
    color: colors.text,
    backgroundColor: colors.surface,
  };

  async function onEmailLogin(hint: 'admin' | 'merchant' | null) {
    setErr(null);
    setBusy(true);
    try {
      const res = await signInWithEmailPassword(email, password, hint);
      if (res.error) {
        setErr(res.error);
        return;
      }
      if (hint === 'admin') {
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: 'AdminShell' }],
          }),
        );
      } else if (hint === 'merchant') {
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: 'MerchantTabs' }],
          }),
        );
      } else if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.dispatch(
          CommonActions.reset({ index: 0, routes: [{ name: 'MainTabs' }] }),
        );
      }
    } finally {
      setBusy(false);
    }
  }

  async function sendOtp() {
    setErr(null);
    setBusy(true);
    try {
      const r = await requestPhoneOtp(phone);
      if (r.error) {
        setErr(r.error);
        return;
      }
      setOtpSent(true);
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp() {
    setErr(null);
    setBusy(true);
    try {
      const r = await verifyPhoneOtp(phone, otp);
      if (r.error) {
        setErr(r.error);
        return;
      }
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.dispatch(
          CommonActions.reset({ index: 0, routes: [{ name: 'MainTabs' }] }),
        );
      }
    } finally {
      setBusy(false);
    }
  }

  function goBack() {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.dispatch(
        CommonActions.reset({ index: 0, routes: [{ name: 'MainTabs' }] }),
      );
    }
  }

  function skip() {
    navigation.dispatch(
      CommonActions.reset({ index: 0, routes: [{ name: 'MainTabs' }] }),
    );
  }

  async function onSocialSuccess() {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.dispatch(
        CommonActions.reset({ index: 0, routes: [{ name: 'MainTabs' }] }),
      );
    }
  }

  async function onGoogle() {
    setErr(null);
    setBusy(true);
    try {
      const r = await signInWithGoogle();
      if (r.error) {
        setErr(r.error);
        return;
      }
      await onSocialSuccess();
    } finally {
      setBusy(false);
    }
  }

  async function onApple() {
    setErr(null);
    setBusy(true);
    try {
      const r = await signInWithApple();
      if (r.error) {
        setErr(r.error);
        return;
      }
      await onSocialSuccess();
    } finally {
      setBusy(false);
    }
  }

  return (
    <StitchScreen scroll scrollProps={{ contentContainerStyle: { paddingBottom: 48 } }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.md,
          height: 56,
          backgroundColor: colors.background,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={goBack}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, padding: 8 })}
        >
          <StitchIcon name="arrow_back" size={24} colorKey="primaryContainer" />
        </Pressable>
        <StitchText
          variant="body-lg"
          colorKey="primaryContainer"
          style={{ fontFamily: stitchFonts.semiBold }}
        >
          Fresh As Ever
        </StitchText>
        <Pressable
          accessibilityRole="button"
          onPress={skip}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, padding: 8 })}
        >
          <StitchText variant="label" colorKey="primaryContainer">
            Skip
          </StitchText>
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: spacing.pageMarginMobile, paddingTop: 8 }}>
        <View style={{ alignItems: 'center', marginBottom: spacing.xl }}>
          <StitchText variant="display" colorKey="text" testID="login.title">
            Welcome Back
          </StitchText>
          <StitchText
            variant="body-md"
            colorKey="textMuted"
            style={{ textAlign: 'center', marginTop: spacing.sm }}
          >
            Sign in to rescue delicious food.
          </StitchText>
        </View>

        {err ? (
          <StitchText
            variant="body-sm"
            colorKey="error"
            style={{ textAlign: 'center', marginBottom: spacing.md }}
          >
            {err}
          </StitchText>
        ) : null}

        <StitchCard>
          {portal === 'admin' ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: spacing.lg,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.xs,
                }}
              >
                <StitchIcon
                  name="shield"
                  size={20}
                  colorKey="primaryContainer"
                />
                <StitchText
                  variant="label"
                  colorKey="primaryContainer"
                  style={{ fontFamily: stitchFonts.semiBold }}
                >
                  Admin portal
                </StitchText>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setPortal('customer');
                  setErr(null);
                  setEmail('');
                  setPassword('');
                }}
              >
                <StitchText variant="label" colorKey="primary">
                  Back
                </StitchText>
              </Pressable>
            </View>
          ) : (
            <View
              style={{
                flexDirection: 'row',
                borderBottomWidth: 1,
                borderBottomColor: colors.divider,
                marginBottom: spacing.lg,
              }}
            >
              <Pressable
                testID="login.portal.customer"
                accessibilityRole="button"
                accessibilityLabel="Customer portal"
                onPress={() => {
                  setPortal('customer');
                  setErr(null);
                  applyQaAutofill('customer');
                }}
                style={{
                  flex: 1,
                  paddingBottom: spacing.sm,
                  alignItems: 'center',
                  borderBottomWidth: 2,
                  borderBottomColor:
                    portal === 'customer' ? colors.primary : 'transparent',
                }}
              >
                <StitchText
                  variant="label"
                  colorKey={portal === 'customer' ? 'primary' : 'textFaint'}
                >
                  Customer
                </StitchText>
              </Pressable>
              <Pressable
                testID="login.portal.merchant"
                accessibilityRole="button"
                accessibilityLabel="Merchant portal"
                onPress={() => {
                  setPortal('merchant');
                  setErr(null);
                  applyQaAutofill('merchant', route.params?.merchant);
                }}
                style={{
                  flex: 1,
                  paddingBottom: spacing.sm,
                  alignItems: 'center',
                  borderBottomWidth: 2,
                  borderBottomColor:
                    portal === 'merchant' ? colors.primary : 'transparent',
                }}
              >
                <StitchText
                  variant="label"
                  colorKey={portal === 'merchant' ? 'primary' : 'textFaint'}
                >
                  Merchant
                </StitchText>
              </Pressable>
            </View>
          )}

          {portal === 'admin' ? (
            <View style={{ gap: spacing.lg }}>
              <StitchText
                variant="body-sm"
                colorKey="textMuted"
                style={{ textAlign: 'center' }}
              >
                Sign in with your platform administrator credentials.
              </StitchText>
              <View style={{ gap: spacing.xs }}>
                <StitchText variant="label" colorKey="onSurfaceVariant">
                  Admin email
                </StitchText>
                <TextInput
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="admin@freshasever.com"
                  placeholderTextColor={colors.textFaint}
                  value={email}
                  onChangeText={setEmail}
                  style={inputStyle}
                />
              </View>
              <View style={{ gap: spacing.xs }}>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <StitchText variant="label" colorKey="onSurfaceVariant">
                    Password
                  </StitchText>
                  <Pressable
                    onPress={() => navigation.navigate('ForgotPassword')}
                  >
                    <StitchText variant="label" colorKey="primaryContainer">
                      Forgot?
                    </StitchText>
                  </Pressable>
                </View>
                <View style={{ position: 'relative' }}>
                  <TextInput
                    secureTextEntry={!showPassword}
                    placeholder="••••••••"
                    placeholderTextColor={colors.textFaint}
                    value={password}
                    onChangeText={setPassword}
                    style={[inputStyle, { paddingRight: 44 }]}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      showPassword ? 'Hide password' : 'Show password'
                    }
                    onPress={() => setShowPassword((s) => !s)}
                    style={{
                      position: 'absolute',
                      right: spacing.sm,
                      top: 0,
                      bottom: 0,
                      justifyContent: 'center',
                    }}
                  >
                    <StitchIcon
                      name={showPassword ? 'visibility_off' : 'visibility'}
                      size={20}
                      colorKey="textMuted"
                    />
                  </Pressable>
                </View>
              </View>
              <StitchButton
                title="Sign in as admin"
                onPress={() => void onEmailLogin('admin')}
                disabled={busy || !email.trim() || !password}
                loading={busy}
              />
            </View>
          ) : portal === 'customer' && !useEmailCustomer ? (
            <View style={{ gap: spacing.lg }}>
              <SocialAuthButtons
                busy={busy}
                onGoogle={() => void onGoogle()}
                onApple={() => void onApple()}
              />
              <View style={{ gap: spacing.xs }}>
                <StitchText variant="label" colorKey="onSurfaceVariant">
                  Phone number
                </StitchText>
                <View style={{ position: 'relative' }}>
                  <View
                    style={{
                      position: 'absolute',
                      left: spacing.sm,
                      top: 0,
                      bottom: 0,
                      justifyContent: 'center',
                      zIndex: 1,
                    }}
                  >
                    <StitchIcon name="call" size={20} colorKey="textMuted" />
                  </View>
                  <TextInput
                    placeholder="+94 77 123 4567"
                    placeholderTextColor={colors.textFaint}
                    keyboardType="phone-pad"
                    value={phone}
                    onChangeText={setPhone}
                    style={[inputStyle, { paddingLeft: 40 }]}
                  />
                </View>
              </View>
              {!otpSent ? (
                <StitchButton
                  title="Send OTP"
                  onPress={() => void sendOtp()}
                  disabled={busy || !phone.trim()}
                  loading={busy}
                />
              ) : (
                <View style={{ gap: spacing.md }}>
                  <StitchText variant="label" colorKey="onSurfaceVariant">
                    SMS code
                  </StitchText>
                  <TextInput
                    placeholder="6-digit code"
                    placeholderTextColor={colors.textFaint}
                    keyboardType="number-pad"
                    value={otp}
                    onChangeText={setOtp}
                    style={inputStyle}
                  />
                  <StitchButton
                    title="Verify & sign in"
                    onPress={() => void verifyOtp()}
                    disabled={busy}
                    loading={busy}
                  />
                </View>
              )}
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginTop: spacing.lg,
                  gap: 4,
                }}
              >
                <StitchText variant="body-sm" colorKey="textMuted">
                  Don&apos;t have an account?
                </StitchText>
                <Pressable onPress={() => navigation.navigate('SignUp')}>
                  <StitchText
                    variant="body-sm"
                    colorKey="primaryContainer"
                    style={{ fontFamily: stitchFonts.medium }}
                  >
                    Sign up
                  </StitchText>
                </Pressable>
              </View>
              <Pressable
                accessibilityRole="button"
                testID="login.useEmailPassword"
                onPress={() => {
                  setUseEmailCustomer(true);
                  setErr(null);
                }}
                style={{ alignItems: 'center', marginTop: spacing.sm }}
              >
                <StitchText variant="label" colorKey="primaryContainer">
                  Use email & password instead
                </StitchText>
              </Pressable>
            </View>
          ) : portal === 'customer' && useEmailCustomer ? (
            <View style={{ gap: spacing.lg }}>
              <View style={{ gap: spacing.xs }}>
                <StitchText variant="label" colorKey="onSurfaceVariant">
                  Email
                </StitchText>
                <TextInput
                  testID="login.email"
                  accessibilityLabel="Email"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="you@example.com"
                  placeholderTextColor={colors.textFaint}
                  value={email}
                  onChangeText={setEmail}
                  style={inputStyle}
                />
              </View>
              <View style={{ gap: spacing.xs }}>
                <StitchText variant="label" colorKey="onSurfaceVariant">
                  Password
                </StitchText>
                <TextInput
                  testID="login.password"
                  accessibilityLabel="Password"
                  secureTextEntry
                  placeholder="••••••••"
                  placeholderTextColor={colors.textFaint}
                  value={password}
                  onChangeText={setPassword}
                  style={inputStyle}
                />
              </View>
              <StitchButton
                testID="login.signIn"
                accessibilityLabel="Sign in"
                title="Sign in"
                onPress={() => void onEmailLogin(null)}
                disabled={busy}
                loading={busy}
              />
              <Pressable
                onPress={() => {
                  setUseEmailCustomer(false);
                  setErr(null);
                }}
                style={{ alignItems: 'center' }}
              >
                <StitchText variant="label" colorKey="primaryContainer">
                  Use phone OTP instead
                </StitchText>
              </Pressable>
            </View>
          ) : (
            <View style={{ gap: spacing.lg }}>
              <View style={{ gap: spacing.xs }}>
                <StitchText variant="label" colorKey="onSurfaceVariant">
                  Email address
                </StitchText>
                <TextInput
                  testID="login.email"
                  accessibilityLabel="Email"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="merchant@cafe.com"
                  placeholderTextColor={colors.textFaint}
                  value={email}
                  onChangeText={setEmail}
                  style={inputStyle}
                />
              </View>
              <View style={{ gap: spacing.xs }}>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <StitchText variant="label" colorKey="onSurfaceVariant">
                    Password
                  </StitchText>
                  <Pressable onPress={() => navigation.navigate('ForgotPassword')}>
                    <StitchText variant="label" colorKey="primaryContainer">
                      Forgot?
                    </StitchText>
                  </Pressable>
                </View>
                <View style={{ position: 'relative' }}>
                  <TextInput
                    testID="login.password"
                    accessibilityLabel="Password"
                    secureTextEntry={!showPassword}
                    placeholder="••••••••"
                    placeholderTextColor={colors.textFaint}
                    value={password}
                    onChangeText={setPassword}
                    style={[inputStyle, { paddingRight: 44 }]}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                    onPress={() => setShowPassword((s) => !s)}
                    style={{
                      position: 'absolute',
                      right: spacing.sm,
                      top: 0,
                      bottom: 0,
                      justifyContent: 'center',
                    }}
                  >
                    <StitchIcon
                      name={showPassword ? 'visibility_off' : 'visibility'}
                      size={20}
                      colorKey="textMuted"
                    />
                  </Pressable>
                </View>
              </View>
              <StitchButton
                testID="login.signIn"
                accessibilityLabel="Sign in"
                title="Sign in as merchant"
                onPress={() => void onEmailLogin('merchant')}
                disabled={busy}
                loading={busy}
              />
            </View>
          )}
        </StitchCard>

        <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
          {portal !== 'admin' ? (
            <StitchButton
              variant="secondary"
              title="Admin portal"
              onPress={() => {
                setPortal('admin');
                setErr(null);
                setEmail('');
                setPassword('');
                setOtpSent(false);
                setOtp('');
              }}
              disabled={busy}
            />
          ) : null}
          <Pressable
            onPress={() => navigation.navigate('SignUp')}
            style={{ alignItems: 'center' }}
          >
            <StitchText variant="body-sm" colorKey="primaryContainer" style={{ fontFamily: stitchFonts.medium }}>
              Create account
            </StitchText>
          </Pressable>
          <Pressable onPress={skip} style={{ alignItems: 'center', marginTop: spacing.sm }}>
            <StitchText variant="body-sm" colorKey="textMuted">
              Continue browsing
            </StitchText>
          </Pressable>
        </View>
      </View>
    </StitchScreen>
  );
}
