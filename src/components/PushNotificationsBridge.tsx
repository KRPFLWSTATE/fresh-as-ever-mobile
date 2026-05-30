import React from 'react';
import { useAuthContext } from '@/context/AuthContext';
import { usePushNotifications } from '@/hooks/usePushNotifications';

/** Side-effect hook wrapper — registers push tokens for signed-in customers. */
export function PushNotificationsBridge(): null {
  const { env, user, resolvedRole } = useAuthContext();
  usePushNotifications({
    env,
    userId: user?.id,
    resolvedRole,
  });
  return null;
}
