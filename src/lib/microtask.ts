/** Deferred work without relying on TS `queueMicrotask` lib types. */
export function scheduleMicrotask(cb: () => void): void {
  void Promise.resolve().then(() => {
    cb();
  });
}
