# Pass 19 — Manual test guide (Kawin)

Click-by-click navigation for Pass 19 customer and merchant features. No code required.

**Test accounts**

| Role | Email | Password |
|------|-------|----------|
| Customer | `qa.customer@freshasever.test` | `TempCustomer#12345` |
| Merchant | `qa.merchant@freshasever.test` | `TempMerchant#12345` |

**Primary demo outlet:** Bakehouse Kollupitiya (`00000000-0000-0000-0000-000000000003`)

Use a Release or Debug build with Pass 19 flags enabled (`EXPO_PUBLIC_GROUP_RESERVATIONS_ENABLED`, clearance shelves enabled).

---

## Customer C6 — Group rescue checkout

**Goal:** Reserve multiple bags from one outlet in a single group with one pickup code.

1. Sign in as **customer** (email/password if prompted).
2. Open **Discover**.
3. Tap **Bakehouse Kollupitiya** (or search “Bakehouse”).
4. On the outlet screen, tap **Add** on a rescue bag (e.g. *Surprise Pastries Bag*).
5. Tap **Add** on a **second** bag from the **same outlet**.
6. Confirm a **group cart bar** appears (“2 bags in your group” or similar).
7. Tap the **group cart bar** → review group checkout.
8. Confirm you see **one shared pickup window** and **one reservation code** for both bags.
9. Choose **Pay at Store** (or Card if sandbox is configured) and tap **Reserve Now**.
10. On the confirmation / celebration screen, note the **6-character code** — you will need it for merchant handover later.

**Pass criteria:** Group bar visible with 2+ bags; checkout shows combined total; one code after reserve. Same bag can be added twice (qty 2 of one listing). Group cart bar hidden when logged out; cart clears on sign-out.

---

## Customer C9 — Shelf basket timer

**Goal:** Clearance shelf basket countdown and expiry refresh messaging.

1. Sign in as **customer**.
2. Open **Discover** → **Bakehouse Kollupitiya**.
3. Tap the **clearance shelf** card (today’s shelf items).
4. Tap **+** on any shelf item to add it to your basket.
5. Confirm a **basket timer pill** appears (countdown while you shop).
6. Tap **Review basket** (or equivalent CTA).
7. Proceed toward checkout and confirm quantities carry through.

**Optional expiry path (QA):** If testing “Prices refreshed for you”, wait for the timer to expire or use a QA build with basket expiry pre-seeded, then return to the shelf and confirm the **refresh banner** appears without breaking the screen.

**Pass criteria:** Timer visible after first add; review → checkout path works; expiry shows friendly refresh copy (not a crash).

---

## Customer C10 — Weekly streak

**Goal:** Impact tab shows weekly rescue streak progress.

1. Sign in as **customer** (must have at least one **collected** order in the current week for a non-zero streak).
2. Open **Profile** (bottom tab).
3. Tap **Impact** (or **Your impact**).
4. Pull down to **refresh**.
5. Confirm the **weekly streak ring** shows `X/3` rescues this week with copy like “N rescue(s) to go this week”.
6. If you already collected 3+ this week, confirm the **goal-met** flourish / completed state.

**Pass criteria:** Streak number matches your recent collected orders; pull-to-refresh updates the count.

---

## Customer C12 — Micro-story + share

**Goal:** Post-rescue celebration story and share sheet.

1. Complete any **successful reservation** (bag or shelf) as customer, or open an existing **paid / reserved** order.
2. Land on **Order celebration** (confetti / “You rescued food!”).
3. Scroll to the **story** section.
4. Tap **Add photo** (grant Photos permission if iOS prompts).
5. Pick an image from the library.
6. Tap **Save story** or **Share**.
7. Confirm the **iOS share sheet** opens (Copy, Save Image, Messages, etc.).

**Pass criteria:** Story step accepts a photo; share sheet appears; no blank/error state after save.

---

## Merchant M11 — Impact dashboard + certificate

**Goal:** Merchant analytics impact metrics and certificate share.

1. Sign out if needed, then sign in as **merchant** (`qa.merchant@freshasever.test`).
2. Confirm outlet **Bakehouse Kollupitiya** is selected (outlet switcher if shown).
3. Open **Analytics** (merchant tab or menu → **Analytics** / **Impact**).
4. Review **CO₂ saved**, **food rescued (kg)**, and **surplus revenue (LKR)** cards.
5. Toggle **Last 7 days** vs **Last 30 days** and confirm numbers / labels update.
6. Scroll to **Certificate** section.
7. Tap **Share certificate** (or share icon on certificate card).
8. Confirm the **share sheet** opens with the certificate image / poster.

**Pass criteria:** Metrics render without error (zero is OK on fresh staging); period toggle works; certificate share sheet opens.

---

## Quick regression after Pass 19

| Check | Steps |
|-------|--------|
| Bags still work | Merchant → **Bags** tab → live bags list loads |
| Shelf consistency | Merchant → **Shelves** tab → **Today’s shelf** shows **Published** when `#SHELF1` order exists |
| Late pickups label | Merchant → **Orders** → **Late pickups** → lateness reads e.g. `13h 1m late`, not `781M` |
| Pickup times | Orders list shows cross-day windows as `Today, HH:MM – Tomorrow, HH:MM` when applicable |

---

*Generated for Pass 19 verification — manual walkthrough only.*
