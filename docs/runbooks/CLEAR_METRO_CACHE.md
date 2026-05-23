# Metro cache phantom bundle runbook (**§ `p1-ant-metro-cache-corrupt-reset-runbook-ant`**)

Symptoms: imports fail after refactor, stale JSON in bundle, inexplicable RN red screen despite clean git.

Steps:

```bash
watchman watch-del-all 2>/dev/null || true
rm -rf $TMPDIR/metro-* $TMPDIR/haste-* $TMPDIR/react-*
npm start -- --reset-cache
```

Hermes JSC archive notes live under `docs/investigations/device-smoke-matrix.md`.
