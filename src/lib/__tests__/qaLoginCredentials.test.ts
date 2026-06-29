describe('qaLoginCredentials', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.EXPO_PUBLIC_QA_CUSTOMER_PASSWORD;
    delete process.env.EXPO_PUBLIC_QA_MERCHANT_PASSWORD;
    delete process.env.EXPO_PUBLIC_QA_ADMIN_PASSWORD;
    delete process.env.EXPO_PUBLIC_QA_MERCHANT_EMAIL;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('uses env passwords when set', () => {
    process.env.EXPO_PUBLIC_QA_CUSTOMER_PASSWORD = 'from-env-customer';
    process.env.EXPO_PUBLIC_QA_MERCHANT_PASSWORD = 'from-env-merchant';
    process.env.EXPO_PUBLIC_QA_ADMIN_PASSWORD = 'from-env-admin';

    const mod = require('../qaLoginCredentials') as typeof import('../qaLoginCredentials');

    expect(mod.qaCustomerPassword()).toBe('from-env-customer');
    expect(mod.qaMerchantPassword()).toBe('from-env-merchant');
    expect(mod.qaAdminPassword()).toBe('from-env-admin');
  });

  it('returns portal credentials for customer, merchant, and admin', () => {
    process.env.EXPO_PUBLIC_QA_CUSTOMER_PASSWORD = 'cust';
    process.env.EXPO_PUBLIC_QA_MERCHANT_PASSWORD = 'merch';
    process.env.EXPO_PUBLIC_QA_ADMIN_PASSWORD = 'admin';

    const mod = require('../qaLoginCredentials') as typeof import('../qaLoginCredentials');

    expect(mod.qaPortalCredentials('customer')).toEqual({
      email: 'qa.customer@freshasever.test',
      password: 'cust',
    });
    expect(mod.qaPortalCredentials('merchant', 'kumbuk')).toEqual({
      email: 'qa.kumbuk@freshasever.test',
      password: 'merch',
    });
    expect(mod.qaPortalCredentials('admin')).toEqual({
      email: 'qa.admin@freshasever.test',
      password: 'admin',
    });
  });
});
