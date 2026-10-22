# Creator Fund in Creator Hub (POC)

Design and mocked implementation of every Creator Hub surface the Creator Fund touches. Everything that would come from a backend is mocked in the renderer; nothing here talks to a new service.

Sources:

- Program rules: [`rodrigo685/creator-fund`](https://github.com/rodrigo685/creator-fund) → `knowledge/definitions.md` (cycles, pool, qualifying players and scenes, the three metrics).
- Eligibility contract: `creator-fund-eligibility/docs/openapi.yaml` in the same repo. The mock returns its `PlaceEligibility` shape so the real client is a drop-in.
- Visual language: Creator Tools Figma (Home "Tutorial Banner", Filter pills, Privacy tag, Help & Support modal) and Creator Tools Analytics Figma (Overview cards, Retention charts).

## Decisions

Settled by product on 2026-10-22:

| Question | Decision |
| --- | --- |
| Creator eligibility | **Account level** (not Foundation / Regenesis Labs, not suspended). It doesn't depend on owning a scene that can opt in. |
| Opt-in granularity | **Joining enrolls every eligible scene**, including ones published later. |
| Payout currency | **USDC.** The pool, the minimum and every amount are shown in USDC. |
| Payout wallet lock | **UI only.** The lock is a toggle that makes the field editable or read-only, so a saved address isn't changed by accident. No confirmation, no support step. |
| Support | **No support buttons** in the payout section or the join flow. |
| Navigation | **A "Payouts" tab** in the navbar, after Manage. |
| Banner | **Gone once the creator has opted in.** |

## Surfaces

| # | Checklist item | Where | Component |
| --- | --- | --- | --- |
| 1 | Program banner → Creator Fund page | Home, under the title (the Figma "Tutorial Banner" slot) | `components/CreatorFund/Banner` |
| 1a | Payouts tab | Navbar, after Manage → `/payouts` | `components/CreatorFundPage` |
| 2 | Quick modal with **JOIN CREATOR FUND** | Opens on the Payouts page when arriving from the banner | `components/CreatorFund/JoinModal` |
| 2a | Eligibility spinner against the backoffice | Modal step `checking` | `creatorFund.checkEligibility` thunk |
| 2b | Not eligible: "Sorry…" | Modal step `not_eligible` |  |
| 2c | Eligible: program terms, scroll to bottom → checkbox → **JOIN CREATOR FUND** | Modal step `terms` | `lib/creatorFund/terms.ts` |
| 3 | Eligible / not eligible label on Scenes & Worlds tiles, plus an "In Creator Fund" filter | Manage page cards and filter bar | `components/CreatorFund/EligibilityChip` |
| 4 | Payout section: wallet input + lock toggle, past payouts (support icon dropped, see Decisions) | Payouts page | `CreatorFundPage/PayoutWallet`, `PastPayouts` |
| 4a | Public leaderboard: top 20 creators and scenes by USDC paid, plus your own rank | Payouts page | `CreatorFundPage/Leaderboard` |
| 5 | D3 retention and attributable new players, per scene and per creator | Analytics list (columns + creator summary), Analytics detail (Overview, Retention) | `lib/creatorFund/metrics.ts` |

## Flows

### Join

```
Home banner ──LEARN MORE──▶ /payouts  (modal opens on "intro")
                                │
              JOIN CREATOR FUND │  (the page's own JOIN button skips "intro")
                                ▼
                           checking ── spinner, GET /users/:address/eligibility
                          ╱        ╲
                not eligible      eligible
               "Sorry, you're       │
                not eligible…"      ▼
                + reason          terms ── scroll to the end unlocks the checkbox;
                                           the checkbox unlocks JOIN CREATOR FUND
                                    │
                                    ▼ POST /users/:address/enrollment
                                 joined ── "N scenes enrolled" → SET UP PAYOUT WALLET
```

Signed-out creators see the page's sign-in card; the modal never opens without a wallet.

A request failure lands on an `error` step with Retry, so a backoffice outage never reads as "not eligible".

### Banner states

| Creator | Banner |
| --- | --- |
| Signed out, or signed in and not enrolled | "Get paid for the players you bring" · LEARN MORE → Payouts + intro modal |
| Signed in, enrollment still loading | hidden, so an enrolled creator never sees a flash of the pitch |
| Enrolled | hidden for good |
| Dismissed (×) | hidden; the Payouts tab is the way back |

### Scene labels and filter

Each published World on the Manage page carries one chip on its thumbnail:

| Chip | When |
| --- | --- |
| **In Creator Fund** (green) | creator enrolled and the place can opt in |
| **Creator Fund eligible** (outlined) | creator not enrolled yet, place can opt in |
| **Not eligible** (grey, reason in tooltip) | `opt_in.eligible = false`: private World, Foundation/Regenesis Labs content, road, disabled |

The **In Creator Fund** chip in the filter bar is a toggle beside Published / Not published. It filters the loaded page client-side (POC; the real one belongs in the management query).

The player minimum (10+ counted players) is a per-cycle payout rule, never an opt-in reason — it shows up only on the Payouts page's scene list ("Below 10 counted players last cycle").

### Payouts

- **Payout wallet**: an address field with a lock toggle at its end. Locked, the field is read-only. Unlocking makes it editable and puts the cursor in it; locking again validates the address and saves it. The lock is UI only: it guards against stray edits and has no meaning on the server. With nothing saved the field starts unlocked, and "Use connected wallet" fills it. Each cycle pays the wallet saved when the cycle closes.
- **Past payouts**: one row per closed cycle: dates, status (Paid / Below 5 USDC minimum / Not qualified), amount in USDC, wallet, transaction link.

The page is titled **Payouts** (the navbar tab); the Creator Fund is the program block at the top of it, and the wallet and history sit in a "Wallet & history" card.

Estimated payout for the running cycle is deliberately absent ("Estimated payout: not for beta", Notion Payout Calculation page). The cycle card shows the three metrics the fund pays on.

### Leaderboard

The fund's own rule (Notion "Payout Calculation" → Definitions): payouts per creator and per scene, top 20 public, ranking and amount posted. Scene and World metrics stay private to their owner, so the board shows the rank, the name and the USDC paid, nothing else.

- **Creators / Scenes** tabs and a **cycle** picker over the closed cycles (latest first), the same tabs + select bar as the Analytics detail page. The top 3 ranks take the accent.
- **Your row** (creators board), for a member:

| Your standing in the cycle | What you see                                                       |
| -------------------------- | ------------------------------------------------------------------ |
| In the top 20              | Your row highlighted in place (accent edge + "You")                |
| Below it, e.g. #64         | The top 20, a `⋯` gap, then "#64 · You" pinned under it            |
| Not paid in that cycle     | "You weren't paid in this cycle, so you're not ranked in it."      |
| Not in the Creator Fund    | "Join the Creator Fund to see where you rank." + JOIN CREATOR FUND |

- **Public**: it renders signed out too (under the sign-in card), with no "you" row.
- Your leaderboard amount and your Past payouts row come from the same standing, so they always agree.

### Metrics

The fund pays on **qualifying** players (anti-bot classified, 5+ AFK-free minutes, prod realms), not on the raw visitors Analytics shows. The two new metrics follow the fund's definitions:

- **New players**: players on their first day in Decentraland, credited to the scene they played most that day. Paid-ads installs don't count.
- **D3 retention**: share of those new players who came back on D1–D3.

| Where | Change |
| --- | --- |
| Analytics list | New columns **New Players** and **D3 Retention**; a creator summary above the table (totals across the creator's places) with a link to the Payouts page |
| Detail → Overview | "New Players" joins the visits card; the retention card leads with D3 and D7 side by side |
| Detail → Retention | "Day 3 Retention" platform row and "Day 3 Retention by Cohort Week" chart |
| Payouts page | Current-cycle creator totals: new players, D1–D3 returners, D3 retention, counted playtime |

## Data contract

`lib/creatorFund/contract.ts` holds the wire types. The first group is copied from `creator-fund-eligibility/src/types/eligibility.ts`; the second is proposed here and has no service yet.

| Endpoint | Status | Used by |
| --- | --- | --- |
| `POST /places/eligibility` | exists (draft service) | Manage chips, fund page list |
| `GET /cycles` | exists | Past payouts dates, current cycle |
| `GET /users/:address/eligibility` | **proposed** | Join modal spinner |
| `POST /users/:address/enrollment` (signed fetch) | **proposed** | Join |
| `GET /users/:address/enrollment` | **proposed** | Page and banner state |
| `PUT /users/:address/payout-wallet` (signed fetch) | **proposed** | Locking the wallet field (saves it) |
| `GET /users/:address/payouts` | **proposed** | Past payouts |
| `GET /users/:address/metrics?cycle=` | **proposed** | Cycle card, creator summary |
| `GET /leaderboard?cycle=&limit=20[&address=]` | **proposed** (public) | Leaderboard; `address` adds `me` |

The eligibility service takes Places API ids. Creator Hub has no Places id for a World or a parcel, so the POC keys places by location (`world:<name>`, `land:<x,y>`). The real client needs a lookup (`/places?names=` / `?positions=`) or a service endpoint that accepts locations.

## Mock

`lib/creatorFund/mockBackoffice.ts` is the stand-in backend. It keeps one record per wallet in `localStorage` (`creator-hub:creator-fund-mock`), adds latency, and answers deterministically per place (a hash of the key), so a tile shows the same label on every visit.

- Place opt-in: World names on the fund's exclusion list are `excluded_content`; about 1 in 6 other Worlds are `private_world`; the rest can opt in. About 1 in 4 opted-in places were `below_min_players` last cycle.
- Creator eligibility: eligible, except the Foundation wallet and when the demo is set to "not eligible".
- Leaderboard (`mockLeaderboard.ts`): each cycle pays 80–110 creators, rank r taking a share of the pool ∝ 1/r^1.1 (the long tail % Share produced: the top 10% take most of it). The asking creator is unpaid in ~12% of cycles, top 20 in ~13%, further down otherwise; Past payouts read from the same standing. The scene board splits each creator's payout over their scenes; it leaves out the asker's own scenes, whose titles the mock doesn't have.
- Metrics: derived from the place's real Analytics numbers (new players ≈ 12–30% of total visits; D3 ≈ 74–86% of D7, the range the fund's Retention Window tab measured). A place with no base number gets no mocked one, so "-" still means "no data". The Payouts page's cycle totals come from the hash alone.

The page header has a **POC** menu: simulate an eligible / not eligible creator, and reset the demo (leave the fund, clear the wallet, show the banner again; the simulated creator is kept, so a reset re-runs the join as them).

## Open questions

1. USDC chain. The transaction links assume Polygon (polygonscan).
2. Whether payouts need KYC or tax forms before the first one.
3. Places ids vs. locations (see Data contract).
4. Analytics is behind `creatorhub-analytics`. The metric changes are invisible without it; the Payouts tab and the banner are not gated.
5. Strings are English only; `es` and `zh` fall back to the key.
