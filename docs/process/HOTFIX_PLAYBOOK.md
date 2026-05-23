# Rollback runbook (**§ `ux-rollback-runbook-hotfix-branch-and-store-halt-steps-ant`**)

1. Tag last known-good commit + store build number.
2. Halt phased rollout percentage in consoles.
3. Branch `hotfix/<issue>` cherry-picking minimal diff.
4. Post-incident RCA link (`§ ux-sev2-rca-*` SLA tracked in quarterly audit template).
