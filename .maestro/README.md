# Maestro flows (**§ `p2-role-guards-battery-maestro-session`, `p7-*`**)

```bash
maestro test .maestro/discover_smoke.yaml
```

| Flow | Scope |
|------|-------|
| `discover_smoke` | Boot + tab visibility |
| _Planned_ | Role denial matrix, cold deep link replay (`p2-deep-link-queue-cold-boot-replay-test`) |

Policy: prefer `testID=` selectors over brittle xpath (`§ p7-ant-maestro-ai-generated-selectors-ban-policy-ant`).

Stable fixture seeding: rerun suite when `STAGING_REVISION` bumps (`§ p7-ant-staging-seed-change-breaks-maestro-batch`).
