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

### Run the build from this PR

1. Grab the installer for your OS from the build comment on this PR and install it.
2. Open Creator Hub and [open / import what you're testing].
3. [Do the action — e.g. hit **Preview**].
4. Look at the result:
   - **Passed** → you're done on this OS.
   - **Didn't pass** → leave everything open and grab the log (see below).

- [ ] Windows — passed
- [ ] macOS — passed

<!--
AGENT GUIDANCE — SDK version step (only sometimes needed):
Add this to the body ONLY if the fix needs a specific @dcl/sdk version
(a canary tarball or a released version) the test scene doesn't ship yet.
If so, add after the run above:
  1. In the project folder: npm install "<@dcl/sdk version or tarball url>"
  2. Reload the scene's editor so the new SDK version is available.
  3. Re-run the action; check the result the same way.
  Then add: [ ] Windows / [ ] macOS — passed with that SDK version.
-->

Still not passing? Attach the log so we can dig in — `%APPDATA%\creator-hub\logs\main.log` on Windows, `~/Library/Logs/creator-hub/main.log` on macOS — and highlight the lines about this change [e.g. `Multiplayer Server`, `[Server]`, `[NodeRuntime]`].

## Impact

[Describe the user-facing impact and any potential side effects or considerations]

## Screenshots

[Include before and after screenshots or videos if it's a UI feature/fix]
