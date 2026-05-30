type ErrorUtilsApi = {
  getGlobalHandler?: () =>
    | ((error: Error, isFatal?: boolean) => void)
    | undefined;
  setGlobalHandler?: (fn: (error: Error, isFatal?: boolean) => void) => void;
};

/** Chains RN global errors after Sentry (when enabled) has installed its handler. */
export function installReactNativeGlobalHandlers(): void {
  const g = globalThis as typeof globalThis & { ErrorUtils?: ErrorUtilsApi };
  const Eu = g.ErrorUtils;
  if (!Eu?.setGlobalHandler) {
    return;
  }
  const existing = Eu.getGlobalHandler?.();
  Eu.setGlobalHandler((error, isFatal) => {
    if (__DEV__) {
      console.warn(
        '[GlobalHandler]',
        isFatal === true ? 'fatal' : 'soft',
        error,
      );
    }
    existing?.(error, isFatal ?? false);
  });
}
