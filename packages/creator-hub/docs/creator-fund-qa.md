# Creator Fund: local QA guide

This guide runs Creator Hub's **EARN** section against a local mock of the Creator Fund API, so you can walk every Creator Fund flow with no backend, no special wallet and no real places. Plan for about 10 minutes of setup and 40 minutes for the full walk.

The mock is `scripts/creator-fund-mock.mjs`: a small Node server on `http://localhost:8788` with made-up places, cycles, payouts and News. Requests take the app's real path (signed in the renderer, sent by the main process), so what you see is what the app does against the real service. The mock reads which wallet is asking from the sign-in, but never checks the signature, so any account you sign in with works. Nothing you do touches production or the shared services.

## What you need

- macOS or Windows with **Node 22+** and **git**.
- A checkout of **creator-hub** on the top of the Creator Fund stack.
- Any Decentraland account you can sign in with. It doesn't need LAND, NAMEs or funds.

## 1. Start the app with the mock

In the **creator-hub** checkout:

1. Install and build once: `make init`.
2. Start the mock and the app together:
   ```bash
   cd packages/creator-hub && npm run start:earn-mock
   ```
   The first line reads `Creator Fund mock on http://localhost:8788`. The app starts once the mock is listening, and quitting the app stops the mock.
3. Turn the EARN feature flag on. Open DevTools (**View → Toggle Developer Tools**, or `Cmd+Option+I` / `Ctrl+Shift+I`) and run:
   ```js
   localStorage.setItem(
     'creator-hub:feature-flags',
     JSON.stringify({ 'creatorhub-creator-fund': true }),
   );
   location.reload();
   ```
   The EARN tab appears after MANAGE.
4. Sign in the usual way, from the avatar menu.

`start:earn-mock` points the dev build at the mock through three environment variables: `CREATOR_FUND_API_URL=http://localhost:8788`, `METRICS_API_URL=http://localhost:8788/v2` (the My Places metric cards) and `WORLDS_CONTENT_SERVER_URL=http://localhost:8788` (the scene count behind the multi-scene World labels). Only dev builds read them. A release build ignores them.

To run the mock on its own, for example while the app runs from another terminal with the variables above, use `npm run mock:creator-fund`.

## 2. Mock switches

Each switch is an environment variable set on the start command, for example `MOCK_ENROLLMENT=active npm run start:earn-mock`, and they combine. The mock keeps its state in memory, per wallet, so a restart forgets every join: add `MOCK_ENROLLMENT=active` to land on the joined page directly.

| Switch | State it produces |
| --- | --- |
| none | Not joined, eligible. Joining works; every Payouts state is reachable after joining |
| `MOCK_INELIGIBLE=excluded` | Joining shows "You can't join yet" with "Your account isn't eligible for the Creator Fund." |
| `MOCK_INELIGIBLE=internal` | The same, with "Foundation and Regenesis Labs accounts can't join the Creator Fund." |
| `MOCK_INELIGIBLE=suspended` | The same, with "Your account is suspended from the Creator Fund." |
| `MOCK_ENROLLMENT=active` | Already joined (on Oct 20, 2026) with a fake contact (`jane.doe@example.com`), email unverified |
| `MOCK_ENROLLMENT=suspended` | Joined but suspended: the landing says "Your Creator Fund participation is suspended." |
| `MOCK_ENROLLMENT=active MOCK_INELIGIBLE=excluded` | Joined, then excluded: every owned place is **Not eligible** with "Your account isn't eligible, so this place can't take part." |
| `MOCK_TERMS_VERSION=2` | Publishes terms version 2 as soon as anyone joins, so the next visit asks to re-accept |
| `MOCK_NO_CLOSED_CYCLE=1` | No cycle has closed yet: Leaderboard shows **Get ready!** |
| `MOCK_NO_RUNNING=1` | Only an upcoming cycle: Leaderboard shows **Get ready!**, My Places lists places with no metric cards |
| `MOCK_PAYOUT_WALLET=1` | Every account starts with a payout wallet (`0x0000…dEaD`) |
| `MOCK_EMAIL_VERIFIED=1` | Every enrollment starts with its email verified |
| `MOCK_NO_PAYOUTS=1` | No payouts yet: the Payouts empty state |
| `MOCK_RESEND_S=5` | A sent code holds off **Resend Code** for 5 s instead of 60 s |
| `MOCK_CODE_TTL_S=20` | A sent code expires after 20 s instead of 10 minutes |
| `PORT=8790` | Runs the mock (and points the app) on another port |

