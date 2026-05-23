# Phase 0 Sequential Thinking hazard seeds (**§ `p0-st-kickoff-hazards-seeded`**)

Starter rows for **`HAZARD_REGISTER.md`** inventory gaps:

| HAZ-ID | Scenario | Likelihood | Detection | Mitigation |
|--------|-----------|-------------|-----------|-------------|
| H-P0-R01 | Middleware alias missing in RN linking | Medium | Unit tests `/ normalizeIncomingLinkPath` | ✅ `__tests__/normalizeIncomingLinkPath.test.ts` |
| H-P0-R02 | New Next route without inventory update | High | Planned CI diff | ⚠ Extend workflow to diff `fresh-as-ever/src/app/**` |

Linked register: see `HAZARD_REGISTER.md`.
