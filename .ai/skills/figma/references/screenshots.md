# Screenshots: capture and the PR body

- **Before / After, never base / head.** That goes for captions, file suffixes (`-before` / `-after`), grid columns (Before | After | Figma) and PR headings.
- **One script per environment, run at both ends**, so a pair can only differ because of the code. A PR body's Before is the PR's base commit, not the previous round's state.
- **Reset state before every shot, and log it.** Step order and starting state produce false findings: a 2D round trip earlier in a script reset Align to World, and a toggle that starts on was turned off by the shot's own click. A forced `:hover` can fail to register; move the real mouse.
- **Name the renderer and fixture per row.** The standalone inspector runs Babylon and Creator Hub runs Bevy, and some controls exist under only one. A state the fixture can't reach (a menu that needs scene info) is listed as such, or shot on a fixture that has it.
- **Evidence must be newer than the code.** Compare the shots' timestamps with the touched files' modification times before judging them.
- **Composites:** `montage -depth 8` (it writes 16-bit PNGs by default, twice the size); stack a pair vertically when the image is ≥ 4× wider than tall.
- **Upload without posting.** Uploading needs the user's approval first, asked through AskUserQuestion, as the architect's "PR actions" block requires (`.claude/agents/dcl-ch-feature-architect.md`); the same goes for any PR comment, reply or draft/ready change. `gh` can't upload images, so once approved you upload them yourself (user decision): attach them in the PR's comment box, harvest each `user-attachments` URL, clear the box, and never submit it. Upload in batches of 5–10, under 8 MB per call (the browser upload tool refuses more than 10 MB at once), and count the resolved links after each batch. GitHub silently stops accepting uploads after a burst of attachments: the tool still reports success, but no link appears. Plan a large set as batches of about 60 roughly two hours apart (one wait of 70 minutes after 66 uploads was not enough), and probe with a single file before each batch. GitHub drops each upload into the box as an `<img … src="https://github.com/user-attachments/assets/…">` tag, not markdown, so harvest the `src` attributes. Fill the body from the first batch right away and leave the missing slots as HTML comments, which render as nothing. After writing the body, check every image with a ranged GET (`curl -r 0-0`, expect 206; HEAD returns 403). A brand-new upload can 404 for a few seconds until a posted body references it. An upload stays reachable on the public repo even if the comment is never posted, which is safe because a shot only ever captures fixture data: never a signed-in profile's wallet, email or scene names.

## Capturing the render

- **Screenshots are ground truth.** `getComputedStyle` over CDP is unreliable for `:hover` / `:focus-within`.
- **Compare the full window at Figma's frame size, DPR 1.** Size the window to the frame (1920 × 1080): Playwright `page.setViewportSize` or CDP `Emulation.setDeviceMetricsOverride`, then `screenshot({ scale: 'css' })`; launch Electron with `--force-color-profile=srgb`. A window capped by the display height (953 on a laptop) is not a valid capture. Never compare crops at mismatched scales. Compare side by side, as a 50% overlay, and as per-row pixel profiles, and report measured numbers (px, alpha, ratio), not impressions.
- **Render traps that move pixels against Figma:**
  - Variable Inter applies its optical-size axis automatically (`opsz` = font size), rendering 2–3% narrower than Figma. `font-optical-sizing: none` gives Figma's widths.
  - Fractional line heights (MUI h1 1.167 → 56.016px) push every rule below onto half pixels, smeared over two device rows. Pin line heights to whole px. `line-height: normal` is fractional too (a `<dl>` of Inter rows came out 98.5 tall, and the card around it 118.5, which left a 1px light line under a flush thumbnail): where Figma gives the frame a fixed height, set that height with `box-sizing: border-box`.
  - `border-collapse: collapse` borders straddle the cell edge and smear the same way. Use `separate` and an inset `box-shadow`.
  - Figma layer blur N = CSS `blur(N / 2)`.
  - A centre-constrained child (a modal's glow) is positioned from the parent's centre, not its top: `top: calc(50% + offset)`.
  - A frame's background can be a different image from the app's. Measure the wash row by row against the app's render rather than copying the layer.
- **An element screenshot of a panel taller than its scroll area lies.** Playwright captures the element's whole box: the part clipped by the scroll container comes out as a dark band, and whatever is painted over the rest (the docked asset panel) lands in the image — it reads as a layout overlap that isn't there. Before shooting a tall panel, raise the viewport until the element sits entirely inside every `overflow` ancestor, check that in the page, and refuse the shot otherwise; shoot the Before and the After at that same viewport. An all-dark shot of a panel is this artifact, not a design. The guard, in Playwright:

  ```js
  const fullyVisible = selector =>
    page.evaluate(sel => {
      const r = document.querySelector(sel).getBoundingClientRect();
      for (let n = document.querySelector(sel).parentElement; n; n = n.parentElement) {
        if (/(auto|scroll|hidden)/.test(getComputedStyle(n).overflowY)) {
          const p = n.getBoundingClientRect();
          if (r.top < p.top - 0.5 || r.bottom > p.bottom + 0.5) return false;
        }
      }
      return r.top >= 0 && r.bottom <= window.innerHeight;
    }, selector);

  if (!(await fullyVisible('.ui-designer-property-panel'))) throw new Error('raise the viewport');
  ```

- **One image per component, states as rows.** Capture each state separately, then compose one grid per component or surface: a row per state (idle, hover, active, selected, focus, disabled…), columns **Before | After | Figma**, each row and column labelled (ImageMagick `montage`, with `-font /System/Library/Fonts/Supplemental/Arial.ttf` or it fails here). A button recoloured across four states is one image, not four. Where Figma is silent for a state, that cell says so. The Figma image is a browser capture zoomed to selection, or `get_screenshot` when the day's budget allows.
- **Inside Creator Hub too.** Shoot the full list on the standalone inspector, and the key surfaces inside the app: Creator Hub in dev with `VITE_INSPECTOR_PORT` set to the port serving the inspector under test, signed out under a temp `HOME` and `--user-data-dir`, with `--force-color-profile=srgb`. The host sets the iframe width, the colour profile and the chrome around the panel, which the standalone server can't show. After a CSS change, a plain iframe reload in a running Creator Hub can keep serving the cached `bundle.css`; fetch it with a cache-busting query (or restart the app) before you judge the render. To shoot Before and After inside Creator Hub side by side, build one renderer per inspector port (`VITE_INSPECTOR_PORT` is baked in at build time) and pair each with the same `main/dist` and `preload/dist` in its own scratch app folder, since main loads the renderer relative to its own real path. Launch each with Playwright `_electron`, signed out under its own temp `HOME` and `--user-data-dir`.
- **Shooting a branch that has no fixtures.** When the data that reaches a state lives only on a fixture branch (a QA build), check out the fixture branch detached and bring in the files under test with `git checkout <branch> -- <path>`. Do it only after `git diff <fixture-branch> <branch-base> -- <path>` shows the fixture branch's copy of each such file equals the base's, so the shot can only differ by the change. List the files you brought in beside the shots.
