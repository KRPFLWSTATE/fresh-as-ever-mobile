export const ERROR = {
  common: {
    fallback: 'Something went wrong. Please try again.',
    network: 'Network error. Check your connection and try again.',
    notFound: 'We could not find that. It may have been removed.',
    permission: 'You do not have permission to perform this action.',
    duplicate: 'This record already exists.',
  },
  checkout: {
    signIn: 'Sign in to reserve this bag.',
    phoneRequired:
      'Add a phone number to your profile before reserving — merchants need a way to reach you at pickup.',
    cashLocked:
      'Complete your first pickup to unlock cash at pickup. Card works right away.',
    soldOut: 'This bag just sold out. Plenty more rescues are live nearby.',
    shelfSoldOut: 'This clearance item just sold out. Plenty more shelf picks are still live nearby.',
    paymentTimeout: 'Payment setup timed out. Check your connection and try again.',
    paymentFailed: 'We could not start payment. Try again in a moment.',
    reserveFailed: 'We could not complete your reservation. Try again shortly.',
    loadBag: 'Could not load bag details.',
  },
  handover: {
    notReady:
      'Not ready for handover yet — check payment status or wait until pickup opens.',
    grace:
      'Available 30 minutes after the pickup window closes.',
    codeMismatch: 'That code does not match. Check the digits and try again.',
    codeLength: 'Enter the full 6-character pickup code.',
    failed: 'Handover could not be completed. Try again.',
  },
  arrival: {
    notEligible:
      'You can tap "I\'m here" from 15 minutes before pickup opens until the window ends.',
    paymentFirst: 'Complete payment first, then you can signal arrival.',
    windowClosed: 'Pickup window has ended for this order.',
    failed: 'Could not notify the outlet. Try again when you are on site.',
  },
  auth: {
    invalidCredentials: 'That email or password did not match. Try again?',
    loginFailed: 'Login failed. Check your details and try again.',
    otpFailed: 'Could not send the code. Try again in a moment.',
    oauthFailed: 'Could not sign in with that provider. Try again.',
    sessionExpired: 'Your session expired. Sign in again to continue.',
    notAdmin: 'This account is not set up for admin access.',
    notMerchant: 'This account is not set up for merchant access.',
  },
  merchant: {
    loadBag: 'We could not load this bag. Go back and try again.',
    analytics: 'We could not load your analytics right now.',
    finance: 'We could not load your finance figures right now.',
    complaintEscalate: 'We could not escalate this complaint. Try again shortly.',
    complaintRefund: 'We could not issue that refund. Try again or contact support.',
    saveBag: 'We could not save this bag. Check the fields and try again.',
  },
  admin: {
    dashboard: 'We could not load dashboard numbers right now.',
    saveFailed: 'Your changes did not save. Try again.',
    updateFailed: 'That update did not go through. Try again.',
  },
  geo: {
    distanceUnavailable: 'Turn on location to see how far each outlet is.',
    locationDenied:
      'Location is off — enable it in Settings to sort bags by distance.',
  },
  discover: {
    loadBags: 'Could not load bags. Pull to refresh or try again.',
  },
  favourites: {
    signIn: 'Please sign in to view favourites.',
    load: 'Could not load favourites.',
  },
  promo: {
    invalid: 'That promo code is not valid for this bag.',
    expired: 'This promo has expired — try another code.',
    minNotMet: 'Order total is below the minimum for this promo.',
  },
} as const;
