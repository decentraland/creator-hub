# Creator Fund in Creator Hub (POC)

Design and mocked implementation of every Creator Hub surface the Creator Fund touches. Everything that
would come from a backend is mocked in the renderer; nothing here talks to a new service.

Sources:

- Program rules: [`rodrigo685/creator-fund`](https://github.com/rodrigo685/creator-fund) → `knowledge/definitions.md`
  (cycles, pool, qualifying players and scenes, the three metrics).
- Eligibility contract: `creator-fund-eligibility/docs/openapi.yaml` in the same repo. The mock returns its
  `PlaceEligibility` shape so the real client is a drop-in.
- Visual language: Creator Tools Figma (Home "Tutorial Banner", Filter pills, Privacy tag, Help & Support
  modal) and Creator Tools Analytics Figma (Overview cards, Retention charts).

## Surfaces

| # | Checklist item | Where | Component |
|---|---|---|---|
| 1 | Program banner → Creator Fund page | Home, under the title (the Figma "Tutorial Banner" slot) | `components/CreatorFund/Banner` |
| 2 | Quick modal with **JOIN CREATOR FUND** | Opens on the Creator Fund page when arriving from the banner | `components/CreatorFund/JoinModal` |
| 2a | Eligibility spinner against the backoffice | Modal step `checking` | `creatorFund.checkEligibility` thunk |
| 2b | Not eligible: "Sorry…" | Modal step `not_eligible` | |
| 2c | Eligible: program terms, scroll to bottom → checkbox → **JOIN CREATOR FUND** | Modal step `terms` | `lib/creatorFund/terms.ts` |
| 3 | Eligible / not eligible label on Scenes & Worlds tiles, plus an "In Creator Fund" filter | Manage page cards and filter bar | `components/CreatorFund/EligibilityChip` |
| 4 | Payout section: wallet input + lock, past payouts, support icon | Creator Fund page | `CreatorFundPage/PayoutWallet`, `PastPayouts` |
| 5 | D3 retention and attributable new players, per scene and per creator | Analytics list (columns + creator summary), Analytics detail (Overview, Retention) | `lib/creatorFund/metrics.ts` |

## Flows

### Join

```
Home banner ──LEARN MORE──▶ /creator-fund  (modal opens on "intro")
                                │
              JOIN CREATOR FUND │  (the page's own JOIN button skips "intro")
                                ▼
                           checking ── spinner, GET /users/:address/eligibility
                          ╱        ╲
                not eligible      eligible
               "Sorry, you're       │
                not eligible…"      ▼
                + reason          terms ── scroll to the end unlocks the checkbox;
                + Contact support          the checkbox unlocks JOIN CREATOR FUND
                                    │
                                    ▼ POST /users/:address/enrollment
                                 joined ── "N scenes enrolled" → SET UP PAYOUT WALLET
```

Signed-out creators see the page's sign-in card; the modal never opens without a wallet.

A request failure lands on an `error` step with Retry, so a backoffice outage never reads as "not eligible".

### Banner states

| Creator | Banner | CTA |
|---|---|---|
| Not enrolled | "Get paid for the players you bring" | LEARN MORE → page + intro modal |
| Enrolled | "You're in the Creator Fund" | VIEW PAYOUTS → page |
| Dismissed (×) | hidden | — the page stays reachable from Manage and Analytics |

### Scene labels and filter

Each published World on the Manage page carries one chip on its thumbnail:

| Chip | When |
|---|---|
| **In Creator Fund** (green) | creator enrolled and the place can opt in |
| **Creator Fund eligible** (outlined) | creator not enrolled yet, place can opt in |
| **Not eligible** (grey, reason in tooltip) | `opt_in.eligible = false`: private World, Foundation/Regenesis Labs content, road, disabled |

The **In Creator Fund** chip in the filter bar is a toggle beside Published / Not published. It filters the
loaded page client-side (POC; the real one belongs in the management query).

The player minimum (10+ counted players) is a per-cycle payout rule, never an opt-in reason — it shows up
only on the Creator Fund page's scene list ("Below 10 counted players last cycle").

### Payouts

- **Payout wallet**: an address field with a lock button at its end. Lock validates the address and freezes
  it; the lock icon is the state. Unlocking asks for confirmation, because the wallet locked when a cycle
  closes is the one that cycle pays. "Use connected wallet" fills the field when it is empty.
- **Past payouts**: one row per closed cycle: dates, status (Paid / Below $5 minimum / Not qualified),
  amount, wallet, transaction link.
- **Support**: an icon button in the section header opens Contact Support, the same URL as the logo menu.

Estimated payout for the running cycle is deliberately absent ("Estimated payout: not for beta",
Notion Payout Calculation page). The cycle card shows the three metrics the fund pays on.

### Metrics

The fund pays on **qualifying** players (anti-bot classified, 5+ AFK-free minutes, prod realms), not on the
raw visitors Analytics shows. The two new metrics follow the fund's definitions:

- **New players**: players on their first day in Decentraland, credited to the scene they played most that
  day. Paid-ads installs don't count.
- **D3 retention**: share of those new players who came back on D1–D3.

| Where | Change |
|---|---|
| Analytics list | New columns **New Players** and **D3 Retention**; a creator summary above the table (totals across the creator's places) with a link to the Creator Fund page |
| Detail → Overview | "New Players" joins the visits card; the retention card leads with D3 and D7 side by side |
| Detail → Retention | "Day 3 Retention" platform row and "Day 3 Retention by Cohort Week" chart |
| Creator Fund page | Current-cycle creator totals: new players, D1–D3 returners, D3 retention, counted playtime |

## Data contract

`lib/creatorFund/contract.ts` holds the wire types. The first group is copied from
`creator-fund-eligibility/src/types/eligibility.ts`; the second is proposed here and has no service yet.

| Endpoint | Status | Used by |
|---|---|---|
| `POST /places/eligibility` | exists (draft service) | Manage chips, fund page list |
| `GET /cycles` | exists | Past payouts dates, current cycle |
| `GET /users/:address/eligibility` | **proposed** | Join modal spinner |
| `POST /users/:address/enrollment` (signed fetch) | **proposed** | Join |
| `GET /users/:address/enrollment` | **proposed** | Page and banner state |
| `PUT /users/:address/payout-wallet` (signed fetch) | **proposed** | Lock / unlock |
| `GET /users/:address/payouts` | **proposed** | Past payouts |
| `GET /users/:address/metrics?cycle=` | **proposed** | Cycle card, creator summary |

The eligibility service takes Places API ids. Creator Hub has no Places id for a World or a parcel, so the
POC keys places by location (`world:<name>`, `land:<x,y>`). The real client needs a lookup
(`/places?names=` / `?positions=`) or a service endpoint that accepts locations.

## Mock

`lib/creatorFund/mockBackoffice.ts` is the stand-in backend. It keeps one record per wallet in
`localStorage` (`creator-hub:creator-fund-mock`), adds latency, and answers deterministically per place
(a hash of the key), so a tile shows the same label on every visit.

- Place opt-in: World names on the fund's exclusion list are `excluded_content`; about 1 in 6 other Worlds
  are `private_world`; the rest can opt in. About 1 in 4 opted-in places were `below_min_players` last cycle.
- Creator eligibility: eligible, except the Foundation wallet and when the demo is set to "not eligible".
- Metrics: derived from the real Analytics numbers when a place has them (new players ≈ 25–55% of unique
  visitors; D3 ≈ 74–86% of D7, the range the fund's Retention Window tab measured), otherwise from the hash.

The page header has a **POC** menu: simulate an eligible / not eligible creator, and reset the demo
(leave the fund, clear the wallet, show the banner again).

## Open questions

1. Creator-level eligibility: is it account-level only (not Foundation / Regenesis Labs, not banned), or
   does it also need at least one scene that can opt in?
2. Opt-in granularity: joining enrolls every eligible place here. Does the creator pick scenes instead?
3. Payout currency and chain (USD pool; MANA? USDC on Polygon?), and whether payouts need KYC / tax forms
   before the first one.
4. Lock semantics: can a locked wallet be unlocked from Creator Hub, or only through support? Does a change
   apply to the open cycle or the next one?
5. Places ids vs. locations (see Data contract).
6. Navigation: the page is reachable from the banner, Manage and Analytics. Does it earn a navbar entry?
7. Analytics is behind `creatorhub-analytics`. The metric changes are invisible without it; the fund page and
   banner are not gated.
