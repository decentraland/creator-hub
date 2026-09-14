# PR Title

## Context and Problem Statement

[Describe the issue or background that led to this change. What problem are we solving?]

## Solution

[Explain the solution implemented, focusing on the approach and key technical decisions]

Key changes:
- [Bullet points highlighting the main changes]
- [Focus on what changed, not how it changed]
- [Include architectural decisions if relevant]

## Testing

- [ ] [Specific test case 1]
- [ ] [Specific test case 2]
- [ ] [Edge cases tested]
- [ ] [Regression testing performed]

## Manual QA

[Fill the three blanks below and delete this line. If the change needs no manual QA, delete this whole section.]

Do the same run once on **Windows** and once on **macOS**.

- **What you're testing:** [what to open or import — e.g. a link to a test scene, or "the current project"]
- **How to know it passed:** [the thing you look at — e.g. "the box at the bottom of the scene turns green instead of red"]

### Step 1 — with the build from this PR

1. Grab the installer for your OS from the build comment on this PR and install it.
2. Open Creator Hub and [open / import what you're testing].
3. [Do the action — e.g. hit **Preview**].
4. Look at the result:
   - **Passed** → you're done on this OS.
   - **Didn't pass** → leave everything open and go to Step 2.

- [ ] Windows — passed at Step 1
- [ ] macOS — passed at Step 1

### Step 2 — only if Step 1 didn't pass

[One line on why: e.g. "the test scene ships an older @dcl/sdk, so pin the canary that has the fix."]

1. Open a terminal in [the project folder] and install the canary:
   ```bash
   [npm install "<canary tarball url>"]
   ```
2. Back in Creator Hub, do the same action from Step 1 again.
3. Check the result the same way.

- [ ] Windows — passed at Step 2
- [ ] macOS — passed at Step 2

Still not passing? Attach the log so we can dig in — `%APPDATA%\creator-hub\logs\main.log` on Windows, `~/Library/Logs/creator-hub/main.log` on macOS — and highlight the lines about this change [e.g. `Multiplayer Server`, `[Server]`, `[NodeRuntime]`].

## Impact

[Describe the user-facing impact and any potential side effects or considerations]

## Screenshots

[Include before and after screenshots or videos if it's a UI feature/fix]
