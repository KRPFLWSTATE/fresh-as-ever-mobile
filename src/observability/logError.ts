/**
 * Canonical app-side error logger. Replaces every `.catch(() => {})` swallow-all so
 * we keep a single observability seam to attach to (Sentry / Crashlytics / Datadog)
 * when wired up. The current implementation is intentionally a thin `console.warn`
 * stub — keep the call signature stable so the eventual real implementation only
 * needs to swap the body in this one file.
 */
export type LogErrorContext = {
  /** Free-form `<screen>.<action>` slug, e.g. `'CheckoutScreen.confirm'`. */
  context?: string;
  /** Anything extra the call site wants to attach (request id, ids, etc.). */
  extra?: Record<string, unknown>;
};

export function logError(
  err: unknown,
  ctx: LogErrorContext | string = {},
): void {
  const c = typeof ctx === 'string' ? { context: ctx } : ctx;
  const tag = c.context ? `[logError ${c.context}]` : '[logError]';
  if (c.extra) {
    console.warn(tag, err, c.extra);
  } else {
    console.warn(tag, err);
  }
}
