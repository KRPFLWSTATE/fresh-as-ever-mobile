import { useEffect } from 'react';
import { CommonActions } from '@react-navigation/native';
import type { NavigationState } from '@react-navigation/native';
import { useAuthContext } from '@/context/AuthContext';
import { navigationRef } from '@/navigation/navigationRef';
import type { RootStackParamList } from '@/navigation/types';
import { scheduleMicrotask } from '@/lib/microtask';

const SHELL_ROUTES = new Set<keyof RootStackParamList>([
  'MainTabs',
  'MerchantTabs',
  'AdminShell',
]);

/** Active root stack route (first level). */
function rootStackRouteName(state: NavigationState): keyof RootStackParamList {
  const r = state.routes[state.index ?? 0];
  return r.name as keyof RootStackParamList;
}

/** Session + role parity with web shells (public guest → MainTabs; merchant → MerchantTabs). Admins stay flexible (customer + merchant tooling). */
export function AuthStackGate({
  navigationReady,
}: {
  navigationReady: boolean;
}): null {
  const { initializing, session, resolvedRole } = useAuthContext();
  const customerOnboardingDone = Boolean(
    session?.user?.user_metadata?.customer_onboarding_complete,
  );

  useEffect(() => {
    if (initializing || !navigationReady || !navigationRef.isReady()) {
      return;
    }

    scheduleMicrotask(() => {
      if (!navigationReady || !navigationRef.isReady()) {
        return;
      }
      const root = navigationRef.getRootState();
      if (!root) {
        return;
      }

      const top = rootStackRouteName(root);

      /** Do not steal focus during Login or leaf flows (checkout, bags, PayHere). */
      if (top === 'Login' || !SHELL_ROUTES.has(top)) {
        return;
      }

      if (!session) {
        if (top === 'MerchantTabs' || top === 'AdminShell') {
          navigationRef.dispatch(
            CommonActions.reset({ index: 0, routes: [{ name: 'MainTabs' }] }),
          );
        }
        return;
      }

      if (resolvedRole !== 'admin' && top === 'AdminShell') {
        if (resolvedRole === 'merchant_staff') {
          navigationRef.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: 'MerchantTabs' }],
            }),
          );
        } else {
          navigationRef.dispatch(
            CommonActions.reset({ index: 0, routes: [{ name: 'MainTabs' }] }),
          );
        }
        return;
      }

      let target: typeof top | null = null;

      if (resolvedRole === 'merchant_staff') {
        if (top === 'MainTabs') {
          target = 'MerchantTabs';
        }
      } else if (resolvedRole === 'customer') {
        if (top === 'MerchantTabs') {
          target = 'MainTabs';
        }
      }

      if (target && target !== top) {
        navigationRef.dispatch(
          CommonActions.reset({ index: 0, routes: [{ name: target }] }),
        );
        return;
      }

      if (
        session &&
        resolvedRole === 'customer' &&
        top === 'MainTabs' &&
        !customerOnboardingDone
      ) {
        navigationRef.dispatch(
          CommonActions.reset({ index: 0, routes: [{ name: 'Onboarding' }] }),
        );
      }
    });
  }, [
    customerOnboardingDone,
    initializing,
    navigationReady,
    session,
    resolvedRole,
  ]);

  return null;
}