The email verification code is always **`000000`**. Any other code is incorrect.

## 3. The walk

Check each step against **Expected**. Note anything different with a screenshot.

### 3.1 Signed out

| Do | Expected |
| --- | --- |
| Open **EARN** while signed out | No dot on the tab. The landing says "Create experiences. Bring players together. Earn money." and shows the four program features |
| Click **Read Terms** | "Example Creator Fund Program Terms (Beta)" open read-only: no checkbox, only **Close** |
| Click **Sign in to join Creators Fund** | Sign-in starts |

### 3.2 Not eligible (`MOCK_INELIGIBLE=excluded`)

| Do | Expected |
| --- | --- |
| Sign in, open EARN | Red dot on the EARN tab (it means "not joined") |
| Click **Join Creators Fund** | "Checking eligibility", then **"You can't join yet"** with "Your account isn't eligible for the Creator Fund." |
| Click **Got it** | The modal closes; you're back on the landing |

Repeat with `internal` and `suspended` for their own sentences.

### 3.3 Join (no switches)

| Do | Expected |
| --- | --- |
| Sign in, open EARN | Red dot on the tab. The landing ends in "Earn USDC." with **Join Creators Fund** |
| Click **Join Creators Fund** | "Checking eligibility", then the Program Terms |
| Look for the checkbox before scrolling | There is none; a hint says to scroll to the bottom. **Accept & Join** is disabled |
| Scroll to the end of the terms | The checkbox "I have read and accept the Creator Fund Program Terms" appears. **Accept & Join** stays disabled until you tick it |
| Tick it, click **Accept & Join** | **Contact Information**, with focus in First Name |
| Type a bad email and press Tab | "Invalid email" under the field; the layout doesn't move; **Submit** stays disabled |
| Fill fake details (`Jane`, `Doe`, `jane.doe@example.com`), click **Submit** | **Welcome to the Creator Fund** |
| Click **Let's go** | The joined page opens on **My Places** |
| Look at the header and the tab | "Earn · Creator Fund", **Beta**, "Joined on {today}". The red dot is gone |

### 3.4 My Places

