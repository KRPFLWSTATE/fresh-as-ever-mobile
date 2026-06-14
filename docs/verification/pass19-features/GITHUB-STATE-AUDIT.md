# GitHub vs local state audit

**Generated:** 2026-06-14  
**Scope:** `fresh-as-ever-mobile` and `fresh-as-ever` (web/Supabase)  
**Action taken:** fetch only — **no push, no commit**

## Executive summary

The user report is **correct**: GitHub `main` is far behind local on both repos. After `git fetch origin`, each repo is **0 commits behind** `origin/main` and **only ahead** (fast-forward pushes would apply with no merge conflicts).

| Repo | Path | GitHub | Branch | Ahead | Behind | Dirty? | Unpushed commits |
|------|------|--------|--------|-------|--------|--------|------------------|
| Mobile | `/Users/kawinperera/Fresh-as-Ever/fresh-as-ever-mobile` | [KRPFLWSTATE/fresh-as-ever-mobile](https://github.com/KRPFLWSTATE/fresh-as-ever-mobile) | `main` | **31** | **0** | **Yes** | 31 |
| Web | `/Users/kawinperera/Fresh-as-Ever/fresh-as-ever` | [KRPFLWSTATE/fresh-as-ever](https://github.com/KRPFLWSTATE/fresh-as-ever) | `main` | **6** | **0** | Minor | 6 |

**GitHub CLI:** authenticated as `KRPFLWSTATE` (`gh auth status` OK). Default branch on both: `main`.

**Safe to push (merge-wise)?** **Yes** — neither repo is behind remote.  
**Safe to push (content-wise)?** **Review first** — see secrets/working-tree notes below.

---

## Remote configuration

### Mobile (`fresh-as-ever-mobile`)

```
origin  https://github.com/KRPFLWSTATE/fresh-as-ever-mobile.git (fetch/push)
```

- Local `HEAD`: `99f725a` — *Pass 19 verify pass7: close B-15 and M2 to strict PASS.*
- Remote `origin/main`: `cfa4aa4` (unchanged after fetch; 31 commits older than local)

### Web (`fresh-as-ever`)

```
origin  https://github.com/KRPFLWSTATE/fresh-as-ever.git (fetch/push)
```

- Local `HEAD`: `0af7afa` — *Fix create_group_reservation child order reservation_code.*
- Remote `origin/main`: `1f32880` (6 commits older than local)

---

## Branch structure

| Repo | Local branches | Remote branches | Notes |
|------|----------------|-----------------|-------|
| Mobile | `main` only (tracks `origin/main`) | `origin/main` | No feature branches with extra work |
| Web | `main` only (tracks `origin/main`) | `origin/main` | No feature branches with extra work |

**Submodules / monorepo:** Neither repo uses git submodules. Mobile and web are **separate repositories** (not a monorepo).

---

## Unpushed commits (would be pushed to `origin/main`)

### Web — push **first** (Supabase migrations & backend for Pass 19)

Order is oldest → newest (6 commits):

| SHA | Message | Theme |
|-----|---------|-------|
| `79e1a82` | fix(web): Pass7–Pass9 RLS migrations and admin discover shelf fixes | QA / RLS |
| `86cd74f` | docs: Pass7–Pass9 verification artifacts and final QA signoff | Docs / QA |
| `63a09c1` | docs: append Pass 11 discover/favourites signoff row | Docs |
| `bbbd0f8` | fix(supabase): restore demo_seed outlets when real listings expire | Demo / discover |
| `06a1d01` | Add rescue_stories table and storage for Pass 19 micro-stories. | **Pass 19** |
| `0af7afa` | Fix create_group_reservation child order reservation_code. | **Pass 19** / group cart |

**Diff scale:** ~1,589 files, +67k lines (large verification artifact trees under `docs/verification/`).

**Migrations in unpushed web work (apply on deploy before mobile expects new APIs):**

- `20260614120000_demo_discover_visibility_fix.sql`
- `20260614180000_rescue_stories_v1.sql`
- `20260614190000_fix_group_reservation_code.sql`

### Mobile — push **after** web migrations are live

Order is oldest → newest (31 commits):

#### Shelf / favourites / discover UX (pre–Pass 19)

| SHA | Message |
|-----|---------|
| `dd85f49` | fix(mobile): shelf scroll layout and favourites UI polish |
| `b151c89` | fix(mobile): guest discover sign-in empty state |
| `c1ac303` | feat(mobile): outlet location search and GPS like customer selector |
| `8746eb1` | docs(mobile): pass14 outlet location verification report and screenshots |
| `f4d63c2` | fix(mobile): add outlet.saveChanges testID for Appium save tap |
| `6eb3e56` | fix(mobile): geocode typed outlet address without suggestion pick |
| `b64b812` | fix(mobile): location search field replace-not-append |
| `172e309` | feat(mobile): discover map pins from feed outlets |
| `6b8c51e` | fix(mobile): discover location header and typed map pins |
| `9785292` | feat(mobile): rescue radar discover map — EWKB coord fix, pan, signature marker system |
| `3973bad` | fix(mobile): discover map feed sync and nav location pill |
| `fd5dbf7` | Style Discover map surface with branded Google Maps tiles on iOS. |
| `1c75257` | fix(mobile): discover map preview-only tap + richer surface |
| `726b0f8` | fix(mobile): restore Discover map surface contrast and readability |
| `414471c` | Discover map: lighter Stitch-branded surface (pass15h). |
| `61b573e` | Discover map: bright anti-pencil surface (pass15i). |
| `3bc9c79` | Discover map: branded lagoon water and richer surface (pass15j). |
| `fa1571d` | docs(mobile): pass16 Discover map backend sync audit |
| `515ebad` | Polish Discover scroll perf and map pan ambience (pass17). |
| `1614079` | fix(discover): hide seed_demo feed rows when use_demo_listings is off |

#### Pass 19 product + verification

| SHA | Message | Verified in audit |
|-----|---------|-------------------|
| `2d2b1ce` | Pass 19: streak, share cards, group cart, basket timer, stories, M11, map pulse. | Yes |
| `b6655d9` | fix(mobile): checkout group overlap hook order crash | Yes |
| `ecd91cc` | docs(verify): Pass 19 verification matrix and evidence | Yes |
| `d81f8d0` | Pass 19 verify pass 2: close 15 PARTIAL rows with evidence. | Yes |
| `99202cc` | Pass 19 verify pass 3: guest logout PASS, streak refresh fix. | Yes |
| `372cf07` | Pass 19 verify pass4: close A-02, B-07, M1 with Appium evidence. | Yes |
| `f9ac372` | Pass 19 verify pass4: document auth workaround and add runner variants. | — |
| `782a833` | Pass 19 verify pass5: close 5 of 7 PARTIAL rows with Appium evidence. | Yes |
| `810892b` | Pass 19 verify pass6: fix shelf fetch hang and document Appium evidence. | Yes |
| `7ac9d07` | Pass 19 verify pass7: basket rehydrate fixes and Appium evidence. | — |
| `99f725a` | Pass 19 verify pass7: close B-15 and M2 to strict PASS. | Yes |

**Diff scale:** ~322 files, +15k / −1.2k lines.

---

## Behind remote / conflicts

- `git log HEAD..origin/main`: **empty** on both repos.
- `git rev-list --left-right --count origin/main...HEAD`: **0 TAB ahead** → mobile `0	31`, web `0	6`.
- **No rebase/merge conflicts** expected if pushing local `main` to `origin/main`.

---

## Uncommitted local changes (not on GitHub even after push)

### Mobile — **dirty**

**Modified (tracked):**

- `docs/verification/pass19-features/pass19-pass6-final.mjs`
- Many `docs/verification/pass19-features/screenshots/pass19/pass6|pass7/*` (PNG/MP4)
- `ios/Podfile.lock`

**Untracked (selected):**

- `.expo/` (should not commit)
- `ios/assets/`
- `docs/verification/pass15-discover-map/*` (screenshots, log)
- Additional pass19 runner scripts (`pass19-a02-only.mjs`, `pass19-pass7-runner.mjs`, etc.)

**Recommendation:** Decide whether verification assets and Podfile.lock belong in the next commit before or after push; `.expo/` should stay untracked/ignored.

### Web — **mostly clean**

**Untracked only:**

- `docs/verification/pass10-final-check/`

Committed `main` is still 6 commits ahead of GitHub; untracked docs would remain local until committed.

### This audit file

- `docs/verification/pass19-features/GITHUB-STATE-AUDIT.md` — **new, uncommitted** (audit-only; not pushed unless committed).

---

## Secrets / sensitive content review

| Risk | Location | Notes |
|------|----------|-------|
| **Review** | Mobile `.env.example` in unpushed diff | Adds `GOOGLE_MAPS_API_KEY=` placeholder (OK). Also contains a **Sentry DSN ingest URL** — confirm team policy on DSN in repo. |
| **Review** | Web unpushed paths | Verification artifacts under `pass8-full-crawl/.../forgot-password/` (filenames only in scan; may contain test account text). |
| **OK** | Working tree scan (mobile) | No `gho_`, OpenAI `sk-`, or JWT-like Supabase keys in current unstaged diff. |
| **Do not commit** | Mobile `.expo/` | Local Expo cache |

No `.env` with live keys appeared in unpushed **filename** scan; still run a full secret scan before public push if policy requires it.

---

## Recommended push order (when user approves)

1. **Web** `fresh-as-ever`: `git push origin main`  
   - Apply/run Supabase migrations (`rescue_stories`, demo discover fix, group reservation code) in target environment.
2. **Mobile** `fresh-as-ever-mobile`: `git push origin main`  
   - Depends on backend for stories, group reservation, demo listing visibility.

Optional before push:

- Commit or stash mobile working-tree verification updates.
- Exclude `.expo/` from any commit.

**Estimated push:** fast-forward only — **31** commits (mobile) + **6** commits (web).

---

## Commands reference (re-run audit)

```bash
# Mobile
cd /Users/kawinperera/Fresh-as-Ever/fresh-as-ever-mobile
git fetch origin
git status -sb
git rev-list --left-right --count origin/main...HEAD
git log origin/main..HEAD --oneline

# Web
cd /Users/kawinperera/Fresh-as-Ever/fresh-as-ever
git fetch origin
git status -sb
git rev-list --left-right --count origin/main...HEAD
git log origin/main..HEAD --oneline
```
