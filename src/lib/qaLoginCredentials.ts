/**
 * QA login autofill — env overrides with __DEV__ fallbacks to documented test creds.
 * @see docs/verification/pass26-expansion/CREDENTIALS.md
 */

export const QA_LOGIN_EMAILS = {
  customer: 'qa.customer@freshasever.test',
  merchant: 'qa.merchant@freshasever.test',
  kumbuk: 'qa.kumbuk@freshasever.test',
  admin: 'qa.admin@freshasever.test',
} as const;

const QA_DEV_PASSWORD_FALLBACKS = {
  customer: 'TempCustomer#12345',
  merchant: 'TempMerchant#12345',
  admin: 'TempAdmin#12345',
} as const;

function resolvePassword(
  envValue: string | undefined,
  devFallback: string,
): string {
  const fromEnv = envValue?.trim();
  if (fromEnv) return fromEnv;
  if (__DEV__) return devFallback;
  return '';
}

export function qaCustomerPassword(): string {
  return resolvePassword(
    process.env.EXPO_PUBLIC_QA_CUSTOMER_PASSWORD,
    QA_DEV_PASSWORD_FALLBACKS.customer,
  );
}

export function qaMerchantPassword(): string {
  return resolvePassword(
    process.env.EXPO_PUBLIC_QA_MERCHANT_PASSWORD,
    QA_DEV_PASSWORD_FALLBACKS.merchant,
  );
}

export function qaAdminPassword(): string {
  return resolvePassword(
    process.env.EXPO_PUBLIC_QA_ADMIN_PASSWORD,
    QA_DEV_PASSWORD_FALLBACKS.admin,
  );
}

export function qaMerchantCredentials(
  merchantHint?: 'bakehouse' | 'kumbuk',
): { email: string; password: string } | null {
  const password = qaMerchantPassword();
  if (!password) return null;
  const envEmail = process.env.EXPO_PUBLIC_QA_MERCHANT_EMAIL?.trim();
  if (envEmail) {
    return { email: envEmail, password };
  }
  if (merchantHint === 'kumbuk') {
    return { email: QA_LOGIN_EMAILS.kumbuk, password };
  }
  return { email: QA_LOGIN_EMAILS.merchant, password };
}

export function qaPortalCredentials(
  portal: 'customer' | 'merchant' | 'admin',
  merchantHint?: 'bakehouse' | 'kumbuk',
): { email: string; password: string } | null {
  if (portal === 'customer') {
    const password = qaCustomerPassword();
    if (!password) return null;
    return { email: QA_LOGIN_EMAILS.customer, password };
  }
  if (portal === 'merchant') {
    return qaMerchantCredentials(merchantHint);
  }
  const password = qaAdminPassword();
  if (!password) return null;
  return { email: QA_LOGIN_EMAILS.admin, password };
}