| Do | Expected |
| --- | --- |
| **My Places**, Current cycle | 14 place cards: **In program** ×10, **Not eligible** ×3, **Replaced** ×1 |
| Hover each **Not eligible** chip | A tooltip with the reason: one fails the Content Policy, one is excluded, one says "Only the owner earns from this place. You're a collaborator." |
| Hover the **Replaced** chip | "This place was republished as a new one. Its earlier numbers are kept." |
| Watch the metric cards load | A grey placeholder while loading, then values (New Players Attributable, D3 Retention, Total Playtime in minutes). A few cards show **-**: the mock leaves some metrics out on purpose |
| Find **Cactus Karaoke** | A World of three scenes: its location reads `example-cactus-karaoke.dcl.eth - 2,1`. The other Worlds show just their name |
| Open the **Cycle** select | "Current cycle", then the closed cycles newest first ("Oct 16 - Oct 31, 2026" first). No upcoming cycle |
| Pick a closed cycle | "No places in this cycle." (you hadn't joined then) |
| ⋮ menu → **Read Terms** | The terms, read-only |
| ⋮ menu → **Contact Support** | Opens the Decentraland help site in your browser |
| Keyboard: Tab to the tabs, use the arrow keys and Enter | Focus stays on the tab you select; the page doesn't reload |

With `MOCK_ENROLLMENT=active` (joined on Oct 20, 2026), **Oct 16 - Oct 31, 2026** lists 13 cards (your owned places, no collaborator one) and **Oct 1 - Oct 15, 2026** says "No places in this cycle."

### 3.5 Leaderboard

| Do | Expected |
| --- | --- |
| Open **Leaderboard** | "The top 20 places with the highest payouts this cycle", the latest closed cycle (Oct 16 - Oct 31, 2026) selected, 20 rows |
| Look at the ranks | The second and third places share an amount and both show the 🥈 medal; the next row is rank 4 |
| Look at the amounts | "{amount} USDC", with cents only when there are any (`1,234.50 USDC`, never `1,234.5`) |
| Scroll the list | The column header stays pinned |
| Pick **All cycles** | "…across all cycles"; the totals change |
| Pick an older cycle | Its own top 20, labelled with that cycle |
| Click **Jump In** on a Genesis City row | Opens the explorer at that place's coordinates |
| The **News** panel | Six items, newest first ("Cycle Nov 1 – Nov 15 is live" on top) |
| Restart with `MOCK_ENROLLMENT=active MOCK_NO_CLOSED_CYCLE=1` | **Get ready!** with its four steps instead of the table |

### 3.6 Payouts

Start with no switches and join (3.3), or use `MOCK_ENROLLMENT=active`.

| Do | Expected |
| --- | --- |
| Open **Payouts** | **Payout Wallet** with **Add wallet**; **Contact Information** with your name, email and **Unverified** / **Verify email** |
| The payouts table | Three rows, newest first: **Oct 16 - Oct 31, 2026 · Pending · 3 · 22.625 USDC**, then two **Paid** rows (**20 USDC** and **23.25 USDC**) with a transaction link |
| Look under the pending row | It opens expanded, with its paid places and their own amounts: `9 USDC`, `8.50 USDC`, `5.125 USDC` |
| Expand a **Paid** row | Its paid places with their amounts |
| Click a transaction link | Opens Etherscan in your browser (the fake hash finds nothing there) |
| **Add wallet**, type `0x123` | "Invalid wallet address. It should start with 0x and be 42 characters long." |
| Type a 42-character address (`0x0000000000000000000000000000000000000002`), **Add wallet** | Snackbar "Payout wallet added"; the address shows with **Copy** and **Edit** |
| **Edit**, change the last digit, **Save** | Snackbar "Payout wallet updated"; the new address shows |
| **Verify email** | "Verify your email", "6-digit code sent to jane.doe@example.com" |
| Enter `123456`, **Verify** | "Incorrect Code. Check the email and try again." |
| Click **Resend Code** at once | Nothing: it is held for 60 s (`MOCK_RESEND_S` shortens it) |
| Enter `000000`, **Verify** | Snackbar "Email verified"; **Unverified** is gone |
| Restart with `MOCK_ENROLLMENT=active MOCK_CODE_TTL_S=20`, open **Verify email**, wait 25 s, enter `000000` | "This code has expired. Resend a new one." |
| Six wrong codes in a row | The sixth answers "Something went wrong. Please try again." (locked; even `000000` is refused until a resend) |
| Restart with `MOCK_ENROLLMENT=active MOCK_NO_PAYOUTS=1` | "Your rewards journey starts here!" and "Your first payout is coming after the Nov 1 - Nov 15, 2026 cycle ends." |
| Restart with `MOCK_ENROLLMENT=suspended`, open EARN | The suspended landing, with the ⋮ menu; no Payouts tab |

### 3.7 Updated terms (re-accept)

Restart with `MOCK_TERMS_VERSION=2` and join (3.3). Joining publishes version 2.

| Do | Expected |
| --- | --- |
| Reload the app (`Cmd+R` / `Ctrl+R`), open EARN | **"Program Terms updated"**, "Review the updated terms to keep earning." There's no close button, and Escape doesn't close it |
| Click **Not now** | You land on **Home** |
| Open EARN again | The same modal again |
| Scroll to the end, tick the checkbox, click **Accept** | The joined page opens on **My Places**; the places are **In program** again; "Joined on" keeps the original date |

## 4. Reset and clean up

- **Start over:** quit the app (or `Ctrl+C` the command); the mock goes with it and forgets every wallet. Start the command again.
- **Turn EARN off:** in DevTools, `localStorage.removeItem('creator-hub:feature-flags'); location.reload();`.
- Nothing else to undo: no config file was edited.

## 5. Against a local creators-data instead

To check the app against the real service, run creators-data locally (its own `docs/creator-fund-qa.md` loads fixtures and starts it on port 8787), then start the app with `CREATOR_FUND_API_URL=http://localhost:8787 npm run start` from `packages/creator-hub`. creators-data does not serve the Leaderboard, Payouts, payout wallet or email verification routes yet, so those tabs show their error state there.

## Known limits

- **Every wallet sees the same places, Leaderboard and payouts.** The fixtures are shared; only the enrollment, payout wallet and email verification are kept per wallet.
- **The `terms_outdated` reason can't be seen.** The mock sets it while the terms are out of date, but the re-accept modal stands in front of My Places until you accept.
- **Publishing to a World fails** while `start:earn-mock` runs, because it points the Worlds content server at the mock. Jump In to a fixture World finds nothing for the same reason, and because the Worlds are made up.
- **Stop with `Ctrl+C` or by quitting the app.** Killing the `start:earn-mock` process from elsewhere stops the mock but leaves the app window open, as with `npm run start`.
- **Responses take 0.3 to 0.8 s** on purpose, so loading states are visible.
- A **"We couldn't check for updates"** notice can appear when running from source. It's unrelated to EARN.
