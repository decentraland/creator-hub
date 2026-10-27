# Creator Hub & Inspector Design System

The visual language for the two UIs in this repo: the **`@dcl/inspector`** web UI (the Babylon.js scene inspector and its panels, including the UI Designer) and the **Creator Hub** Electron renderer around it. It's the reference for every color, spacing, focus, and motion decision in their `.css`/`.tsx`.

**Scope: two systems, one boundary.** Creator Hub renders the inspector inside an `<iframe>`, and no token crosses that boundary. Inspector code uses only the `vars.css` tokens documented in most of this file. Creator Hub renderer code uses only `decentraland-ui2` and `theme.css` ([Creator Hub (renderer)](#creator-hub-renderer)). Don't import ui2 tokens into the inspector, and don't apply `vars.css` to Creator Hub.

**Not our brand kit.** Anthropic brand assets (Poppins/Lora, orange `#d97757`, etc.) and the `brand-guidelines` skill do **not** apply to this codebase. The inspector's brand is Decentraland: pink `--primary-main #ff2d55`, the cyan UI-Designer accent, and Inter.

---

## How to use this doc

This file follows the Figma file's own order: tokens first, then one section per Figma section of components. To find a Figma component, look up its page or set name in the index below, or grep for `### <Figma set name> (<page>)`: every set block starts with that heading. A set block has a header line (set link, variants with node ids, size, read date, and the code that renders it), one value table with the ✱ rows for states Figma doesn't draw, and the dated **Decisions** rows that record what the user settled. Grep a component's Decisions before you ask a question again.

Each value names its token. A value that differs from the token file carries its status: `ships in #<PR>` (an open spoke sets it), `drift → <Figma value> (pending spoke)`, `✱ deviation` (kept on purpose), or `PROPOSED` (a new token whose name is the user's call).

### Sections index

| Figma page | Figma section | Component sets | Anchor |
| --- | --- | --- | --- |
| Colors | Tokens | — (tokens) | [#colors](#colors) |
| Icons | Tokens | — (tokens) | [#icons](#icons) |
| Typography | Tokens | — (tokens) | [#typography](#typography) |
| Tags / Labels | Tokens | Place, Privacy, Role tag | [#place-tags--labels](#place-tags--labels) |
| Progress | Feedback | Spinner Animation, ProgressBar | [#spinner-animation-progress](#spinner-animation-progress) |
| Snackbars | Feedback | Snackbars | [#snackbars-snackbars](#snackbars-snackbars) |
| Tooltips | Feedback | Tooltip | [#tooltip-tooltips](#tooltip-tooltips) |
| Header | Navigation | Main Navigation, tab-bar | [#main-navigation-header](#main-navigation-header) |
| Tabs | Navigation | TabHorizontal, TabVertical | [#tabhorizontal-tabs](#tabhorizontal-tabs) |
| Accordion | Surfaces | AccordionEntry, LabelAccordion, Admin Tools accordions | [#accordionentry-accordion](#accordionentry-accordion) |
| Background | Surfaces | Background | [#background-background](#background-background) |
| Cards | Surfaces | Scene-Card, Template-Card, Learn-Video-Card, Learn-Doc-Card, Published-Scene-Card | [#scene-card-cards](#scene-card-cards) |
| Menu | Surfaces | Menu-Entry, Menu, Context menus | [#menu-entry-menu](#menu-entry-menu) |
| Modals | Surfaces | DefaultModal, Help & Support Modal, ReportBug, Secure-Sign-In | [#defaultmodal-modals](#defaultmodal-modals) |
| Scrollbar | Surfaces | Scrollbar | [#scrollbar-scrollbar](#scrollbar-scrollbar) |
| Sections Titles | Surfaces | TitleBar, Subtitle-Navigation | [#titlebar-sections-titles](#titlebar-sections-titles) |
| TitleBar | Surfaces | Editor Toolbar, Editor Toolbar buttons, Play Options menus | [#editor-toolbar-titlebar](#editor-toolbar-titlebar) |
| Profile Snapshot | Surfaces | ConnectionStatus, ProfilePic | [#connectionstatus-profile-snapshot](#connectionstatus-profile-snapshot) |
| Buttons | Inputs | Button-Contained-Text, Button-Contained-Text-Icon, PillIconText, rounded-button-contained, BackTitle, Button-Multiple-Options, ButtonContainedVertical, JumpInCTA, ToggleLabel, ToolbarButton, Switch, IconContainedToggle, TextureContainedRoundedButton | [#button-contained-text-buttons](#button-contained-text-buttons) |
| Checkbox | Inputs | Checkbox, End | [#checkbox-checkbox](#checkbox-checkbox) |
| Dropdown | Inputs | Sort-By, Dropdown-Input | [#sort-by-dropdown](#sort-by-dropdown) |
| Filter / Sort / Search bar | Inputs | Filter | [#filter-filter--sort--search-bar](#filter-filter--sort--search-bar) |
| Radio | Inputs | Radio, End | [#radio-radio](#radio-radio) |
| Search Bar | Inputs | Search-Bar, Close-Button | [#search-bar-search-bar](#search-bar-search-bar) |
| Slider | Inputs | Slider | [#slider-slider](#slider-slider) |
| Switch | Inputs | Switch | [#switch-switch](#switch-switch) |
| Text Field | Inputs | Text-Input | [#text-input-text-field](#text-input-text-field) |
| Avatars | Graphic Assets | AvatarSnapshot | [#avatarsnapshot-avatars](#avatarsnapshot-avatars) |
| Logo | Graphic Assets | Logo | [#logo-logo](#logo-logo) |
| Scene's Thumbnails | Graphic Assets | Thumbnail | [#thumbnail-scenes-thumbnails](#thumbnail-scenes-thumbnails) |
| Section | Graphic Assets | SectionImages | [#sectionimages-section](#sectionimages-section) |
| App Settings | Settings | Settings | [#settings-app-settings](#settings-app-settings) |
| AI Assistant | Editor | AiChat, Menu, Header, TitleBar, ChatInput | [#ai-assistant-page-lead](#ai-assistant-page-lead) |
| 3D Editor Bottom Panel | Editor | BottomPanel3D, PreviewToggle, FoldersHierarchy, File Button States, Scale Slider, Right Panel, Collapse/Expand Panel | [#3d-editor-bottom-panel-page-lead](#3d-editor-bottom-panel-page-lead) |
| UI Editor | Editor | LeftPanel2D, RightPanel2D, BottomPanel2D, Tooltip, MinMaxSize, Interactions, Devices, Fill, Border, EventHandler, EventTag, AddLogicInputs, LogicInputs, LogicError and Header, AddAction, ColourPanel, HUE and Slider, EventsMenu, VariableMenu, Subtitle, ToggleTabs, Input, NodeTypeHierarchy, GUI, TabBar, PropertiesSections, HierarchySections, Icons — layout and box model, ConstraintsIcons — 25, UI Editor Buttons, ScaleToggle, WrapToggle, ToggleTab, ViewModeToggle, AddVariant, VisibilityToggle, LockLayerToggle, HelpCTA, DeleteCTA, Properties, InputAction | [#ui-editor-page-lead](#ui-editor-page-lead) |
| Viewport | Editor | Viewport | [#viewport-viewport](#viewport-viewport) |
| Toolbar | Editor | Toolbar, RuntimeControls, AudioToggle | [#toolbar-viewport-toolbar](#toolbar-viewport-toolbar) |

---

## Figma source

Both UIs are specified in one Figma file, **📗️ Design System | Creator Tools** (file key `5ecKgNHjChZEe05LUwKGku`). [Node `20420:50646`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20420-50646) is its COVER page. Tokens live on the pages under **Tokens** (Colors, Icons, Typography, Tags / Labels); components and screens live on the section pages, so start from the frame URL for the surface you're changing. A page whose name contains `🟡 Outdated` is superseded: don't pull from it.

Read `.ai/skills/figma/SKILL.md` before pulling a frame. It covers the Figma MCP, the Claude-in-Chrome fallback, and syncing palette changes back into this file.

## Pages inventory

Read October 27, 2026 from the Figma file's own page list (`store.getState().mirror.appModel.pagesList` in the web client).

| Page | Section | Node id | Status |
| --- | --- | --- | --- |
| COVER | — | `20420:50646` | cover |
| ↓ Tokens | Tokens | `20717:461` | section header |
| Colors | Tokens | `20752:6024` | in scope |
| Icons | Tokens | `20450:15495` | in scope |
| Typography | Tokens | `20717:313` | in scope |
| Tags / Labels | Tokens | `20755:7456` | in scope (components: Role tag, Privacy, Place) |
| ↓ Feedback | Feedback | `20762:23667` | section header |
| Progress | Feedback | `20450:17811` | in scope |
| Snackbars | Feedback | `20450:17639` | in scope |
| Tooltips | Feedback | `20819:271` | in scope |
| ↓ Navigation | Navigation | `20757:439` | section header |
| Header | Navigation | `20448:15582` | in scope |
| Tabs | Navigation | `20757:522` | in scope |
| ↓ Surfaces | Surfaces | `20762:23670` | section header |
| Accordion | Surfaces | `20932:5254` | in scope |
| Background | Surfaces | `20759:13588` | in scope |
| Cards | Surfaces | `20910:7505` | in scope |
| Cards 🟡 Outdated | Surfaces | `21457:1660` | skipped: outdated |
| Menu | Surfaces | `20747:59496` | in scope |
| Modals | Surfaces | `20423:75560` | in scope |
| Modals 🟡 Outdated | Surfaces | `21457:14856` | skipped: outdated |
| Scrollbar | Surfaces | `20937:5631` | in scope |
| Sections Titles | Surfaces | `20448:15585` | in scope |
| TitleBar | Surfaces | `20530:79669` | in scope |
| Profile Snapshot | Surfaces | `20772:841` | in scope |
| ↓ Inputs | Inputs | `20705:10838` | section header |
| Buttons | Inputs | `20705:10837` | in scope |
| Checkbox | Inputs | `20932:3958` | in scope |
| Dropdown | Inputs | `20780:6256` | in scope |
| Filter / Sort / Search bar | Inputs | `20448:15583` | in scope |
| Radio | Inputs | `20932:3959` | in scope |
| Search Bar | Inputs | `20768:1310` | in scope |
| Slider | Inputs | `21625:14984` | in scope |
| Switch | Inputs | `20907:5707` | in scope |
| Text Field | Inputs | `20810:667` | in scope |
| ↓ Graphic Assets | Graphic Assets | `20423:75578` | section header |
| Avatars | Graphic Assets | `21232:42259` | in scope |
| Cards Thumbnails 🟡 Outdated | Graphic Assets | `21457:18423` | skipped: outdated |
| Download 🟡 Outdated | Graphic Assets | `21457:18035` | skipped: outdated |
| Logo | Graphic Assets | `21454:39192` | in scope |
| Scene's Thumbnails | Graphic Assets | `21454:39301` | in scope |
| Section | Graphic Assets | `21457:18415` | in scope |
| ↓ Settings | Settings | `20423:51482` | section header |
| App Settings | Settings | `21454:39027` | in scope |
| Settings 🟡 Outdated | Settings | `21454:13370` | skipped: outdated |
| Editor | Editor | `20421:50640` | section header |
| AI Assistant | Editor | `21206:31202` | in scope |
| Cleanup wizard 🟡 Outdated | Editor | `21023:15344` | skipped: outdated |
| Scene Editor 🟡 Outdated | Editor | `20533:81937` | skipped: outdated |
| 3D Editor Bottom Panel | Editor | `21670:18705` | in scope (boards: Feedback `21673:55006`, Components `21673:54749`, Editor 3D `21673:54990`, Editor 3D Bottom Panel `21673:54913`) |
| UI Editor | Editor | `21028:15887` | in scope |
| Viewport | Editor | `20506:34918` | in scope |
| Toolbar | Editor | `21023:11034` | in scope |
| Publish (WIP) 🟡 Outdated | Editor | `20423:50468` | skipped: outdated |

---

## Tokens

All inspector tokens are CSS custom properties on `:root` in **`packages/inspector/src/theme/vars.css`**, loaded with `theme/index.css` (fonts + a few resets). Several tokens pass through VS Code webview variables (`--vscode-*`) with a fallback, so the inspector adopts the host editor theme when embedded there. Creator Hub's tokens are `decentraland-ui2`'s theme plus `:root` in `packages/creator-hub/renderer/src/themes/theme.css` ([Creator Hub (renderer)](#creator-hub-renderer)).

**The one rule:** style with these tokens. Do not introduce new hardcoded hex/`rgba()` in inspector CSS — if a needed color isn't a token, add a token.

### Colors

Reconciled on October 27, 2026 from the Colors page ([node `20752:6024`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20752-6024), frame "Colors Dark" [`20755:6429`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20755-6429), 12 columns). Variable names come from the frame's variable definitions; fills and alphas come from the swatches, since INFO and three Neutrals swatches are raw fills with no variable. One table per Figma column group, in Figma's order.

Status: **match** (same value), **ships in #1703** (the open spoke `feat/design-tokens-figma-values` sets Figma's value; the table shows that value), **drift → X (pending spoke)** (a token holds another value; a spoke stacked on #1703 changes it), **missing** (no token in that world), **✱ deviation** (documented and kept on purpose), **PROPOSED** (a new token; the name is the user's call). A `—` means the world has no token for it and needs none yet. ui2 paths name `decentraland-ui2`'s dark theme (`theme/colorSchemes.js`, `theme/colors.js`); ui2 reads none of these through a `--mui-*` variable except `--mui-palette-action-disabled` and `--mui-palette-secondary-contrast`, so a ui2 drift is fixed upstream.

Swatch chrome on the page (not tokens): radius 8px, a 312 × 82 fill, the name in Inter Bold 16 / 1.75 / 0.15px, the value in `Body/Body - 14`, a 4px gap, and the column heading in `Other/Overline`. Light swatches carry a 1px Black 10 border; Pale Black a 1px White 20.

#### Primary and Primary Alt (CTAs, highlights)

| Figma variable | Value | Use | `vars.css` | `theme.css` / ui2 | Status |
| --- | --- | --- | --- | --- | --- |
| Primary/Primary · Brand/Ruby | `#FF2D55` | Brand pink — **CTAs and main buttons only**, plus the "armed/active tool" signal: the `.Button.primary` fill and the `text` + `primary` label. Not for panel chrome (that's `--ui-designer-control-accent`); don't use it for field errors. | `--primary-main` `#ff2d55` | `--primary`, `--dcl` `#ff2d55` · ui2 `palette.primary.main` | match |
| Primary/Primary Dark 1 | `#F70038` | `.Button.primary` pressed; ui2's contained-primary hover | `--primary-dark` `#f70038` | `--dcl-hover` `#f70038` (no consumer) · ui2 `palette.primary.dark` | match |
| Primary/Primary Dark 2 | `#D80029` | — | PROPOSED `--palette-primary-dark2` | ui2 `colors.base.primaryDark2` `#D80029` | missing in inspector |
| Primary/Primary Light 1 | `#FF6280` | `.Button.primary` hover and active fill, and the `text` + `primary` hover label (ui2 theme-path name); Creator Hub's primary hover | `--palette-primary-light` `#ff6280` | `--primary-hover` `#ff6280` · ui2 `palette.primary.light` `#F26276` · ui2 `colors.base.primaryLight1` `#F8919D` | match in inspector; `--primary-hover` ships in #1703; ui2 drifts (upstream) |
| Primary/Primary Light 2 | `#FF93A8` | — | PROPOSED `--palette-primary-light2` | ui2 `colors.base.primaryLight2` `#FFC9D5` | missing in inspector; ui2 drifts (upstream) |
| Primary Alt/Primary Alt · Brand/Orange | `#FF7439` | Brand orange | `--secondary-main` `#ff7439` | — · ui2 `brand.orange` | match |
| Primary Alt/Primary Alt Dark 1 | `#F45708` | Brand orange shade (no consumers yet) | `--secondary-dark` `#f45708` | — | ships in #1703 |
| Primary Alt/Primary Alt Dark 2 | `#D84900` | — | PROPOSED `--palette-primaryAlt-dark2` | — | missing |
| Primary Alt/Primary Alt Light 1 | `#FFAD8D` | Brand orange shade (no consumers yet) | `--secondary-light` `#ffad8d` | — | ships in #1703 |
| Primary Alt/Primary Alt Light 2 | `#FFCDBA` | — | PROPOSED `--palette-primaryAlt-light2` | — | missing |

#### Neutrals (text, surfaces, borders)

The Figma ramp has 13 swatches; 10 are variables and three (Onix, Onix Dark 1, Charcoal) are swatch fills only. ui2 mirrors the ramp as `colors.neutral` (`softWhite`, `gray5…gray0`, `softBlack2`, `softBlack1`).

| Figma variable | Value | Use | `vars.css` | `theme.css` / ui2 | Status |
| --- | --- | --- | --- | --- | --- |
| Neutrals/White | `#FFFFFF` | Glyphs on dark boards (every icon frame) | `--white` `#ffffff`, `--base-01` | `--white`, `--text` `#ffffff` · ui2 `neutral.white` | match |
| Neutrals/Snow (also DCL/Snow) | `#FCFCFC` | Figma Neutrals/Snow (ui2 `neutral.softWhite`): the 3D toolbar's hover and selected glyph; `--ui-designer-text` aliases it, and `--focus-ring` reads it through that alias | `--palette-neutral-softWhite` `#fcfcfc` | ui2 `neutral.softWhite` | match |
| Neutrals/Pearl | `#ECEBED` | Light surface (the Typography sheet) | PROPOSED `--palette-neutral-gray5` | ui2 `neutral.gray5` | missing in inspector |
| Neutrals/Gray | `#CFCDD4` | Figma Neutrals/Gray (ui2 `neutral.gray4`): the 3D toolbar's resting glyph (11.55:1 on Shadow); `--ui-designer-text-value` aliases it | `--palette-neutral-gray4` `#cfcdd4` | ui2 `neutral.gray4` | match |
| Neutrals/Silver | `#A09BA8` | Figma Neutrals/Silver (ui2 `neutral.gray3`): the camera button's icon stroke (4.59:1 on Onix); `--ui-designer-text-muted` aliases it | `--palette-neutral-gray3` `#a09ba8`, `--neutral-grey-3` `#a09ba8` | `--dcl-silver` `#a09ba8`, `--clear-divider` `#a09ba8` · ui2 `neutral.gray3` | match |
| Neutrals/Cloudy Sky | `#716B7C` | Figma Neutrals/Cloudy Sky (ui2 `neutral.gray2`): the `RangeField` track; `--ui-designer-glyph` aliases it | `--palette-neutral-gray2` `#716b7c` | `--dropdown` `#716b7c` · ui2 `neutral.gray2` | match |
| Neutrals/Graffito | `#5E5B67` | The Switch Off track | PROPOSED `--palette-neutral-gray1` | `--light-gray` `#5e5b67` · ui2 `neutral.gray1` | missing in inspector |
| Neutrals/Pale Black | `#43404A` | Control fill, the icon boards | `--gray-0` `#43404a` | `--dark-gray` `#43404a` · ui2 `neutral.gray0` | match |
| Onix (swatch) | `#35333B` | Figma Neutrals/Onyx: field and control chrome, UI Designer menus (`--ui-designer-control-bg`), and the 1px border of an unselected UI Designer tab toggle, at rest, on hover and disabled (1.27:1 against the panel: an edge, not the state cue) | `--palette-neutral-onyx` `#35333b`, `--ui-designer-control-bg` `#35333b` | — | match in inspector; missing in Creator Hub |
| Onix Dark 1 (swatch) | `#2D2A33` | Title-bar button, the 2D viewport fill, `InputAction` rest, the AI `ChatInput` container | PROPOSED `--palette-neutral-onyxDark1` | `--title-bar-button` `#2d2a33` | missing in inspector |
| Charcoal (swatch) | `#25212A` | Panel frame | `--ui-designer-panel-bg` → `--base-19` `#242129` | `--card`, `--modal`, `--secondary`, `--darker-gray` `#242129` · ui2 `neutral.softBlack2` `#242129` | **✱ deviation**: both worlds follow ui2's `#242129`, 1/255 from Figma; keep |
| Neutrals/Shadow | `#161518` | Tree and page surface | `--base-20` `#161518`, `--tree-bg-color` | `--black` `#161518`, `--bg` and `--background` `#161518` · ui2 `neutral.softBlack1` | match in inspector; `--bg` ships in #1703, `--background` ships in #1703 |
| Neutrals/Black | `#000000` | — | `--black` `#000000`, `--base-21` | `--bg-inspector` `#000` · ui2 `neutral.black` | match |
| — | `#676370` | Secondary text and lines in Creator Hub | `--neutral-grey-4` `#676370` | `--secondary-text`, `--text-area-border`, `--popup` `#676370`, and the `#676370xx` alpha family (`--divider`, `--secondary-on-modal`, `--card-on-modal`) | **not in Figma**; nearest is Graffito `#5E5B67` |

Figma's Neutrals swatches name `#35333b` **Onix** and `#25212a` **Charcoal**. The `vars.css` comment above `--built-in-badge-*` calls `#35333b` Charcoal; read Onix.

The inspector's `--base-02 … --base-18` and `--accent-blue-*` ramps are VS Code's, not Figma's; they predate the design system and are kept for the embedded-webview theme ([Inspector role tokens](#inspector-role-tokens)).

#### Transparencies

Figma names four steps per base colour, Backdrop 60% · Blurry 40% · Soft 20% · Subtle 10%, plus the component-level `Transparencies/White 10`, `White 20` and `Black 10`. The alpha is not in the variable value (the variable returns the opaque hex), so take it from the swatch. Every swatch has a radius of 8px and a 1px White 40 border around the chequered preview.

| Figma variable | Value | Use | `vars.css` | `theme.css` / ui2 | Status |
| --- | --- | --- | --- | --- | --- |
| Transparency (White)/Subtle · White 10 | `rgba(255,255,255,.1)` | Figma White Subtle · White 10: checkbox hover halo; `Button` Secondary fill (contained + secondary) and its pressed state; `--ui-designer-control-border` aliases it (ui2 theme-path name). `--ui-designer-control-selected-bg` holds the same value: the hover and selected fill on a menu **row** | `--palette-whiteTransparent-subtle` `rgba(255,255,255,.1)`, `--ui-designer-control-selected-bg` `rgba(255,255,255,.1)` | ui2 `whiteTransparent.subtle` | match in inspector; missing in `theme.css` |
| Transparency (White)/Soft · White 20 | `rgba(255,255,255,.2)` | Figma White Soft · White 20: disabled checkbox and large-field border; `Button` Secondary hover and `.active`; `--ui-designer-control-border-strong` aliases it (ui2 theme-path name) | `--palette-whiteTransparent-soft` `rgba(255,255,255,.2)` | ui2 `whiteTransparent.soft` | match in inspector; missing in `theme.css` |
| Transparency (White)/Blurry · White 40 | `rgba(255,255,255,.4)` | Figma White Blurry · White 40: checkbox and large-field border; `Button variant="outlined"` outline; `--ui-designer-checkbox-border` aliases it (ui2 theme-path name) | `--palette-whiteTransparent-blurry` `rgba(255,255,255,.4)` | ui2 `whiteTransparent.blurry` | match in inspector; missing in `theme.css` |
| Transparency (White)/Backdrop · White 60 | `rgba(255,255,255,.6)` | Figma White Backdrop · White 60: large-field hover and filled border; `outlined` pressed outline and `text` pressed label (ui2 theme-path name) | `--palette-whiteTransparent-backdrop` `rgba(255,255,255,.6)` | ui2 `whiteTransparent.backdrop` | match in inspector; missing in `theme.css` |
| Transparency (Black)/Subtle · Black 10 | `rgba(0,0,0,.1)` | The light-swatch border on the Colors page | PROPOSED `--palette-blackTransparent-subtle` | ui2 `blackTransparent.subtle` | missing (no consumer) |
| Transparency (Black)/Soft · Black 20 | `rgba(0,0,0,.2)` | The Background overlay, the modal and Settings title bars, react-contexify separators | `--contexify-separator-color` `rgba(0,0,0,.2)`; PROPOSED `--palette-blackTransparent-soft` for the overlay role | ui2 `blackTransparent.soft` | match in value; the role name is missing |
| Transparency (Black)/Blurry · Black 40 | `rgba(0,0,0,.4)` | Figma Black Blurry · Black 40: the thin menu scrollbar's thumb fill, on the react-contexify submenu and the `Dropdown` `OptionList` (user, October 26, 2026). 1.32:1 on Onix and 1.48:1 on `--gray-0` on its own; the White 60 thumb outline carries it | `--palette-blackTransparent-blurry` `rgba(0,0,0,.4)` | ui2 `blackTransparent.blurry` | match in inspector; missing in `theme.css` |
| Transparency (Black)/Backdrop · Black 60 | `rgba(0,0,0,.6)` | Modal overlay | `--modal-overlay-bg-color` `rgba(0,0,0,.6)` | ui2 `blackTransparent.backdrop` | match |
| Transparency (White)/Transparent | empty variable | — | `--transparent` `transparent` | — | Figma defect: the variable has no value |
| — | `rgba(255,255,255,.05)` | Figma's unnamed `#FFFFFF` 5% (no Figma variable; ui2's `whiteTransparent` stops at `subtle`): the AccordionEntry hover fill, and its `:focus-visible` fill under the Snow ring (user, October 26, 2026). 1.16:1 against the `#242129` panel on its own, so it never carries a state alone: hover doesn't need to, and focus adds the ring | `--palette-whiteTransparent-faint` `rgba(255,255,255,.05)` | `--transparent-gray-dark` `rgba(255,255,255,.05)` | not a Figma step; user decision |
| — | `rgba(255,255,255,.08)` | The MobileHUD `InputAction` texture-input fill | PROPOSED `--palette-whiteTransparent-hint` | — | missing (or White 10, if design confirms a typo) |
| — | `rgba(255,255,255,.15)` | Card hover | PROPOSED `--palette-whiteTransparent-hover` | — | missing |
| — | `.05` / `.07` white | Placeholder or unbound field fill; subtle dividers | `--ui-designer-control-empty-bg` `rgba(255,255,255,.05)`, `--ui-designer-hairline` `rgba(255,255,255,.07)` | — | not Figma steps; **✱ deviation**, keep (solved for contrast, see the accent note) |
| — | `.23` white · `#ffffffb2` (70%) · `#000000dd` (87%) | Creator Hub only | — | `--transparent-gray-light`, `--text-on-secondary`, `--dimmer` | not Figma steps |

#### System status (success, warning, error)

ui2's dark theme carries Figma's System ramp verbatim (`palette.success` / `.warning` / `.error`, each with `main`, `dark` = Dark 1, `light` = Light 1), so Creator Hub reads status colours from the theme. The inspector's status tokens take the same values in #1703. The error role is System/Red `#FB3B3B`; `DCL/Red` `#FF0000` is a legacy variable, not the error role.

| Figma variable | Value | Use | `vars.css` | `theme.css` / ui2 | Status |
| --- | --- | --- | --- | --- | --- |
| System/Green | `#34CE77` | Success | `--success-main` `#34ce77` | `--success` `#34ce77` · ui2 `palette.success.main` | `--success-main` ships in #1703; match in Creator Hub |
| System/Green Dark 1 | `#00B453` | Status shade (no consumers yet) | `--success-dark` `#00b453` | ui2 `palette.success.dark` | ships in #1703 |
| System/Green Light 1 | `#65D890` | Status shade (no consumers yet) | `--success-light` `#65d890` | ui2 `palette.success.light` | ships in #1703 |
| System/Green Dark 2 | `#00A146` | — | PROPOSED `--palette-success-dark2` | ui2 alert success background `rgba(0,161,70,.24)` | missing |
| System/Green Light 2 | `#C1EECF` | — | PROPOSED `--palette-success-light2` | ui2 light-scheme alert | missing |
| System/Orange | `#FE9C2A` | Warning | `--warning-main` `#fe9c2a` | `--danger` `#fe9c2a` · ui2 `palette.warning.main` | ships in #1703 (both) |
| System/Orange Dark 1 | `#F38025` | Warning shade (no consumers yet) | `--warning-dark` `#f38025` | ui2 `palette.warning.dark` | ships in #1703 |
| System/Orange Light 1 | `#FFB95B` | — | PROPOSED `--palette-warning-light` | ui2 `palette.warning.light` | missing in inspector |
| System/Orange Dark 2 | `#EC7122` | — | PROPOSED `--palette-warning-dark2` | ui2 alert warning background `rgba(236,113,34,.24)` | missing |
| System/Orange Light 2 | `#FFCD88` | — | PROPOSED `--palette-warning-light2` | ui2 alert warning text | missing |
| System/Red | `#FB3B3B` | Error | `--error-main` `#fb3b3b` | `--error` `#fb3b3b` · ui2 `palette.error.main` | ships in #1703 (both) |
| System/Red Dark 1 | `#EC303A` | Error shade (no consumers yet) | `--error-dark` `#ec303a` | ui2 `palette.error.dark` | ships in #1703 |
| System/Red Light 1 | `#E97177` | The hover and focus border of an errored field, and the 10–13px error text | `--error-light` `#e97177` | ui2 `palette.error.light` | ships in #1703 |
| System/Red Dark 2 | `#CC1D2C` | — | PROPOSED `--palette-error-dark2` | ui2 alert error background `rgba(204,29,44,.24)` | missing |
| System/Red Light 2 | `#FFCDD4` | — | PROPOSED `--palette-error-light2` | — | missing |
| `DCL/Red` (legacy) | `#FF0000` | Not the error role | — | — | legacy variable |

Contrast of the status text and icon colours at these values, on the surfaces they sit on: `#161518` inspector page, `#242129` card, modal and UI Designer panel, `#35333b` Onix.

| Token            | on `#161518` | on `#242129` | on `#35333b` |
| ---------------- | ------------ | ------------ | ------------ |
| `--error-main`   | 5.02         | 4.37         | 3.43         |
| `--error-light`  | 6.14         | 5.36         | 4.20         |
| `--warning-main` | 8.66         | 7.55         | 5.93         |

`--error-main` text on `#242129` (the `CallbackField` add-name error, 11px, and the `CreateScriptModal` error, 12px) is 4.37:1, under 4.5:1 (use `--error-light` there if it is fixed). As a border (`TextField`, `TextArea`, `Dropdown`, `CheckboxField`, the callback textarea) every value clears 3:1.

#### INFO (blues; swatch fills, no variables)

| Figma name | Value | Use | `vars.css` | `theme.css` / ui2 | Status |
| --- | --- | --- | --- | --- | --- |
| Blue | `#2196F3` | The pinned edge in `ConstraintsIcons` | PROPOSED `--palette-info-main` | ui2 `palette.info.main` | missing in inspector |
| Blue Dark 1 | `#1A75D2` | — | PROPOSED `--palette-info-dark1` | ui2 `palette.info.dark` `#1A75D2` | missing in inspector; the fill is the value (Figma's label reads `#1F87E5`) |
| Blue Dark 2 | `#244B7D` | Figma System/Blue Dark 2: the text-selection highlight of every `input` and `textarea`, under Snow text (8.61:1); the selected toggle fill through `--ui-designer-control-active-bg` | `--palette-system-blueDark2` `#244b7d` | `--ai-session-selected` `#244b7d` | match on the fill (Figma's label reads `#1764C0`) |
| Blue Dark 3 | `#243852` | Figma System/Blue Dark 3: the fill of a selected toggle under the pointer (Snow glyph 11.61:1). Darker than Blue Dark 2 on purpose, as Figma draws it | `--palette-system-blueDark3` `#243852` | `--ai-session-selected-hover` `#243852` | match |
| System/Blue Light 1 | `#63B4F6` | Figma System/Blue Light 1 (ui2 dark `palette.info.light`, `#63B4F6`): the shared `Tree`'s drop target, a 1px inset outline for inside and a 2px line for before / after, in all four trees (user, October 27, 2026; NodeTypeHierarchy ✱ drop target). 7.09:1 on the panel `#242129`, 8.13:1 on the tree `#161518`, 5.33:1 on Blue Dark 3. Same value as `--ui-designer-control-accent`, which stays the UI Designer's panel accent (ui2 theme-path name) | `--palette-info-light` `#63b4f6`, `--ui-designer-control-accent` `#63b4f6`, `--built-in-badge-bg-color` `#63b4f6` | ui2 `palette.info.light` | match |
| Blue Light 2 | `#BBDEFB` | — | PROPOSED `--palette-info-light2` | ui2 alert info text | missing |
| — | `#214272` / `#2E4A7A` | AI selection | — | `--ai-selected` `#214272` / `--ai-selected-hover` `#2e4a7a` | not in Figma |
| — | `#127FD4` | VS Code focus blue | `--border-focused` `#127fd4` | — | not in Figma; **✱ deviation**, keep |

#### Brand

| Figma variable | Value | Use | `vars.css` | `theme.css` / ui2 | Status |
| --- | --- | --- | --- | --- | --- |
| Brand/Yellow | `#FFC95B` | — | `--yellow` `#ffc95b` (no consumer) | ui2 `brand.yellow` `#FFBC5B` | match in inspector; ui2 drifts (upstream) |
| Brand/Melon | `#FFA25A` | — | `--melon` `#ffa25a` | ui2 `brand.melon` | match |
| Brand/Orange | `#FF7439` | Brand orange | `--secondary-main` `#ff7439` | ui2 `brand.orange` | match |
| Brand/Ruby | `#FF2D55` | Brand pink | `--primary-main` `#ff2d55` | `--primary` `#ff2d55` · ui2 `brand.ruby` | match |
| Brand/Lavender | `#C640CD` | The smart-item disc | `--lavender` `#c640cd`, `--smart-item-icon-bg-color` `#c640cd` | ui2 `brand.lavander` | match |
| Brand/Violet | `#A524B3` | — | `--violet` `#a524b3` | ui2 `brand.voilet` | match |
| Brand/Purple | `#691FA9` | — | `--purple` `#691fa9` | `--purple-banner` `#691fa9` (no consumer) · ui2 `brand.purpel` | match in inspector; `--purple-banner` ships in #1703 |

#### Rarities

Base values come from the `Rarities/*` variables; Common Light and Exotic Light from `DCL/Rarities/*`. No rarity colour has a consumer in either world, and the rarity names are the user's call.

| Figma variable | Value | Use | `vars.css` | `theme.css` / ui2 | Status |
| --- | --- | --- | --- | --- | --- |
| Rarities/Common | `#73D3D3` | — | PROPOSED `--palette-rarity-common` | ui2 `colors.rarity` `#73D3D3` | missing |
| DCL/Rarities/Common Light | `#ACF8F8` | — | PROPOSED `--palette-rarity-common-light` | ui2 `rarityLight` `#D2F9F9` | missing; ui2 drifts |
| Rarities/Uncommon | `#FF8362` | — | PROPOSED `--palette-rarity-uncommon` | ui2 `#FF8362` | missing |
| Rarities/Uncommon Light | `#FFE0B2` | — | PROPOSED `--palette-rarity-uncommon-light` | ui2 `#F9E4DF` | missing; ui2 drifts |
| Rarities/Rare | `#34CE76` | — | PROPOSED `--palette-rarity-rare` | ui2 `#34CE76` | missing |
| Rarities/Rare Light | `#73FFAF` | — | PROPOSED `--palette-rarity-rare-light` | ui2 `#C1F2D6` | missing; ui2 drifts |
| Rarities/Epic | `#438FFF` | — | PROPOSED `--palette-rarity-epic` | ui2 `#438FFF` | missing |
| Rarities/Epic Light | `#81E1FF` | — | PROPOSED `--palette-rarity-epic-light` | ui2 `#C0D3EF` | missing; ui2 drifts |
| Rarities/Legendary | `#A14BF3` | — | PROPOSED `--palette-rarity-legendary` | ui2 `#A14BF3` | missing |
| Rarities/Legendary Light | `#E8B9FF` | — | PROPOSED `--palette-rarity-legendary-light` | ui2 `#E1C1FF` | missing; ui2 drifts |
| Rarities/Mythic | `#FF4BED` | The Settings glow (an asset) | PROPOSED `--palette-rarity-mythic` | ui2 `#FF4BED` | missing |
| Rarities/Mythic Light | `#F6C1FF` | — | PROPOSED `--palette-rarity-mythic-light` | ui2 `#FDC4F7` | missing; ui2 drifts |
| Rarities/Exotic | `#CAFF73` | — | PROPOSED `--palette-rarity-exotic` | not in ui2 | missing |
| DCL/Rarities/Exotic Light | `#E4FFB8` | — | PROPOSED `--palette-rarity-exotic-light` | not in ui2 | missing |
| Rarities/Unique | `#FEA217` | — | PROPOSED `--palette-rarity-unique` | ui2 `#FEA217` | missing |
| Rarities/Unique Light | `#FFF280` | — | PROPOSED `--palette-rarity-unique-light` | ui2 `#F3E5CF` | missing; ui2 drifts |

#### Gradients

The three gradients are image fills: their variables carry no stops, so the ends below are sampled from the exported swatch. Both axes change, consistent with 135°.

| Figma variable | Value | Use | `vars.css` | `theme.css` / ui2 | Status |
| --- | --- | --- | --- | --- | --- |
| Brand/Flare (Ruby to Yellow) | `#FE2D55` → `#FEBC59` | — | PROPOSED `--gradient-flare` | ui2 `gradient.flare` `linear-gradient(135deg, #FF2D55 0%, #FFBC5B 100%)` | missing; the drawn end matches ui2's `#FFBC5B`, not Brand/Yellow `#FFC95B` |
| Brand/Cerise (Ruby to Lavender) | `#FE2D55` → `#C640CD` | — | PROPOSED `--gradient-cerise` | ui2 `gradient.cerise` 135° | missing |
| Brand/Amin (Lavender to Purple) | `#C640CD` → `#691FA9` | — | PROPOSED `--gradient-amin` | ui2 `gradient.amin` 135° | missing |
| — | `#060d2b` → `#132d7d` 52% → `#9763c1` | — | — | `--metaverse-gradient` | not in Figma |

Everything in `vars.css` that these tables and [Inspector role tokens](#inspector-role-tokens) don't list is VS Code-derived (`--vscode-*` passthroughs, `--dropdown-*`, `--list-item-*`) or a Smart Item colour (`--list-smart-item-*`, `--ground-icon-bg-color`) with no Figma counterpart. Value changes and new tokens arising from these tables go to the user first (names are theirs), ship with before/after screenshots of every consumer, and land in the same commit as their row here.

### ⚠️ The neutral ramp runs LIGHT → DARK

`--base-01 … --base-21` go **light to dark**:

```
--base-01 #ffffff   (lightest)
--base-02 #f0f0f0
--base-06 #ccc
--base-10 #808080
--base-12 #606060
--base-20 #161518
--base-21 #000       (darkest)
```

**Low indices are LIGHT.** This is the #1 source of "dark fallback that renders light" bugs: a rule like `background: var(--base-02, #1e1e22)` looks dark (the `#1e1e22` fallback is a decoy) but actually renders near-white, because `--base-02` resolves to `#f0f0f0`. Read the token's real value, not the fallback.

#### Correct dark-surface pairing (dropdowns, popovers, suggestion lists)

```css
.some-dark-surface {
  background: var(--ui-designer-control-bg); /* the raised UI Designer menu surface */
  border: 1px solid var(--ui-designer-control-border);
  color: var(--ui-designer-text); /* explicit light fg, NOT inherit */
}
.some-dark-surface .row:hover,
.some-dark-surface .row[aria-selected='true'] {
  background: var(--ui-designer-control-accent-21); /* panel surface → blue */
}
.some-dark-surface :focus-visible {
  outline: 2px solid var(--border-focused);
  outline-offset: -1px;
}
```

`VariablePicker.css` is the canonical example.

### Inspector role tokens

Inspector tokens that name a role rather than a Figma variable: surfaces, foregrounds, the focus ring, the `--ui-designer-*` family, and the `--base-*` and `--accent-blue-*` ramps. Where one aliases a Figma colour, the Figma equivalent says which.

| Token | Value | Figma equivalent | Use |
| --- | --- | --- | --- |
| `--main-bg-color` | `--vscode-editor-background` → `--background` | — | App/editor background |
| `--tree-bg-color` | `--base-20` `#161518` | Neutrals/Shadow | Panels, trees, **dropdown/popover surfaces** |
| `--modal-content-bg-color` | `--tree-bg-color` | Modal shell `#181225` (a raw fill, no variable): drift → `#181225` (pending spoke), or PROPOSED `--modal-surface` | Modals |
| `--ui-designer-panel-bg` | `--base-19` `#242129` | Charcoal `#25212a` (**✱ deviation**, within 1/255) | UI Designer panel frame |
| `--ui-designer-control-bg` | `#35333b` | Neutrals/Onix | Inputs/selects/textarea chrome, and UI Designer menus |
| `--disabled-bg-color` | `#323036` | — | Disabled control fill |
| `--title` | `#eeeeef` | — | Primary text **on dark surfaces** |
| `--sub-text` | `#ffffffcf` | — | Secondary text on dark |
| `--text-primary` | `#000000de` | — | Text **on light surfaces** |
| `--ui-designer-text` | `--palette-neutral-softWhite` `#fcfcfc` | Neutrals/Snow | Labels, group titles |
| `--ui-designer-text-value` | `--palette-neutral-gray4` `#cfcdd4` | Neutrals/Gray | The value inside a field |
| `--ui-designer-text-muted` | `--palette-neutral-gray3` `#a09ba8` | Neutrals/Silver | Hints, secondary |
| `--ui-designer-glyph` | `--palette-neutral-gray2` `#716b7c` | Neutrals/Cloudy Sky | Glyphs on the frame |
| `--ui-designer-glyph-on-control` | `--ui-designer-text-muted` | Neutrals/Silver | Glyphs on a field fill — see the contrast note in `vars.css` |
| `--ui-designer-control-border` | `--palette-whiteTransparent-subtle` `rgba(255,255,255,.1)` | White 10 | Control borders |
| `--ui-designer-control-border-strong` | `--palette-whiteTransparent-soft` `rgba(255,255,255,.2)` | White 20 | Strong control borders |
| `--ui-designer-checkbox-border` | `--palette-whiteTransparent-blurry` `rgba(255,255,255,.4)` | White 40 | Checkbox border |
| `--ui-designer-hairline` | `rgba(255,255,255,.07)` | not a Figma step (**✱ deviation**) | Subtle dividers |
| `--ui-designer-control-empty-bg` | `rgba(255,255,255,.05)` | not a Figma step (**✱ deviation**) | Placeholder or unbound field fill |
| `--focus-ring` | `--ui-designer-text` `#fcfcfc` (Snow) | Neutrals/Snow | Keyboard focus on the shared controls: the `:focus-visible` ring of `Button`, the `Dropdown` trigger, `CheckboxField`, `ModeSwitcher` and the `RangeField` thumb, and the focus border of `TextField` and `TextArea`. 17.73:1 on `#161518`, 15.45 on `#242129`, 12.13 on Onix, 9.88 on `--gray-0`. A ring on a light surface takes `--text-primary` instead: the `Pill` remove button sits on the `--base-02` `#f0f0f0` pill, where Snow is 1.11:1 and `--text-primary` about 15:1. That ring draws inside the 11px button (`outline-offset: -2px`), because any outer offset covers the end of the pill's label. UI Designer panels keep `--ui-designer-control-accent` |
| `--menu-shadow` | `0 4px 8px rgba(0,0,0,.4)` | Menu `20749:386` drop shadow (0 / 4 / 8, Black 40, no Figma variable) | Every menu surface — react-contexify through `--contexify-menu-shadow`, the `Dropdown` `OptionList`, `MoreOptionsMenu`, and the snap card after #1714 (G30) |
| `--border-focused` | `#127fd4` | not in Figma (VS Code blue; **✱ deviation**) | `Tree` drop indicators and older UI Designer rules. Not a focus ring: 2.97:1 on Onix, 2.42 on `--gray-0`. The `Tree` drop indicators move to `--palette-info-light` in layer 3b unit 3 (NodeTypeHierarchy, ✱ drop target); `--border-focused` keeps its value for its other consumers (`Tile.css`, `--vscode-blue`) |
| `--ui-designer-accent` | `rgb(80,200,255)` | none (**✱ deviation**: the canvas cyan, see the accent note) | **Canvas** selection cyan |
| `--ui-designer-accent-80/-40/-12/-08/-05` | cyan @ .8/.4/.12/.08/.05 | none | Canvas hover/selection fills, drop targets |
| `--ui-designer-control-accent` | `#63b4f6` | System/Blue Light 1 | **Panel** focus rings, the Anchor pin, bind affordances, selected rows |
| `--ui-designer-control-accent-62/-21/-15` | blue @ .62/.21/.15 | none (solved for contrast) | Panel hover borders and fills |
| `--ui-designer-control-selected-bg` | `rgba(255,255,255,.1)` | White 10 | Hover/selected fill on a menu **row** |
| `--ui-designer-control-active-bg` | `#244b7d` (→ `--palette-system-blueDark2`) | Blue Dark 2 | Fill of a selected/active **toggle**; ships in #1707 |
| `--ui-designer-control-active-fg` | `#fcfcfc` (→ `--ui-designer-text`, Snow) | Neutrals/Snow | Glyph on that fill: 8.61:1; ships in #1707 |
| `--base-01` | `#ffffff` | Neutrals/White | Lightest step |
| `--base-02` | `#f0f0f0` | — | VS Code ramp; the `Pill` fill |
| `--base-03` | `#e7e7e7` | — | VS Code ramp |
| `--base-04` | `#e5e5e5` | — | VS Code ramp |
| `--base-05` | `#d4d4d4` | — | VS Code ramp |
| `--base-06` | `#ccc` | — | VS Code ramp |
| `--base-07` | `#c6c6c6` | — | VS Code ramp |
| `--base-08` | `#bbb` | — | VS Code ramp |
| `--base-09` | `#a0a0a0` | — | VS Code ramp |
| `--base-10` | `#808080` | — | VS Code ramp |
| `--base-11` | `#7f7f7f` | — | VS Code ramp |
| `--base-12` | `#606060` | — | VS Code ramp |
| `--base-13` | `#454545` | — | VS Code ramp |
| `--base-14` | `#3c3c3c` | — | VS Code ramp |
| `--base-15` | `#3a3d41` | — | VS Code ramp |
| `--base-16` | `#333` | — | VS Code ramp |
| `--base-17` | `#303031` | — | VS Code ramp |
| `--base-18` | `#292929` | — | VS Code ramp |
| `--base-19` | `#242129` | Charcoal `#25212a` (**✱ deviation**, 1/255) | The UI Designer panel through `--ui-designer-panel-bg` |
| `--base-20` | `#161518` | Neutrals/Shadow | Trees, panels, the inspector page |
| `--base-21` | `#000` | Neutrals/Black | Darkest step |
| `--accent-blue-01` … `--accent-blue-10` | `#75beff` … `#062f4a` | none (VS Code) | The embedded-webview theme; `--accent-blue-05` / `-07` / `-08` are also `Button color="info"`'s fill / hover / pressed, a colour with no Figma counterpart |

The UI Designer names its own three foreground steps, from the Figma's Neutrals ramp: `--ui-designer-text` (→ `--palette-neutral-softWhite` `#fcfcfc`; labels, group titles), `--ui-designer-text-value` (→ `--palette-neutral-gray4` `#cfcdd4`; the value inside a field), `--ui-designer-text-muted` (→ `--palette-neutral-gray3` `#a09ba8`; hints, secondary). Code outside the UI Designer (the 3D toolbar) uses the `--palette-neutral-*` names directly. Glyphs take `--ui-designer-glyph` (an alias of `--palette-neutral-gray2` `#716b7c`), or `--ui-designer-glyph-on-control` when they sit on a field fill instead of the frame — see the contrast note in `vars.css`.

`UIDesigner.css` repoints `--gray-0`, `--title` and `--sub-text` to those tokens **inside** `.ui-designer` / the two rails, so every shared control in the designer takes the design's surface and foreground without per-selector overrides. The 3D EntityInspector keeps the global values.

There is no single `--text` token — pick the foreground that matches the surface. **Never rely on `color: inherit` for a control on a themed surface** (that is exactly how the white-on-white callback autocomplete happened); set an explicit foreground.

#### Icon buttons and toggles

Every icon control in the UI Designer panels and canvas takes one of three rules (user decision, October 22, 2026; it overrides the `UI Editor Buttons` sets where they differ, see the ✱ deviations in those sets under [Editor](#editor)). The lock and eye take none of them: they follow their own sets as drawn (user decision, October 27, 2026), in every tree. The 2D toolbar takes the `ToolbarButton` set and the Viewport Toolbar's 2D variant instead (user decision October 23, 2026; shipped in `73a26ea5f`), so the toolbar controls the rules below name are styled by those sets.

- **Icon button** (any icon control that is not a toggle: trash, help, bind link, add, copy, the toolbar's save / undo / redo): Silver `--ui-designer-text-muted` glyph and no container at rest; on hover a Snow `--ui-designer-text` glyph on a White 10 `--palette-whiteTransparent-subtle` container, 4px radius.
- **Tab toggle** (one choice out of a set: TextAlign, Flow direction, the canvas device pair, the device-variant tabs, the interaction-state tabs, the fill-mode chips, the 2D toolbar gizmos): unselected is a Silver glyph, no fill and a 1px `--palette-neutral-onyx` border; unselected + hover is Snow on White 10 with the same Onyx border; selected is a Snow glyph on `--ui-designer-control-active-bg` (Blue Dark 2); selected + hover is Snow on `--palette-system-blueDark3`; disabled is a White 20 glyph with the Onyx border. A selected tab toggle shows no Onyx: its 1px border takes the fill colour, so the box never changes size.
- **Single toggle** (on / off: wrap, the aspect lock, the canvas HUD / safe-area toggles, the toolbar Run / Scene Info): the tab-toggle colours with no border in any state. Silver at rest, Snow on White 10 on hover, Snow on Blue Dark 2 when selected, Snow on Blue Dark 3 when selected + hover, White 20 when disabled.
- **Lock and eye** (every lock and eye: the 2D tree rows, the node-header and GUI-list eyes, the 3D trees' lock and eye and the spawn-point eye; the MobileHUD input-action eye follows InputAction, below): LockLayerToggle and VisibilityToggle as drawn. A Gray `--palette-neutral-gray4` glyph in every state; no fill at rest; a White 10 `--palette-whiteTransparent-subtle` fill with a 4px radius on hover; locked or hidden is the same Gray glyph with no fill, and the glyph's shape (closed lock, eye-off) is the only indicator, announced by `aria-pressed="true"`. Pressed + hover is White 10, as any hover. Focus is unchanged: the accent ring in the UI Designer, the 1px Snow `--focus-ring` in the 3D trees.
- **MobileHUD input-action eye:** the InputAction set as drawn, an 18 × 18 VisibilityToggle instance. Visible is a Gray eye with no fill, White 10 on hover; hidden is a System/Blue Light 1 `--palette-info-light` eye-off on a System/Blue Dark 3 `--palette-system-blueDark3` fill (5.33:1), the same on hover.
- **State hook:** the ARIA attribute (`aria-pressed`, `aria-checked` or `aria-selected`), never a class. The kind, not the attribute, decides the border.
- **Segmented group** (the tab toggles that sit joined: TextAlign, Flow direction, the canvas device pair, the device-variant tabs, the 2D toolbar gizmos): each cell draws its own 1px border and every cell after the first overlaps its neighbour by `margin-left: -1px`, so a seam is one pixel, never two. The first cell carries the group's left radii and the last its right radii, at the radius the group already had: `--ui-designer-radius-field` (6px) for alignment and flow, 4px for the canvas device pair, the device-variant tabs and the gizmos. The wrapper draws no border of its own. A selected cell (and the hovered one) sits above its neighbours (`z-index: 1`), so the shared seam shows its colour, not Onyx. The fill-mode and interaction-state chips are tab toggles that stand apart (a 2px gap): each keeps its full border and radius.
- **Focus:** one 2px `--ui-designer-control-accent` ring in every state, offset 1px on a standalone control and −2px inside a segmented cell.
- **Disabled:** WrapToggle's Blocked look for every icon control: White 20 `--palette-whiteTransparent-soft` glyph, no fill, no hover; a tab toggle keeps its Onyx border, a single toggle and an icon button draw none. No separate pressed state.
- **Hit target:** a control drawn smaller than 24px is a 24 × 24 transparent button whose Figma-size container is its `::before`. Its focus ring hugs that container (1px outside it, concentric corners), not the 24px box.

| Pairing (on `#242129`) | Contrast |
| --- | --- |
| Silver glyph at rest | **5.85:1** |
| Snow glyph on the White 10 hover container | **11.40:1** |
| Gray lock / eye glyph at rest / on the White 10 hover fill | **10.07:1** / **7.43:1** |
| Onyx tab-toggle border vs. panel | 1.27:1 (an edge; the glyph and fill carry the state) |
| Snow glyph on Blue Dark 2 / Blue Dark 3 | **8.61:1** / **11.61:1** |
| Blue Dark 2 / Blue Dark 3 fill vs. panel | 1.79:1 / 1.33:1 (the glyph colour carries the state) |
| Accent ring on panel / White 10 / Blue Dark 2 / Blue Dark 3 | 7.09 / 5.23 / **3.95** / 5.33:1 |
| White 20 disabled glyph | 1.91:1 (disabled, exempt) |

An Onix ring on a selected cell would be 1.41:1 on Blue Dark 2, so no selected-state ring override exists. The fills alone are under 3:1 against the panel, so selection is never colour-of-fill alone: the glyph turns Snow.

The checkbox tick and the indeterminate dash ignore `color`: the tick is a mask over `background-color`, the dash a solid block. Recolour them with `background-color`, never with a baked SVG fill.

#### ⚠️ Two accents, and which one you want depends on what it sits on

The UI Designer has **two** accent families. Picking the wrong one is a real bug, not a style preference:

- **Canvas → cyan.** The canvas renders the _author's own UI_ in arbitrary colours. A selection ring in a brand colour disappears the moment they use that colour themselves — and `#ff2d55` is precisely what the palette encourages. Because the backdrop is unknowable, WCAG 1.4.11's ≥3:1 cannot be verified against it; a hue authors are unlikely to pick is the mitigation. Use for node selection/hover, resize handles, drop targets, reorder indicators.
- **Panel → blue `#63b4f6`.** Panel chrome always sits on `--base-20` (`#161518`), a surface we control, so contrast is fixed and testable. Use for focus rings, active tab underlines, hover borders/fills, selected rows, and the Anchor row's pinned edge. Toggle fills are Blue Dark 2 / 3 and the bind affordance is Silver / Snow (see "Icon buttons and toggles"). It is Figma's System/Blue Light 1.

  **UI Designer panel chrome is deliberately not pink.** Its focus rings and selection take the accent blue, and its toggles the Blue Dark 2 / 3 fills. `--primary-main` belongs to CTAs and main buttons (`Button color="primary"`, the event/variable menu `ADD` confirm) and to the value marks Figma draws in Primary: the `RangeField` fill and thumb (Slider) and the MobileHUD "Main" radio. The UI Designer checkbox is not one of them. Figma draws it as the Checkbox set's `Tertiary` variant ([`21650:4611`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21650-4611)), a Snow tick on no fill, so a checked rail checkbox carries no pink. A mark that carries a value is not chrome; a ring, a row highlight or a toggle fill painted pink would compete with the one thing on screen that should read as the action.

**Do not copy alpha steps between the two families.** The panel blue's relative luminance is `0.419` against cyan's `0.502`, so the same alpha composites differently. The steps are solved for this surface and named for their true alpha (`-62`, not `-40`) so nothing lies:

| Step  | Contrast on `#161518`                               | Role                         |
| ----- | --------------------------------------------------- | ---------------------------- |
| base  | **8.13:1** — clears ≥3:1 non-text _and_ ≥4.5:1 text | Rings, active borders, icons |
| `-62` | 3.87:1 (vs 1.41:1 resting border) — clears ≥3:1     | Hover / selected borders     |
| `-21` | 1.47:1 · Snow on it 12.03:1                         | Menu / selected row fill     |
| `-15` | 1.30:1                                              | Hover fill                   |

Adding a step means solving for its contrast, not guessing an alpha.

### Typography

`--font-family` → **Inter** (system-ui fallbacks), the only family on Figma's Typography page. `--font-monospace` → **Inconsolata** (code/callback editors) has no Figma counterpart and is an intentional deviation. Use `font-variant-numeric: tabular-nums` for numeric readouts (zoom %, counters). Both worlds declare the same two font tokens, each in its own file; Creator Hub loads Inter as one variable `@font-face` (`100 900`), and ui2's `typography.js` sets only the family plus MUI's variant weights (`h1`–`h3` 600, `h4`–`h5` 500, `subtitle2` 600). No ui2 variant maps one-to-one to a Figma style, and ui2's 500 weight matches no Figma weight.

Figma's Font frame ([node `20717:328`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20717-328)) assigns weights by role:

| Role (Figma heading) | Family · weight       |
| -------------------- | --------------------- |
| Titles               | Inter Bold · 700      |
| Titles and buttons   | Inter Semi Bold · 600 |
| Descriptions         | Inter Regular · 400   |

#### Type scale

Read on October 27, 2026 from the Typography page's Size frame ([node `20717:350`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20717-350)), labelled "Perfect Fourth (1,5)". Line-height in the variables is a percentage (100) on the H styles and a ratio on Body and Overline. Caps means `text-transform: uppercase`; the variable carries no case. Neither token file declares a size, weight, line-height or letter-spacing token, so every size below is a literal in component CSS or an MUI `variant` today.

| Figma style | Size | Weight | Line-height | Letter-spacing | Case | Sample node |
| --- | --- | --- | --- | --- | --- | --- |
| Display H1 Semi (local style, no variable) | 48px | 600 | normal | 0 | — | `20762:19757` |
| Display H1 Regular (local style, no variable) | 48px | 400 | normal | 0 | — | `20762:19764` |
| `H1 Semi` | 30px | 600 | 100% | 0 | — | `20717:356` |
| `H2 Semi` | 24px | 600 | 100% | 0 | — | `20717:362` |
| `H3 Semi` | 22px | 600 | 100% | 0 | — | `20717:368` |
| `H4 Semi` | 20px | 600 | 100% | 0 | — | `20717:374` |
| `H5 Semi` | 18px | 600 | 100% | 0 | — | `20717:380` |
| `H5 Regular` | 18px | 400 | 100% | 0 | — | `20717:385` |
| `H6 Semi Caps` | 16px | 600 | 100% | 0 | uppercase | `20717:391` |
| `H6 Semi` | 16px | 600 | 100% | 0 | — | `20717:396` |
| `H6 Regular` | 16px | 400 | 100% | 0 | — | `20717:401` |
| `H7 Bold Caps` | 14px | 700 | 100% | 0 | uppercase | `20717:407` |
| `H7 Semi Caps` | 14px | 600 | 100% | 0 | uppercase | `20717:412` |
| `H7 Semi` | 14px | 600 | 100% | 0 | — | `20717:417` |
| `H7 Regular` | 14px | 400 | 100% | 0 | — | `20717:422` |
| `H8 Semi` | 12px | 600 | 100% | 0 | — | `21199:31163` |
| `H8 Regular` | 12px | 400 | 100% | 0 | — | `21199:31168` |
| `Body/Body - 14` | 14px | 400 | 1.43 | 0.17px | — | Colors frame value text |
| `Other/Overline` | 12px | 400 | 2.66 | 1px | uppercase | Colors frame headings |

`Body/Body - 14` and `Other/Overline` carry MUI-style metrics. They are MUI's default `body2` and `overline` metrics, which ui2 keeps (its `theme/typography.js` only sets the family), so Creator Hub takes them from the `Typography` variant rather than declaring them.

#### Proposed type tokens

**PROPOSED, names pending the user.** One prefix per Figma style, in both `vars.css` and `theme.css`, each with four suffixes: `-size`, `-weight`, `-line-height` and `-letter-spacing`. Case stays with the consumer (`text-transform: uppercase` on a `-caps` style).

| Proposed prefix | Figma style | Values (size / weight / line-height / letter-spacing) |
| --- | --- | --- |
| `--type-display-semi-*` | Display H1 Semi | 48px / 600 / normal / 0 |
| `--type-display-regular-*` | Display H1 Regular | 48px / 400 / normal / 0 |
| `--type-h1-semi-*` | `H1 Semi` | 30px / 600 / 100% / 0 |
| `--type-h2-semi-*` | `H2 Semi` | 24px / 600 / 100% / 0 |
| `--type-h3-semi-*` | `H3 Semi` | 22px / 600 / 100% / 0 |
| `--type-h4-semi-*` | `H4 Semi` | 20px / 600 / 100% / 0 |
| `--type-h5-semi-*` | `H5 Semi` | 18px / 600 / 100% / 0 |
| `--type-h5-regular-*` | `H5 Regular` | 18px / 400 / 100% / 0 |
| `--type-h6-semi-caps-*` | `H6 Semi Caps` | 16px / 600 / 100% / 0 |
| `--type-h6-semi-*` | `H6 Semi` | 16px / 600 / 100% / 0 |
| `--type-h6-regular-*` | `H6 Regular` | 16px / 400 / 100% / 0 |
| `--type-h7-bold-caps-*` | `H7 Bold Caps` | 14px / 700 / 100% / 0 |
| `--type-h7-semi-caps-*` | `H7 Semi Caps` | 14px / 600 / 100% / 0 |
| `--type-h7-semi-*` | `H7 Semi` | 14px / 600 / 100% / 0 |
| `--type-h7-regular-*` | `H7 Regular` | 14px / 400 / 100% / 0 |
| `--type-h8-semi-*` | `H8 Semi` | 12px / 600 / 100% / 0 |
| `--type-h8-regular-*` | `H8 Regular` | 12px / 400 / 100% / 0 |
| `--type-body14-*` | `Body/Body - 14` | 14px / 400 / 1.43 / 0.17px |
| `--type-overline-*` | `Other/Overline` | 12px / 400 / 2.66 / 1px |
| `--type-caption-size` | none (the NodeLogic descriptions and hint, Inter 400) | 10px |

### Spacing · Radius · Effects

Spacing runs on a 4px scale — use it instead of ad-hoc px: `--uid-space-1: 4px` · `2: 8px` · `3: 12px` · `4: 16px` · `5: 20px` · `6: 24px`.

| Token | Value | Use |
| --- | --- | --- |
| `--uid-space-1` … `--uid-space-6` | `4px` … `24px` | Gaps and padding on the 4px scale |
| `--controlHeight-small` | `26px` | Dense `TextField` / `Dropdown` height, the default (Figma UI Editor `Input`; ui2 theme-path name) |
| `--controlHeight-medium` | `40px` | `Button size="medium"` height (Figma TitleBar CTA, Button-Contained-Text-Icon Hug × 40; ui2 theme-path name) |
| `--controlHeight-large` | `46px` | `TextField size="large"` and `Button size="large"` height (Figma Text-Input, Button-Contained-Text; ui2 theme-path name) |
| `--borderWidth-strong` | `1.5px` | Kept as the ui2 theme-path name; unused, because Chromium floors a fractional border width — large fields draw 1.5px as a 1px border plus `box-shadow: inset 0 0 0 0.5px`, and `Button variant="outlined"` draws it as `box-shadow: inset 0 0 0 1.5px` with no border, so the outline takes no box |
| `--sidebar` | `314px` | Sidebar width |

Give interactive controls a consistent height so rows align: fields take `--controlHeight-small` (dense, the default) or `--controlHeight-large` (forms). Interactive hit targets should be ≥24px.

Every corner radius Figma draws, with its token:

| Radius | Where Figma draws it | Token | Status |
| --- | --- | --- | --- |
| 4px | Icon-button hover container, lock and eye hover fill, `ToolbarButton` cells, the small `Button` | — (literal) | the small `Button` hardcodes it |
| 6px | Dense field, dropdown and textarea corners | `--shape-borderRadius` `6px` (aliased by `--ui-designer-radius-field`) · Creator Hub `--mui-shape-borderRadius` `6px` | match (ui2 theme-path name) |
| 8px | Colour swatches, list rows, the Toast tooltip of rounded-button-contained | PROPOSED `--shape-borderRadiusMedium` | missing |
| 10px | The Toast tooltip of IconContainedToggle and TextureContainedRoundedButton | — | Figma defect: the three Toast tooltips disagree |
| 12px | Large field, `.Button.medium` and `.Button.large` corners, option lists and popovers, the LabelAccordion frame | `--shape-borderRadiusLarge` `12px` (aliased by `--ui-designer-radius-menu`) | match (ui2 theme-path name) |
| 16px | Cards | PROPOSED `--shape-borderRadiusXLarge` | missing |
| 24px | Modals | PROPOSED `--shape-borderRadiusXXLarge` | missing |
| 64px | The icon boards and the Typography sheet (page chrome) | — | not a component value |
| 100px | Figma's 100px pill: the thin menu scrollbar's thumb, on the react-contexify submenu and the `Dropdown` `OptionList` (user, October 26, 2026); the other pills listed under Figma values take it as they are re-themed | `--shape-borderRadiusPill` `100px` | match (ui2 theme-path name) |

Corners in the UI Designer come from two tokens, `--ui-designer-radius-field` (6px — inputs, dropdowns, segmented cells, the anchor preview) and `--ui-designer-radius-menu` (12px — option lists and popovers), which alias `--shape-borderRadius` and `--shape-borderRadiusLarge`. The shared `TextField`, `Dropdown` and `TextArea` take 6px by default, so the panel needs no radius override for them; the shared `CheckboxField` and the small `Button` still hardcode their own (5px and 4px).

Every shadow Figma draws, with its token:

| Shadow | Where Figma draws it | Token | Status |
| --- | --- | --- | --- |
| `0 4px 8px rgba(0,0,0,.4)` | Menu `20749:386`, every menu surface | `--menu-shadow` | match |
| `0 2px 3px rgba(0,0,0,.25)` | Tooltip | PROPOSED `--shadow-tooltip` | missing |
| `0 4px 4px rgba(0,0,0,.1)` | The Toast tooltip of rounded-button-contained, IconContainedToggle and TextureContainedRoundedButton | PROPOSED `--shadow-toast` | missing |
| `0 4px 10px rgba(0,0,0,.25)` | `ColourPanel` | — | missing; whether it unifies with `--menu-shadow` is a question for design |
| `2px 2px 10px rgba(0,0,0,.5)` | none (react-contexify default) | `--contexify-menu-shadow` | menus read `--menu-shadow` through it |

### Icons

Read on October 27, 2026 from the Icons page ([`20450:15495`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20450-15495)). Three frames, `General` [`20450:16492`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20450-16492), `Editor` [`20798:7431`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20798-7431) and `Component Icons` [`20798:7736`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20798-7736); each is a Pale Black board (64px radius, 2px White 10 border, padding 100, gap 50) holding one wrapping row of icon components. No token exists for an icon size or colour.

- **Grid.** A 24 × 24 frame with a 4px inset, so a general glyph has a 16px live area; editor glyphs of 12–14px sit off-centre by design; the 16 × 16 family fills its frame.
- **Colour.** Every glyph is a White filled vector (no strokes) on the dark board, so code takes `fill="currentColor"`. The skill's viewBox gotcha applies: crop each export to its 24px frame, never to the glyph bounds, or the 4px inset is lost and the icon renders ~30% larger than its neighbours.
- **Code.** Creator Hub `components/Icons` (3 custom: `AssistantIcon`, `ChevronDownIcon`, `WarningCircleIcon`) plus `@mui/icons-material` (124 distinct icons across 52 files) and `assets/images/*.svg`; inspector `components/Icons` (`Cleanup`, `CustomAsset`, `Folder`, `ListChevrons`, `Search`) plus `react-icons` (72 files; `vsc`, `io5`, `ai` sets) and per-panel `icons/` folders (Hierarchy, Toolbar/Gizmos, AssetsCatalog, SceneInspector, UIDesigner PropertyPanel). Figma names already in the repo: `Cleanup`, `Search`, `CustomItem` (inspector `CustomAsset`), `BrowseFolder` (inspector `Folder`); everything else is Material or react-icons today.

| Set | Count | Frame | Glyph | Colour | Naming | Row layout | Contrast |
| --- | --- | --- | --- | --- | --- | --- | --- |
| General | 86 — Windows, Apple, LocalAssets, FolderOpen, CustomItem, AssetPack, HidePreview, ShowPreview, Collapse/ExpandHorizontally, Synch, BrowseFolder, Cleanup, Cloud, Reload, Warning, bug, help, settings, Info, Search, Expand, Grid, magnet, player-location, zoom-out, zoom-in, keyboard, templates, Tip, podium, no-connection, Import-Download, Export-Upload, MapPin, Public, Private, Close, Likes, Create-Event, Edit, Link, LinkAlt, Cut, Copy, Paste, Duplicate, Favorite, Pin, Minus, plus, layout, layout-outline, Scenes, Kebab, ArrowUp, arrow-down, arrow-left, arrow-right, learn, code, DeleteFilled, Delete, Storage, Transfer, Code, Preview, CheckCompleted, Videos, Documents, Attach, DevWorkflow, BuildMetaverse, CodeBash, Cube, Leave, SceneStats, VariableBig, Hide, Show, Unlock, Lock, NewChat, Open, AiAgent, Optimize, CollapseVertically, ExpandVertically | 24 × 24 | 16 × 16 live area at 4 / 4 (Windows); tall glyphs reach 18 × 22 at 3 / 1 (MapPin) | Neutrals/White `#FFFFFF` → `--white` / `--white` | mixed PascalCase and kebab-case (`ArrowUp` beside `arrow-down`); `Edit` carries a `Vector (Stroke)` layer, `CollapseVertically` / `ExpandVertically` are 5-vector stacks | `Group 3163` 874 wide, wrap, gap 24 | White on `#161518` 18.19:1, on `#16141a` 18.28:1, on Pale Black 10.14:1 (≥ 3:1 non-text everywhere) |
| Editor | 68 — 47 at 24 × 24 (list-all, CameraHierarchy, Layers, search-cloud, Save, Camera, undo, redo, move, translation, rotate, scale, more-options, snap, AlignToWorld, Joystick, Edit, details, layout-small, layout-outline_small, layout-warning, flow, player, photo, hexagon, hexagons, custom-item-outline, VariableSmall, pain, paint-outline, smart, smat-outline, Checkmark, play, stop, pause, kebab-small, hide, show, link, tag, list-bullets, Desktop, Mobile, SafeArea, AudioOn, AudioOff) and 21 at 16 × 16 (NodeType/Container, Image, Button, Label, Input, Dropdown, Prefab, GUIRoot, Desktop, Mobile, FullScreen; Fill/Paint, Image, Video, Avatar, None; AssetsFilters All, Models, Avatar Animations, Images, Others) | 24 × 24 / 16 × 16 | 12–14px glyphs off-centre by design (list-all `menu` 12 × 13.22 at 6 / 5.39; redo 10 × 9.38 at 7 / 7.31); the 16 × 16 family fills its frame | Neutrals/White; `layout-warning` in System/Orange `#FE9C2A` | kebab-case verbs, PascalCase nouns | `Frame 3163` 831 wide, wrap, gap 10 | as General |
| AssetsFilters (Editor) | 5 — All `21673:55162`, Models `21673:55159`, Avatar Animations `21673:55160`, Images `21673:55158`, Others `21673:55161` (set `21673:55163`) | 16 × 16 | fills its frame | Neutrals/White | PascalCase | inside `Frame 3163` | as General |
| Component Icons | 3 — smat-item (sic), Credits, JumpIn | smart-item 16 × 16, 5px radius; Credits 24 box; JumpIn 24 × 24, 8px radius | smart-item: Lavender disc under a White `Union` 8.4 × 12 (0.59 stroke); Credits: `#6141A6 → #6C84FF` coin at 80% with a white drop shadow and a `#5600FF` 50% inner shadow (an illustration); JumpIn: Vector 13.19 × 12 Snow | Lavender → `--lavender`, `--smart-item-icon-bg-color` / missing; Snow → `--ui-designer-text` / ui2 `neutral.softWhite` | product nouns | — | Lavender disc vs `#161518` 4.34:1, vs `#242129` 3.79:1 (≥ 3:1); White glyph on Lavender 4.19:1 (≥ 3:1 non-text) |

---

## Components

One section per Figma section, in the file's order, and one block per component set in page order and then set order. Each block keeps Figma's names so it stays traceable to the file. A row marked ✱ is a state Figma does not define, proposed here so implementers never invent it silently. **Standing rule (user, October 27, 2026): always follow Figma.** This is a flow to align the code to Figma: where Figma draws a value or a control, the code follows it, and no deviation from a drawn value is recommended. From layer 3b unit 3 on, a new ✱ is only for a state Figma doesn't draw at all (focus, drop, keyboard), and it takes Figma's nearest drawn value. Contrast is WCAG against the real surface it renders on: inspector `#161518`, Creator Hub `#16141a` page / `#242129` card. "Code" names the component that renders the role today; "none" is absence, not removal.

### Figma names → code names

| Figma name | Code name | Where it appears |
| --- | --- | --- |
| `Terciary` (Button-Contained-Text, Button-Contained-Text-Icon, TitleBar CTAs) | `Button variant="outlined" color="secondary"` | Button-Contained-Text, Button-Contained-Text-Icon, TitleBar. `Button` has a shape axis (`variant`) and `CheckboxField` does not, so Figma's one word has two code spellings (gap G27) |
| `Tertiary` (the Checkbox set's `Type`) | `CheckboxField color="tertiary"` | Checkbox |
| `Primary`, `Secondary` (Button-Contained-Text / -Icon) | `Button variant="contained"` + `color="primary"` / `color="secondary"` | Button-Contained-Text, Button-Contained-Text-Icon. `Button`'s TypeScript defaults are MUI's (`text` / `primary` / `medium`), so every call site writes `variant`, `color` and `size` |
| Attach Hug × 30 / TitleBar CTA Hug × 40 / Hug 46 | `Button size="small"` / `"medium"` / `"large"` | ReportBug Attach, TitleBar, Button-Contained-Text |
| `Checkbox` `21650:4611`, `Type` = `Primary` / `Secondary` / `Tertiary` | `CheckboxField` `color` `primary` (default), `secondary`, `tertiary` | Checkbox |
| `Quaternary` | not implemented until a caller exists (the Figma spec below is kept) | Button-Contained-Text-Icon |
| `Idle` / `idle` | `default` | TabVertical, the Main Navigation `Profile-Button` |
| `Hover` (boolean) × `Status` (`Default` / `Selected`) | `hover` × `default` / `selected` | PillIconText |
| `Blocked`, `PrimaryBlocked`, `SingleBlocked`, `IconBlocked` | `disabled` (`PrimaryBlocked` → `Button color="primary"` + `disabled`) | rounded-button-contained, ButtonContainedVertical (20), Button-Contained-Text, ProfilePic, Dropdown-Input, Filter, Input, WrapToggle, BottomPanel2D |
| `En` | `end` | End (Checkbox) |
| `Hove` | `hover` | Radio |
| `OnHover`, `HoverSelected`, `SelectedHover` | `hoverSelected` | Radio, Checkbox, NodeTypeHierarchy |
| `Invisible…` (`InvisibleDefault`, `InvisibleHover`, `InvisibleSelected`, `InvisibleSelectedHover`) | `hidden`, `hiddenHover`, `hiddenSelected`, `hiddenHoverSelected` | NodeTypeHierarchy |
| `Hiden`, `HidenHover` | `hidden`, `hiddenHover` | InputAction |
| `RigthSide` | `rightSide` | Toolbar |
| `smat-item` | `smart-item` | Component Icons |
| `Property 1` | the property it varies: `variant`, `state` or `size` | every set that keeps Figma's default property name |

Specs keep Figma's names so they stay traceable to the file; component APIs use the code names.

## Tags / Labels

The Tags / Labels page sits in Figma's Tokens section but holds three small label components; it defines no token of its own. Board [`20762:20271`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20762-20271) draws only Place; Privacy and Role tag exist as sets on the page.

### Place (Tags / Labels)

Component [`20765:865`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20765-865), 1 variant. Size 92 × 18. Read October 27, 2026. Code: inspector none · Creator Hub none (place labels are inline text).

| Variant | Fill | Border | Radius | Text | Glyph | Padding / gap | Inspector token | Creator Hub token | Contrast |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Place | none | none | — | "worldname" (placeholder) · Inter 14/400/1.5 · `#A09BA8` Silver | `MapPin` 14 × 14 (`20765:861`) · Silver | height 18, gap 4, overflow clip | `--palette-neutral-gray3` / `--ui-designer-text-muted` | `--dcl-silver` · ui2 `neutral.gray3` | Silver on `#161518` 6.71:1, on `#16141a` 6.74:1, on `#242129` 5.85:1 |

### Privacy (Tags / Labels)

Set [`20757:431`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20757-431), 2 variants (Public `20757:432`, Private `20757:435`). Size 111 × 98. Read October 27, 2026. Code: inspector none · Creator Hub none (privacy labels are inline text).

| Variant | Fill | Border | Radius | Text | Glyph | Padding / gap | Inspector token | Creator Hub token | Contrast |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Public | none | none | — | "Public" · Inter 14/400/1.5 (text-box-trim both) · `#A09BA8` Silver | `Public` 14 × 14 (`20760:19365`) · Silver | height 18, gap 4, overflow clip | `--palette-neutral-gray3` / `--ui-designer-text-muted` | `--dcl-silver` · ui2 `neutral.gray3` | as Place |
| Private | none | none | — | "Private" · same · Silver | `Private` 14 × 14 (`20760:19368`) · Silver | height 18, gap 4, padding 5 / 0 | same | same | as Place |

### Role tag (Tags / Labels)

Set [`21455:39415`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21455-39415), 3 variants (Collaborator `21455:39416`, Tenat `21455:39418`, Owner `21455:39421`). Size 154 × 161. Read October 27, 2026. Code: inspector none · Creator Hub none.

A pill: 100px radius, padding 4 / 10, label `H6 Regular` (Inter 16/400/normal/0). The variant is named "Tenat" in Figma; its label reads "Tenant". A tinted fill is a translucent state of a colour token, so it is written `color-mix(in srgb, var(--token) 20%, transparent)` and needs no token of its own.

| Variant | Fill | Border | Radius | Text | Padding | Inspector token | Creator Hub token | Contrast |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Owner ("Owner") | `rgba(255,255,255,0.1)` Transparencies/White 10 | none | 100px | `H6 Regular` · `#FCFCFC` Snow | 4 / 10 | fill `--palette-whiteTransparent-subtle`; text `--ui-designer-text`; radius `--shape-borderRadiusPill` | ui2 `neutral.softWhite`, `whiteTransparent.subtle`; `theme.css` missing | Snow on the composite (`#2D2C2F` over `#161518`) 13.53:1; over `#242129` 11.40:1 |
| Tenat ("Tenant") | `rgba(254,156,42,0.2)` System/Orange at 20% | none | 100px | `H6 Regular` · `#FE9C2A` System/Orange | 4 / 10 | text `--warning-main` (ships in #1703); fill `color-mix` of `--warning-main` at 20% | `--danger` (ships in #1703) · ui2 `palette.warning.main` | `#FE9C2A` on `#44301C` (over `#161518`) 5.94:1; on `#503A29` (over `#242129`) 5.06:1 |
| Collaborator | `rgba(26,117,210,0.2)` Blue Dark 1 `#1A75D2` at 20% | none | 100px | `H6 Regular` · `#63B4F6` System/Blue Light 1 | 4 / 10 | text `--palette-info-light`; fill `color-mix` of PROPOSED `--palette-info-dark1` at 20% | ui2 `palette.info.light`; fill ui2 `palette.info.dark` at 20% | `#63B4F6` on `#17283D` (over `#161518`) 6.67:1; on `#22324B` (over `#242129`) 5.78:1 |

## Feedback

Progress, snackbars and tooltips: the Feedback pages, in Figma order.

### Feedback tokens

Every literal the Feedback pages use, mapped once; the variant tables below refer to these names.

| Literal | Figma | Inspector (`vars.css`) | Creator Hub (`theme.css` / ui2) |
| --- | --- | --- | --- |
| `#FCFCFC` text, glyphs, spinner track, progress border | Neutrals/Snow | `--ui-designer-text` | ui2 `neutral.softWhite`; `theme.css` missing |
| `#FF2D55` action text, spinner arc | Primary/Primary | `--primary-main` | `--primary`, `--dcl` · ui2 `palette.primary.main` |
| `#161518` snackbar fill | Neutrals/Shadow | `--base-20`, `--tree-bg-color` | `--black` · ui2 `neutral.softBlack1` |
| `#35333B` tooltip fill | Neutrals/Onix (a Figma variable on this page) | `--ui-designer-control-bg`, `--palette-neutral-onyx` | missing (ui2 `_components.tooltip.fill` is `#242129`, upstream) |
| `rgba(255,255,255,.1)` progress track | DCL/White10% | `--palette-whiteTransparent-subtle` (aliased by `--ui-designer-control-border`) | missing |
| Snow @ .3 spinner track | not a Figma step (ramp is 60/40/20/10); drawn inside an SVG asset | missing | missing |
| Ruby → Yellow progress fill | Brand/Flare, as an image fill | PROPOSED `--gradient-flare` | missing (`--metaverse-gradient` differs) |
| 12px radius | — | `--ui-designer-radius-menu` | missing (`--mui-shape-borderRadius` is 6px) |
| 100px pill radius | — | `--shape-borderRadiusPill` | missing |
| `0 2px 3px rgba(0,0,0,.25)` tooltip shadow | — | PROPOSED `--shadow-tooltip` (`--contexify-menu-shadow` differs) | missing |
| Inter 14 / 400 / 100% | `H7 Regular` | `--font-family` + literal size | `--font-family` + literal size or `Typography` |
| Inter 14 / 600 / 100% uppercase | `H7 Semi Caps` | `--font-family` + literal size | `--font-family` + literal size or `Typography` |

### Spinner Animation (Progress)

Set [`10394:80291`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=10394-80291), 4 variants (Default `10394:80292`, Variant2 `10394:80294`, Variant3 `10394:80296`, Variant4 `10394:80298`). Size 292 × 88; each variant 48 × 48. Read October 27, 2026. Code: inspector `components/Loading` · Creator Hub `components/Loader` / ui2 `CircularProgress`.

All four variants are keyframes of one animation: a 225° Primary arc over a Snow @ .3 full-circle track, 48 × 48, stroke 4 round-capped, rotated per variant. The arc and track are SVG assets, so their angles and stroke are not in the node tree. The Snackbar Loading variant embeds it at 24 × 24, stroke 2. The Progress board also places a fifth instance, `20506:33908` (48 × 48), and a prototype link. Code: inspector `components/Loading` (decentraland-ui `Loader`, Semantic UI's grey ring, not this arc); Creator Hub `components/Loader` and direct ui2 `CircularProgress` (MUI default, no ui2 override, 40px / 3.6 stroke).

| Variant | State | Arc start → end | Fill / stroke | Size | Inspector token | Creator Hub token | Contrast | A11y |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Default | default | 137° → 272° | arc Primary, track Snow @ .3 | 48, stroke 4 | `--primary-main`, `--ui-designer-text` | `--primary` / `--dcl`; ui2 `neutral.softWhite` | arc on `#161518` 4.99:1, on `#242129` 4.35:1 (≥ 3:1 non-text); track 2.65:1, decorative | `role="progressbar"` + `aria-label` ("Loading"), or `aria-busy` on the region |
| Variant2 | default | 201° → 336° | same | same | same | same | same | same |
| Variant3 | default | 332° → 107° | same | same | same | same | same | same |
| Variant4 | default | 78° → 213° | same | same | same | same | same | same |
| any | ✱ reduced motion | static Default keyframe | same | same | — | — | same | `prefers-reduced-motion`: no rotation |
| any | ✱ 24px | as Default | arc Primary, track Snow @ .3 | 24, stroke 2 | — | — | same | inline in a 44px row (Snackbar Loading) |

### ProgressBar (Progress)

Component [`20827:581`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20827-581), 1 variant, no states. Size 300 × 16. Read October 27, 2026. Code: inspector none · Creator Hub `OptimizeModal` renders ui2 `LinearProgress` (MUI default: 4px tall, square, `primary` fill, no border).

| Variant | State | Fill | Border | Radius | Spacing / size | Inspector token | Creator Hub token | Contrast | A11y |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ProgressBar | determinate | track White 10; bar Ruby → Yellow (Brand/Flare as a PNG image fill; placeholder width 194 of the 292 inner width, ≈ 66%) | 2px Snow | 100px pill (track and bar) | 300 × 16; padding 2 / 100 / 2 / 2 (top / right / bottom / left, the right padding sets the placeholder fill); bar 12 tall, flex-fill | track `--palette-whiteTransparent-subtle`; border `--ui-designer-text`; radius `--shape-borderRadiusPill`; fill PROPOSED `--gradient-flare` | ui2 `whiteTransparent.subtle`, `neutral.softWhite`; `theme.css` missing | border 17.73:1; bar vs track 3.81:1 at the Ruby end (≥ 3:1); track vs page 1.31:1, the border carries the edge | `role="progressbar"` with `aria-valuenow/min/max` and a visible or `aria-label` name |
| ProgressBar | ✱ indeterminate | same chrome, bar animates | same | same | same | — | — | same | `role="progressbar"` without `aria-valuenow`; honour `prefers-reduced-motion` |

### Snackbars (Snackbars)

Set [`10394:276910`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=10394-276910), 4 variants (Notification `10394:276909`, Warning `10394:276948`, Notification_Action `10394:276962`, Loading `10394:276969`). Size 442 × 276. Read October 27, 2026. Code: inspector none · Creator Hub `components/Snackbar`.

No interaction states drawn. Shared chrome: fill Shadow, 12px radius, 44 tall, padding 12 / 16 / 12 / 12 (top / right / bottom / left), 16px gap between content and action, 10px gap icon → text, no border, no shadow. Text `H7 Regular` Snow; action `H7 Semi Caps` Primary; glyphs Snow. The Snackbars board [`20450:17653`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20450-17653) places the four variants unchanged. Code: inspector none (`ui/Message` is an inline field message, not a snackbar); Creator Hub `components/Snackbar` (MUI `Snackbar` + ui2 `Alert`, MUI defaults): `styles.css` paints `--card` `#242129` and the ui2 `Paper` radius, action `--dcl` — drift from Shadow / 12px.

| Variant | State | Leading | Text | Action | Size | Inspector token | Creator Hub token | Contrast | A11y |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Notification | default | `notification_important` 18px Snow | "Notification text" | `OK` Primary | 199 × 44 | fill `--tree-bg-color`; radius `--ui-designer-radius-menu`; text `--ui-designer-text`; action `--primary-main` | fill `--black` · ui2 `neutral.softBlack1`; action `--primary`, `--dcl` | text 17.73:1; action on Shadow 4.99:1 (≥ 4.5:1); on `#242129` 4.35:1 — fails, keep the Shadow fill | `role="status"`, `aria-live="polite"`; action is a `<button>` |
| Warning | default | `warning` 18px Snow | "Warning text" | `OK` Primary | 177 × 44 | as Notification | as Notification | same | `role="alert"`; action is a `<button>` |
| Notification_Action | default | `notification_important` 18px Snow | "Action required" | `ACTION` Primary + `Close` 20px Snow, 16px gap | 265 × 44 | as Notification | as Notification | same; close glyph 17.73:1 | close `<button aria-label="Dismiss">`; 20px glyph needs a ≥ 24px hit area |
| Loading | default | Spinner 24px, stroke 2 | "Loading..." | none | 127 × 44 | as Notification | as Notification | text 17.73:1; arc 4.99:1 | `role="status"`, `aria-busy="true"` |
| any with action | ✱ hover | — | — | keep Primary, add underline; Primary Dark 1 `#F70038` is not an option | — | — | — | `#F70038` on Shadow 4.34:1, below 4.5:1 text | — |
| any with action | ✱ focus | — | — | `:focus-visible` ring `--border-focused` (inspector) / ui2 `palette.info.light` (Creator Hub), offset 2px | — | — | — | ring on `#161518`: `--border-focused` 4.34:1, `#63b4f6` 8.13:1 (≥ 3:1) | — |
| any | ✱ surface | — | — | — | — | — | — | Shadow vs Creator Hub page `#16141a` 1.00:1 and inspector `#161518` 1.00:1: the snackbar does not separate from the page it floats over | needs the tooltip's `0 2px 3px rgba(0,0,0,.25)` shadow or a `--ui-designer-hairline` border; the user picks |

### Tooltip (Tooltips)

Set [`20819:309`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20819-309), 4 variants (Top `20819:310`, Bottom `20819:314`, Right `20819:327`, Left `20819:331`). Size 111.77 × 317.54. Read October 27, 2026. Code: inspector `ui/InfoTooltip` · Creator Hub ui2 `Tooltip`.

Placement variants, no states. Shared: container fill Onix, 12px radius, padding 16 / 20, text `H7 Regular` Snow centred, `max-width: 300px`; peak a 26 × 26 Onix square, 5px radius, rotated 45° (a 36.77 box), overlapping the container by 26px so ~11px shows; drop shadow `0 2px 3px rgba(0,0,0,.25)` on the whole. The Tooltips board [`20819:272`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20819-272) repeats these values. Code: inspector `ui/InfoTooltip` (decentraland-ui `Popup`: `--gray-0` `#43404a` fill, 11px / 500 text, arrow hidden) and `Toolbar.css .CameraModeTooltip`; Creator Hub ui2 `Tooltip` (MUI default `rgba(97,97,97,.92)` fill, 11px, no ui2 override).

| Variant | State | Peak | Size (with "Text") | Inspector token | Creator Hub token | Contrast | A11y |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Top | default | below the container, centred | 69 × 59.77 | fill `--ui-designer-control-bg`; radius `--ui-designer-radius-menu`; text `--ui-designer-text`; shadow PROPOSED `--shadow-tooltip` | fill missing (ui2 `_components.tooltip.fill` `#242129`, upstream drift from Onix) | text 12.13:1; Onix vs `#161518` 1.46:1, vs `#242129` 1.27:1 — the shadow carries the edge | `role="tooltip"`, trigger `aria-describedby`; shows on hover and focus, dismisses on Escape |
| Bottom | default | above the container | 69 × 59.77 | same | same | same | same |
| Right | default | left of the container | 79.77 × 49 | same | same | same | same |
| Left | default | right of the container | 79.77 × 49 | same | same | same | same |

## Navigation

The top navigation bar and the two tab sets: the Navigation pages, in Figma order.

### Navigation tokens

Every literal the Navigation pages use, mapped once; the variant tables below refer to these names.

| Literal | Figma | Inspector (`vars.css`) | Creator Hub (`theme.css` / ui2) |
| --- | --- | --- | --- |
| `#FCFCFC` active tab label and underline, button text, logo disc | Neutrals/Snow | `--ui-designer-text` | ui2 `neutral.softWhite`; `theme.css` missing |
| `#A09BA8` resting tab label | Neutrals/Silver | `--palette-neutral-gray3` (aliased by `--ui-designer-text-muted`) | `--dcl-silver` · ui2 `neutral.gray3` |
| `#FF2D55` Create button fill, notification dot | Primary/Primary | `--primary-main` | `--primary`, `--dcl` · ui2 `palette.primary.main` |
| `rgba(255,255,255,.4)` Sign-in border | Transparencies/White 40 | `--palette-whiteTransparent-blurry` (aliased by `--ui-designer-checkbox-border`) | missing (`--transparent-gray-light` is .23) |
| `rgba(255,255,255,.1)` tab hover fill | Transparencies/White 10 | `--palette-whiteTransparent-subtle` (aliased by `--ui-designer-control-border`), `--ui-designer-control-selected-bg` (menu rows) | missing (`Navbar` paints `#ffffff0d`, White 5) |
| `rgba(255,255,255,.2)` Create split divider | Transparencies/White 20 | `--palette-whiteTransparent-soft` (aliased by `--ui-designer-control-border-strong`) | missing (`CreateButton` carries the literal) |
| `#A14BF3` avatar disc behind the placeholder snapshot | Rarities/Legendary | PROPOSED `--palette-rarity-legendary` | missing (ui2 `rarity.legendary`); a wearable-rarity colour, not a navigation token — the real avatar decides |
| 12px radius | — | `--ui-designer-radius-menu` | missing (`--mui-shape-borderRadius` is 6px; `CreateButton` and `UserMenu` carry the literal) |
| 100px pill radius (logo, avatar, dot) | — | `--shape-borderRadiusPill` | missing |
| 2px active indicator (bottom on horizontal, right on vertical) | — | literal | literal |
| Inter 20 / 600 / 100% | `H4 Semi` | `--font-family` + literal size | `--font-family` + literal size or `Typography` |
| Inter 16 / 600 / 100% uppercase | `H6 Semi Caps` | `--font-family` + literal size | `--font-family` + literal size or `Typography` |

### Main Navigation (Header)

Set [`10394:80156`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=10394-80156), 2 variants (Signed In=On `10394:80157`, Signed In=Off `10394:80166`). Size 1960 × 260; each variant 1920 × 100. Read October 27, 2026. Code: inspector none · Creator Hub `Navbar`.

No interaction states drawn on the bar itself; the tabs it embeds are the `tab-bar` set below, in TabHorizontal's resting look. Shared chrome: 1920 × 100, padding 0 / 32, `space-between`, no fill, border or shadow; left group gap 26 (logo disc, then the tab bar at gap 40); right group gap 10 (Create split button, a 37px vertical divider, the account control). Code: Creator Hub `Navbar` (`Header` + `LogoMenu` + `.menu-item` + `CreateButton` + `Header/UserMenu`); inspector none.

| Part | Variant | Fill | Border | Radius | Typography | Size / spacing | Inspector token | Creator Hub token | Contrast | A11y |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Logo disc (TextureContainedRoundedButton `21232:42112`) | both | Snow, logo asset 64 in a 44 box (SVG asset) | none | 100px | — | 40 × 40 | `--ui-designer-text`; `--shape-borderRadiusPill` | `LogoButton`; ui2 `neutral.softWhite` | disc vs `#16141a` 17.81:1 | `<button aria-label>`; `LogoButton` matches at 40px, adds a 2px white hover outline and a `--dcl` focus ring Figma does not draw |
| Tab bar | both | none | none | — | `H4 Semi`, Silver at rest | 8 tabs (HOME, SCENES, TEMPLATES, ANALYTICS, MANAGE, BADGES, LEARN, MORE), gap 40, tab padding 10 / 4 | `--palette-neutral-gray3` / `--ui-designer-text-muted` | `--dcl-silver` · ui2 `neutral.gray3` | Silver on `#16141a` 6.74:1, on `#161518` 6.71:1 | `<nav>`; `Navbar` uses gap 8 and tab padding 19 / 16 / 17 — drift |
| Create (label half, `20817:810`) | both | Primary | none | 12px, on the outer row | `H6 Semi Caps` Snow, line-height 22 | 40 tall, padding 0 / 14, gap 6, icon 18 | `--primary-main`; `--ui-designer-text` | `--primary`, `--dcl` | Snow on Primary 3.55:1 — **fails 4.5:1** (16px / 600 is not large text); Primary Dark 1 4.08:1 also fails | `<button>`; `CreateButton` matches geometry and paints hover `#F70038` as a literal |
| Create (menu half, `20817:813`) | both | Primary | 1px White 20 left | 12px, on the outer row | chevron 8.5 × 5 Snow | 40 × 40 | `--palette-whiteTransparent-soft` | missing (`CreateButton` carries the literal) | divider on Primary 1.20:1, decorative; chevron 3.55:1 (≥ 3:1 non-text) | `aria-haspopup="menu"`, `aria-expanded`, `aria-label`; `CreateButton` matches |
| Divider | both | — | 37px vertical hairline (SVG asset; its stroke colour is not in the node tree) | — | — | 0 × 37 | — | — | — | `aria-hidden`; `Navbar` has none |
| Account (TextureContainedRoundedButton `21232:42212`) | Signed In=On | Legendary `#A14BF3` under the avatar snapshot | none | 100px | — | 40 × 40 | PROPOSED `--palette-rarity-legendary` | missing; ui2 `rarity.legendary` | placeholder disc vs page 4.19:1; the real avatar decides | `<button aria-label>`; `UserMenu` renders the avatar at 44px — drift |
| Account (Button-Contained-Text `20960:6432`) | Signed In=Off | none | 1.5px White 40 | 12px | `H6 Semi Caps` Snow, "sign in" | 40 tall, padding 12 / 24 | `--palette-whiteTransparent-blurry`; `--borderWidth-strong` | missing; `--transparent-gray-light` is .23 | text 17.81:1; border 3.83:1 (≥ 3:1) | `<button>`; `UserMenu` paints 1px `--transparent-gray-light`, padding 7 / 16 — drift |
| Create, Sign in | ✱ hover / press / focus / disabled | not drawn on this page; take them from Buttons (Inputs page) when it is extracted | — | — | — | — | — | — | — | — |

### tab-bar (Header)

Set [`10394:81166`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=10394-81166), 1 variant (Default `10394:81167`). Size 1058 × 84; the bar is 1018 wide. Read October 27, 2026. Code: inspector none · Creator Hub `Navbar` (the top tab bar).

The set draws only the resting look: no selected or hover variant. Each tab is TabHorizontal's rest state; a tab is 40 tall (a 20px line plus 10 / 10 padding).

| Variant | Fill | Typography | Padding / gap | Inspector token | Creator Hub token | Contrast |
| --- | --- | --- | --- | --- | --- | --- |
| Default, 8 tabs (HOME `20723:270`, SCENES `20696:281`, TEMPLATES `20747:59482`, ANALYTICS `20713:650`, MANAGE `10394:81172`, BADGES `21810:13244`, LEARN `10394:81170`, MORE `10394:81171`) | none | `H4 Semi` (Inter 20/600/100%/0), centred, `#A09BA8` Silver | row, align start, tab gap 40; each tab a column, padding 10 / 4 (vertical / horizontal) | `--palette-neutral-gray3` / `--ui-designer-text-muted` | `--dcl-silver` · ui2 `neutral.gray3` | Silver on `#16141a` 6.74:1, on `#161518` 6.71:1 |

### TabHorizontal (Tabs)

Set [`10394:70307`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=10394-70307), 12 variants (Active × Hover × Notification × Icon; no icon `10394:70308`, `10394:70313`, `10394:70318`, `10394:70327`, `10394:70331`, `10394:70336`; icon `21670:44595`, `21670:44591`, `21670:44593`, `21670:44597`, `21670:44601`, `21670:44599`). Size 314 × 277; icon variants 78 wide. Read October 27, 2026. Code: inspector `ModeSwitcher`, `.ui-designer-right-rail-tab` · Creator Hub `Navbar .menu-item`.

The page labels Notification "UNUSED". Hover and Notification are mutually exclusive: no variant has both. Shared: Hug × 75 Fill, vertical flow, padding 10 / 4 (vertical / horizontal), label `H4 Semi` centred, no radius, no shadow. The `Icon=True` variants put a 24px `settings` glyph before the label in a row with gap 6, 78 wide. The notification badge maps to MUI `Badge variant="dot" color="primary"`. The Tabs board [`20762:19945`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20762-19945) repeats these values. Code: Creator Hub `Navbar .menu-item` (20px / 500 `#716b7c` rest, `#ffffff0d` hover, `--text` + 2px white bottom border active — drift on weight, rest colour and hover alpha); inspector `ModeSwitcher` and `.ui-designer-right-rail-tab` (36px band, 12px / 11px labels, 50% white rest: a documented deviation, since at those sizes White 40 misses 4.5:1).

| Variant | State | Fill | Border | Label | Badge | Inspector token | Creator Hub token | Contrast | A11y |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Active=False, Hover=False, Notification=False | default | none | none | Silver `#A09BA8` | — | `--palette-neutral-gray3` | `--dcl-silver`; ui2 `neutral.gray3` | label 6.71:1 on `#161518`, 6.74:1 on `#16141a`, 5.85:1 on `#242129` | `role="tab"` in a `role="tablist"`, or `<a aria-current="page">` for routes; hit target 48 × 75 |
| Active=False, Hover=True, Notification=False | hover | White 10 | none | Silver | — | fill `--palette-whiteTransparent-subtle` | missing (`Navbar` paints `#ffffff0d`) | label over the fill 5.12:1 on `#161518`, 5.11:1 on `#16141a`, 4.31:1 on `#242129`; fill vs surface 1.31:1, the label carries the state | — |
| Active=False, Hover=False, Notification=True | default | none | none | Silver | 8 × 8 Primary dot, 100px, `right: 0`, `top: −0.04px` | dot `--primary-main` | `--primary` | dot 4.99:1 (≥ 3:1 non-text) | the dot needs text: `aria-label="Scenes, 1 notification"` or a visually hidden count |
| Active=True, Hover=False, Notification=False | active | none | 2px Snow bottom | Snow | — | `--ui-designer-text` | ui2 `neutral.softWhite` | label and underline 17.73:1 | `aria-selected="true"` or `aria-current="page"` |
| Active=True, Hover=True, Notification=False | active + hover | White 10 | 2px Snow bottom | Snow | — | as above | as above | label over the fill 13.53:1 | — |
| Active=True, Hover=False, Notification=True | active | none | 2px Snow bottom | Snow | 8 × 8 Primary dot, `right: 0`, `top: 0.46px` | as above | as above | dot 4.99:1 | as above |
| Icon=True (6 variants) | as the no-icon variant with the same Active / Hover / Notification | as that variant | as that variant | as that variant; `settings` glyph 24 high, Silver at rest, Snow when active (SVG asset) | badge `top: 0.96px` inactive, `0.46px` active | as that variant | as that variant | as that variant | as that variant |
| any | ✱ focus | — | — | — | — | — | — | ring on `#161518`: `--border-focused` 4.34:1, `--ui-designer-control-accent` 8.13:1; Creator Hub ui2 `palette.info.light` 8.13:1 (≥ 3:1) | `:focus-visible` outline 2px, offset −2px, as `ModeSwitcher` does |
| any | ✱ disabled | — | — | — | — | — | — | — | not drawn; `Navbar` omits an unavailable entry instead of greying it — keep that, no disabled style |

### TabVertical (Tabs)

Set [`20902:5640`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20902-5640), 6 variants (idle `20902:5641`, hover `20902:5643`, notification `20902:5645`, active `20902:5647`, active + hover `20902:5649`, active + notification `20902:5651`). Size 480 × 200; each variant 80 × 75. Read October 27, 2026. Code: inspector none · Creator Hub `Modals/TabsModal`.

Same axes as TabHorizontal. Shared: 80 × 75, column flow, `justify-content: center`, `align-items: flex-start`, padding 0 / 20, label `H4 Semi` left-aligned, no radius, no shadow; the active indicator is a 2px Snow right border and the badge (`20902:5653`) sits at top 21.96 / right 9, on the active + notification variant only. Code: Creator Hub `Modals/TabsModal` (MUI `Tabs orientation="vertical"`; `.TabsModalTab` is 42px min-height, 600 uppercase, `--text-on-secondary` rest, `rgba(255,255,255,.8)` hover, selected `--dcl` text on `--darker-gray` with MUI's own indicator — drift: Figma selects with Snow and a right border, not Primary); inspector none.

| Variant | State | Fill | Border | Label | Badge | Inspector token | Creator Hub token | Contrast | A11y |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Active=False, Hover=False, Notification=False | default | none | none | Silver `#A09BA8` | — | `--palette-neutral-gray3` | `--dcl-silver`; ui2 `neutral.gray3` | 6.71:1 on `#161518`, 6.74:1 on `#16141a`, 5.85:1 on `#242129` | `role="tab"` in a vertical `role="tablist"` (`aria-orientation="vertical"`, Up/Down arrows); hit target 80 × 75 |
| Active=False, Hover=True, Notification=False | hover | White 10 | none | Silver | — | `--palette-whiteTransparent-subtle` | missing | 5.12:1 / 5.11:1 / 4.31:1 over the fill | — |
| Active=False, Hover=False, Notification=True | default | none | none | Silver | none drawn | — | — | — | badge text as TabHorizontal |
| Active=True, Hover=False, Notification=False | active | none | 2px Snow right | Snow | — | `--ui-designer-text` | ui2 `neutral.softWhite` | 17.73:1 | `aria-selected="true"` |
| Active=True, Hover=True, Notification=False | active + hover | White 10 | 2px Snow right | Snow | — | as above | as above | 13.53:1 over the fill | — |
| Active=True, Hover=False, Notification=True | active | none | 2px Snow right | Snow | 8 × 8 Primary dot, 100px, top 21.96 / right 9 | `--primary-main` | `--primary` | dot 4.99:1 | as above |
| any | ✱ focus / disabled | as TabHorizontal | — | — | — | — | — | — | — |

## Surfaces

The containers and chrome that hold content: accordions, the app background, cards, menus, modals, the scrollbar, section titles, the editor title bar and the profile snapshot.

### Surfaces tokens

Every literal the Surfaces pages use (Accordion, Background, Cards, Menu, Modals, Scrollbar, Sections Titles, TitleBar, Profile Snapshot), mapped once. Read October 27, 2026. Contrast is against inspector `#161518`, Creator Hub page `#16141a`, or the fill named in the row.

| Literal | Figma | Inspector (`vars.css`) | Creator Hub (`theme.css` / ui2) |
| --- | --- | --- | --- |
| `#FCFCFC` titles, labels, values, button text | Neutrals/Snow | `--ui-designer-text` (→ `--palette-neutral-softWhite`) | ui2 `neutral.softWhite`; `theme.css` missing |
| `#CFCDD4` accordion body, modal body, thumbnail fallback | Neutrals/Gray | `--ui-designer-text-value` (→ `--palette-neutral-gray4`) | ui2 `neutral.gray4`; `theme.css` missing |
| `#A09BA8` card meta, menu glyphs, menu section label | Neutrals/Silver | `--ui-designer-text-muted`, `--neutral-grey-3` | `--dcl-silver`, `--clear-divider` · ui2 `neutral.gray3` |
| `#FFFFFF` icon glyphs | Neutrals/White | `--white` | `--white`, `--text` |
| `#43404A` menu row hover, back-button ring | Neutrals/Pale Black | `--gray-0` | `--dark-gray` · ui2 `neutral.gray0` |
| `#35333B` menu fill | Neutrals/Onix | `--palette-neutral-onyx`, `--ui-designer-control-bg` | PROPOSED `--menu-bg` |
| `#FF2D55` primary button, D7 retention value, required marker | Primary/Primary | `--primary-main` | `--primary`, `--dcl` · ui2 `palette.primary.main` |
| `#C640CD` smart-item icon disc, avatar fill | Brand/Lavender | `--lavender`, `--smart-item-icon-bg-color` | PROPOSED `--lavender` |
| `rgba(255,255,255,.05)` card rest fill, AccordionEntry hover fill | not a Figma step (unnamed `#FFFFFF` 5%) | `--palette-whiteTransparent-faint` (accordion); `--ui-designer-control-empty-bg` (UI Designer fields) | `--transparent-gray-dark` |
| `rgba(255,255,255,.1)` card border, accordion rules, menu border and rule, secondary button fill, modal close fill | Transparencies/White 10 | `--palette-whiteTransparent-subtle` (aliased by `--ui-designer-control-border`), `--ui-designer-control-selected-bg` | missing (`PublishedProjectCard` paints `--transparent-gray-dark`, White 5) |
| `rgba(255,255,255,.15)` card hover fill | not a Figma step (unnamed `#FFFFFF` 15%) | PROPOSED `--palette-whiteTransparent-hover` | PROPOSED `--transparent-gray-hover` (`Tutorials` hovers with `.1`) |
| `rgba(255,255,255,.2)` location divider, Publish split divider | Transparencies/White 20 | `--palette-whiteTransparent-soft` (aliased by `--ui-designer-control-border-strong`) | missing |
| `rgba(255,255,255,.4)` chevrons, kebab glyph, accordion group label, field border | Transparencies/White 40 | `--palette-whiteTransparent-blurry` (aliased by `--ui-designer-checkbox-border`) | missing (`--transparent-gray-light` is .23) |
| `rgba(255,255,255,.6)` scrollbar handle border, verification expiry text, modal group label, attach label | Transparencies/White 60 | `--palette-whiteTransparent-backdrop` | missing |
| Ruby → Lavender favourite star | Gradients/Cerise (stops not in the style list) | PROPOSED `--gradient-cerise` | PROPOSED `--gradient-cerise` |
| `#6141A6 → #6C84FF` credits coin (+ white drop shadow, `#5600FF` 50% inner shadow) | — (illustration, not a variable) | missing; ship as an SVG asset | missing; ship as an SVG asset |
| `#302C37` page boards | — (Figma presentation only) | not a surface | not a surface |
| 8px radius (menu row, title-bar buttons) | — | PROPOSED `--shape-borderRadiusRow` (`--ui-designer-radius-field` is 6px; `--contexify-activeItem-radius` holds 8px for the menus) | PROPOSED `--shape-borderRadiusRow` (`--mui-shape-borderRadius` is 6px; `SceneList` carries the literal) |
| 12px radius (menu, published thumbnail, CTA buttons, grouped accordion, form fields) | — | `--shape-borderRadiusLarge` (aliased by `--ui-designer-radius-menu`) | missing (`UserMenu` carries the literal) |
| 16px radius (cards, card thumbnails) | — | PROPOSED `--shape-borderRadiusCard` | PROPOSED `--shape-borderRadiusCard` (`Tutorials` carries the literal) |
| 24px radius (modals) | — | PROPOSED `--shape-borderRadiusXLarge` | PROPOSED `--shape-borderRadiusXLarge` (ui2 `Modal` paper is 12px) |
| 100px pill (kebab, modal close, radio, avatar ring, scrollbar handle) and 9999px (BackCTA, title Tag) | — | `--shape-borderRadiusPill` (100px; 9999px draws the same pill) | missing (`EditorPage` and `Title` carry `100%`) |
| 34px pill (scene status chip) | — | missing | missing |
| 5px radius (16px checkbox) | — | missing | missing |
| 6px radius (attach button, location row) | — | `--shape-borderRadius` (aliased by `--ui-designer-radius-field`) | `--mui-shape-borderRadius` |
| `0 4px 8px rgba(0,0,0,.4)` menu shadow | — | `--menu-shadow` (`--contexify-menu-shadow` holds `2px 2px 10px rgba(0,0,0,.5)` until the Menu-Entry spoke points it there) | PROPOSED `--menu-shadow` (ui2 `MuiPaper` elevation today) |
| `0 4px 4px rgba(0,0,0,.1)` title-bar toast shadow | — | PROPOSED `--shadow-tooltip` | PROPOSED `--shadow-tooltip` (ui2 `Tooltip` today) |
| `#181225` modal fill | — (a raw hex on every modal, not a variable) | `--modal-content-bg-color` (→ `--tree-bg-color` `#161518`): drift → `#181225` (pending spoke) | `--modal` `#242129`: drift → `#181225` (pending spoke); the ui2 `Modal` paper paints it |
| `#000000` title-bar fill | Neutrals/Black | `--black`, `--base-21` | `--bg-inspector` |
| `#2D2A33` toolbar icon and split buttons, title-bar toast | Neutrals/Onix Dark 1 | PROPOSED `--palette-neutral-onyxDark1` | `--title-bar-button` |
| `#25212A` AI-toggle hover, button-table board | Neutrals/Charcoal | `--ui-designer-panel-bg` is `#242129` — ✱ deviation (1/255) | `--darker-gray`, `--card`, `--modal` `#242129` — same ✱ deviation |
| `#244B7D` AI-toggle selected | System/Blue Dark 2 | `--palette-system-blueDark2` | `--ai-session-selected` |
| `#243852` AI-toggle selected + hover | System/Blue Dark 3 | `--palette-system-blueDark3` | `--ai-session-selected-hover` |
| `#FF6280` publish split-button hover | Primary/Primary Light 1 | `--palette-primary-light` | `--primary-hover` (ships in #1703) |
| `#5E5B67` `.dcl.eth` suffix | Neutrals/Graffito | PROPOSED `--palette-neutral-gray1` | `--light-gray` |
| `#34CE77` online dot | System/Green | `--success-main` (ships in #1703) | `--success` |
| `#FE9C2A` away dot | System/Orange | `--warning-main` (ships in #1703; the warning role, no presence token) | `--danger` (ships in #1703; the warning role) |
| `#28AC00` online dot on the 28px avatar only | DCL/Grass (a legacy-library variable, shown with `?` in the panel) | missing | missing — Figma drift, see ProfilePic |
| `#FF0000` blocked ring | DCL/Red (legacy; the error role is System/Red `#FB3B3B`) | `--error-main` (ships in #1703) | `--error` (ships in #1703) |
| `#FF4BED` @ 30% + layer blur 500 modal glow | DCL/Rarities/Mythic (legacy) | missing; ship as an asset | missing; ship as an asset |
| `#FFD079 → #DA36FF` AI sparkle gradient | — (raw linear gradient) | missing | missing (`components/Icons/AssistantIcon` paints its own gradient) |
| `rgba(0,0,0,.2)` background overlay, modal title-bar fill | Transparencies/Black 20 | PROPOSED `--palette-blackTransparent-soft` (`--contexify-separator-color` holds the same value in a react-contexify role) | PROPOSED `--palette-blackTransparent-soft` |
| `rgba(0,0,0,.4)` scrollbar handle | Transparencies/Black 40 | `--palette-blackTransparent-blurry` | PROPOSED `--scrollbar-thumb` |
| `rgba(0,0,0,.6)` Secure-Sign-In close button | Transparencies/Black 60 | `--modal-overlay-bg-color` (same value, the overlay role) | missing (`--dimmer` is `#000000dd`) |
| Inter 100 / 600 / normal | unnamed (sign-in verification number) | `--font-family` + literal size | same |
| Inter 48 / 600 / 100% | `H0 Semi` | `--font-family` + literal size | same |
| Inter 48 / 400 / 117% | `typography/h3` (legacy name; `.dcl.eth`) | `--font-family` + literal size | same |
| Inter 24 / 600 / 100% | `H2 Semi` | `--font-family` + literal size | same |
| Inter 20 / 600 / 100% | `H4 Semi` | `--font-family` + literal size | `--font-family` + literal size or `Typography` |
| Inter 18 / 600 / 100% | `H5 Semi` (modal title bars) | `--font-family` + literal size | same |
| Inter 18 / 400 / 100% | `H5 Regular` | `--font-family` + literal size | same |
| Inter 16 / 600 / 100% | `H6 Semi` | `--font-family` + literal size | same |
| Inter 16 / 600 / 100% uppercase | `H6 Semi Caps` | `--font-family` + literal size | same |
| Inter 16 / 400 / 100% | `H6 Regular` | `--font-family` + literal size | same |
| Inter 16 / 400 / 100% uppercase | unnamed (Help & Support group labels) | `--font-family` + literal size | same |
| Inter 16 / 600 / 22px uppercase | unnamed (modal and section-title CTA labels) | `--font-family` + literal size | same |
| Inter 14 / 600 / 100% | `H7 Semi` (the CTA label is the same face uppercase, unnamed) | `--font-family` + literal size | same |
| Inter 14 / 600 / 100% uppercase | `H7 Semi Caps` (snackbar action) | `--font-family` + literal size | same |
| Inter 14 / 400 / 100% | `H7 Regular` (also the Play Options heading, uppercase) | `--font-family` + literal size | same |
| Inter 14 / 400 / 150%, cap-height trim | unnamed (location and privacy meta) | `--font-family` + literal size | same |
| Inter 13 / 600 / 24px, 0.46px tracking, uppercase | `button/small` (legacy; toolbar split buttons) | `--font-family` + literal size | same |
| Inter 12 / 600 / 100% | `H8 Semi` (title-bar toasts) | `--font-family` + literal size | same |
| Inter 12 / 400 / 100% | `H8 Regular` (menu rows; the section label is the same face uppercase, unnamed) | `--font-family` + literal size | same |
| `SF Pro Text` Medium 18 | unnamed (Editor Toolbar title; the only non-Inter text in the file) | `--font-family` (Inter) | `--font-family` (Inter) |

### AccordionEntry (Accordion)

Set [`20932:3939`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20932-3939), 3 variants (Default `20932:3940`, Hover `20932:3943`, Expanded `20932:3946`). Size 596 × 50 (Default, Hover); Expanded hugs its header and Description. Read October 27, 2026. Code: inspector `ui/Accordion` · Creator Hub none.

Shared:

- **Row:** Fill width (596 in the set), 50 tall, padding 0 / 20, gap 20, 1px White 10 bottom rule, no radius, no shadow.
- **Order:** the chevron **leads**: `arrow-right` `20932:3942`, then the label `Text` `20932:3941` (523.75 wide).
- **Chevron:** an instance of the `arrow-right` icon component, 12.25 box; its Vector `21791:3` is 11.23 × 6.63, White 40, and points right closed, down open.
- **Label:** `H7 Semi` Snow, in the copy's own casing (no Caps).
- **Expanded:** a composite. Its header is a nested AccordionEntry Default instance `21290:47861` with its bottom stroke removed, over a `Description` instance `21290:47876`. Its one rule is the variant's own bottom rule, under the body; nothing separates the header from the body.

Code: inspector `ui/Accordion`, used by `AdminToolsBasicView` and `AdminToolkitView`. It has a 4px radius, padding 12 / 8, a 12px / 500 uppercase label on `--text-light` (which no stylesheet defines, so it resolves to the inherited colour), a `--base-14` border and an open header rule in `--base-12`: drift on every value, and layer 3b unit 2 aligns it (decisions below). Creator Hub: none. Its hand-rolled `SettingsAccordion` (`Modals/AppSettings/Tabs/AiTab`) is not this set: Figma draws it on App Settings `21176:30197` as a local `ConnectDropdown` frame (`H6 Semi` 16 / 600 DCL/White, a leading chevron, no row, no rule), and it is its own Creator Hub unit in layer 4 (G34). Its rule is the separate `hr.AiDivider` (`--mui-palette-divider`), and its title inherits its size at weight 600.

The body region keeps its DOM node while closed or off, and is `hidden` (so `aria-controls` always resolves). An author `display` rule outranks the UA's `[hidden] { display: none }`, so the region's layout rule is scoped `.Accordion > .content:not([hidden])`. Without that scope a hidden body still laid out its padding and stayed in the accessibility tree (layer 3b unit 2, round 1).

| Variant | State | Fill | Border | Chevron | Body | Size | Contrast | A11y | Inspector token | Creator Hub token |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Default | collapsed | none | 1px White 10 bottom | leads the row; right, White 40 | — | 596 × 50 | label 17.73:1 on `#161518`, 17.81:1 on `#16141a`, 15.45:1 on the `#242129` entity panel; chevron 3.83:1 / 3.74:1 (≥ 3:1 non-text); rule 1.32:1 / 1.36:1, decorative | header is a `<button aria-expanded="false" aria-controls>`; hit target 50 tall, full width | `--palette-whiteTransparent-subtle` (rule), `--palette-neutral-softWhite` (label), `--palette-whiteTransparent-blurry` (chevron) | missing (no consumer) |
| Hover | collapsed + hover | White 5 (unnamed; `--palette-whiteTransparent-faint`) | 1px White 10 bottom | right, White 40 | — | 596 × 50 | fill vs surface 1.13:1 (1.16:1 on `#242129`) — the fill alone does not announce the state; label over it 15.67:1 (13.37:1 on the panel) | — | `--palette-whiteTransparent-faint` | missing |
| Expanded | open | none | 1px White 10 bottom, under the body (none under the header) | down, White 40 | `Description` row: Fill × Hug 37, padding 0 / 20 / 20, `H7 Regular` Gray, 17 tall | 596 × 88 (50 + 37 + rule) | body 11.55:1 / 11.61:1 (10.07:1 on the panel) | `aria-expanded="true"`; body is `role="region" aria-labelledby` the header | `--palette-neutral-gray4` (`--ui-designer-text-value`, body) | missing |
| any | ✱ expanded + hover | White 5 on the header row only | — | — | — | — | as Hover | — | — | — |
| any | ✱ body gap between controls (Figma draws only a text body; user, October 26, 2026) | — | — | — | the body's controls in a column, `--uid-space-4` (16) apart; the body itself is Figma's padding 0 / 20 / 20 | — | — | — | — | — |
| any | ✱ focus (Figma draws none; user, October 26, 2026) | White 5 `--palette-whiteTransparent-faint`, as Hover | 1px inset Snow `--focus-ring` (`outline: 1px solid; outline-offset: -1px`) | as the state | — | — | ring 15.45:1 on `#242129`, 13.37:1 over the White 5 fill | `:focus-visible` on the header button only; the same ring as unit 1's menu rows | — | — |
| any | ✱ off, the section switched off by its checkbox (Figma draws none; user, October 26, 2026) | — | — | White 40 under the dim, right or down as the remembered state | hidden while off | — | the whole entry at `opacity: .7`: label 8.39:1 on `#242129` | toggle remembered, not disabled: the header stays focusable and still toggles, so the chevron and `aria-expanded` flip; the body stays hidden until the section is re-enabled, then opens if it was left open. Nothing draws as open over an empty body. No `aria-disabled` | — | — |
| any | ✱ enable checkbox (Figma draws none; user, October 26, 2026) | — | — | — | — | the inspector `CheckboxField`, between the chevron and the label | as `CheckboxField` | a separate control beside the header button, never inside it; `aria-label="Enable <label>"` ("Enable Video Screens"); the visible text is unchanged | — | — |

**Decisions** (layer 3b unit 2; the record for this component, so grep here before asking again):

| Date | Question | Answer |
| --- | --- | --- |
| 2026-10-26 | No Figma board draws the inspector's accordions. Who composes it? | We do, in this doc: [Admin Tools accordions (inspector)](#admin-tools-accordions-inspector), built from AccordionEntry `20932:3939` and the Checkbox on our tokens. It is the unit's source once the user approves it at sign-off. Design's review of it is tracked on G10 and blocks nothing. |
| 2026-10-26 | Spacing in the ~315px entity panel? | Figma exact, settled at sign-off: a 50px row (`calc(var(--uid-space-5) * 2.5)`), header padding 0 / `--uid-space-5`, 20px between chevron, checkbox and label, body padding 0 / `--uid-space-5` / `--uid-space-5`. One density, so no `size` prop. Only the 16px gap between body controls is a ✱ (Figma draws a text body). |
| 2026-10-26 | Grouping? | Flush rows divided by Figma's 1px White 10 bottom rule. The per-entry box (`border` modifier: `--base-14`, 4px radius, 2px margin) goes from `AdminToolsBasicView`, so both panels draw alike. |
| 2026-10-26 | Header semantics? | A `<button aria-expanded aria-controls>`; Enter and Space toggle it; the body is `role="region"`, named by the header. The enable checkbox is a separate control beside it, never nested. Test-first. |
| 2026-10-26 | Keyboard focus? | On `:focus-visible` the header takes Figma's Hover fill (White 5) plus a 1px inset Snow `--focus-ring`, as unit 1's menu rows (✱ focus). |
| 2026-10-26 | Off state (the enable checkbox unchecked)? | Keep the existing look: `opacity: .7`, body hidden, the header still focusable and still toggling (✱ off). Nothing draws as open over an empty body. |
| 2026-10-26 | While a section is off, what does its header do? | Toggle remembered, not disabled: the chevron and `aria-expanded` flip; the body stays hidden until the section is re-enabled, then opens if it was left open. No `aria-disabled`; the chevron stays White 40 under the 0.7 dim (✱ off). |
| 2026-10-26 | Tab order between the header and its checkbox? | The header button first, then the "Enable …" checkbox, set by DOM order with no positive `tabindex`. |
| 2026-10-26 | How does a `<button>` keep chevron, checkbox, label with the checkbox between? | A full-row header `<button>` holds the chevron and the label, with a slot reserved for the checkbox; the checkbox is its sibling, layered above it in that slot. Nothing is nested. |
| 2026-10-26 | The enable checkbox's accessible name? | `aria-label="Enable <label>"`, e.g. "Enable Video Screens". |
| 2026-10-26 | Order of chevron, checkbox and label? | Chevron, checkbox, label: Figma's leading chevron stays first, and the checkbox sits between it and the label. |
| 2026-10-26 | Label casing? | Title Case, Figma's `H7 Semi` Snow with no `text-transform`: Text Announcements, Video Screens, Smart Item Actions, in both views. This closes G3 (`--text-light` goes). |
| 2026-10-26 | Chevron glyph? | Figma's `arrow-right` vector as a `currentColor` SVG, White 40, right closed and down open. react-icons `IoIosArrow*` goes. |
| 2026-10-26 | Name of the hover token? | `--palette-whiteTransparent-faint` = `rgba(255, 255, 255, 0.05)`, a new token in the hub. |
| 2026-10-26 | `rightContent`? | Removed: no accordion passes one; the Admin Tools tooltip belongs to the outer `Container`. |
| 2026-10-26 | The checkbox ignores `enabled` and shows checked after a re-select while the scene says off. Fix it here? | Yes, test-first: `enabled` controls the checkbox, `initialEnabled` goes, and `onToggleEnabled` keeps its name. |
| 2026-10-26 | Creator Hub `SettingsAccordion`? | Its own Creator Hub unit in layer 4 (G34), against its App Settings `ConnectDropdown` board `21176:30197`. |
| 2026-10-26 | The new header button doesn't take Space: the Reset Camera hotkey (Space) cancels it. Fix it here? | Yes. Space activates a focused button, checkbox or radio (native or by role). The Reset Camera hotkey ignores those targets (`useHotkey` `ignoreTargets`, `ACTIVATABLE_CONTROLS`), and every other hotkey is unchanged. Radios are covered by unit tests only: the UI Designer's MobileHUD radio never had the bug, because Reset Camera is off in 2D. |
| 2026-10-26 | The "Screen Steup" typo in `VideoControl`? | Fixed in this spoke: "Screen Setup". |
| 2026-10-26 | Sign-off of the Before / After / Figma set (layer 3b unit 2), standalone and inside Creator Hub | Signed off, with Figma-exact spacing. Our "Admin Tools accordions (inspector)" board is the unit's source. |

### LabelAccordion (Accordion)

Component [`20932:5388`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20932-5388), 1 variant: a group label over a bordered stack of AccordionEntry instances. Size 638 wide × Hug; column, gap 10. Read October 27, 2026. Code: inspector none · Creator Hub none (`DocsPage` lists FAQ-style links without a disclosure).

| Part | State | Fill | Border | Radius | Typography | Size / spacing | Contrast | A11y | Inspector token | Creator Hub token |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Label (`create`) | default | none | none | — | `H6 Semi Caps` White 40 | 638 × 19 | **3.83:1 on `#161518` and `#16141a` — fails 4.5:1** (16px / 600 is not large text); Silver would pass at 6.71:1 — the user picks | `<h3>` or the group's `aria-labelledby` target | `--palette-whiteTransparent-blurry` | missing |
| Questions (group) | default | none | 1px White 10 all sides | 12px | — | Fill × Hug 139; entries inside are AccordionEntry at 638 wide (header text 563.75) | border 1.32:1, decorative | `role="group"`; entries keep their own button semantics | `--palette-whiteTransparent-subtle`, `--shape-borderRadiusLarge` (12px) | missing |
| Entries | collapsed / open | as AccordionEntry | a 1px White 10 bottom rule between entries; the last (expanded) entry draws none, and the group's own border closes it | — | header `H7 Semi` Snow, body `H7 Regular` Gray | header 50 tall; the first entry reads "What can I create in Decentraland?" | as AccordionEntry | as AccordionEntry | as AccordionEntry | missing |

### Admin Tools accordions (inspector)

This is our board for the inspector's accordions (decision October 26, 2026). No Figma board draws them: Editor 3D `21673:54990` draws the entity panel as `Container` cards with no accordion. It is composed only from AccordionEntry `20932:3939` and the inspector `CheckboxField`, on our tokens. The two views share it:

- **Basic view:** `SmartItemBasicView` → `AdminToolsBasicView`, at the top of the panel.
- **Advanced view:** the "Admin Tools" `Container` → `AdminToolkitView`, under the "Advanced" divider.

Both views draw the same three entries in the same order as today. The basic view lists Text Announcements, Video Screens, Smart Item Actions; the advanced view lists Video Screens, Text Announcements, Smart Item Actions.

**Status:** the unit's source, signed off by the user (layer 3b unit 2). Design's review is tracked on G10 and blocks nothing.

**Tokens.** Every part below is a token. The one literal is the label's 14px size, as with every `--font-family` + size row in "Type".

| Part | Token | Value | Figma |
| --- | --- | --- | --- |
| Entry rule | `--palette-whiteTransparent-subtle` | `rgba(255,255,255,.1)`, 1px, bottom only | White 10 |
| Header hover, expanded + hover, focus fill | `--palette-whiteTransparent-faint` | `rgba(255,255,255,.05)` | unnamed White 5 |
| Focus ring | `--focus-ring` | Snow `#fcfcfc`, 1px inset | ✱ not drawn |
| Chevron | `--palette-whiteTransparent-blurry` | White 40, 12px box `--uid-space-3` | White 40, 12.25 box |
| Label | `--palette-neutral-softWhite`, `--font-family` | Inter 14 / 600 / 100% | `H7 Semi` Snow |
| Row height | `calc(var(--uid-space-5) * 2.5)` | 50px | 50 |
| Row padding, gaps | `--uid-space-5` | 0 / 20; 20 between chevron, checkbox and label | 0 / 20, gap 20 |
| Body padding, gap | `--uid-space-5`, `--uid-space-4` | 0 / 20 / 20; 16 between controls | 0 / 20 / 20; ✱ the 16 gap (Figma draws a text body) |
| Off | — | `opacity: .7` on the entry | ✱ not drawn |

**Layout.** A row is `[chevron] [enable checkbox] [label]`, full width, with the entries flush one under another and each closed by its rule. The header `<button>` covers the whole row and holds the chevron and the label. The checkbox is its sibling, layered over the button in the column between them. Both share one grid, so the checkbox column takes the checkbox's own width.

| State | Look | A11y |
| --- | --- | --- |
| Collapsed | chevron right; no body | `aria-expanded="false"` |
| Hover (anywhere in the header, the checkbox included) | White 5 fill on the header row | — |
| Expanded | chevron down; the body's controls below the header, the rule under the body | `aria-expanded="true"`; the body is `role="region"`, named by the header |
| Expanded + hover | White 5 on the header row only | — |
| Keyboard focus | White 5 plus the 1px inset Snow ring on the header row | `:focus-visible`; Tab reaches the header, then its checkbox |
| Off (checkbox unchecked) | the entry at `opacity: .7`, body hidden, the header still toggles; re-enabling opens the body if it was left open | the checkbox reads "Enable Video Screens, checkbox, not checked" |

### Background (Background)

Component [`20506:31427`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20506-31427), 1 variant and no component set: the page has only this frame plus its title. Size 1720 × 1080. Read October 27, 2026. Code: inspector none (the editor paints `--base-20`) · Creator Hub `theme.css` `.Main` paints `assets/images/background.png` over `#242129` with `background-blend-mode: overlay`: the same raster role, a different overlay.

| Name | Fill | Overlay | Size | Usage | Contrast | Inspector token | Creator Hub token |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Background | raster `image.png` — a near-black field with a violet glow bottom-left and a dark-blue glow left (no gradient stops: it is a bitmap, not a Figma gradient) | solid `rgba(0,0,0,0.2)` (Transparencies/Black 20), inset 0 | 1720 × 1080, no radius | the app canvas behind cards and pages | text is specified against the solid page colours above; the raster's darkest region reads as `#0a0712`-ish and its glow as `#1d1033`-ish (canvas measurement, ±8 per channel) — treat `#16141a` as the design surface and keep Snow / Silver text ≥ 4.5:1 there | PROPOSED `--palette-blackTransparent-soft` for the overlay; no background token | overlay PROPOSED `--palette-blackTransparent-soft`; `.Main` blends the raster instead of overlaying it |
| ✱ Page board | `#302C37`, 64px radius, padding 100 | — | 1920 × Hug | Figma presentation frame on every Surfaces page, not a product surface | — | — | — |

### Scene-Card (Cards)

Set [`20910:7527`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20910-7527), 2 variants (Default `20910:7528`, Hover `20910:7536`). Size 416 × 383. Read October 27, 2026. Code: inspector none · Creator Hub `SceneCard`, `ProjectCard` (drift, below).

Shared: column, 416 × 383, 1px White 10 border, 16px radius, clips; `Thumbnail` fills the height the Text block leaves (273), 16px radius, image fill; `Text` block Fill × 110, padding 20, gap 10; title `H4 Semi` Snow, 24 tall, one line with an ellipsis; `Parcels` row 316.25 × 32, gap 10, a 16px `layout` glyph (Silver) and `N Parcels` `H7 Regular` Silver. Code detail: Creator Hub `SceneCard` (`#313131` literal fill, 10px radius, 260 tall, 18px / 600 title, 14px meta — drift on fill, radius, size and type) and `ProjectCard` (`--secondary` fill, 10px radius, 2px white hover border, `#a09ba8` meta literal — drift).

| Variant | State | Fill | Border | Kebab | Contrast | A11y | Inspector token | Creator Hub token |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Default | default | White 5 (unnamed) | 1px White 10 all sides | — | title over the fill 15.77:1 on `#16141a`; meta 5.97:1 (≥ 4.5:1); glyph 5.97:1; fill vs page 1.13:1 and border 1.31:1 — the card edge is weak, the thumbnail carries it | the whole card is one `<a>` / `<button>` named by the title; hit target 416 × 383 | `--palette-whiteTransparent-faint`, `--palette-whiteTransparent-subtle`, `--ui-designer-text`, `--ui-designer-text-muted` | fill and border missing; `--dcl-silver` (meta) |
| Hover | hover | White 15 (unnamed) | none | `rounded-button-contained` 40 × 40, 100px, no fill, `Kebab` 24 box, Vector 4 × 20 White 40, at right 10 / top 10.5 inside the Text block | title 11.43:1; **meta 4.33:1 — fails 4.5:1 on hover** (Silver 14px / 400 over White 15); kebab 3.29:1 (≥ 3:1 non-text) | kebab is a separate `<button aria-label="Scene options" aria-haspopup="menu">`, 40px hit target, must also appear on focus-within, not only on hover | PROPOSED `--palette-whiteTransparent-hover` | PROPOSED `--transparent-gray-hover` |
| any | ✱ focus | as Hover | — | — | ring ui2 `palette.info.light` 8.13:1 | `:focus-visible` outline 2px on the card; kebab gets its own ring | — | — |
| any | ✱ press | White 10 | — | — | — | — | — | — |
| any | ✱ disabled | — | — | — | not drawn; keep cards enabled or omit them | — | — | — |

### Template-Card (Cards)

Set [`20910:7545`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20910-7545), 2 variants (Default `20910:7546`, Hover `20910:7553`). Size 416 × 383. Read October 27, 2026. Code: inspector none · Creator Hub `TemplatesPage` → `ProjectCard` (drift as Scene-Card).

Identical to Scene-Card except the meta line is a subtitle (`H7 Regular` Silver, one line with an ellipsis filling the rest of the Text block, "Start your own scene from scratch") and the hover button carries `CodeBash` (White, inset 20% in its 24 box), at right 10 / top 10.

| Variant | State | Fill | Border | Button | Contrast | A11y | Inspector token | Creator Hub token |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Default | default | White 5 | 1px White 10 | — | title 15.77:1; subtitle 5.97:1 | card is one link / button | as Scene-Card | as Scene-Card |
| Hover | hover | White 15 | none | 40 × 40 pill, `CodeBash` glyph White | subtitle 4.33:1 — fails 4.5:1 on hover, as Scene-Card; glyph 11.43:1 | `<button aria-label="Open in code">`, 40px hit target, visible on focus-within | PROPOSED `--palette-whiteTransparent-hover`; `--white` (glyph) | PROPOSED `--transparent-gray-hover`; `--white` (glyph) |
| any | ✱ focus / press / disabled | as Scene-Card | — | — | — | — | — | — |

### Learn-Video-Card (Cards)

Set [`20910:7560`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20910-7560), 2 variants (Default `20910:7561`, Hover `20910:7567`). Size 416 × 383. Read October 27, 2026. Code: inspector none · Creator Hub `VideosPage` → `Tutorials` (`.Tutorial`).

Same chrome as Scene-Card; the thumbnail is the video poster (a placeholder image), 273 tall; title `H4 Semi` Snow "Video Tutorial", one line with an ellipsis; subtitle `H7 Regular` Silver, one paragraph set on two lines by a hard line break; no hover button. Code detail: Creator Hub `.Tutorial` has a 16px radius, transparent rest, hover `rgba(255,255,255,.1)`, padding 12, a 2px `--transparent-gray-light` poster border, a 16px / 500 title and a `#a09ba8` literal — drift on rest fill, hover alpha, padding and type.

| Variant | State | Fill | Border | Contrast | A11y | Inspector token | Creator Hub token |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Default | default | White 5 | 1px White 10 | title 15.77:1; subtitle 5.97:1 | card is one `<a>` to the video, named by the title | as Scene-Card | as Scene-Card |
| Hover | hover | White 15 | none | subtitle 4.33:1 — fails 4.5:1 on hover | — | PROPOSED `--palette-whiteTransparent-hover` | PROPOSED `--transparent-gray-hover` |
| any | ✱ focus / press | as Scene-Card | — | — | — | — | — |

### Learn-Doc-Card (Cards)

Set [`20910:7636`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20910-7636), 2 variants (Default `20910:7637`, Hover `20910:7689`). Size 416 × 210. Read October 27, 2026. Code: inspector none · Creator Hub `DocsPage` (a link list, no card).

Column, 416 × 210, 16px radius, the whole card clips; `Thumbnail` 100 tall: a centred column, padding 20, no radius and no image, holding a `Favorite` star in a 48 × 48 box (fill Gradients/Cerise, Ruby → Lavender); `Text` block 110 tall, padding 20, gap 10: title `H4 Semi` Snow "Doc Title", 24 tall; subtitle `H7 Regular` Silver, one line with an ellipsis.

| Variant | State | Fill | Border | Star | Contrast | A11y | Inspector token | Creator Hub token |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Default | default | White 5 | 1px White 10 | Cerise gradient | title 15.77:1; subtitle 5.97:1; star Ruby end 4.44:1, Lavender end 3.86:1 over the fill (≥ 3:1, and decorative) | card is one `<a>` named by the title; star `aria-hidden` | as Scene-Card; star PROPOSED `--gradient-cerise` | as Scene-Card; star PROPOSED `--gradient-cerise` |
| Hover | hover | White 15 | none | same | subtitle 4.33:1 — fails 4.5:1 on hover | — | PROPOSED `--palette-whiteTransparent-hover` | PROPOSED `--transparent-gray-hover` |
| any | ✱ focus / press | as Scene-Card | — | — | — | — | — | — |

### Published-Scene-Card (Cards)

Set [`20964:6705`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20964-6705), 2 variants (Default `20964:6706`, Hover `20964:6737`), under the page's `<Analytics>` label. Size 852 × 214. Read October 27, 2026. Code: inspector none · Creator Hub `ManagePage/PublishedProjectCard`, `AnalyticsPage`.

Shared: column, 852 × 214, 1px White 10 border on all sides, 16px radius, gap 20; `Information` padding 20, gap 20; `Header` row gap 20: `Thumbnail` 100 × 100, 12px radius, Gray fallback fill under a Snow `Img` placeholder, then a column (padding-right 280, gap 6) with `Scene's Name` `H4 Semi` Snow (one line, ellipsis) and a `Location` row (gap 4, 6px radius, clips): a `Place` frame 92 × 18 with a `MapPin` 14 box (Silver) + `worldname` Inter 14 / 400 / 150% Silver, a 1px White 20 vertical rule 14 tall, and a `Privacy` frame 65 × 18 (padding 5 / 0) with a `Private` lock 14 box + "Private" Inter 14 / 400 / 150% Silver. `Analytics` row gap 20: five fill columns (gap 6) of label `H7 Regular` Silver (24 tall) over value `H4 Semi` Snow — Concurrent Users, Daily Active Users, D7 Retention (value Primary), Revenue (`credits-icon` 24 box + value; the row aligns its items at the start at rest and centred on hover), Avg. Playtime ("min"). Code detail: Creator Hub `PublishedProjectCard` has a 10px radius, a `--transparent-gray-dark` White 5 fill, padding 8 / 8 / 8 / 16 and 14px `--light-gray` meta — drift on radius, padding and meta colour.

| Variant | State | Fill | Border | CTAs | Contrast | A11y | Inspector token | Creator Hub token |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Default | default | White 5 | 1px White 10 all sides | — | name 15.77:1; labels and location 5.97:1; D7 value Primary 4.44:1 (20px / 600 ⇒ large text, ≥ 3:1); divider 1.87:1, decorative; thumbnail fallback Gray vs fill 10.27:1 | `<article aria-labelledby>` the name; stats as a `<dl>`; "0%" in Primary needs a text cue, not colour alone | `--palette-whiteTransparent-faint`, `--palette-whiteTransparent-subtle`, `--ui-designer-text`, `--ui-designer-text-muted`, `--ui-designer-text-value`, `--primary-main`, `--palette-whiteTransparent-soft` (rule) | `--primary` (D7 value); the rest missing |
| Hover | hover | White 15 | 1px White 10 all sides (kept, unlike the home cards) | `CTAs` 257 × 40, absolute at right 9 / top 45, gap 10: `Button-Contained-Text` Secondary flex 1 × 40, 12px, padding 11.5 / 24, White 10 fill, "DETAILS" Inter 14 / 600 uppercase Snow; Primary the same with the Primary fill, "EDIT"; kebab pill 40 × 40, `Kebab` inset 20%, Vector 4 × 20 White 40 | labels 4.33:1 — fails 4.5:1 on hover; DETAILS 8.38:1; **EDIT Snow on Primary 3.55:1 — fails 4.5:1** (same finding as the Create button); D7 value 3.22:1 large-text pass; kebab 3.29:1 | CTAs are `<button>`s, 40px tall, visible on focus-within; kebab `aria-label` + `aria-haspopup="menu"` | PROPOSED `--palette-whiteTransparent-hover`; `--palette-whiteTransparent-subtle` (DETAILS), `--primary-main` (EDIT) | PROPOSED `--transparent-gray-hover`; `--primary` (EDIT) |
| any | ✱ focus / press | as Scene-Card | — | — | — | — | — | — |

### Menu-Entry (Menu)

Set [`20749:790`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20749-790), 4 variants (Default `20749:741`, Hover `20749:791`, Section `21291:48109`, Div `20749:823`). Size 240 × 38 (Div 240 × 1). Read October 27, 2026. Code: inspector `Hierarchy/ContextMenu`, `CustomAssets/ContextMenu`, `hoc/withContextMenu`, the UI Designer menus · Creator Hub `Dropdown`, `Header/UserMenu`.

Shared: row, Fill × 38 (240 in the set, 180 inside Menu), 8px radius, padding 0 / 10, gap 10 (none on Section). Code detail: inspector react-contexify on `--contexify-*` (VS Code `--dropdown-bg-color` `#d8d8d8` light fill, 2px radius, 6px item padding, `--contexify-activeItem-radius` 4px — drift on every value, it is the embedded-webview theme) and the UI Designer menus (`--ui-designer-control-bg` Onix, `--ui-designer-control-selected-bg` White 10 rows, `--ui-designer-radius-menu` 12px — closest); Creator Hub ui2 `Menu` / `MenuItem` (MUI defaults, 200px list, glyphs `--text-on-secondary`) — drift.

| Variant | State | Fill | Leading | Label | Trailing | Size | Contrast (on Onix) | A11y | Inspector token | Creator Hub token |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Default | default | none | `Info` 16 box, Vector Silver | `H8 Regular` Snow (174 × 15) | `arrow-right` 10 box, Vector 9.17 × 5.42 White 40 | 240 × 38 | label 12.13:1; glyph 4.59:1 (≥ 3:1); chevron 3.38:1 | `role="menuitem"` in a `role="menu"`; 38px hit target; submenu chevron ⇒ `aria-haspopup="menu"` | `--ui-designer-text`, `--ui-designer-text-muted`, `--palette-whiteTransparent-blurry`; radius PROPOSED `--shape-borderRadiusRow` | `--dcl-silver`; the rest missing |
| Hover | hover / keyboard active | Pale Black | same | same | same | 240 × 38 | fill vs Onix 1.23:1 — weak; label over it 9.88:1, glyph 3.74:1, chevron 3.06:1 (≥ 3:1) | the keyboard-active item uses the same fill plus the focus ring below | `--gray-0` | `--dark-gray` |
| Section | — | none | — | Inter 12 / 400 uppercase Silver (220 × 15), no gap; no leading glyph, so the label sits 10px from the left | — | 240 × 38 | 4.59:1 (≥ 4.5:1, barely; 12px / 400 is small text) | `role="presentation"` heading or `aria-label` on the group; not focusable | `--ui-designer-text-muted` | `--dcl-silver` |
| Div | — | White 10, 1px tall | — | — | — | 240 × 1 (padding 7 / 10 ⇒ 15px of rhythm) | 1.37:1, decorative | `role="separator"` | `--palette-whiteTransparent-subtle` | missing |
| Default | ✱ keyboard active (Figma draws none) | Pale Black plus a 1px inset Snow `--focus-ring`, as the Dropdown list | as Hover | as Hover | as Hover | — | ring 9.88:1 on the Pale Black row; the fill alone is 1.23:1, so the ring carries the state | `:focus-visible` on the row the arrow keys make active; a hovered row keeps the fill alone | — | — |
| Default | ✱ press | White 10 over Pale Black | — | — | — | — | — | — | — | — |
| Default | ✱ disabled (Figma draws none) | none; the whole row at the library's `opacity: .5` | Silver @ .5 | Snow @ .5 | — | — | label 4.34:1, glyph 2.26:1 — disabled content is exempt from the minimums | `aria-disabled="true"`, stays in the menu's arrow-key order | — | — |
| Default | ✱ leading glyph | none | 16px, Silver `--ui-designer-text-muted` on rest and hover, 10px gap; each menu keeps its current glyph family (no swap to Figma's icons), and a menu with no glyphs (catalog asset, custom item) gets none | `H8 Regular` Snow, 12px in every menu | — | 200 min × 38 | as Default | glyph `aria-hidden` | — | — |
| Default | ✱ submenu parent (Figma draws none) | Pale Black while its submenu is open | as Default | as Default | chevron White 40 in every state | 38 | chevron 3.39:1 on Onix, 3.05:1 on Pale Black | `aria-haspopup="menu"`; the name is the row's own label ("Add Component"), never its submenu's items | — | — |

**Inspector context menus** (layer 3b, unit 1): the eight react-contexify menus take this look, and their board is ours, in [Context menus (inspector)](#context-menus-inspector).

**Status:** signed off by the user; the spoke carries the three sign-off changes (the 400ms close delay, the submenu scrollbar and reduced motion).

**Decisions** (the record for these menus; grep here before asking again):

| Date | Question | Answer |
| --- | --- | --- |
| 2026-10-26 | Where do the `--contexify-*` value changes land? | On the spoke with the component CSS, so each PR is visually complete on its own. New tokens (`--menu-shadow`) go to the hub. |
| 2026-10-26 | Row height? | 38px, as Figma (react-contexify draws 32 today). |
| 2026-10-26 | Label size? | 12px (`H8 Regular`) in every menu. The catalog, custom item and tile menus inherit 14px today. |
| 2026-10-26 | Row glyphs? | 16px Silver `--ui-designer-text-muted`, 10px gap, Silver on hover too. No glyph swaps, and no glyphs added to menus that have none (✱ leading glyph). |
| 2026-10-26 | Disabled rows? | The library's `opacity: .5` (label 4.34:1). This replaces the White 40 label proposal (✱ disabled). |
| 2026-10-26 | Keyboard focus? | A 1px inset Snow `--focus-ring` on the arrow-key-active row, over Pale Black, as the Dropdown list. This replaces the 2px accent outline at −2px proposal (✱ keyboard active). |
| 2026-10-26 | Label casing? | Title Case, following Figma's menus ("Enable Autosave"): Add Child, Add Component, New Folder, Add to Filesystem, Copy Name, Copy File Name / Copy File Names, Duplicate N Items, Delete N Items. Rename, Duplicate, Delete, Create Custom Item and Copy Path / Copy Paths stay as they are. |
| 2026-10-26 | The per-panel overrides (`Tree.css` `.Tree .contexify svg`, `Tile.css` `.ProjectView .contexify .contexify_itemContent`)? | Delete both; one global `.contexify_itemContent` rule in `theme/index.css` replaces them. Keep `Tree.css`'s `.Tree .item > div:not(.contexify)`: the menu renders inside the tree row and must stay out of its layout. |
| 2026-10-26 | Accessibility fixes in this unit? | Yes, test-first. The menu gets an accessible name, separators get `role="separator"`, glyphs get `aria-hidden`, Escape returns focus to the trigger, and "Add Component"'s name stops including its submenu's items. |
| 2026-10-26 | The tile menu closes on the first ArrowDown and no row takes focus. Fix it here? | Yes, in this unit. |
| 2026-10-26 | No Figma board draws the inspector's context menus. Who designs it? | We do, in this doc: [Context menus (inspector)](#context-menus-inspector), composed only from Menu `20749:386` and Menu-Entry `20749:790` on our tokens. It becomes the unit's source once the user approves it. Design's review of it is tracked on G10 and blocks nothing. |
| 2026-10-26 | Approve our board as the unit's source? | Yes, with its three proposals below. |
| 2026-10-26 | Group the rows with dividers? | Yes: edit verbs and create / copy verbs form two groups. Hierarchy root, custom item, tree row and tile each gain a divider; the Hierarchy entity's divider moves from before Add Component to before Create Custom Item. |
| 2026-10-26 | Tile order? | Delete moves up beside Rename and Duplicate, as in the tree row. |
| 2026-10-26 | Section headers, and a danger colour for Delete? | No Section headers; Delete stays Snow. |
| 2026-10-26 | The menus' accessible names? | Entity Options (Hierarchy), Spawn Point Options (PlayerTree), Asset Options (Local Assets tree and tile), Catalog Asset Options, Custom Item Options, Node Options (UI Designer `NodeTree`); the submenu row is "Add Component", and the submenu container is a `role="menu"`. |
| 2026-10-26 | Keyboard and focus behaviour, as built? | Approved: the app's shortcuts pause while a menu is open; rows, tiles and cards take focus on left-click (`tabIndex -1`); Escape returns focus to the trigger row. |
| 2026-10-26 | The returned focus draws the browser's default blue ring on the row, tile or card. Who themes it? | This unit: a 1px inset Snow `--focus-ring` on `:focus-visible`, the same ring as the menu rows. G19 keeps the tree rows' arrow-key navigation and reuses this ring. |

### Menu (Menu)

Component [`20749:386`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20749-386), 1 variant: two `Options` / `Options2` slots (each Fill × Hug, padding 0 / 10, holding Menu-Entry instances) around a Div entry. Size 200 × 117 (10 + 38 + 10 + 1 + 10 + 38 + 10, the border outside the clip). Read October 27, 2026. Code: inspector react-contexify menus and the UI Designer popovers · Creator Hub ui2 `Menu`.

Code detail: inspector react-contexify (`--contexify-menu-shadow` `2px 2px 10px rgba(0,0,0,.5)`, `--contexify-menu-padding` 6px) until the Menu-Entry spoke sets the [Context menus (inspector)](#context-menus-inspector) values; Creator Hub ui2 `Menu` (MUI `Paper` elevation on `background.paper`).

| Part | State | Fill | Border | Radius | Shadow | Size / spacing | Contrast | A11y | Inspector token | Creator Hub token |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Container | open | Onix | 1px White 10 all sides | 12px | `0 4px 8px rgba(0,0,0,.4)` | 200 × Hug (117 with one entry per slot), padding 10 / 0, gap 10 | Onix vs `#161518` 1.46:1, vs `#242129` 1.27:1 — the shadow and border carry the edge | `role="menu"` with `aria-labelledby` the trigger; Escape closes, arrows move, focus returns to the trigger | `--palette-neutral-onyx` (aliased by `--ui-designer-control-bg`), `--palette-whiteTransparent-subtle`, `--shape-borderRadiusLarge`, `--menu-shadow` | PROPOSED `--menu-bg`, PROPOSED `--menu-shadow`; ui2 `Menu` paints MUI defaults |
| Options / Options2 | — | none | none | — | — | Fill × Hug, padding 0 / 10 | — | `role="group"` when a Section labels it | — | — |
| Entry (in the slots) | — | none | none | 8px | — | Fill × 38, padding 0 / 10, gap 10: `Info` 16 + label `H8 Regular` Snow; no trailing arrow | as Menu-Entry | as Menu-Entry | as Menu-Entry | as Menu-Entry |
| Div | — | as Menu-Entry Div | — | — | — | between the slots, full bleed (the Menu's full width) | — | `role="separator"` | `--palette-whiteTransparent-subtle` | missing |
| Container | ✱ width | as above | as above | as above | as above | `min-width: 200px`; the menu grows with a long label ("Delete 12 Items", component names) where Figma draws a fixed 200 | — | — | — | — |
| Div | ✱ inset | White 10 | — | — | — | inset with the rows, 10px clear above and below (Figma: full bleed in the composed menu); user decision October 21, 2026 (#1707) | 1.36:1, decorative | `role="separator"` | — | — |
| Submenu | ✱ open (Figma draws none) | inherits every Container value (Onix, 1px White 10, 12px, `--menu-shadow`) | as Container | as Container | as Container | opens 10px clear of the parent menu; scrolls past 30vh (`theme/index.css` `.contexify_submenu`) with the thin menu scrollbar (✱ below); opens at once and stays open 400ms after the pointer leaves its parent row, so a diagonal move across the gap reaches it; the keyboard opens and closes it at once | as Container; scrollbar thumb outline 5.07:1 on Onix (the Black 40 fill alone is 1.32:1) | `role="menu"`, opened from a row with `aria-haspopup="menu"` | — | — |
| Container | ✱ enter motion (Figma draws none) | — | — | — | — | the library's 0.3s fade with a 10px slide, turned off under `prefers-reduced-motion: reduce`; the submenu's 400ms close delay stays under reduced motion (hover intent, not motion) | — | — | — | — |
| Submenu | ✱ thin menu scrollbar (deviates from Figma's 16px Scrollbar `20931:3935`, sized for menus; Figma draws none inside a menu) | thumb `--palette-blackTransparent-blurry` (Black 40) with a 1px `--palette-whiteTransparent-backdrop` (White 60) outline; track transparent | — | `--shape-borderRadiusPill` | — | a 6px gutter holding a 4px pill thumb (outline included), the track inset 10px top and bottom; the same scrollbar on the `Dropdown` `OptionList` (user, October 26, 2026) | outline 5.07:1 on Onix | native scrollbar; no ARIA | — | — |

**Decisions** (the record for this component; grep here before asking again):

| Date | Question | Answer |
| --- | --- | --- |
| 2026-10-26 | Name the Menu shadow token, and which rules consume it? | `--menu-shadow` = `0 4px 8px rgba(0,0,0,.4)`, a new token in the hub. `--contexify-menu-shadow`, `OptionList.css` and `MoreOptionsMenu.css` consume it; the snap card (`Gizmos.css`) switches after #1714 merges (G30). |
| 2026-10-26 | Menu width? | `min-width: 200px`, Figma's width, growing with long labels (✱ width). |
| 2026-10-26 | Submenus? | They inherit the container values; the chevron is White 40 in every state; the open parent row takes the Pale Black hover fill; the 30vh scroll cap stays (✱ open, and Menu-Entry ✱ submenu parent). |
| 2026-10-26 | A diagonal pointer path from "Add Component" to its 5th item closed the submenu (a row-height hover bridge doesn't cover it). Keep the 10px gap? | Yes, with a close delay: the submenu stays open about 250ms after the pointer leaves its parent row (a CSS `transition-delay` on closing only); opening stays instant. |
| 2026-10-26 | Sign-off of the Before / After / Board set (layer 3b unit 1) | Signed off, with the three changes below. |
| 2026-10-26 | The 250ms close delay drops a 500–750ms diagonal. Change it? | Raise it to 400ms. Opening stays instant, and the keyboard still opens and closes the submenu at once. |
| 2026-10-26 | The submenu shows the platform scrollbar (a light thumb on Onix). Theme it? | Yes, in this unit, as the thin menu scrollbar (✱), on the react-contexify submenu and the `Dropdown` `OptionList`; other inspector scroll areas stay as they are. |
| 2026-10-26 | The menus' enter animation ignores reduced motion. Change it? | Under `prefers-reduced-motion: reduce` the enter animation (0.3s fade and 10px slide) is off. |
| 2026-10-26 | Under reduced motion, does the submenu keep its 400ms close delay? | Yes. Reduced motion turns off only the enter animation; the close delay is hover intent, not motion, and without it a diagonal move can't reach the submenu. |
| 2026-10-26 | How wide is the menu scrollbar? | Thin, sized for menus: a 6px gutter with a 4px Black 40 pill thumb and a 1px White 60 outline, the track transparent and inset 10px top and bottom (✱ thin menu scrollbar). It applies to the react-contexify submenu and the `Dropdown` `OptionList`. |

### Context menus (inspector)

Our board for the inspector's right-click menus (decision October 26, 2026; no Figma board draws them). It is composed only from Menu `20749:386` and Menu-Entry `20749:790`, with design's conventions from the Toolbar ⋮ and Camera menus (`21722:57105`, `21719:56872`) and the TitleBar menus (`21372:16356`):

- rows inset 10px inside the menu;
- a Div between groups of related actions;
- a Section only to name a choice group (there is none here: a context menu is named by what was right-clicked);
- Title Case labels.

**Status:** approved by the user, proposals included; it is the source for layer 3b unit 1. Design's review is tracked on G10 and blocks nothing.

**Tokens.** Every part below is a token, set in `vars.css` or in the one `theme/index.css` rule:

| Part | Token | Value | Figma |
| --- | --- | --- | --- |
| Menu fill | `--contexify-menu-bgColor: var(--palette-neutral-onyx)` | `#35333b` | Neutrals/Onix |
| Menu border | `border: 1px solid var(--palette-whiteTransparent-subtle)` (a `.contexify` rule: the library has no border variable) | `rgba(255,255,255,.1)` | 1px White 10 |
| Menu radius | `--contexify-menu-radius: var(--shape-borderRadiusLarge)` | `12px` | 12px |
| Menu shadow | `--contexify-menu-shadow: var(--menu-shadow)` | `0 4px 8px rgba(0,0,0,.4)` | drop shadow 0 / 4 / 8 Black 40 |
| Menu inset | `--contexify-menu-padding` (`--contexify-menu-negatePadding` follows it) | `10px` | padding 10 / 0, slots 0 / 10 |
| Menu width | `--contexify-menu-minWidth` | `200px`, grows with a long label | Fixed 200 (✱) |
| Row | `--contexify-itemContent-padding`; the global `.contexify_itemContent` rule adds `min-height: 38px` and `gap: 10px` | `0 10px` | Fill × 38, padding 0 / 10, gap 10 |
| Row radius | `--contexify-activeItem-radius` | `8px` | 8px |
| Label | `--contexify-item-color`, `--contexify-activeItem-color`: `var(--ui-designer-text)`; `--font-family` 400 12px | `#fcfcfc` | `H8 Regular` Snow |
| Glyph | `color: var(--ui-designer-text-muted)`, 16 × 16, rest and hover | `#a09ba8` | `Info` 16, Silver |
| Hover | `--contexify-activeItem-bgColor: var(--gray-0)` | `#43404a` | Pale Black |
| Keyboard active | hover fill plus `box-shadow: inset 0 0 0 1px var(--focus-ring)` | `#fcfcfc` | not drawn (✱) |
| Disabled | the library's `opacity: .5` | — | not drawn (✱) |
| Divider | `--contexify-separator-color: var(--palette-whiteTransparent-subtle)`, `--contexify-separator-margin: 10px 0`, 1px | `rgba(255,255,255,.1)` | Div White 10 (✱ inset with the rows) |
| Submenu chevron | `--contexify-arrow-color`, `--contexify-activeArrow-color`, `--contexify-rightSlot-color`, `--contexify-activeRightSlot-color`: `var(--palette-whiteTransparent-blurry)` | `rgba(255,255,255,.4)` | `arrow-right` 10, White 40 |
| Submenu | a nested `.contexify` with every value above. It opens 10px clear of the parent menu, its first row level with the parent row (as the TitleBar menu), and scrolls past `max-height: 30vh` with the thin menu scrollbar (6px gutter, 4px Black 40 pill thumb, 1px White 60 outline, track inset 10px; ✱ deviation from "Scrollbar (Scrollbar)"). It opens at once and closes 400ms after the pointer leaves the parent row (`transition-delay` on closing only, no fade); the keyboard opens and closes it at once | — | not drawn (✱) |
| Enter motion | the library's fade with a 10px slide (0.3s), off under `prefers-reduced-motion: reduce` | — | not drawn (✱) |

A menu is `22 + 38 × rows + 21 × dividers` tall: the padding plus border, then each row, then each divider with its 10px above and below.

**The eight menus.** Rows are listed top to bottom, with ─ for a divider. Glyphs keep their current family. The hover shot uses the first enabled row, and the keyboard-active shot the second.

| Menu (code) | Trigger | Rows | Glyphs | States drawn | Size |
| --- | --- | --- | --- | --- | --- |
| Hierarchy entity (`Hierarchy/ContextMenu` + `Tree/ContextMenu`) | an entity row | Rename · Add Child · Duplicate · Delete ─ Create Custom Item · Add Component ▸ | yes, except Add Component | default, hover, keyboard active, submenu open (component names; scrolls past 30vh) | 200 × 271 |
| Hierarchy root | Scene | Add Child ─ Create Custom Item | yes | default, hover, keyboard active | 200 × 119 |
| Player spawn point (`Hierarchy/PlayerTree`) | a spawn point | Rename · Duplicate · Delete | yes (`Md*` / `Ai*`, 16px) | default, hover, keyboard active, disabled Delete (one spawn point) | 200 × 136 |
| Catalog asset (`AssetsCatalog/Asset/ContextMenu`) | an asset | Add to Filesystem; a built-in emote shows Copy Name instead | none | default, hover, keyboard active | 200 × 60 |
| Custom item (`CustomAssets/ContextMenu`) | a custom item | Add to Filesystem ─ Rename · Delete | none | default, hover, keyboard active | 200 × 157 |
| Local Assets tree row (`ProjectView` + `Tree/ContextMenu`) | a folder row | Rename · New Folder · Duplicate · Delete ─ Copy Path · Copy File Name | yes | default, hover, keyboard active | 200 × 271 |
| Local Assets tile (`ProjectAssetExplorer/Tile`) | a tile | Rename · Duplicate · Delete ─ Copy Path · Copy File Name | yes | default, hover, keyboard active | 200 × 233 |
| UI Designer node (`UIDesigner/LeftPanel/NodeTree` + `Tree/ContextMenu`) | a node row in the 2D hierarchy | Rename · Duplicate · Delete (Rename only on a renameable node; no Add Child) | yes | default, hover, keyboard active | 200 × 136 |

Variants of the same menus:

- **File row:** a model row has no New Folder (200 × 233).
- **Multi-selection, tile:** Duplicate N Items · Delete N Items ─ Copy Paths · Copy File Names, with Rename hidden (200 × 195).
- **Multi-selection, tree row:** Rename is hidden, Duplicate and Delete keep their labels, and the copy rows become Copy Paths · Copy File Names.
- **Read-only path:** the copy group only.
- **Built-in emote** (tile or tree row): Copy Name only.

**What the board sets beyond the per-row decisions** (approved by the user):

- **Grouping dividers** in the Hierarchy root, custom item, tree row and tile menus. The Hierarchy entity menu's divider sits before Create Custom Item, so the edit verbs and the create verbs form two groups.
- **The tile's Delete sits with** Rename and Duplicate, so the tile and the tree row list the same verbs in the same order.
- **No Section headers.**
- **Delete stays Snow:** Figma draws no danger colour.

**Accessibility, every menu:**

- `role="menu"` named by `aria-label`, `role="menuitem"` rows, `role="separator"` dividers and `aria-hidden` glyphs.
- The submenu row has `aria-haspopup="menu"` and is named "Add Component", by its own label; the submenu container is a `role="menu"` too.
- Arrow keys move the 1px Snow ring, and the app's shortcuts pause while a menu is open.
- The trigger takes focus: rows, tiles and cards are focusable on left-click (`tabIndex -1`), and Escape returns focus to the row that opened the menu. That returned focus draws the same ring as the menu rows, a 1px inset Snow `--focus-ring` on `:focus-visible` (`outline: 1px solid var(--focus-ring); outline-offset: -1px`), never the browser's default.
- Contrast: label 12.13:1 on Onix and 9.88:1 on Pale Black; glyph 4.59:1 and 3.74:1; chevron 3.39:1 and 3.05:1; ring 9.88:1 in the menu. On the triggers the ring is 17.73:1 on the tree `#161518`, 10.40:1 on a selected row `--selected-item`, 9.88:1 on a tile `--gray-0`, 11.93:1 on a card `--list-item-bg-color`, and 7.96:1 on a hovered card.

| Menu                                | Accessible name (`aria-label`) |
| ----------------------------------- | ------------------------------ |
| Hierarchy entity and Hierarchy root | Entity Options                 |
| Player spawn point                  | Spawn Point Options            |
| Local Assets tree row and tile      | Asset Options                  |
| Catalog asset                       | Catalog Asset Options          |
| Custom item                         | Custom Item Options            |
| UI Designer `NodeTree`              | Node Options                   |

### DefaultModal (Modals)

Component `DefaultModalButtonsHorizontal` [`21183:30733`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21183-30733), 1 variant, placed twice on the page: under `<DefaultModal> | Horizontal Stack Buttons` (the component) and `| Vertical Stack Buttons` (instance [`21196:31147`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21196-31147)). Size Hug 700 × 413 (horizontal), 479 (vertical). Read October 27, 2026. Code: inspector `components/Modal` · Creator Hub ui2 `Modal` (`Modals/index.ts`), `Modals/WarningModal`.

Shared: row, Hug 700 × Hug, fill `#181225` (a raw hex, no variable), 1px White 10 border, 24px radius, clips, padding 100, gap 100; `Glow` 1037 × 513 Mythic `#FF4BED` @ 30% with layer blur 500, flipped vertically and centred, at top calc(50% + 437px) (decorative); `Content` column Fixed 500 × Hug, gap 50: title `H2 Semi` Snow ("Delete Mobile Variant"), body `H6 Regular` Gray ("Deleting the Mobile layout will delete its device specific settings. Your Desktop layout will remain unchanged."), `CTAs` gap 20 of two `Button-Contained-Text` 46 tall, 12px radius, padding 12 / 24, label Inter 16 / 600 / 22 uppercase Snow; `close-button` 36 × 36, 100px pill, White 10 fill, at right 19 / top 19, its X at inset 20% (a 14.4 box). Code detail: Creator Hub `Modals/index.ts` `Modal` = ui2 `Modal` (paper `--modal` `#242129`, 12px radius, padding 24, widths 540 / 720 / 900, no border, no glow) and `Modals/WarningModal` (centred `--dcl-silver` message, 150px-min buttons, gap 16) — drift on fill, radius, border, padding, close button and button size; inspector `components/Modal` (`--modal-content-bg-color` → `#161518`, `--tree-border-color` border, 3px radius, padding 20, min 500 × 200, overlay `--modal-overlay-bg-color`) — drift.

| Variant | State | Fill | Border | CTAs | Close | Contrast | A11y | Inspector token | Creator Hub token |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Horizontal | default | `#181225` + glow | 1px White 10 | row, gap 20: `Secondary` (White 10 fill) "CANCEL" then `PrimaryBlocked` (Primary fill) "DELETE MOBILE", each Fill 240 × 46 | White 10 pill, 36 × 36 | title 17.77:1, body 11.58:1 on `#181225`; CANCEL 13.51:1 over White 10; **DELETE 3.55:1 Snow on Primary — fails 4.5:1** (16px / 600 is not large text); modal vs page `#16141a` 1.00:1 — only the 1.32:1 border and the glow separate it; close pill vs modal 1.32:1, a Gray glyph on it 8.80:1, a Snow one 13.51:1 | `role="dialog" aria-modal="true" aria-labelledby` the title, `aria-describedby` the body; focus trapped, Escape closes; close is `<button aria-label="Close">`, 36px target; Cancel first in DOM order | fill `--modal-content-bg-color` drift → `#181225` (pending spoke); `--palette-whiteTransparent-subtle` (border, Secondary, close); `--primary-main`; radius PROPOSED `--shape-borderRadiusXLarge`; glow missing (asset) | fill `--modal` drift → `#181225` (pending spoke); `--primary`; the rest missing |
| Vertical | default | same | same | column, gap 20: `PrimaryBlocked` "DELETE MOBILE" above `Secondary` "CANCEL", each Fill 500 × 46 | same | as Horizontal | primary action first in DOM order here — one order per platform, the user picks | as Horizontal | as Horizontal |
| any | ✱ hover / press | — | — | per the Buttons page | ✱ `Hover Style` True is drawn nowhere on this page — propose White 10 over Black 60 | — | — | — | — |
| any | ✱ focus | — | — | — | — | ring on `#181225`: `--ui-designer-control-accent` 8.15:1, `--border-focused` 4.35:1; Creator Hub ui2 `palette.info.light` 8.15:1 | `:focus-visible` outline 2px on every button; initial focus on Cancel | — | — |

### Help & Support Modal (Modals)

Component `Modal` [`20915:8417`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20915-8417), 1 variant (`Scrollview` Default), under the label `<Help&Support>`, with the modal header `TitleBar` [`20931:3932`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20931-3932). Size Fixed 800 × Hug. Read October 27, 2026. Code: inspector none · Creator Hub none (`Navbar/LogoMenu` lists Help and Report-bug items that open external links; no in-app modal).

Shared: column, Fixed 800 × Hug, fill `#181225`, 1px White 10, 24px radius, clips, gap 50; `TitleBar` `20931:3932` Fill 798 × 50, Black 20 fill, 1px White 10 bottom rule, padding 10 / 20: "Help & Support" `H5 Semi` Inter 18 / 600 Snow + a 30 × 30 `close-button` (White 10, 100px pill, its X in an 18 box); `Glow` 824 × 257.5 Mythic @ 30% blur 500, flipped and centred, at bottom −131.5; `Scrollview` Fill × Hug, padding 0 / 80 / 50, gap 50, centred, holding three `LabelAccordion` instances (general, create, support updates; each group label Inter 16 / 400 uppercase White 60, 10 above its Questions frame), a footer row of two flex-1 cells (gap 10) and a `Scrollbar` instance (14 × 860, absolute at right 10 / top 0, padding-bottom 300; Handle 14 × 560).

Copy: general: "What can I create in Decentraland?" (collapsed), "How do I become a Decentraland creator?" (expanded); create: What can I create in Decentraland? / How do I become a Decentraland creator? / What tools are necessary to be a Decentraland creator? / Is it possible to monetize my creations? / Does Decentraland take a cut from creator's earnings? / Do I need to own LAND to build in Decentraland? / Where can I hire creators to design or build something for me? / What's the difference between a LAND and a World? / Can I control who can see the content of my World and LAND?; support updates: Attention Creators: Backface Culling Updates. Footer: "Don't see your question above?" and the link "Speak with the Support Team".

| Part | State | Fill | Border | Typography | Size / spacing | Contrast | A11y | Inspector token | Creator Hub token |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TitleBar | default | Black 20 | 1px White 10 bottom | title `H5 Semi` 18 / 600 Snow; close 30 × 30 White 10 pill, its X in an 18 box | 798 × 50, padding 10 / 20 | title 18.45:1 on the Black 20 composite `#130e1e`; fill vs modal 1.04:1, decorative | `<h2 id>` referenced by the dialog | fill PROPOSED `--palette-blackTransparent-soft` (`--contexify-separator-color` holds the value); `--palette-whiteTransparent-subtle`; `--palette-neutral-softWhite` | missing |
| Scrollview | default | none | none | entries per LabelAccordion; group label Inter 16 / 400 uppercase White 60 (not the `H6 Semi Caps` White 40 of the LabelAccordion set) | padding 0 / 80 / 50, gap 50 | group label White 60 7.08:1 on `#181225` (≥ 4.5:1) | `overflow: auto` region; keyboard-scrollable (`tabindex="0"`) when the content overflows | `--palette-whiteTransparent-backdrop` (group label) | missing |
| Don't see your question above? | default | — | — | `H7 Regular` Inter 14 / 400, line-height normal, Snow, right-aligned | a flex-1 cell of the footer row (gap 10) | 17.77:1 | plain text | `--ui-designer-text` | missing |
| Speak with the Support Team | default | — | — | Inter 14 / 400, line-height normal, Primary, solid underline | the other flex-1 cell | **5.00:1 (≥ 4.5:1)** | `<a>` opening the support channel; the underline keeps it identifiable without colour | `--primary-main` | `--primary` |
| Scrollbar | default | as Scrollbar (Scrollbar) at 14 wide | — | — | 14 × 860, absolute at right 10 / top 0, padding-bottom 300 | as Scrollbar | — | `--palette-blackTransparent-blurry`, `--palette-whiteTransparent-backdrop`, `--shape-borderRadiusPill` | missing |

### ReportBug (Modals)

Component `ReportBug` [`21196:31035`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21196-31035), 1 variant (`Scrollview` Modified), under the label `<ReportBug>`. Size Fixed 800 × 700. Read October 27, 2026. Code: inspector none · Creator Hub none (the `Navbar/LogoMenu` report-bug item opens an external link; no in-app form).

Column, fill `#181225`, 1px White 10, 24px radius, gap 50; `TitleBar` as Help & Support, titled "Report Bug"; `Glow`; `Scrollview` Fill 798 × Hug, padding 0 / 80 / 50, gap 50. The inputs belong to the Inputs section; their instance props are recorded here. Required markers `*` are Primary.

| Part | State | Component | Fill | Size / spacing | Typography | Contrast | A11y | Inspector token | Creator Hub token |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Dropdown-Input | `Property 1` Default | Inputs page | — | Fill 638 × Hug, gap 10 | title `H6 Semi` Snow "Issue Type" + a Primary `*`; help `H7 Regular` Snow "Select your issue category"; field 46 tall, 1px White 40 border, 12px radius, padding 0 / 16, gap 10, value `H6 Regular` Snow "Scene Creation & Management", `arrow-down` 14 box | 17.77:1 | `<label for>` + `<select>` or listbox | `--palette-whiteTransparent-blurry`, `--shape-borderRadiusLarge`, `--primary-main` | `--primary`; the rest missing |
| Description | — | column of Text-Input + Button-Contained-Text-Icon | — | Hug 638 × 222, gap 10 | label `H6 Semi` Snow "Description" + a Primary `*`; help `H7 Regular` Snow "Briefly describe what happened." | — | — | `--primary-main` | `--primary` |
| Text-Input | `Property 1` Default | Inputs page | — | Fixed 638 × 182, gap 10; the field fills the height, padding 14 / 16 | field 1px White 40, 12px radius; placeholder Inter 16 / 400 White 40 "Issue description" | — | `<textarea aria-describedby>` | `--palette-whiteTransparent-blurry`, `--shape-borderRadiusLarge` | missing |
| Button-Contained-Text-Icon (Attach) | `Property 1` Secondary, with overrides | Buttons page | **none** (Secondary's White 10 fill is overridden off) | Hug 257 × 30, 6px radius, padding 6 / 10, gap 10; `Attach` glyph 18 × 18, a 1.5px Transparencies/White 60 stroke | label "Paste, drop, or click to add files", `H7 Regular` Inter 14 / 400 / 100%, sentence case, Transparencies/White 60 | label 7.08:1 on `#181225` | `<button>` with a visible label; 30px tall clears the 24px floor. A dropzone affordance, not a styled Secondary button: code takes only its box for `Button size="small"` and keeps the Secondary paint and today's 13px white label (read in the browser, October 21, 2026) | `--palette-whiteTransparent-backdrop`, `--shape-borderRadius` | missing |
| Checkmark | `Property 1` On | Checkbox Secondary 20 box + consent text | — | Fill 638 × 20, gap 10 | `H7 Regular` Snow, right-aligned | text 17.77:1; check Primary 5.00:1, ring White 40 3.82:1 (≥ 3:1) | `<input type="checkbox">` with the sentence as its `<label>` | `--ui-designer-text` | missing |
| CTAs | — | row, gap 20 | — | Fill 638 × 46 | — | — | — | — | — |
| CANCEL | `Secondary` | Button-Contained-Text | White 10 | flex 1 × 46, 12px, padding 12 / 24 | Inter 16 / 600 / 22 uppercase Snow | 13.51:1 | — | `--palette-whiteTransparent-subtle` | missing |
| SUBMIT (disabled) | `PrimaryBlocked` @ 20% opacity | Button-Contained-Text | Primary at 20% | flex 1 × 46 | same | fill vs modal 1.24:1; node opacity dims the label too: Snow at 20% composites to about `#464150`, 1.50:1 on the fill, 1.85:1 on the modal (browser capture, October 21, 2026) — the dim state reads as disabled by opacity alone | `disabled` + `aria-disabled`; the 20% opacity is the only disabled cue drawn, add a tooltip or helper text saying why | `--primary-main` | `--primary` |

### Secure-Sign-In (Modals)

Component [`20808:605`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20808-605), 1 variant. Size Hug 1115 × 650. Read October 27, 2026. Code: inspector none · Creator Hub `SignInPage` (a page, not a modal).

Row, Hug 1115 × Hug 650, fill `#181225`, 1px White 10, 24px radius, padding 100, gap 100; `Glow` 1037 × 513 Mythic @ 30% blur 500, flipped, at top calc(50% + 436.5px); `Text` column Fixed 500 × Hug, gap 40; `Image` 315 × 450, clips, holding `padlock.png` rotated 19.01° clockwise; `close-button` 46 × 46, 100px pill, Black 60, at right 19 / top 19. Its close button differs from DefaultModal's (36, White 10) and the modal TitleBar's (30, White 10). Code detail: Creator Hub `SignInPage` is a full page over `genesis_plaza.webp` with a `#491975` gradient, ui2 `Typography` h3 / h6 / body1 and a `--dcl-silver` reopen link, with no verification-number view — drift: the design is a modal with the code, the app is a page without it.

| Part | State | Typography | Colour | Size | Contrast | A11y | Inspector token | Creator Hub token |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Secure Sign-in | default | `H0 Semi` 48 / 600 | Snow | 500 × 58 | 17.77:1 | `<h1>` / dialog label | `--ui-designer-text` | ui2 `Typography` h3 |
| A browser window should open… | default | `H5 Regular` 18 / 400 | Snow | 500 × 52 | 17.77:1 | — | — | — |
| 29 (verification number) | default | Inter 100 / 600 / normal (unnamed) | Snow | 500 × 121 | 17.77:1 | `aria-live="polite"` region; read as digits | — | — |
| Expiration Counter | default | `H5 Regular` 18 / 400 "Verification number will expire in 08:25" + `Info` 20 box | White 60 | Hug 359 × 22, gap 9 | 7.08:1 (≥ 4.5:1) | the countdown is `aria-live="off"` with a static `aria-label` (a ticking live region would announce every second); `Info` is a `<button aria-label>` or decorative | `--palette-whiteTransparent-backdrop` | missing |
| Image | default | — | padlock raster, PNG export | 315 × 450 | — | `alt=""` | — | — |
| Close button | default | — | Black 60 pill, its X at inset 20% | 46 × 46, right 19 / top 19 | pill vs modal 1.10:1; a Gray glyph on it 12.70:1 | `<button aria-label="Close">`, 46px target | `--modal-overlay-bg-color` (same value, the overlay role) | missing |
| any | ✱ expired | — | ✱ Primary text "Verification number expired" + a retry link | — | Primary 5.00:1 | not drawn — the user decides the copy | — | — |

### Scrollbar (Scrollbar)

Component [`20931:3935`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20931-3935), 1 variant and no component set. Size 16 × 860. Read October 27, 2026. Code: inspector `UIDesigner.css` right-rail scrollbar; the react-contexify submenu and `ui/Dropdown` `OptionList` (the thin menu scrollbar ✱) · Creator Hub `theme.css` global `::-webkit-scrollbar`.

A 16 × 860 track (no fill) holding `Handle` `20931:3934`: the track's full width × the content ratio, 100px pill, Black 40 fill, 1px White 60 inner border. The Help & Support modal places it at 14 × 860 with a 560-tall handle and 300 bottom padding (the thumb proportion is placeholder, not spec). Code detail: Creator Hub global `::-webkit-scrollbar` (8px wide, track `--black`, thumb `--dcl-silver`, 4px radius) — drift on width, track, thumb colour and radius; inspector `UIDesigner.css` `.ui-designer-right-rail-tabpanel::-webkit-scrollbar` (8px, transparent track, thumb White 12 / hover White 22, 4px radius) — drift; the react-contexify submenu (`.contexify_submenu`) and `ui/Dropdown` `OptionList` take the thin menu scrollbar (layer 3b unit 1; ✱ menus row below).

| Part | State | Fill | Border | Radius | Size | Contrast | A11y | Inspector token | Creator Hub token |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Track | default | none | none | — | 16 wide | — | native scrollbar; no ARIA | — | — (`--black` track today: code drift) |
| Handle | default | Black 40 | 1px White 60, inner | 100px | 16 wide × content ratio | fill vs `#181225` 1.07:1, vs `#16141a` 1.07:1 — the border carries it: White 60 7.08:1 on the modal, 7.10:1 on the page, 7.56:1 against the handle fill (≥ 3:1 non-text) | — | `--palette-blackTransparent-blurry`, `--palette-whiteTransparent-backdrop`, `--shape-borderRadiusPill` | PROPOSED `--scrollbar-thumb` (Black 40), PROPOSED `--scrollbar-thumb-border` (White 60); `--dcl-silver` thumb today: code drift |
| Handle | ✱ hover / drag | ✱ Black 60 | ✱ White 60 | — | — | — | not drawn; `::-webkit-scrollbar-thumb:hover` | — | — |
| any | ✱ 8px variant | — | — | — | — | — | not drawn — the editor's side rails use 8px today; the user decides whether 16px is the only width | — | — |
| Menus | ✱ thin menu scrollbar (user, October 26, 2026) | thumb `--palette-blackTransparent-blurry`; track transparent | thumb 1px `--palette-whiteTransparent-backdrop` outline | `--shape-borderRadiusPill` | a 6px gutter holding a 4px thumb (outline included), track inset 10px top and bottom; sized for menus, where 16px took too much of a 200px panel | outline 5.07:1 on Onix, 4.29:1 on `--gray-0` (≥ 3:1); the fill alone 1.32:1 / 1.48:1 | react-contexify submenu and `Dropdown` `OptionList` only | — | — |

### TitleBar (Sections Titles)

Set [`10394:80020`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=10394-80020), 3 variants (Main Section `10394:80021`, Sub-Section `10394:80028`, Sub-Section+ `20461:3716`), under the `section-titles` board on the Sections Titles page. Size 1724 wide × Hug. Read October 27, 2026. Code: inspector none · Creator Hub `Title`, `EditableTitle`.

**Name collision:** the TitleBar page's set is the editor toolbar (`Editor Toolbar` below) and the modal header is also a `TitleBar` instance — this one is the page-section header; the user picks the code name.

Shared: row, Fixed 1724 × Hug, title `H0 Semi` 48 / 600 Snow ("Text", one line); `CTAs` absolute at right 0, vertically centred, gap 20: `Button-Contained-Text-Icon` `Terciary` (40 tall, 12px radius, 1.5px White 40 border, padding 8 / 24, gap 10, `settings` 18 box + "ACTION" Inter 16 / 600 / 22 uppercase Snow) and `Primary` (the same with the Primary fill, no border). Code detail: Creator Hub `Title` (`.header` gap 16, `back.svg` 45 × 45, hover `--transparent-gray-dark` circle; the title through ui2 `Typography`) and `EditableTitle` — drift on back-button size, chevron colour and title scale.

| Variant | State | Leading | Title | Trailing | Size / spacing | Contrast (on `#16141a`) | A11y | Inspector token | Creator Hub token |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Main Section | default | — | `H0 Semi` Snow "Text" | CTAs | 1724 × Hug, gap 32 | title 17.81:1; ACTION on Terciary 17.81:1, border White 40 3.83:1 (≥ 3:1); **ACTION on Primary 3.55:1 — fails 4.5:1**; glyph White 18.28:1 | `<h1>` or `<h2>` per page depth; CTAs are `<button>`s 40 tall | `--ui-designer-text`, `--palette-whiteTransparent-blurry`, `--primary-main` | ui2 `Typography`; `--primary` |
| Sub-Section | default | `BackTitle` 40 × 40, 100px pill, no fill, `arrow-left` glyph in a 24 box (inset left 15%, right 25%), Primary | `H0 Semi` Snow | CTAs | 1724 × Hug, gap 16 | chevron Primary 5.01:1 (≥ 3:1 non-text) | back is `<button aria-label="Back">` (or `<a>` to the parent), 40px target | `--primary-main` | `--primary` |
| Sub-Section+ | default | BackTitle as above | `Label` row Hug 316 × 58: `H0 Semi` Snow "Text" + `.dcl.eth` `typography/h3` 48 / 400 / 117% Graffito (180 × 56) | `Copy` 34 box (Vector 27.63 White) then CTAs | 1724 × Hug, gap 16 | **`.dcl.eth` Graffito 2.76:1 on `#16141a`, 2.39:1 on `#242129` — fails even the 3:1 large-text floor**; Silver would give 5.97:1 — the user picks; Copy glyph 18.28:1 | the suffix is part of the heading text, not `aria-hidden`; Copy is `<button aria-label="Copy name">`, 34px target, announces "Copied" via a live region | `.dcl.eth` PROPOSED `--palette-neutral-gray1` | `--light-gray` |
| any | ✱ BackTitle hover / press | ✱ White 10 / White 20 pill | — | — | — | — | not drawn (`BackTitle` `Property 1` has only Default here); Creator Hub `Title` hovers with `--transparent-gray-dark` today | — | — |
| any | ✱ focus | — | — | — | — | ring ui2 `palette.info.light` 8.13:1 on `#16141a` | `:focus-visible` 2px on back, Copy and each CTA | — | — |

### Subtitle-Navigation (Sections Titles)

Component [`20735:711`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20735-711), 1 variant, under the `SUBTITLE` label. Size 1724 × 40. Read October 27, 2026. Code: inspector none · Creator Hub none (page sub-headers are ad-hoc `Typography`).

Row, Fixed 1724 × 40, padding 3 / 0, gap 10: `Title` `H2 Semi` 24 / 600 Snow, one line; `BackTitle` 30 × 30 pill, flipped and rotated 180° into a forward chevron (`arrow-left` in a 24 box, Primary); `CTAs` as TitleBar (Terciary + Primary, 40 tall), absolute at right 0, top calc(50% − 1px), gap 20.

| Part | State | Typography | Colour | Size | Contrast | A11y | Inspector token | Creator Hub token |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Title | default | `H2 Semi` 24 / 600 | Snow | 52 × 29 | 17.81:1 | `<h2>` / `<h3>` | `--ui-designer-text` | ui2 `Typography` |
| Forward chevron | default | — | Primary | 30 × 30 pill, glyph in a 24 box (inset left 15%, right 25%) | 5.01:1 | `<a>` / `<button aria-label="Open <title>">`; **30px target is above the 24px floor but below the 40px used by TitleBar** — one size, the user picks | `--primary-main` | `--primary` |
| CTAs | default | as TitleBar | — | 298 × 40 | as TitleBar | — | as TitleBar | as TitleBar |

### Editor Toolbar (TitleBar)

Set [`21028:42468`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21028-42468), 2 variants (Default `21028:42469`, Snackbar `21028:42483`), under `<TitleBar>` on the TitleBar page. Size 1920 × 50. Read October 27, 2026. Code: inspector none (the inspector's own toolbar is the 3D/2D `Toolbar`) · Creator Hub `EditorPage` header.

Shared: 1920 × 50, fill Black, children placed absolutely; `BackCTA` 24 × 24 at left 17, vertically centred, 9999px pill, no fill, 0.5px Pale Black border, padding 2 / 3 / 2 / 1, `ChevronLeftFilled` 20 box with a 6.17 × 10 Snow Vector; `Title` at left 49, vertically centred (column gap 4, row gap 8): "Scene Title" `SF Pro Text` Medium 18 Snow (the file's only non-Inter text) + a hidden `Tag` chip (Hug 100 × 15, 9999px, padding 2 / 8, fill `secondary/secondary/dark` Gray); `Actions` row at right 16, vertically centred, 32 tall, gap 10, end-aligned: `AIToggle`, two `rounded-button-contained` (Optimize, Code), a hidden `status/scenes/builder` chip (`status` draft, Hug 111 × 22, 34px pill, Pale Black, padding 2 / 8), `Button-Multiple-Options` Preview (Hug 112 × 32, Onix Dark 1; `Left` padding 0 / 10, gap 6; `Right` 32 × 32 behind a 1px White 10 divider) and Publish (Hug 135 × 32, Primary; `Right` behind a 1px White 20 divider). Code detail: Creator Hub `EditorPage` `.Header` (56 tall on `--bg-inspector`; `.back` 32 circle with a 1px `--dark-gray` border and a 14px `ArrowBackIosIcon`; `.actions` 32-tall buttons at 8px radius, split groups with a 1px `rgba(255,255,255,.2)` divider, `--title-bar-button` fill, `.ai-toggle` 32 × 32 with `--ai-session-selected` / `-hover`) — matches on action sizing, radius and the three fills; drift on bar height (56 vs 50), back button (32 / 1px / 14px glyph vs 24 / 0.5px / 6 × 10), the Preview divider (White 20 vs White 10) and the AI glyph colour (see Editor Toolbar buttons).

| Variant | State | Fill | Left | Centre | Right | Contrast (on Black) | A11y | Inspector token | Creator Hub token |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Default | default | Black | BackCTA 24 pill + "Scene Title" Snow | — | Actions, 32 tall, at right 16 | title 20.47:1; back glyph 20.47:1, 0.5px Pale Black ring 2.07:1 — the pill edge is sub-threshold, the glyph carries the control; Tag Gray fill 13.34:1 | `<header role="banner">`; back `<button aria-label="Back to scenes">` — **24px is the floor, not a comfortable target; the app's 32px is the better size**; title `<h1>`; Actions is a `role="toolbar"` with arrow-key focus | `--black` / `--base-21` (bar), `--gray-0` (back ring), `--ui-designer-text` | `--bg-inspector`, `--dark-gray`, `--title-bar-button`, `--primary` |
| Snackbar | default | Black | same | `Snackbars` `Property 1` Notification, h 44, absolutely centred in the bar, 12px radius, fill Shadow `#161518`, padding 12 / 16 / 12 / 12, gap 16: `notification_important` 18 box + "Notification text" `H7 Regular` Snow, then "OK" `H7 Semi Caps` Primary (and a hidden "Update" `H7 Semi` in `DCL/Ruby`) | same | snackbar vs Black 1.15:1 — the 12px radius and the gap carry it; text 17.73:1 on Shadow; OK Primary 4.99:1 (≥ 4.5:1, barely) | `role="status"`; see Snackbars (Snackbars) — same component, placed inside the bar | `--tree-bg-color` (`#161518`), `--primary-main` | missing; `--primary` |
| any | ✱ title overflow | — | — | — | — | — | not drawn; truncate the title with an ellipsis and a `title` attribute, never wrap the 50px bar | — | — |

### Editor Toolbar buttons (TitleBar)

Frame `<Buttons> | Title Bar` [`21310:15793`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21310-15793), a usage board, no set: a Charcoal `#25212A` board (24px radius, 1px White 10) tabulating 9 controls × 3 columns (Default / Hover / Selected), each cell a 1px Onix border with padding 20; a `Fill/None` 16px glyph marks a state the control does not have. Read October 27, 2026. Code: inspector none · Creator Hub `EditorPage` header, `MenuOptions`.

Four components back the table — `BackCTA`, `AIToggle` (`Selected` Yes/No × `Hover` Yes/No), `rounded-button-contained` (`State` Default/Hover, `Hover Style` False/Tooltip Bottom) and `Button-Multiple-Options` (`Property 1` Default/HoverLeft/HoverRight) — whose mains live on the Buttons page; this table is the title-bar usage matrix. Hover cells carry a `Toast` tooltip, the Tooltip (Tooltips) component, in Onix Dark 1 with a `0 4px 4px rgba(0,0,0,.1)` shadow and `H8 Semi` Inter 12 / 600 Snow, centred: on the AIToggle padding 2 / 10 and a 10px radius, placed at 115.63% of the toggle; on the other buttons padding 6 / 10 and an 8px radius, 42px below Optimize / Code and 22.5px below the row centre for Play / Publish Options. Labels: "AI Assistant", "Close AI Assistant", "Optimize", "Code", "Play Options", "Publish Options". Code detail: Creator Hub `EditorPage` (`.ai-toggle` colour `--white` closed, gradient open — **inverted against Figma, where the gradient is the rest state and Snow the selected one**; `rounded-button-contained` ≈ `IconButton` on `--title-bar-button`; `Button-Multiple-Options` ≈ `ButtonGroup` + `extra-button` with the White 20 divider; MUI icons `SpeedOutlined`, `Code`, `PlayCircle`, `Public` stand in for Figma `Optimize`, `Code`, `Icon` glyphs).

| Control | Default | Hover | Selected | Size | Contrast (on Black) | A11y | Inspector token | Creator Hub token |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `<Back>` BackCTA | no fill, 0.5px Pale Black ring, Snow chevron 6.17 × 10 | White 10 fill, same ring | — | 24 × 24, 9999px | glyph 20.47:1; hover fill 1.21:1 — the hover is near-invisible on Black, the tooltip is absent; ✱ raise to White 20 (1.66:1) or add a ring change | `<button aria-label="Back">` | `--gray-0` (ring), `--palette-whiteTransparent-subtle` (hover) | `--dark-gray`; hover missing |
| `<AiAssistantOff>` AIToggle | no fill; `Icon` 24 box, sparkle 18.88 × 20.66 linear gradient `#FFD079 → #DA36FF` | Charcoal fill (`Hover` Yes); "AI Assistant" tooltip | Blue Dark 2 fill, Snow sparkle | 32 × 32, 8px | gradient ends 14.55:1 / 5.95:1 on Black; Charcoal hover vs Black 1.33:1 — weak, the tooltip announces the hover; Blue Dark 2 vs Black 2.38:1 (below 3:1 for a state boundary — the glyph colour change carries it); Snow on Blue Dark 2 8.61:1 | `<button aria-pressed="false" aria-label="AI Assistant">`; the state is colour-and-glyph, announce it with `aria-pressed` | `--palette-system-blueDark2`; Charcoal hover `--ui-designer-panel-bg` (✱ deviation, `#242129`) | `--ai-session-selected`; `--darker-gray` (✱ deviation) |
| `<AiAssistantOn>` AIToggle | Blue Dark 2 fill, Snow sparkle (`Selected` Yes) | Blue Dark 3 fill (`Selected` Yes, `Hover` Yes); "Close AI Assistant" tooltip | no fill, gradient sparkle (toggles back) | 32 × 32, 8px | Snow on Blue Dark 3 11.61:1; Blue Dark 3 vs Black 1.76:1 | `aria-pressed="true"` | `--palette-system-blueDark3` | `--ai-session-selected-hover` |
| `<Optimize>` rounded-button-contained | Onix Dark 1 fill; `Optimize` 19.2 box, Vector 14.64 × 11.71 Snow | White 10 fill replacing the Onix Dark 1 fill (`State` Hover, `Hover Style` Tooltip Bottom); "Optimize" tooltip | — | 32 × 32, 8px | Onix Dark 1 vs Black 1.49:1; glyph 13.73:1 on it; hover White 10 vs Black 1.21:1 — **the hover is darker than rest** (`#1a1a1a` vs `#2d2a33`), as Figma draws it | `<button aria-label="Optimize assets">` | PROPOSED `--palette-neutral-onyxDark1`; `--palette-whiteTransparent-subtle` (hover) | `--title-bar-button`; hover missing |
| `<Code>` rounded-button-contained | as Optimize, `Code` glyph | as Optimize (White 10 replaces the fill); "Code" tooltip | — | 32 × 32, 8px | as Optimize | `<button aria-label="Open in code editor">` | as Optimize | as Optimize |
| `<Preview>` Button-Multiple-Options | Onix Dark 1; `Left` padding 0 / 10, gap 6: `Icon` 18 + "PLAY" uppercase Snow (`button/small` 13 / 600 / 24 / 0.46 in the Editor Toolbar set; Inter 14 / 600, line-height normal, on this board); `Right` 32 × 32, 1px White 10 left border, chevron 8.5 × 5 Snow | `HoverLeft`: the left segment takes White 10 | — | Hug 113 × 32, 8px, clips | label 13.73:1; divider 1.36:1 on Onix Dark 1, decorative | split control: `<button>Play</button>` + `<button aria-label="Play options" aria-haspopup="menu">` sharing one 8px frame; the right segment is 32 × 32 | PROPOSED `--palette-neutral-onyxDark1`; `--palette-whiteTransparent-subtle` | `--title-bar-button` |
| `<PreviewOptions>` Button-Multiple-Options | as Preview | `HoverRight`: the right segment takes White 10; "Play Options" tooltip | — | same | as Preview | — | as Preview | as Preview |
| `<Publish>` Button-Multiple-Options | Primary fill; `Left` padding 0 / 14 on this board (0 / 10 in the Editor Toolbar set): "PUBLISH" `button/small` 13 / 600 / 24 / 0.46 uppercase Snow + `Icon` 18; `Right` chevron Snow, 1px White 20 divider | `HoverLeft`: the left segment takes Primary Light 1 | — | Hug 143 × 32, 8px, clips | Primary vs Black 5.76:1; **"PUBLISH" Snow on Primary 3.55:1 — fails 4.5:1** (13px / 600); divider 1.20:1 | `<button>Publish</button>` + options button | `--primary-main`, `--palette-primary-light` (hover), `--palette-whiteTransparent-soft` (divider) | `--primary`, `--primary-hover` (ships in #1703) |
| `<PublishOptions>` Button-Multiple-Options | as Publish | `HoverRight`: right segment Primary Light 1; "Publish Options" tooltip | — | same | **Snow chevron on Primary Light 1 2.80:1 — fails 3:1 non-text**; Primary Light 1 vs Black 7.31:1 | — | `--primary-main`, `--palette-primary-light` | `--primary`, `--primary-hover` (ships in #1703) |
| any | ✱ press / focus / disabled | — | — | — | — | not drawn; focus ring `--ui-designer-control-accent` / ui2 `palette.info.light` 9.39:1 on Black; disabled = 20% opacity as the ReportBug SUBMIT, plus `aria-disabled` | — | — |

### Play Options menus (TitleBar)

Frame `<Menu> | Title Bar` [`21372:16356`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21372-16356), no set: two `Menu` (Menu) instances, Play Options `21372:16534` and its submenu `21372:16364` (at 308 / 48), each Fixed 300 wide. Read October 27, 2026. Code: inspector none · Creator Hub `EditorPage/MenuOptions` (`PreviewOptions` / `PublishOptions`), `EditorPage/OptionBox`.

Each menu: Onix, 1px White 10, 12px radius, padding 10 / 0, gap 10, shadow `0 4px 8px rgba(0,0,0,.4)`; its `Options` / `Options2` slots (padding 0 / 10) hold `Menu-Entry` (Menu) instances, 38 tall, 8px radius, padding 0 / 10, gap 10, carrying `Radio` and `Checkbox Secondary` leads. Text sizes: the "PLAY OPTIONS" heading and the "Desktop Client" / "Web (Bevy)" rows are 14px; "Show QR Code for Mobile" and every submenu row are 12px. Code detail: Creator Hub ui2 `Menu` with MUI `Radio`, `Checkbox` and `Divider`, and `OptionBox` (340 wide, `--dark-gray`, 8px radius, padding 10 / 30) — drift on width, fill, entry anatomy and text sizes.

| Menu | Entry | Variant | Lead | Label | Trailing | Size | Contrast (on Onix) | A11y | Inspector token | Creator Hub token |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Play Options | PLAY OPTIONS | `Section` | — | `H7 Regular` Inter 14 / 400 uppercase Silver | — | Fill 280 × 38, 8px, padding 0 / 10, no glyph | 4.59:1 | group heading, not focusable | `--ui-designer-text-muted` | `--dcl-silver` |
| Play Options | Desktop Client | `Hover` (drawn as the active row) | `Radio` `On` 20 box: 1px White 40 ring + Primary dot | `H7 Regular` Snow (210 wide) | `arrow-right` 10 box (submenu) | Fill 280 × 38, Pale Black fill | label 9.88:1 on Pale Black; **Primary dot 2.78:1 and White 40 ring 3.05:1 on the Pale Black row — the dot fails 3:1 while hovered**; on Onix at rest: dot 3.41:1, ring 3.39:1 | `role="menuitemradio" aria-checked="true" aria-haspopup="menu"` | `--gray-0` (row), `--ui-designer-text`, `--primary-main`, `--palette-whiteTransparent-blurry` | `--dark-gray`, `--primary` |
| Play Options | Web (Bevy) | `Default` | `Radio` `Off`: 20 box, 1px White 40 ring, 100px | `H7 Regular` Snow | `arrow-right` (hidden) | Fill 280 × 38 | label 12.13:1; ring 3.39:1 (≥ 3:1) | `role="menuitemradio" aria-checked="false"` | `--ui-designer-text`, `--palette-whiteTransparent-blurry` | missing |
| Play Options | — | `Div` | — | — | — | 300 × 1, White 10, full width, no side padding | 1.37:1, decorative | `role="separator"` | `--palette-whiteTransparent-subtle` | missing |
| Play Options | Show QR Code for Mobile | `Default` | `Info` 16 box (hidden) | `H8 Regular` Inter 12 / 400 Snow | `arrow-right` (hidden) | Fill 280 × 38 | 12.13:1 | `role="menuitem"` | `--ui-designer-text` | missing |
| Submenu | Enable Landscape Terrains / Enable MCP Server / Compress Assets | `Default` | `Checkbox Secondary` `On` 16 box, 5px radius: White 40 ring + `Checkmark (Stroke)` 9.6 × 8 Primary | `H8 Regular` Inter 12 / 400 Snow | — | Fill 280 × 38, gap 10 | check Primary 3.41:1, ring 3.39:1 (≥ 3:1) | `role="menuitemcheckbox" aria-checked="true"` | `--primary-main`, `--palette-whiteTransparent-blurry` | `--primary` |
| Submenu | Multi-Instance Preview | `Default` | `Checkbox Secondary` `Off`: 16 box, 5px radius, 1px White 40 ring | `H8 Regular` Inter 12 / 400 Snow | — | same | ring 3.39:1 | `aria-checked="false"` | `--palette-whiteTransparent-blurry` | missing |
| any | ✱ keyboard-active checkbox row | `Hover` | — | — | — | Pale Black | as Desktop Client — the Primary check falls to 2.78:1 | arrow keys move, Space toggles without closing | — | — |

### ConnectionStatus (Profile Snapshot)

Set [`20772:851`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20772-851), 2 variants (Online `20772:852`, Away `20772:854`). Size 10 × 10 (14 × 14 with the ring, which the SVG draws at inset −20%). Read October 27, 2026. Code: inspector none · Creator Hub none (`Header/UserMenu` shows no presence).

A 10 × 10 dot with a 2px Shadow `#161518` outer ring drawn in the SVG; `ProfilePic` places it at 10 (60px avatar) or 6 × 6 (40 / 32).

| Variant | Fill | Border | Size | Contrast | A11y | Inspector token | Creator Hub token |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Online | System/Green `#34CE77` | 2px Shadow, outer | 10 × 10 (6 × 6 on small avatars) | Green vs page 8.91:1; Shadow ring vs Green 8.87:1, vs Lavender 4.34:1 — the ring is what separates the dot from the avatar | not a control; the avatar's accessible name carries "online" | `--success-main` (ships in #1703) | `--success` |
| Away | System/Orange `#FE9C2A` | same | same | Orange vs page 8.71:1; ring vs Orange 8.66:1 | **Green vs Orange 1.02:1 — status is colour-only; the name must say "away"** | `--warning-main` (ships in #1703; the warning role, no presence token) | `--danger` (ships in #1703; the warning role) |
| ✱ Offline | — | — | — | — | not drawn (the `DisconnectedOverlay` below is the offline treatment) | — | — |

### ProfilePic (Profile Snapshot)

Set [`20772:856`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20772-856), 4 variants (60 `20772:857`, 40 `20772:860`, 32 `20772:864`, 28 `20772:871`), on the board [`20772:849`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20772-849) (Pale Black `#43404A`, 2px White 10 border, 64px radius). Size 60 / 40 / 32 / 28 square. Read October 27, 2026. Code: inspector none · Creator Hub `Header/UserMenu` `.AvatarButton`.

Circle, fill Brand/Lavender, White 40 inner ring (3px at 60, 2px below), `AvatarSnapshot` (an `image.png` raster, object-cover) inset by the ring and clipped, `ConnectionStatus` at top-right, plus two hidden layers on the 40 / 32 / 28 variants: `DisconnectedOverlay` (full circle, `#000000` 60%) and `Blocked` (3px at 32, 2px at 28, `DCL/Red` ring); the hidden layers' values are not re-read 2026-10-27. Code detail: Creator Hub `.AvatarButton` is an MUI `Avatar` 44 × 44 at 8px radius inside a 12px-radius frame with a 1px `--transparent-gray-light` border and a `--text` hover border — drift on shape (rounded square vs circle), size, ring and fill.

| Variant | State | Fill | Ring | Avatar | Status dot | Size | Contrast | A11y | Inspector token | Creator Hub token |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 60 | default | Lavender | 3px White 40, inner | 54 × 54 at 3 / 3, 100px | 10 × 10 at left 42 / top 2 inside the ring (45 / 5 from its outer edge), Online | 60 × 60 | Lavender vs page 4.37:1, vs card 3.79:1, vs Black 5.02:1 (≥ 3:1); ring vs Lavender 1.78:1 — decorative, the raster carries the edge | `<img alt="<name>, online">` or a `<button>` named the same when it opens the menu; 60px target | `--lavender`, `--palette-whiteTransparent-blurry` | PROPOSED `--lavender`; ring missing |
| 40 | default | Lavender | 2px White 40 | 36 × 36 at 2 / 2 | 6 × 6 at right 2 / top 1, Green (`Property 1` unset) | 40 × 40 | as 60 | 40px target | as 60 | as 60 |
| 32 | default | Lavender | 2px White 40 | 28 × 28 at 2 / 2 | 6 × 6 at right 0 / top 0, Green | 32 × 32 | as 60 | 32px target (≥ 24) | as 60 | as 60 |
| 28 | default | Lavender | 2px White 40 | 24 × 24 at 2 / 2 | none visible; a hidden 6 × 6 dot at 19 / 1, **`DCL/Grass` `#28AC00` with a `DCL/Shadow` ring — the only variant off System/Green; Figma drift, treat as Green** | 28 × 28 | Grass vs page 6.08:1; ring vs Grass 6.06:1 | 28px target | as 60 | as 60 |
| 40 / 32 / 28 | disconnected (hidden layer) | Lavender under `#000000` 60% | same | dimmed | — | — | the overlay dims the raster; add "offline" to the name | `aria-label` carries the state | — | — |
| 32 / 28 | blocked (hidden layer) | Lavender | `DCL/Red` 3px (32) / 2px (28) replaces the White 40 ring | same | — | — | **Red vs Lavender 1.05:1 — the blocked ring is invisible against the fill; Red vs page 4.57:1 is what you see at the outer edge**; pair it with an icon or text | `aria-label` carries "blocked" | `DCL/Red` is legacy; the error role is `--error-main` (System/Red, ships in #1703) | `--error` (ships in #1703) |
| any | ✱ hover / focus | — | ✱ White 60 ring | — | — | — | ring ui2 `palette.info.light` 8.13:1 on `#16141a` | `:focus-visible` 2px outline, offset 2px, when the avatar is a button | — | — |

## Inputs

The Inputs pages: Buttons, Checkbox, Dropdown, Filter / Sort / Search bar, Radio, Search Bar, Slider, Switch and Text Field.

### Inputs tokens

Literals the Inputs pages add to the Surfaces tokens table; the Snow, Gray, Silver, White, Pale Black, Primary, Primary Light 1, White 10 / 20 / 40 / 60, Black 40, Onix Dark 1, Charcoal, Blue Dark 2 / 3 and 8 / 12 / 100px entries are mapped there and not repeated. Read October 27, 2026. Contrast is against inspector `#161518`, Creator Hub page `#16141a`, or the fill named in the row.

| Literal | Figma | Inspector (`vars.css`) | Creator Hub (`theme.css` / ui2) |
| --- | --- | --- | --- |
| `#FF2D55` Switch On track | DCL/Ruby (legacy collection; same value as Primary/Primary) | `--primary-main` | `--primary`, `--dcl` |
| `#FCFCFC` Switch knob | DCL/Snow (legacy collection; same value as Neutrals/Snow) | `--ui-designer-text` | ui2 `neutral.softWhite`; `theme.css` missing |
| `#161518` ToolbarButton rest rectangle | DCL/Shadow | `--tree-bg-color` (`--base-20`) | missing (`--bg-inspector` is `#000`) |
| `#5E5B67` Switch Off track (Switch page) | Neutrals/Graffito | PROPOSED `--palette-neutral-gray1` (ui2 `neutral.gray1`) | `--light-gray` · ui2 `neutral.gray1` |
| `#2D2A33` Toast tooltip fill (rounded-button-contained, IconContainedToggle, TextureContainedRoundedButton) | Neutrals/Onix Dark 1 | PROPOSED `--palette-neutral-onyxDark1` | `--title-bar-button` |
| `0 4px 4px rgba(0,0,0,.1)` Toast tooltip shadow | — (no Figma variable) | PROPOSED `--shadow-toast` | missing |
| Toast radius 8 / padding 6 / 10 (rounded-button-contained) and radius 10 / padding 2 / 10 (IconContainedToggle, TextureContainedRoundedButton); Inter 600 12 / 100% (`H8 Semi`) Snow | — | missing | missing |
| `rgba(0,0,0,.4)` Quaternary fill | Transparencies/Black 40 | `--palette-blackTransparent-blurry` | missing |
| 1.5px border | — | 1px border + `box-shadow: inset 0 0 0 0.5px` (Chromium floors a 1.5px border to 1px; see Text-Input) | missing |
| 46px button height | — | `--controlHeight-large` | missing (`Button` is MUI default) |
| 10px radius (ButtonContainedVertical 20) | — | missing | missing |
| 6px radius (ToggleLabel) | — | `--shape-borderRadius` (aliased by `--ui-designer-radius-field`) | `--mui-shape-borderRadius` |
| 58.82px radius (Switch track and knob) | — | `--shape-borderRadiusPill` (a pill) | missing |
| 20% opacity (blocked) | — (node opacity, not a variable) | missing | missing |
| Inter 16 / 700 / 22px uppercase | unnamed (JumpInCTA label) | `--font-family` + literal size | same |
| `#8A38F5` dashed 1px, 5px radius | — (Figma set frame chrome, not spec) | not a surface | not a surface |
| `#A14BF3` dashed 1px (`Rarities/Legendary`) | Figma set frame chrome on Checkbox and Radio | not a surface | not a surface |
| 5px radius, 20 × 20 box (Checkbox) | — | literals in `CheckboxField.css` (single use) | missing |
| 100px radius, 20 × 20 ring and 10 × 10 dot (Radio) | — | `--shape-borderRadiusPill` | missing |
| 32 × 32 halo at −6 / −6 | — | `box-shadow: 0 0 0 6px` literal in `CheckboxField.css`, a rounded square rather than Figma's circle | missing |
| `#FF2D55` @ 20% halo (Checkbox), @ 10% (Radio) | unnamed fill, not a variable | `color-mix(in srgb, var(--primary-main) 20%, transparent)` (a translucent state of a token; no new token) | missing |
| White 40 / 60 border steps | `Transparencies/White 40`, `White 60` | `--palette-whiteTransparent-blurry` / `--palette-whiteTransparent-backdrop` | missing |
| `#161518` tick on Primary (Checkbox Primary) | Neutrals/Shadow | `--tree-bg-color` (`--base-20`) | missing |
| `#FCFCFC` named `DCL/White` (Description, help) | legacy collection; value is Snow, not `#FFFFFF` | `--ui-designer-text` | ui2 `neutral.softWhite` |
| `#FFFFFF` Dropdown Title | unnamed solid white | `--white` | `--white` |
| 9999px / 999px pill radius (Sort-By, Filter bar) | — | `--shape-borderRadiusPill` | missing |
| 12px field radius, 46px height, 16px side padding (Dropdown container) | — | `--shape-borderRadiusLarge`, `--controlHeight-large`, `--uid-space-4`; `Dropdown` has no large size yet | missing |
| 56px bar, 300px Search-Bar, 30 / 10px bar padding | — | missing | missing |
| Inter 14 / 400, 16 / 400, 16 / 600 (line-height 100% or `normal`) | `H7 Regular`, `H6 Regular`, `H6 Semi` | `--font-family` + literal size | same |
| 52 × 30 Switch, track 50.21 × 30, knob 25.1 × 25.1 at 3.05 / 2.45 (Off) and 22.52 / 2.45 (On), radius 58.82px | — | `--shape-borderRadiusPill` for the radius; sizes missing | missing |
| 50% node opacity (Switch `Default`) | — (node opacity, not a variable) | missing | missing |
| `#FFFFFF` @ 5% Close-Button fill | unnamed fill, not a variable | `--palette-whiteTransparent-faint` | missing |
| 24 × 24 Close-Button (19 × 19 inside the bar), 16 × 16 glyph, 100px radius | — | `--shape-borderRadiusPill` for the radius; sizes missing | missing |
| 12px field radius, 14 / 16px padding, 1px and 1.5px borders (Text Field container) | — | `TextField size="large"`: `--shape-borderRadiusLarge`, padding 0 / `--uid-space-4` at the fixed `--controlHeight-large`, focus and error as a 1px border plus a 0.5px inset shadow | missing |
| 1px Snow left or right edge of the text frame (Selected, Editing, Completed), or an 18px × 1px `#FFFFFF` line rotated −90° (Text-Input Error) | — (drawn caret) | not a surface; the native caret | not a surface; the native caret |
| 19 × 19 Search glyph, 20 × 20 `LocalAssets` folder glyph | — | missing | missing |
| `#FFFFFF` Title (Text Field) | unnamed solid white | `--white` | `--white` |
| `#D9D9D9` 179 × 18 `Gap` spacer (Search-Bar Completed) | unnamed default fill, opacity 0 | not a surface | not a surface |
| `#244B7D` text-selection highlight (Text-Input Input Highlighted) | System/Blue Dark 2 | `--palette-system-blueDark2`; `UIDesigner.css` paints the same value as two literals | `--ai-session-selected` |
| `#716B7C` slider track (Slider) | Neutrals/Cloudy Sky | `--palette-neutral-gray2` (ui2 `neutral.gray2`; `--ui-designer-glyph` aliases it) | `--dropdown` · ui2 `neutral.gray2` |
| `#FF2D55` slider fill and handle (Slider) | Primary/Primary (fill); the handle is an svg ellipse in the same value | `--primary-main` | `--primary` · ui2 `palette.primary.main` |
| 6px track, 14 × 14 handle, 100px radius (Slider) | — | literals; the pill radius is `--shape-borderRadiusPill` | missing |
| 8px menu-row radius, 10px row inset (Dropdown menu) | — | missing; the dense list takes `--shape-borderRadius` and `--uid-space-1` | missing |

The nine UI Editor Buttons sets (copies `21671:*` on this page) are documented under [UI Editor Buttons](#ui-editor-buttons-buttons) in Editor.

### Button-Contained-Text (Buttons)

Set [`20705:11927`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20705-11927), 9 variants (Primary `20705:11928`, Primary-Hover `20794:2384`, PrimaryBlocked `20953:6308`, Secondary `20705:11934`, Secondary-Hover `20794:2391`, Terciary `20705:11932`, Terciary-Hover `20794:2393`, Quaternary `20705:11930`, Quaternary-Hover `20794:2395`). Size 970 × 46 (set); each button Hug × 46, 12px radius, padding 12 / 24, label Inter 600 16 / 22 uppercase Snow. Read October 27, 2026. Code: inspector `components/Button` · Creator Hub `components/Button` (ui2 `Button`).

Inspector `components/Button` takes MUI's axes: `variant` contained | outlined | text, `color` primary | secondary | info, `size` small | medium | large (TypeScript defaults text / primary / medium, so every call site writes all three). Each prop emits a class only where it differs from the CSS baseline on bare `.Button`, which is contained + secondary + small. Large is 46px `--controlHeight-large`, 12px `--shape-borderRadiusLarge`, padding 12 / 24 `--uid-space-3` / `--uid-space-6`, Inter 600 16 / 22 uppercase; medium is the same at `--controlHeight-medium` 40px with padding 8 / 24; small is the Attach box (padding 6 / 10, 6px `--shape-borderRadius`, Hug 30 from an 18px line). Primary paints `--primary-main` and hovers to `--palette-primary-light`; Secondary is White 10 / White 20; Terciary is `variant="outlined"`, a 1.5px White 40 inset outline that turns Snow on hover. Disabled is Figma's PrimaryBlocked on every variant: the whole node at `opacity: 0.2`, with each variant's rest paint (a hovered disabled button never shows its hover paint). Pressed is defined per variant (✱ row below). Exceptions: MoreOptions items and the CreateScriptModal create keep a .5 opacity. Every `.Button` draws a 2px `--focus-ring` `:focus-visible` ring at a 2px offset. The large-field forms put their CTA in `color="primary"` and Cancel in the default Secondary, at `size="large"`: `UrlInputModal`, `CreateEditTagModal`, `CreateCustomAsset`, `RenameAsset`. `CreateScriptModal` has a large field but hand-styled 13px buttons (`.cancel-button` / `.create-button`). It matches geometry, label, Primary and Secondary fills and Terciary; Quaternary is not implemented. Creator Hub `components/Button` (ui2 `Button`: `colorPrimary` `--dcl`, hover `--primary-hover`, secondary `--dark-gray`, `info` outlined 1px white) matches the Primary fill, and drifts on the Secondary fill.

| Variant | State | Fill | Border | Label | Token (inspector · Creator Hub) | Contrast | A11y |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Primary | default | Primary `#FF2D55` | — | Snow | `--primary-main` · `--primary`, ui2 `palette.primary.main` | **Snow on Primary 3.55:1 — fails 4.5:1** (16px / 600 is not large text); Primary vs `#161518` 4.99:1, vs `#16141a` 5.01:1, vs card `#242129` 4.35:1 | `<button>`; 46px target |
| Primary | hover | Primary Light 1 `#FF6280` | — | Snow | `--palette-primary-light` · `--primary-hover` (ships in #1703) | **Snow on Primary Light 1 2.80:1 — fails**; fill vs `#161518` 6.33:1 | — |
| PrimaryBlocked | blocked | Primary, node opacity 20% (fill **and** label: sampled fill a = 0.21, label Snow at 20%) | — | Snow at 20% | `--primary-main` + `opacity: 0.2` · ui2 disabled | disabled, exempt; label 1.50:1 on the 20% fill, 1.85:1 on `#161518`. Code matches: `.Button:disabled { opacity: 0.2 }` dims the whole node, on every variant. | `aria-disabled="true"` |
| Secondary | default | White 10 | — | Snow | `--palette-whiteTransparent-subtle` · `--dark-gray` (drift) | 13.53:1 on `#161518` (13.50 on `#16141a`) | — |
| Secondary | hover | White 20 | — | Snow | `--palette-whiteTransparent-soft` · missing | 9.44:1 | — |
| Terciary | default | none | 1.5px White 40 | Snow | `--palette-whiteTransparent-blurry` · missing | border 3.84:1 on `#161518` (3.83 on `#16141a`), passes 3:1 | — |
| Terciary | hover | none | 1.5px Snow | Snow | `--ui-designer-text` · missing | border 17.73:1 | — |
| Quaternary | default | Black 40 | — | Snow | `--palette-blackTransparent-blurry` · missing | fill is near-invisible on `#161518`; the label carries it | — |
| Quaternary | hover | White 10 | — | Snow | `--palette-whiteTransparent-subtle` · missing | 13.53:1 | — |
| any | ✱ press / focus | ✱ press one step darker than hover; code: Secondary W10 (= rest), Primary `--primary-dark`, info `--accent-blue-08`, outlined White 60 outline, text White 60 label | ✱ focus ring | — | — | ring `--focus-ring` Snow 17.73:1 on `#161518` / ui2 `palette.info.light`; pressed Primary label 4.19:1 | not drawn; `:focus-visible` 2px outline, offset 2px |
| text + primary | ✱ the bare `<Button>` default (no Figma text button) | none | — | `--primary-main`, hover `--palette-primary-light`, pressed `--primary-main` | — | ✱ 4.99:1 on `#161518`, 4.51 on canvas, **4.35 on card `#242129`** (accepted) | no caller |
| text (any colour) | ✱ disabled | none | — | the rest label at the whole-node opacity 0.2 | — | 1.87:1 on `#161518` (exempt) | `disabled`; no Figma text button, so the Figma blocked treatment is extended to it |
| small / medium | ✱ sizes | as the variant | — | as the variant | — | — | small = Attach box (padding 6 / 10, radius 6, Hug 30 from an 18px line); medium = TitleBar CTA, fixed 40px (Figma's 8 + 22 + 8 = 38 inside a Hug 40 frame; the frame wins) |

Variant names `Terciary` and `Quaternary` are Figma's spelling; the component API uses MUI's names (`variant="outlined" color="secondary"` for Terciary), and Quaternary is deferred until a caller exists.

### Button-Contained-Text-Icon (Buttons)

Set [`20735:1190`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20735-1190), 8 variants (Primary `20735:1191`, Primary-Hover `20792:149`, Secondary `20735:1193`, Secondary-Hover `20794:2341`, Terciary `20735:1195`, Terciary-Hover `20794:2379`, Quaternary `20735:1197`, Quaternary-Hover `20794:2374`). Size 1084 × 46 (set); each button Hug 118 × 46, 12px radius, padding 12 / 24, gap 10; `settings` icon 18 × 18 White `#FFFFFF`, label Inter 600 16 / 22 uppercase Snow (42 × 22). Read October 27, 2026. Code: inspector `components/Button` · Creator Hub `components/Button` with `startIcon`.

Fills and borders match Button-Contained-Text. The ReportBug Attach instance overrides to Hug 257 × 30, 6px radius, padding 6 / 10.

| Variant | State | Fill | Border | Content | Token (inspector · Creator Hub) | Contrast | A11y |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Primary | default | Primary | — | icon White + label Snow | `--primary-main`, icon `--white` · `--primary`, `--white` | label 3.55:1 — **fails 4.5:1**; icon White on Primary ≥ 3.55:1 passes non-text | visible label names the control; icon `aria-hidden` |
| Primary | hover | Primary Light 1 | — | same | `--palette-primary-light` · `--primary-hover` (ships in #1703) | label 2.80:1 — **fails** | — |
| Secondary | default / hover | White 10 / White 20 | — | same | `--palette-whiteTransparent-subtle` / `-soft` · missing | 13.53:1 / 9.44:1 | — |
| Terciary | default / hover | none | 1.5px White 40 / 1.5px Snow | same | `--palette-whiteTransparent-blurry` / `--ui-designer-text` · missing | 3.84:1 / 17.73:1 border | — |
| Quaternary | default / hover | Black 40 / White 10 | — | same | `--palette-blackTransparent-blurry` / `--palette-whiteTransparent-subtle` · missing | 13.53:1 on hover | — |
| any | ✱ blocked / press / focus | ✱ as Button-Contained-Text | — | — | — | — | not drawn; follow Button-Contained-Text |

### PillIconText (Buttons)

Set [`20705:11942`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20705-11942), 4 variants (`Hover` × `Status`: Default `20705:11943`, Default + Hover `20705:11946`, Selected `20705:11949`, Selected + Hover `20705:11952`). Size 526 × 76 (set); each pill Hug 99 × 36, 100px pill, padding 8 / 16, gap 10; `Icon` 20 × 20 (one svg asset per status, Default and Selected), label Inter 600 14 / `normal` uppercase. Read October 27, 2026. Code: inspector none (`ui/Pill` is a removable chip: `--base-02` fill, 13px / 500, not this toggle pill) · Creator Hub none (ui2 `Chip` in `PublishedProjectCard`, `WorldPermissionsItem`, in other roles); no toggle pill exists.

| Variant | State | Fill | Border | Icon / label | Token (inspector · Creator Hub) | Contrast | A11y |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Default | default | none | 1.5px White 10 | Default svg, label White 60 | `--palette-whiteTransparent-subtle`, `--palette-whiteTransparent-backdrop` · missing | label 7.07:1 on `#161518` (7.10 on `#16141a`); border 1.31:1 — sub-threshold, the label carries it | `<button aria-pressed="false">` |
| Default + Hover | hover | none | 1.5px White 40 | same | `--palette-whiteTransparent-blurry` · missing | border 3.84:1 | — |
| Selected | selected | White 10 | none | Selected svg, label Snow | `--palette-whiteTransparent-subtle`, `--ui-designer-text` · missing | 13.53:1 | `aria-pressed="true"` |
| Selected + Hover | selected + hover | White 20 | none | same | `--palette-whiteTransparent-soft` · missing | 9.44:1 | — |
| any | ✱ focus / disabled | — | ✱ focus ring | — | — | — | not drawn; 36px target clears 24px |

### rounded-button-contained (Buttons)

Set [`20705:12363`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20705-12363), 5 variants (`State` × `Hover Style`: Default / False `20705:12364`, Hover / Default `20705:12367`, Blocked / False `21026:15734`, Hover / Tooltip Top `21309:15314`, Hover / Tooltip Bottom `21309:15277`). Size 280 × 80 (set); button 40 × 40, 100px pill, no fill; `settings` glyph 24 × 24 White at 8 / 8. Read October 27, 2026. Code: inspector none · Creator Hub `EditorPage` `.actions` `IconButton` 32 × 32 on `--title-bar-button` at 8px radius (the title-bar instance overrides the 40 pill, see Editor Toolbar buttons).

The tooltip is a Toast: Onix Dark 1 `#2D2A33` fill, padding 6 / 10, 8px radius, shadow `0 4px 4px rgba(0,0,0,.1)`, text Inter 600 12 / 100% (`H8 Semi`) Snow, centred, its centre 42px above (Top) or below (Bottom) the button's centre.

| Variant | State | Fill | Glyph | Token (inspector · Creator Hub) | Contrast | A11y |
| --- | --- | --- | --- | --- | --- | --- |
| Default / False | default | none | White | `--white` · `--white` | White vs `#161518` ≥ 17.73:1 | `<button aria-label>` |
| Hover / Default | hover | White 10 | White | `--palette-whiteTransparent-subtle` · missing | fill vs `#161518` 1.31:1 — the hover boundary is faint, nothing else changes | — |
| Hover / Tooltip Top, Bottom | hover | White 10 + Toast tooltip | White | Toast fill PROPOSED `--palette-neutral-onyxDark1` · `--title-bar-button`; shadow PROPOSED `--shadow-toast` · missing | tooltip Snow on Onix Dark 1 13.73:1 | tooltip `role="tooltip"`, `aria-describedby` |
| Blocked / False | blocked | none, node opacity 20% | White at 20% | — | disabled, exempt | `aria-disabled="true"` |

### BackTitle (Buttons)

Set [`20762:22781`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20762-22781), 2 variants (Default `20736:43677`, Hover `20762:22782`). Size 130 × 80 (set); button 40 × 40, 100px pill; `arrow-left` 24 × 24 Primary at 6 / 8. Read October 27, 2026. Code: inspector none · Creator Hub `EditorPage .Header .back` (32 circle, 1px `--dark-gray` border, `ArrowBackIos` 14): drift on size, border and glyph.

| Variant | State | Fill | Glyph | Token (inspector · Creator Hub) | Contrast | A11y |
| --- | --- | --- | --- | --- | --- | --- |
| Default | default | none | Primary | `--primary-main` · `--primary` | 4.99:1 on `#161518`, 5.01:1 on `#16141a`, 4.35:1 on card `#242129` (≥ 3:1 non-text) | `<button aria-label="Back">` |
| Hover | hover | White 10 | Primary | `--palette-whiteTransparent-subtle` · missing | fill vs `#161518` 1.31:1 | — |
| any | ✱ focus / press | ✱ focus ring | — | — | — | not drawn |

### Button-Multiple-Options (Buttons)

Set [`20794:2456`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20794-2456), 3 variants (Default `20745:59084`, HoverLeft `20794:2457`, HoverRight `20794:2470`). Size 505 × 40 (set); button Hug 155 × Fixed 40, 12px radius (the frame clips). Read October 27, 2026. Code: inspector none · Creator Hub `CreateButton`, `Button` `ButtonGroup` + `extra-button`.

- **Left segment:** Hug 115 × Fill 40, padding 0 / 14, gap 6, Primary; icon 18 × 18 and the label Inter 600 16 / 22 uppercase Snow (63 × 22; Figma's text is the placeholder "create").
- **Right segment:** 40 × 40 Primary with a 1px White 20 left border; chevron 8.5 × 5.
- **Hover:** the frame fill is Primary Light 1, and only the hovered segment shows it; the other segment keeps its own Primary fill.

Creator Hub `CreateButton` (`StyledLabelButton` 130 × 40, 16 / 600 uppercase, 12px radius, Primary; toggle 40 × 40 with a 1px `rgba(255,255,255,.2)` left border) matches the geometry; each segment hovers to `--primary-hover`.

| Variant | State | Left / right fill | Token (inspector · Creator Hub) | Contrast | A11y |
| --- | --- | --- | --- | --- | --- |
| Default | default | Primary / Primary | — · `--primary` | label 3.55:1 — **fails 4.5:1**; divider White 20 over Primary 1.20:1, decorative | `<button>` + `<button aria-haspopup="menu" aria-label>` in one frame |
| HoverLeft | hover left | Primary Light 1 / Primary | — · `--primary-hover` (ships in #1703) | **label 2.80:1 — fails** | — |
| HoverRight | hover right | Primary / Primary Light 1 | — · `--primary-hover` (ships in #1703) | chevron Snow on Primary Light 1 2.80:1 — **fails 3:1 non-text** | — |
| any | ✱ blocked / focus | — | — | — | not drawn |

### ButtonContainedVertical (24 Caps) (Buttons)

Set [`20925:148`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20925-148), 2 variants (`Hover` Off `20925:147`, On `20925:149`). Size 276 × 127 (set); button Fixed 112 × Hug 85, 12px radius, padding 20 / 10 / 10 / 10, gap 16; `Create-Event` icon 24 × 24 and label Inter 400 12 / `normal` uppercase centred (92 × 15). Read October 27, 2026. Code: inspector none · Creator Hub none (Create-Event tile).

| Variant | State | Fill | Content | Token (inspector · Creator Hub) | Contrast | A11y |
| --- | --- | --- | --- | --- | --- | --- |
| Off | default | none | Gray | `--palette-neutral-gray4` · ui2 `neutral.gray4` | 11.55:1 on `#161518` | `<button>` with the visible label |
| On | hover | White 10 | Snow (hover svg) | `--palette-whiteTransparent-subtle`, `--palette-neutral-softWhite` · missing | Snow on White 10 13.53:1 | — |
| any | ✱ focus / press / disabled | — | — | — | — | not drawn |

### ButtonContainedVertical (20) (Buttons)

Set [`21076:34691`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21076-34691), 3 variants (`Hover` × `Blocked`: Off / No `21076:34692`, On / No `21076:34695`, Off / Yes `21138:10829`). Size 302 × 112 (set); button Fixed 80 × 70, 10px radius, 1px border, padding 20 / 10, gap 10; `NodeType/Container` icon 20 × 20, label Inter 400 12 / `normal` centred, single line with ellipsis (60 × 15). Read October 27, 2026. Code: inspector UIDesigner `Palette` `.ui-designer-palette-card` (row layout, 1px `--ui-designer-control-border`, 4px radius, padding 6 / 8, gap 8, disabled opacity .4): drift on orientation, size and radius · Creator Hub none.

| Variant | State | Fill | Border | Content | Token (inspector · Creator Hub) | Contrast | A11y |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Off / No | default | none | 1px White 10 | Gray | `--palette-whiteTransparent-subtle`, `--palette-neutral-gray4` · missing | 11.55:1; border 1.31:1, the label carries it | `<button>` |
| On / No | hover | White 10 | 1px White 60 | Snow (hover svg) | `--palette-whiteTransparent-backdrop`, `--palette-neutral-softWhite` · missing | Snow on White 10 13.53:1; border 7.07:1 | — |
| Off / Yes | blocked | none | 1px White 10, no opacity | icon and label White 20 | `--palette-whiteTransparent-soft` · missing | 1.88:1 — disabled, exempt | `aria-disabled="true"` |
| any | ✱ focus / press | — | ✱ focus ring | — | — | — | not drawn |

### JumpInCTA (Buttons)

Set [`20926:242`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20926-242), 2 variants (Default `20925:171`, Hover `20926:243`). Size 662 × 88 (set); button Hug 300 × Fixed 46, 12px radius, padding 0 / 100, gap 10, Primary; "JUMP IN" Inter 700 16 / 22 uppercase Snow (66 × 22), then one 24 × 24 `Icn/JumpIn` svg whose keycap outline (White 20) is part of the svg. Read October 27, 2026. Code: inspector none · Creator Hub `ManagePage/PublishedProjectCard` `handleJumpIn` (ui2 `Button`; styling unchecked).

| Variant | State | Fill | Token (inspector · Creator Hub) | Contrast | A11y |
| --- | --- | --- | --- | --- | --- |
| Default | default | Primary | `--primary-main` · `--primary` | **Snow on Primary 3.55:1 — fails 4.5:1** (700 / 16px is not large text) | `<button>`; the icon is decorative (`aria-hidden`) |
| Hover | hover | Primary Light 1 | `--palette-primary-light` · `--primary-hover` (ships in #1703) | **2.80:1 — fails** | — |
| any | ✱ focus / press / disabled | — | — | — | not drawn |

### ToggleLabel (Buttons)

Set [`21004:3194`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21004-3194), 2 variants (`Active` Off `21004:3195`, On `21004:3202`; an `Icon` boolean property is also exposed). Size 95 × 100 (set); chip Hug 55 × Fixed 20, 6px radius, padding 2 / 6, gap 2; optional icon 16 × 16 + label "Text" Inter 400 12 / `normal` centred, no case (25 × 15). Read October 27, 2026. Code: none (20px chip) · Creator Hub none.

| Variant | State | Fill | Content | Token (inspector · Creator Hub) | Contrast | A11y |
| --- | --- | --- | --- | --- | --- | --- |
| On | selected | Blue Dark 3 `#243852` | Snow | `--palette-system-blueDark3`, `--shape-borderRadius` · `--ai-session-selected-hover` | Snow on Blue Dark 3 11.61:1; fill vs `#161518` 1.53:1 | `aria-pressed="true"` |
| Off | default | none | Silver | `--palette-neutral-gray3` · `--dcl-silver` | 6.71:1 on `#161518`, 6.74:1 on `#16141a`, 5.85:1 on card | `aria-pressed="false"` |
| any | ✱ hit target | — | — | — | **20px tall is below the 24px floor** — add 2px vertical hit padding | — |

### ToolbarButton (Buttons)

Set [`21005:3408`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21005-3408), 11 variants (Blocked `21005:3415`; Default `21005:3412`, Default Hover Main `21719:55739`, Default Chevron `21719:55703`, Chevron Hover Main `21719:55742`, Chevron Hover Chevron `21719:55816`; Selected `21005:3409`, Selected Hover Main `21719:55762`, Selected Chevron `21719:55700`, Chevron Hover Main `21719:55765`, Chevron Hover Chevron `21719:56027`). Size 209 × 193 (set); single 26 × 26, split 46 × 26. Read October 27, 2026. Code: inspector `Toolbar/ToolbarButton` · Creator Hub none.

- **Properties:** `Type` (Default / Selected / Blocked) × `Hover Main` × `Hover Chevron` × `Chevron` (False: a 26 × 26 button; True: a 46 × 26 split button).
- **Single button:** `Icon` 24 × 24 at 1 / 1 over a `Rectangle` 26 × 26.
- **Split button** (`21719:55703`): the main cell, a 1px White 20 `Line 953` at x 26, then a 20-wide chevron cell holding an 8px `arrow-down` in White 60 at right 5.5 / top 9.
- **Glyph artwork:** small inside the 24px frame (8.4–12px: undo 10 × 9.4, select 10, move 12, rotate 12 × 12.9, scale 12.3 × 11.3, play 9 × 11, pause 10 × 11, stop 10, edit and save 12).
- **Frames:** in the Viewport Toolbar every instance sits in a frame (6px radius, 1px Onix border, Onix fill), which gives the visible corners and edge.

Code: inspector `Toolbar/ToolbarButton`, one look for both bars (user decisions October 23, 2026).

- **Box:** 26 × 26, 1px `--palette-neutral-onyx` border, 6px radius, `--tree-bg-color` (Shadow) fill, `--palette-neutral-gray4` glyph.
- **Glyphs:** Figma's own artwork as `currentColor` svgs at their 24px frame (`Toolbar/icons.tsx`).
- **State hook:** `aria-pressed` on toggles.
  - A selected cell inside a joined group (the gizmos, the Snap split) keeps the group's Onix edge.
  - A standalone selected button (Interact) takes its fill colour as its border.
  - Mute shows its state by a glyph swap, with no fill.
  - RuntimeControls' Pause is not a toggle: a `running` class gives it the Selected look while the scene runs (see RuntimeControls).
- **Split button** (Snap): two buttons in one frame, the toggle and a chevron button named "Snap increments", with a White 20 seam between them. The chevron cell is Figma's 20 × 26, below the 24px hit-target floor (✱, user decision October 23, 2026).
- **Shipped:** `f6d320189` (layer 3a3) ships every state above in both bars: the box, selected, disabled, focus, Figma's Charcoal hover, the glyphs and the Snap split button.

| Variant | State | Rectangle | Icon | Token (inspector) | Contrast | A11y |
| --- | --- | --- | --- | --- | --- | --- |
| Blocked | disabled | Shadow `#161518` | Pale Black `--gray-0` | `--tree-bg-color`, `--gray-0` | 1.79:1, disabled, exempt | native `disabled` |
| Default | default | Shadow | Gray `--palette-neutral-gray4` | `--tree-bg-color`, `--palette-neutral-gray4` | 11.55:1; Onix edge 1.46:1 | `<button>` named by `aria-label` or `title`; a toggle adds `aria-pressed="false"` |
| Default, `Hover Main` | hover | Charcoal `#25212A` → `--base-19` (`#242129`, the documented 1/255 deviation) | Gray (unchanged) | `--base-19` ✱ deviation | 10.07:1; fill vs Shadow 1.15:1 (a subtle cue, as drawn) | — |
| Selected | selected | Blue Dark 2 `--palette-system-blueDark2` | Snow `--palette-neutral-softWhite` | `--palette-system-blueDark2`, `--palette-neutral-softWhite` | Snow on Blue Dark 2 8.61:1; fill vs Shadow 2.06:1, below 3:1, so the glyph colour change carries it; a grouped cell's Onix edge on Blue Dark 2 1.41:1 (an edge, not the cue) | `aria-pressed="true"` |
| Selected, `Hover Main` | selected + hover | Blue Dark 3 `--palette-system-blueDark3` | Snow | `--palette-system-blueDark3` | 11.61:1 | — |
| `Chevron=True`, Default | rest / `Hover Main` / `Hover Chevron` | main and chevron cells Shadow; the hovered cell Charcoal → `--base-19` | `arrow-down` White 60 → `#a2a1a3` | `--tree-bg-color`, `--base-19` | 7.07:1 | a separate `<button aria-label="Snap increments" aria-expanded>` |
| `Chevron=True`, Selected | rest | main cell Blue Dark 2, chevron cell Shadow | as Default | `--palette-system-blueDark2`, `--tree-bg-color` | as Selected | — |
| `Chevron=True`, Selected | `Hover Main` | main cell Blue Dark 3, chevron cell Blue Dark 2 | as Default | `--palette-system-blueDark3`, `--palette-system-blueDark2` | as Selected | — |
| `Chevron=True`, Selected | `Hover Chevron` | main cell Blue Dark 2, chevron cell Charcoal → `--base-19` | as Default | `--palette-system-blueDark2`, `--base-19` | as Selected | — |
| ✱ focus | not drawn | as state | as state | `--focus-ring` | 2px `--focus-ring` (Snow) at 1px offset: 17.73:1 on Shadow | `:focus-visible`; 26px targets clear 24px. The 20-wide chevron cell doesn't: ✱ accepted (user decision October 23, 2026) |

### Switch (Buttons)

Set [`21167:30101`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21167-30101), 2 variants (`Switch` On `21167:30105`, Off `21167:30108`), built on the legacy `DCL/Snow` and `DCL/Ruby` collection. Size 135 × 64 (set); switch 41 × 24; track 40 × 24, 58.82px radius, left 0.41; knob 19.54 × 19.54 at 2.52 / 2.23 (Off) and 18.57 / 2.23 (On), `DCL/Snow`. Read October 27, 2026. Code: inspector none · Creator Hub ui2 `Switch` (`OptimizeModal`, MUI default sizing): drift on size and track colour.

| Variant | State | Track | Knob | Token (inspector · Creator Hub) | Contrast | A11y |
| --- | --- | --- | --- | --- | --- | --- |
| Off | default | White 20 | Snow, left | `--palette-whiteTransparent-soft`, `--ui-designer-text` · missing, ui2 `neutral.softWhite` | **track vs `#161518` 1.88:1 (1.87 on `#16141a`, 1.91 on card) — fails 3:1 non-text**; knob on track 9.44:1 | `<input role="switch" aria-checked="false">` |
| On | selected | Ruby `#FF2D55` | Snow, right | `--primary-main` · `--primary` | track vs `#161518` 4.99:1; knob on track 3.55:1 (passes 3:1 non-text) | `aria-checked="true"`; knob position and colour both change |
| any | ✱ hover / focus / disabled | — | — | — | — | not drawn; 24px tall meets the floor |

### IconContainedToggle (Buttons)

Set [`21206:31700`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21206-31700), 4 variants (`Selected` × `Hover`: No / No `21206:31699`, No / Yes `21206:31701`, Yes / No `21206:31716`, Yes / Yes `21206:31731`; the main of `AIToggle`). Size 200 × 74 (set); button 32 × 32, 8px radius; single `Icon` 24 × 24 at 4 / 4, a gradient sparkle at rest and Snow when selected. Read October 27, 2026. Code: inspector none · Creator Hub `EditorPage .ai-toggle` (32 × 32; hover `--title-bar-button` `#2D2A33` where Figma draws Charcoal `#25212A`; active `--ai-session-selected` `#244B7D`; active hover `--ai-session-selected-hover` `#243852`): selected colours match, hover drifts.

Both hover variants draw a Toast tooltip: Onix Dark 1 `#2D2A33`, padding 2 / 10, 10px radius, shadow `0 4px 4px rgba(0,0,0,.1)`, 37px below the button, text Inter 600 12 (`H8 Semi`) Snow.

| Variant | State | Fill | Token (inspector · Creator Hub) | Contrast | A11y |
| --- | --- | --- | --- | --- | --- |
| No / No | default | none | — | gradient ends per Editor Toolbar buttons | `<button aria-pressed="false">` |
| No / Yes | hover | Charcoal `#25212A` + tooltip | `--base-19` ✱ deviation · `--title-bar-button` (code drift: the hover fill takes the tooltip colour) | fill vs `#161518` 1.15:1 — near-invisible; tooltip Snow on Onix Dark 1 13.73:1 | tooltip `role="tooltip"` |
| Yes / No | selected | Blue Dark 2 | `--palette-system-blueDark2` · `--ai-session-selected` | Snow 8.61:1; fill vs `#161518` 2.06:1 | `aria-pressed="true"` |
| Yes / Yes | selected + hover | Blue Dark 3 + tooltip | `--palette-system-blueDark3` · `--ai-session-selected-hover` | Snow 11.61:1; fill 1.53:1 | — |

### TextureContainedRoundedButton (Buttons)

Set [`21232:42111`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21232-42111), 2 variants (`Hover` No `21232:42112`, Yes `21232:42114`). Size 132 × 82 (set; the dashed `#8A38F5` set frame is Figma chrome); button 40 × 40, 100px pill; one `Texture` child 40 × 40, 100px, a Snow circle with a 64 × 64 `Icon` placeholder image inside. Read October 27, 2026. Code: inspector none · Creator Hub none.

| Variant | State | Fill | Ring / tooltip | Token (inspector · Creator Hub) | Contrast | A11y |
| --- | --- | --- | --- | --- | --- | --- |
| Hover=No | default | none; `Texture` child | — | — | texture image decides; ring not drawn | `<button aria-label>`, image `alt=""` |
| Hover=Yes | hover | White 10 | a 46 × 46 Primary ring around the Texture (about 2px, canvas inference); Toast tooltip (Onix Dark 1, padding 2 / 10, 10px radius, shadow `0 4px 4px rgba(0,0,0,.1)`, 50.25px below, `H8 Semi` Snow) | `--palette-whiteTransparent-subtle`, ring `--primary-main` · ring `--primary` | fill vs `#161518` 1.31:1 — faint; ring 4.99:1 | — |
| any | ✱ focus / press / disabled | — | — | — | — | not drawn |

### Checkbox (Checkbox)

Set [`21650:4611`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21650-4611), 8 variants (`Type` × `Hover` × `Selected`: Primary Off `21650:4612`, Primary Hover `21650:4614`, Primary On `21650:4617`, Primary HoverSelected `21650:4620`, Secondary On `21650:4624`, Secondary HoverSelected `21650:4627`, Tertiary On `21650:4634`, Tertiary HoverSelected `21650:4637`). Size 269 × 62 (set); box 20 × 20, 5px radius, 1px White 40 inside border; tick `Checkmark (Stroke)` 12 × 10 at 4 / 5; hover variants add a 32 × 32 halo at −6 / −6, 100px radius, behind the box. Read October 27, 2026. Code: inspector `components/ui/CheckboxField` `color` `primary` (the default) / `secondary` / `tertiary` · Creator Hub ui2 `Checkbox` inside `FormControlLabel` (`AppSettings` `EditorTab`, `OptimizeModal`, `PreviewOptions`; MUI defaults); the filled style is a checked MUI `Checkbox` with `color="primary"`.

Secondary and Tertiary draw only their two selected variants; their unselected box is the shared Primary Off / Hover box. The selected variants are flattened svgs that bake fill, tick and halo together, so the per-type tick colour comes from the variable list (Shadow, Snow, Primary). The dashed `#A14BF3` frame is Figma chrome.

- **Primary (`color="primary"`, the default):** the inspector's 3D-panel checkbox, at 20 × 20 with a 6px halo. The selected variants fill Primary and draw the tick in `Neutrals/Shadow` `#161518`. The tick is `Checkmark (Stroke)` `21170:30126`, 12 × 10 at 4 / 5: one round-capped, round-joined stroke about 1.8px wide, from 0.9 / 5.2 through 4.4 / 9.1 to 10.9 / 0.9 in its box (canvas measurement, ±0.2px). Unchecked: 1px `--palette-whiteTransparent-blurry` (aliased `--ui-designer-checkbox-border`), no fill. Checked and indeterminate: fill and border `--primary-main`; the border takes the fill colour, so the box reads borderless without changing size. The tick and the indeterminate dash are `--base-20` (Neutrals/Shadow), drawn as a CSS mask over a token background, so no colour is baked into an SVG. The mask is that stroke (`stroke-width="1.8"`). With an error on a checked box the `--error-main` border sits on the Primary fill at 1.01:1; the error message, not the border, is the cue there. Halo: `--palette-whiteTransparent-subtle` on hover, and on checked + hover `--primary-main` at 20% via `color-mix`, with no new token; it follows the box radius instead of Figma's circle. The focus ring is `--focus-ring`, offset 2px. The visible `Label` is linked with `htmlFor` (a `useId()` id; a caller's `id` or `aria-label` wins), so every call site is named by its label and clicking the label toggles the box; an `InfoTooltip` icon inside the label cancels its click, so it opens the tooltip without toggling.
- **Secondary (`color="secondary"`):** the set as drawn (Primary tick on the White 40 outline, no fill), no caller yet.
- **Tertiary (`color="tertiary"`):** the UI Designer's checkbox: the right rail's Properties and Logic tabs, and the MobileHUD panel's raw checkboxes (same colours in `MobileHudPanel.css`). A Snow `#FCFCFC` tick on the White 40 outline, no fill, and a White 10 halo on both hover variants. The rails draw it at 14 × 14 with a 4px radius, a 4px halo, an 8.4 × 7 tick (the 12 × 10 stroke scaled 0.7, about 1.26px wide) and the `--ui-designer-control-accent` focus ring at a 1px offset: that is rail geometry (`PropertyPanel.css`, `MobileHudPanel.css`), and the colours are the variant (`CheckboxField.css`). The UI Editor panel `Header` frame (`21067:22621`) draws its 14px toggle checkboxes as SVG assets, not instances of this set; the set wins, so the code tick is Snow ✱. The MobileHUD frame `21281:45188` draws its three global toggles as the same outline boxes, all Off.

| Type | Variant | State | Box | Mark | Halo | Token (inspector · Creator Hub) | Contrast | A11y |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Primary | Off | default | 1px White 40, no fill | — | — | `--palette-whiteTransparent-blurry` · missing | 3.84:1 on `#161518`, 3.74 on card | `<input type="checkbox">`, ≥ 24px label row |
| Primary | Hover | hover | 1px White 40 | — | White 10 | `--palette-whiteTransparent-subtle` · missing | 1.31:1, decorative | — |
| Primary | On | selected | fill Primary, border Primary | `#161518` tick | — | `--primary-main`, tick `--tree-bg-color` · `--primary` | fill 4.99:1 on `#161518` (4.35 on card); tick on Primary 4.99:1 | `checked` |
| Primary | HoverSelected | selected + hover | fill Primary | `#161518` | `#FF2D55` @ 20% | `color-mix` of `--primary-main` · missing | halo 1.24:1, decorative | — |
| Secondary | Off / Hover | default / hover | not drawn in the set: the shared box, as Primary Off / Hover | — | as Primary | as Primary | border 3.84:1 on `#161518` (3.83 on `#16141a`, 3.74 on card), passes 3:1 non-text; halo 1.31:1 — faint | `<input type="checkbox">`, 24px label row |
| Secondary | On | selected | 1px White 40 | tick Primary | — | `--palette-whiteTransparent-blurry`, tick `--primary-main` · missing | tick 4.99:1 on `#161518` (4.35 on card); border 3.84:1 | `checked`; label and tick both change |
| Secondary | HoverSelected | selected + hover | 1px White 40 | tick Primary | `#FF2D55` @ 20% | `color-mix` of `--primary-main` · missing | halo vs `#161518` 1.24:1 | — |
| Tertiary | Off / Hover | default / hover | not drawn in the set: the shared box, as Primary Off / Hover | — | as Primary | `--palette-whiteTransparent-blurry` (the shared box; the rails' `--ui-designer-checkbox-border` is its alias), hover `--palette-whiteTransparent-subtle` | border 3.74:1 (3.84) on the panel `#242129` (on `#161518`); halo 1.36:1, decorative (1.31) | — |
| Tertiary | On | selected | 1px White 40, no fill | Snow tick (Checkmark stroke mask) | — | tick `--ui-designer-text` | tick 15.45:1 (17.73); border 3.74:1 | — |
| Tertiary | HoverSelected | selected + hover | as On | as On | White 10 | `--palette-whiteTransparent-subtle` | 1.36:1, decorative; the border on the halo stays 3.29:1 | — |
| Secondary | any | ✱ indeterminate | 1px White 40 | Primary dash (`color="secondary"`) | as On / HoverSelected | — | dash 4.99:1 on `#161518`, 4.35 on card and panel | announced as mixed |
| Secondary | any | ✱ disabled | 1px White 20 | `--base-09` mark when checked (`color="secondary"`; the disabled label's colour) | none | — | exempt (mark 6.06:1 on panel, 6.96 on `#161518`) | `disabled` |
| Secondary | any | ✱ focus | — | — | ✱ focus ring | — | ring `--focus-ring` / ui2 `palette.info.light`, ≥ 3:1 | not drawn; 20px box sits inside a ≥ 24px row |
| Primary | any | ✱ indeterminate | fill Primary, border Primary | ✱ `#161518` dash (10 × 2) | as On / HoverSelected | — | dash on Primary 4.99:1 | `indeterminate`; announced as mixed |
| Primary | any | ✱ disabled, unchecked | 1px White 20, no fill | — | none | — | exempt | `disabled` |
| Primary | any | ✱ disabled, checked or indeterminate | fill and border `--base-12` | `--base-20` mark | none | — | exempt (fill 2.52:1 on card, mark 2.89:1 on the fill) | `disabled` |
| Primary | any | ✱ focus | as its state | as its state | — | — | `--focus-ring` 15.45:1 on card (offset 2px) | not drawn |
| Tertiary | any | ✱ indeterminate | as On | Snow dash (10 × 2; rails 8 × 2) | as On / HoverSelected | `--ui-designer-text` | dash 15.45:1 | — |
| Tertiary | any | ✱ disabled, Off | 1px White 20, no fill | — | none | `--palette-whiteTransparent-soft` | exempt (1.91:1) | — |
| Tertiary | any | ✱ disabled, On or indeterminate | 1px White 20, no fill | Silver mark | none | `--palette-whiteTransparent-soft`, mark `--ui-designer-text-muted` | exempt (mark 5.85:1) | — |
| Tertiary | any | ✱ error | `--error-main` border | as its state | as its state | `--error-main` | the message is the cue | — |
| Tertiary | any | ✱ focus | as its state | as its state | — | `--focus-ring` 2px, offset 2px; rails `--ui-designer-control-accent` 2px, offset 1px | 15.45:1; accent 7.09:1 | — |

### End (Checkbox)

Set [`20932:5479`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20932-5479), 2 variants (`Property 1` En `20932:5478`, Start `20932:5480`; "En" is Figma's spelling of End; the set is the `<FormControlLabel>` placement example). Size 578 × 100 (set); each row Hug 199 × 20, gap 10, items centred: a `Checkbox` Primary / Off instance (`21650:4612`), label "Open Debug Console" Inter 400 14 / `normal` (`H7 Regular`) `DCL/Snow` `#FCFCFC` (141 × 17), `help` icon 18 × 18. Read October 27, 2026. Code: inspector `CheckboxField` renders box then label only · Creator Hub ui2 `FormControlLabel` `labelPlacement` `end` / `start`.

| Variant | Order | Label | Token (inspector · Creator Hub) | Contrast | A11y |
| --- | --- | --- | --- | --- | --- |
| En | box · label · help | Snow | `--ui-designer-text` · ui2 `neutral.softWhite` | 17.73:1 on `#161518` (17.81 on `#16141a`) | `<label>` wraps the input, so the name is the visible text; `help` needs its own `aria-label` or `aria-describedby` |
| Start | label · help · box | Snow | same | same | same |

### Sort-By (Dropdown)

Set [`20785:59388`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20785-59388), 2 variants (Vertical `20785:59389`, Horizontal `20780:6314`; orientation only, no states). Size 287 × 90 (set). Read October 27, 2026. Code: inspector none · Creator Hub `ManagePage` (`Typography` "Sort by" + `components/Select`, ui2 `Select` `variant="standard"`, 8px radius, White 10 hover fill, 12px / 2px padding): drift on label size and the chevron.

Vertical is a column Hug 71 × 40, gap 4; Horizontal a row Hug 164 × Fixed 48, padding 8 / 0, gap 10; both 9999px radius, no fill or border. Inside: "Sort by" Inter 400 16 / `normal` (`H6 Regular`) `Neutrals/Silver` (56 × 19); an `Input` row (gap 10, 6px radius from Figma's `--borderradius` variable; 10px padding on the Horizontal one) holding "Newest" Snow (Vertical Inter 400 14, Horizontal Inter 400 16) and an `arrow-down` 10 × 10.

| Variant | State | Label | Value | Token (inspector · Creator Hub) | Contrast | A11y |
| --- | --- | --- | --- | --- | --- | --- |
| Vertical | default | Silver 16 | Snow 14, chevron 10 | `--ui-designer-text-muted`, `--ui-designer-text` · `--dcl-silver`, ui2 `neutral.softWhite` | Silver 6.71:1 on `#161518` (6.74 on `#16141a`); Snow 17.73:1 | the visible "Sort by" labels the control: `aria-labelledby` |
| Horizontal | default | Silver 16 | Snow 16, chevron 10 | same | same | same; 48px row target |
| any | ✱ hover / focus / open / disabled | — | — | — | — | not drawn; open uses the Dropdown-Input Selected menu |

### Dropdown-Input (Dropdown)

Set [`20898:5394`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20898-5394), 3 variants (`Property 1` Default `20898:5395`, Hover `20898:5400`, Selected `21220:16635`). Size 540 × 513 (set); frame Fixed 500 wide. Read October 27, 2026. Code: inspector `components/ui/Dropdown` (dense only) · Creator Hub `components/Select` + `components/Dropdown` (ui2 `Select` standard, MUI `Menu`): drift.

The frame is vertical, gap 10: `Title` Inter 600 16 / 100% (`H6 Semi`) `#FFFFFF` (500 × 19); `Description` Inter 400 14 / 100% (`H7 Regular`) `DCL/White` `#FCFCFC` (500 × 17); `Container` Fill × Fixed 46, 12px radius, 1px border, padding 0 / 16, gap 10, no fill, holding the value "Text" Inter 400 16 / 100% (`H6 Regular`) Snow (444 × 19) and a 14 × 14 chevron. Selected is the open state: Hug 229, chevron `ArrowUp`, and a `Menu` instance (Fill 500 × Hug 117) under the container — the documented Menu (Onix `#35333B`, 1px White 10, 12px radius, `0 4px 8px` Black 40, padding 10 / 0, gap 10). Its two slots (`Options`, `Options2`) are padded 0 / 10, so every row sits inset 10px from both menu edges; the first slot holds a Menu-Entry **Hover** (Fill 480 × 38, 8px radius, padding 0 / 10, gap 10, fill Pale Black `#43404A`) carrying the 16px `Checkmark` and the label in `menu/itemDefault` (Inter 400 16 / 150%, 0.15px tracking, Snow), the second a Menu-Entry Default (same box, no fill), with a full-width 1px White 10 Div between them.

Inspector `components/ui/Dropdown` is dense only (26px `--controlHeight-small`, 6px `--shape-borderRadius`, padding 0 / 8, `--gray-0` fill and border, hover border `--base-09`, open `--base-01`, keyboard focus a 2px `--ui-designer-control-accent` outline at 2px offset). Its open list (`OptionList`, portalled to `body`) is a `--gray-0` Pale Black panel with a 4px radius and no border or side inset, and the hovered or keyboard-active row is a full-width `--primary-main` band — drift on the menu fill, radius, border, inset and row fill; the UI Designer's lists add the White 10 border and 12px radius (`PropertyPanel.css`, `data-dropdown-scope="ui-designer"`).

| Variant | State | Container border | Chevron | Token (inspector · Creator Hub) | Contrast | A11y |
| --- | --- | --- | --- | --- | --- | --- |
| Default | default | 1px White 40 | down 14 | `--palette-whiteTransparent-blurry`, `--shape-borderRadiusLarge`, `--controlHeight-large` · missing | border 3.84:1 on `#161518` (3.83 on `#16141a`); Title 17.73:1; Snow value 17.73:1 | `role="combobox"` `aria-haspopup="listbox"` `aria-expanded="false"`, name from Title (`aria-labelledby`), `aria-describedby` the Description |
| Hover | hover | 1px White 60 | down 14 | `--palette-whiteTransparent-backdrop` · missing | border 7.07:1 | — |
| Selected | open | 1px Snow | up 14 | `--ui-designer-text`; menu `--ui-designer-control-bg`, `--menu-shadow`, row `--gray-0` · missing | border 17.73:1; menu fill vs `#161518` 1.46:1 — border and shadow carry the edge; hovered row Pale Black vs the Onix menu **1.23:1**, Snow label on it 9.88:1 | `aria-expanded="true"`; Menu as documented, `role="listbox"` options, `aria-selected` on the Checkmark row; Escape closes, focus returns to the field. The row fill alone is under 3:1, so ✱ a row the arrow keys make active also draws a 1px inset `--focus-ring` (9.88:1 on the row); a hovered row keeps the fill alone, as Figma |
| any | ✱ focus / disabled / error | ✱ focus ring | — | — | `--focus-ring` Snow (17.73:1 on `#161518`, 15.45 on `#242129`), per the design review | not drawn; 46px target. The `Text` inner frame carries a 1px left border weight with no stroke colour — treat as none |
| Selected | ✱ section header in the list | divider inset with the rows (`--uid-space-1` each side) | — | — | accepted deviation (user, October 21, 2026): Figma draws the Div inset in the Menu-Entry set `20749:790` but full-bleed in every composed menu (`20749:386`, this Selected variant); the inspector keeps it inset | the header is not focusable; the divider is decorative |
| Selected | ✱ list scrollbar (Figma draws none; user, October 26, 2026) | the thin menu scrollbar on `OptionList`: a 6px gutter with a 4px `--palette-blackTransparent-blurry` pill thumb (`--shape-borderRadiusPill`), a 1px `--palette-whiteTransparent-backdrop` outline, transparent track inset 10px top and bottom — the same as the react-contexify submenu (Menu ✱ thin menu scrollbar) | — | — | outline 4.29:1 on the `--gray-0` list, 5.07:1 on Onix (UI Designer lists); the fill alone 1.48:1 / 1.32:1 | native scrollbar; no ARIA |

### Filter (Filter / Sort / Search bar)

Component [`20768:61659`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20768-61659), 1 variant (`Slot` Default; the page frame is `20461:3770`). Size 1152 × 56. Read October 27, 2026. Code: inspector `components/Search` (14px icon, 5px padding, red icon colour) is a tree filter, not this bar · Creator Hub `ManagePage` row (`FiltersBar` left / right `Row`, a `Chip` filter set, `Typography` "Sort by", `components/Select`, `components/Search` — 40px, 1px `--transparent-gray-light` border, 12px padding, 600 weight): drift on bar fill, 56 height, pill geometry and the 600 weight.

The bar is Fill × Fixed 56, horizontal, 999px radius, padding 0 / 10 / 0 / 30, gap 16, fill White 10. Left: `ResultsNumber` "N Text" Inter 400 16 / `normal` (`H6 Regular`) Silver (345 × 19), flex 1. Right `Slot` (Hug 751 × 51, gap 30): `Filter` group (gap 16: "Filter by" Silver 16, `Pills` gap 12 holding two PillIconText instances in Default, Hug 69 × 33, 8 / 16 padding, 1.5px White 10 border, 100px radius, label "text" Inter 600 14 uppercase White 60, no icon), a Sort-By Horizontal instance, and a `Search-Bar` instance (`Property 1` Default, Fixed 300 × Hug 51, padding 6 / 0; its `Container` Fill × 39, 100px radius, 1px White 40 border, padding 10 / 40 / 10 / 10, gap 10, a 19 × 19 `Search` icon and "Search" Inter 400 16 / 100% White 40). Only the Default Search-Bar is on this page; its other states are not drawn.

| Part | State | Fill / border | Text | Token (inspector · Creator Hub) | Contrast | A11y |
| --- | --- | --- | --- | --- | --- | --- |
| Bar | default | White 10 (`#2D2C31` over `#16141A`, `#2D2C2F` over `#161518`), no border | — | `--palette-whiteTransparent-subtle`, `--shape-borderRadiusPill` · missing | bar vs page 1.32:1, decorative | `role="search"` on the form, or a labelled `role="toolbar"` |
| ResultsNumber | default | — | Silver 16 | `--ui-designer-text-muted` · `--dcl-silver` | 5.11:1 on the bar | `aria-live="polite"` for the count |
| Filter by | default | — | Silver 16 | `--ui-designer-text-muted` · `--dcl-silver` | 5.11:1 on the bar | labels the pill group (`role="group"`, `aria-labelledby`) |
| Pill (Default) | default | 1.5px White 10 | per PillIconText | per PillIconText | border 1.31:1, the label carries it | `aria-pressed` |
| Sort-By | default | none | Silver label, Snow value | per Sort-By | Snow 13.50:1 on the bar | as Sort-By |
| Search-Bar | default | 1px White 40 | placeholder White 40 | `--palette-whiteTransparent-blurry` · missing | **placeholder 3.53:1 on the bar — fails 4.5:1** (the border passes 3:1); typed text should be Snow 13.50:1 | `<input type="search">` with an `aria-label`; ✱ the Figma placeholder doubles as the only label |
| Search-Bar | ✱ hover / focus / filled / clear | ✱ White 60 / ring / — | — | — | ring ≥ 3:1 | not drawn |

### Radio (Radio)

Set [`20903:5661`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20903-5661), 4 variants (`Property 1` Off `20903:5662`, On `20903:5664`, Hove `20903:5673`, OnHover `20903:5675`; "Hove" is Figma's spelling). Size 145 × 62 (set); ring 20 × 20, 100px radius, no fill; selected adds a 10 × 10 dot inset 25% (at 5 / 5) in Primary; hover and on-hover add a 32 × 32 halo at −6 / −6. Read October 27, 2026. Code: inspector none · Creator Hub ui2 `Radio` / `RadioGroup` (`PreviewOptions`, `AppSettings` `ScenesTab`; MUI defaults).

| Variant | State | Ring | Dot | Halo | Token (inspector · Creator Hub) | Contrast | A11y |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Off | default | 1px White 40 | — | — | `--palette-whiteTransparent-blurry` · missing | 3.84:1 on `#161518` (3.83 on `#16141a`) | `<input type="radio">` in a `role="radiogroup"` |
| Hove | hover | **1px White 60** (Checkbox hover keeps White 40) | — | White 10 | `--palette-whiteTransparent-backdrop`, `--palette-whiteTransparent-subtle` · missing | ring 7.07:1; halo 1.31:1 | — |
| On | selected | 1px White 40 | Primary 10 | — | `--primary-main` · `--primary` | dot 4.99:1 on `#161518` (4.35 on card) | `checked`; arrow keys move within the group |
| OnHover | selected + hover | 1px White 40 | Primary 10 | `#FF2D55` @ **10%** (Checkbox HoverSelected is 20%) | `color-mix` of `--primary-main` · missing | halo 1.09:1 | — |
| any | ✱ focus / disabled | ✱ focus ring | — | — | — | ring ≥ 3:1 | not drawn |

### End (Radio)

Set [`21028:42345`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21028-42345), 2 variants (`Property 1` End `21028:42346`, Start `21028:42350`). Size 578 × 100 (set); identical to the Checkbox `End` set with a Radio Off in place of the box: Hug 199 × 20, gap 10, label "Open Debug Console" Inter 400 14 (`H7 Regular`) `DCL/Snow` (141 × 17), `help` 18 × 18 (Neutrals/White). Read October 27, 2026. Code: inspector none · Creator Hub ui2 `FormControlLabel` with `Radio`.

| Variant | Order | Label | Token (inspector · Creator Hub) | Contrast | A11y |
| --- | --- | --- | --- | --- | --- |
| End | radio · label · help | Snow | `--ui-designer-text` · ui2 `neutral.softWhite` | 17.73:1 on `#161518` | label wraps the input; the group needs a visible or `aria-label` name |
| Start | label · help · radio | Snow | same | same | same |

### Search-Bar (Search Bar)

Set [`20768:1462`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20768-1462), 4 variants (`Property 1` Default `20768:1461`, Hover `20768:1463`, Selected `20768:1468`, Completed `20768:1473`). Size 331 × 276 (set); frame Fixed 300 × Hug 39, gap 10. Read October 27, 2026. Code: inspector `components/Search` (tree filter: 14px icon, 5px padding, red icon colour, 13px text): drift on every value · Creator Hub `components/Search` (`SearchInput` 220 × 40, 1px `--transparent-gray-light`, 12px input padding, 600 weight, clickable `svg`): drift on width, border colour, radius and weight.

`Container` Fill × Fill 39, 12px radius, 1px border, no fill, padding 10 / 40 / 10 / 10 (Completed: 10 all round), gap 10; a 19 × 19 `Search` glyph (Snow, the container's inner height) then a `Text` frame Hug × 19 holding Inter 400 16 / 100% (`H6 Regular`). The Selected caret is a 1px Snow left edge on that frame; the Completed caret a 1px Snow right edge. Completed adds a `Close-Button` and a `Gap` spacer (opacity 0, `#D9D9D9`, 18 high). The Filter page's instance is Hug 51 with padding 6 / 0 and a 100px radius: those are that instance's overrides, the set's own radius is 12px.

| Variant | State | Border | Placeholder / value | Glyph | Token (inspector · Creator Hub) | Contrast | A11y |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Default | default | 1px White 40 | "Search" White 40 | Snow | `--palette-whiteTransparent-blurry` · missing | border 3.84:1 on `#161518` (3.83 on `#16141a`, 3.74 on card), passes 3:1; **placeholder 3.84:1 — fails 4.5:1 as text** | `<input type="search">` with an `aria-label`; the placeholder is not a label |
| Hover | hover | 1px Snow | "Search" White 40 | Snow | `--ui-designer-text` · ui2 `neutral.softWhite` | border 17.73:1 | — |
| Selected | focus, empty | 1px Snow + 1px Snow caret | "Search" **White 20** | Snow | `--ui-designer-text`, placeholder `--palette-whiteTransparent-soft` · missing | **placeholder 1.88:1 on `#161518` — fails 4.5:1** (dimmer than Default); border 17.73:1 | the Snow border is the focus indication, 3:1 passes; ✱ still add `:focus-visible` ring `--ui-designer-control-accent` `#63B4F6` / ui2 `palette.info.light` if the border is not kept |
| Completed | filled | 1px Snow | "Text" Snow, 1px caret on the right | Snow | `--ui-designer-text`; Close-Button `--palette-whiteTransparent-faint` · missing | text 17.73:1; the Close-Button fill is Snow on White 5 15.61:1 | clear button `<button aria-label="Clear search">`; Escape clears |
| any | ✱ disabled / error | — | — | — | — | — | not drawn |

### Close-Button (Search Bar)

Set [`20768:59567`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20768-59567), 2 variants (`Hover` No `20768:59566`, Yes `20768:59568`). Size 64 × 108 (set); button 24 × 24, 100px radius; `Close` 16 × 16 centred (inset 16.67%) holding a 9.33 × 9.33 vector at 3.33 / 3.33, Snow fill plus a 0.2px outside Snow stroke. Read October 27, 2026. Code: inspector none · Creator Hub none (`Search` has a clickable `svg`, no clear button).

In the Search-Bar Completed variant it is a 19 × 19 instance that fills the bar's inner height (glyph 12.67, vector 7.39), so the glyph scales with the instance.

| Variant | State | Fill | Glyph | Token (inspector · Creator Hub) | Contrast | A11y |
| --- | --- | --- | --- | --- | --- | --- |
| Hover=No | default | White 5 (`#FFFFFF` @ 5%, unnamed) | Snow | `--palette-whiteTransparent-faint` · missing | fill vs `#161518` 1.14:1 — nearly invisible; glyph 15.61:1 | `<button aria-label>`; **19px instance is below the 24px floor — keep 24px or pad the hit area** |
| Hover=Yes | hover | White 10 | Snow | `--palette-whiteTransparent-subtle` · missing | fill 1.31:1; glyph 13.53:1 | — |
| any | ✱ focus / press / disabled | — | — | — | ✱ ring ≥ 3:1 | not drawn |

### Slider (Slider)

Component [`21625:15070`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21625-15070), 1 variant (a single component, no states). Size 250 × 6. Read October 27, 2026. Code: inspector `ui/RangeField`, `ui/RangeHourField` · Creator Hub ui2 / MUI `Slider` (`OptimizeModal` texture quality; round rail ends already).

`Bar` `21625:15072` Fill 250 × Hug 6, 100px radius, fill `Neutrals/Cloudy Sky` `#716B7C`, padding right 200 (the unfilled share in this instance); inside it `Fill&Handle` `21625:15075` Fill 50 × Hug 6, 100px radius, fill `Primary/Primary` `#FF2D55`, and the `Handle` `21625:15076`, a 14 × 14 svg ellipse in Primary `#FF2D55`, anchored to the right end of the fill and centred on the bar (36 / −4 for this 50px fill). Both ends of the track and of the fill are fully round; nothing sits beyond them. No stroke, no shadow.

Inspector `ui/RangeField` draws an 8px square-ended track, a `--primary-main` fill over `--base-10`, a 10px `::before` / `::after` dot at each end (the "ellipses") and a 20px thumb; `outline: none` on focus, a 1px `--base-01` thumb border in WebKit only. `SmartItemBasicView.css` restyles it with hardcoded `#ff2d55` / `#808080`. `ui/RangeHourField` (the skybox time) is a sky gradient on a 4px-radius 8px track, white thumb, `#361c75` end dots, all `!important`. The UI Designer colour popover's hue and alpha bars are `react-colorful` (24px, square or bottom-only rounded ends) and follow the ColourPanel `Slider` set instead.

| Part | State | Fill | Size | Radius | Token (inspector · Creator Hub) | Contrast | A11y |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Bar (track) | default | Cloudy Sky `#716B7C` | 250 × 6 | 100px | `--palette-neutral-gray2` · `--dropdown`, ui2 `neutral.gray2` | 3.55:1 on `#161518`, 3.09 on `#242129` — passes 3:1 | `<input type="range">`, named by its label; ✱ the input box stays ≥ 24px tall, the bar is drawn inside it |
| Fill&Handle (value) | default | Primary `#FF2D55` | value share × 6 | 100px | `--primary-main` · `--primary` | 4.99:1 on `#161518`, 4.35 on `#242129`; vs the bar 1.41:1 — the handle and its value field carry the value | — |
| Handle (thumb) | default | Primary `#FF2D55` | 14 × 14 | 50% | `--primary-main` · `--primary` | 4.35:1 on `#242129`; vs the bar 1.41:1 | 14px is under 24px: the thumb is not the hit target, the input is |
| any | ✱ hover / focus / disabled | — | — | — | — | focus: a 2px `--focus-ring` ring on the thumb (15.45:1 on `#242129`) | not drawn; disabled keeps today's `--base-12` / `--base-11` and is exempt |

### Switch (Switch)

Set [`20907:6053`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20907-6053), 3 variants (`Property 1` Default `20907:6050`, On `20907:6051`, Off `20907:6052`). Size 216 × 70 (set); switch Fixed 52 × 30. Read October 27, 2026. Code: inspector none · Creator Hub ui2 `Switch` (`OptimizeModal`, MUI default sizing): drift on size and colours.

A different set from the Buttons page's `Switch` `21167:30101` (41 × 24, legacy `DCL/Snow` · `DCL/Ruby`): this one is built on `Neutrals/Graffito`, `Neutrals/Snow` and `Primary/Primary`. Track 50.21 × 30 at left 0.47, 58.82px radius; knob 25.1 × 25.1, 58.82px radius, 2.45 from the top, left 3.05 (Off, Default) or 22.52 (On). The page's dashed `#8A38F5` frame is Figma chrome. The two Figma sets disagree on size (41 × 24 vs 52 × 30) and colours: the user picks one.

| Variant | State | Track | Knob | Token (inspector · Creator Hub) | Contrast | A11y |
| --- | --- | --- | --- | --- | --- | --- |
| Off | default | Graffito `#5E5B67` | Snow, left | PROPOSED `--palette-neutral-gray1`, `--ui-designer-text` · `--light-gray`, ui2 `neutral.softWhite` | **track vs `#161518` 2.74:1 (2.76 on `#16141a`, 2.39 on card) — fails 3:1 non-text**; knob on track 6.46:1 | `<input role="switch" aria-checked="false">` |
| On | selected | Primary `#FF2D55` | Snow, right | `--primary-main` · `--primary` | track 4.99:1 on `#161518` (5.01, 4.35 on card); knob on track 3.55:1, passes 3:1 | `aria-checked="true"`; position and colour both change |
| Default | disabled look | Graffito, whole node at 50% opacity | Snow, left | as Off + `opacity: 0.5` | track vs `#161518` 1.58:1, knob on track 3.30:1 — disabled, exempt | `aria-disabled="true"`; ✱ "Default" is Figma's name for what reads as a disabled Off |
| any | ✱ hover / focus / disabled On | — | — | — | ring ≥ 3:1 | not drawn; 30px tall clears 24px |

### Text-Input (Text Field)

Set [`20815:1961`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20815-1961), 7 variants (`Status` Default `20815:1960`, Hover `20815:1962`, Selected `20815:2015`, Editing `20815:1967`, Input Highlighted `21626:15139`, Filled `20820:683`, Error `20817:977`). Size 540 × 918 (set); frame Fill 500 × Fixed 102 (Error 146; Editing and Input Highlighted Hug), vertical, gap 10. Read October 27, 2026. Code: inspector `components/ui/TextField` `size="large"` · Creator Hub ui2 `TextField` inside `InputLabel` (`DetailsTab`, MUI default): drift.

- **Title:** Inter 600 16 / 100% (`H6 Semi`) `#FFFFFF`.
- **Description:** Inter 400 14 / 100% (`H7 Regular`) `DCL/White` `#FCFCFC` (legacy name, value is Snow).
- **Container:** Fill × 46, 12px radius, no fill, padding 14 / 16, gap 10, holding the value (Inter 400 16 / 100%, `H6 Regular`, 438 wide) and a 20 × 20 `LocalAssets` folder glyph (18.33 × 13.33 vector, Silver `#A09BA8`; no button state drawn).
- **Caret:** Selected draws a 1px Snow left edge on the `TxtInput` frame, Editing a 1px Snow right edge; Error draws an 18px × 1px `#FFFFFF` `Line 1` rotated −90°.
- **Error message:** under the container, 500 × 34, Inter 400 14 / 100% `System/Red` `#FB3B3B`, wrapping to two lines: "Path already exists or can't save files there. Please choose a different folder."
- The dashed `#8A38F5` frame is Figma chrome.

Inspector `TextField` `size="large"` serves the five form sites (`UrlInputModal`, `CreateScriptModal`, `CreateEditTagModal`, `CreateCustomAsset`, `RenameAsset`): 46px `--controlHeight-large`, 12px `--shape-borderRadiusLarge`, padding 0 / 16, no fill, 1px `--palette-whiteTransparent-blurry`, hover and filled `--palette-whiteTransparent-backdrop`, focus `--ui-designer-text` (Snow) and error `--error-main` as a 1px border plus `box-shadow: inset 0 0 0 0.5px` in the same colour (a true 1.5px; Chromium floors a 1.5px border to 1px at DPR 1 and 2 alike), disabled `--palette-whiteTransparent-soft`; value Inter 400 16 Snow, placeholder `--ui-designer-text-muted` (Silver, 6.71:1, where Figma's White 40 is 3.84:1), label Inter 600 16. The visible label names the input (`htmlFor`, a `useId()` id; a caller's `id` wins). Error sets `aria-invalid` and links the message with `aria-describedby`; `UrlInputModal` and `CreateScriptModal` draw their own message and link it the same way. Every other site takes the dense default (26px `--controlHeight-small`, 6px `--shape-borderRadius`, padding 0 / 8, 1px `--gray-0`, hover `--base-09`, focus `--base-01`, error `--error-main` and `--error-light`, 13px), and `TextArea` shares its 6px radius. `FileUploadField` draws the folder glyph — matches on the large size.

| Variant | State | Container border | Value | Token (inspector · Creator Hub) | Contrast | A11y |
| --- | --- | --- | --- | --- | --- | --- |
| Default | default | 1px White 40 | "Text" White 40 (placeholder) | `--palette-whiteTransparent-blurry` · missing | border 3.84:1 on `#161518` (3.83 on `#16141a`), passes 3:1; **placeholder 3.84:1 — fails 4.5:1 as text**; Title 18.19:1; Description 17.73:1; folder glyph 6.71:1 | `<label>` wraps the Title; `aria-describedby` the Description |
| Hover | hover | 1px White 60 | White 40 | `--palette-whiteTransparent-backdrop` · missing | border 7.07:1 | — |
| Selected | focus, empty | **1.5px** Snow | "Text" White 40 + 1px Snow caret (left) | `--ui-designer-text` · ui2 `neutral.softWhite` | border 17.73:1; **placeholder 3.84:1 — fails 4.5:1** | the Snow border is the focus indication; ✱ keep a `:focus-visible` ring if it is dropped |
| Editing | typing | 1.5px Snow | "Text" Snow + 1px Snow caret (right) | `--ui-designer-text` · ui2 `neutral.softWhite` | text 17.73:1 | `Container` is Fixed 46 while the variant is Hug — treat as the same box |
| Input Highlighted | focus, text selected | 1.5px Snow | "Text" Snow (`H6 Regular`) on a `TxtInput` box Hug × 20 filled `System/Blue Dark 2` `#244B7D` (its 1px right border weight has no colour — treat as none) | `--palette-system-blueDark2` · `--ai-session-selected` | selected text 8.61:1 on Blue Dark 2; the highlight vs the field's surface 2.06:1 on `#161518`, 1.79 on `#242129` — and on the dense fills only 1.15:1 (`--gray-0`) and 1.41 (Onix) | the text's own `::selection`; selection is not the focus indicator, the Snow border is |
| Filled | filled, idle | 1px White 60 | "Text" Snow | `--palette-whiteTransparent-backdrop` · missing | border 7.07:1; text 17.73:1 | the White 60 border is the only cue that a value is set |
| Error | error | 1.5px `System/Red` `#FB3B3B` | "Text" Snow + rotated `Line 1` caret | `--error-main` (ships in #1703) · ui2 `palette.error.main` | border 5.02:1 on `#161518` (5.04 on `#16141a`, **4.37 on card**); message 5.02:1 on `#161518` (**4.37 on card — fails 4.5:1**) | `aria-invalid="true"`, message linked by `aria-describedby`, `role="alert"` on change; colour alone is not the cue, the message text is |
| any | ✱ disabled / read-only | — | — | — | — | not drawn; 46px target |

## Graphic Assets

The Graphic Assets pages: Avatars, Logo, Scene's Thumbnails and Section. They hold rasters and brand art, not controls; the host control owns every state.

### AvatarSnapshot (Avatars)

Set [`21232:42261`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21232-42261), 24 variants (`AvatarSnapshot` = `DefaultProfileThumbnail` `21232:42262`, `001` `21232:42265`, `002` `21232:42267`, … `023` `21232:42309`, ids stepping by 2). Size 1622.78 × 626.79 (set). Read October 27, 2026. Code: inspector none · Creator Hub `Header/UserMenu` renders the signed-in avatar through ui2 `AvatarFace` (a profile snapshot fetched at runtime, never one of these fixtures); no consumer of the 24 rasters.

The set sits inside the board `Cards&Items` `21232:42260` (vertical, Hug 1822.78 × 826.79, 64px radius, 100 padding, gap 10, Pale Black). The set frame is the dashed `#9747FF` Figma chrome (3.62px radius). Every variant is a 180 × 180 raster (object-cover) on a 200px grid (`001` at left 200 / top 14, so a 20px gutter); no radius, border, fill or state is drawn on a variant. `DefaultProfileThumbnail` is an svg, a `DCL/Snow` `#FCFCFC` person silhouette on a transparent ground; `001` – `023` are avatar snapshots (`002`, `017`, `019` – `023` clip a 256 × 256 inner image). This is the source asset for the `AvatarSnapshot` inside `ProfilePic` (Profile Snapshot), which owns the circle, ring and sizes (28 / 32 / 40 / 60) — see that subsection, nothing is respecified here.

| Variant | State | Content | Size | Token (inspector · Creator Hub) | Contrast | A11y |
| --- | --- | --- | --- | --- | --- | --- |
| DefaultProfileThumbnail | default | Snow silhouette, transparent ground | 180 × 180 | `--ui-designer-text` · ui2 `neutral.softWhite` | silhouette (Snow) vs page `#16141a` 17.81:1; vs Lavender (the `ProfilePic` fill) not computed | the fallback when no snapshot resolves; `alt` comes from the owner's name, never the file name |
| `001` – `023` | default | full-colour avatar render | 180 × 180 | — (raster) | raster: no token, no contrast to enforce | decorative inside a named control (`alt=""`), otherwise `alt="<name>"`; ids are filenames, not copy |
| any | ✱ hover / focus / disabled / loading | — | — | — | — | not drawn; the states belong to the host control (`ProfilePic` ✱ ring), not to the raster |

### Logo (Logo)

Component [`10394:257174`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=10394-257174) `Icon/Explorer`, 1 variant. Size 128 × 128. Read October 27, 2026; the boards `app-icons` `21454:39193` and `ch-icon` `21454:39197`, values not re-read 2026-10-27. Code: inspector none (no logo asset) · Creator Hub `buildResources/icon.png`, `icon.icns`, `icon.ico` (the app icon; `IconAssets.iconset` holds the cut ramp) and `Navbar/LogoMenu` (the in-app mark).

The page defines no component set: it is a specimen board of one library instance, `Icon/Explorer` (a 128 × 128 round Decentraland mark, white sails and sun on a gradient disc, one flattened svg that references no variable), titled "Decentraland Logo" (`app-icons` `21454:39193`, Inter, Hug 899 × 119, Snow), and an "Icon Sizes" ramp (`ch-icon` `21454:39197`; title Inter 600 98 / 100%, Snow; ramp frame `Frame 1000001123` `21454:39200`, Hug 1064 × 2378, vertical, padding 20, gap 51, 1px dashed `#9747FF` chrome). No safe area, padding, minimum size, clear space or export format is drawn; the one asset system the page defines is the size ramp.

| Size (px) | Label frame   | Label       | Notes                                     |
| --------- | ------------- | ----------- | ----------------------------------------- |
| 16        | `21454:39208` | `16x16`     | smallest cut                              |
| 32        | `21454:39209` | `32x32`     | —                                         |
| 64        | `21454:39210` | `64x64`     | —                                         |
| 128       | `21454:39211` | `128x128`   | same size as the `Icon/Explorer` instance |
| 256       | `21454:39212` | `256x256`   | —                                         |
| 512       | `21454:39213` | `512x512`   | —                                         |
| 1024      | `21454:39214` | `1024x1024` | the largest cut                           |

Labels are Inter 600 16 / 100%, uppercase, right-aligned, `Neutrals/Soft White` `#FCFCFC` (a third legacy name for Snow). Mark colours as the panel lists them (not a token set): `Linear Gradient` `#A524B3` → `#FF2D55` → `#FFC95B`, `#FC9965`, `#FFBC5B`, glyph `#FFFFFF`; `#FF2D55` is Primary (`--primary-main` inspector), the rest are brand-art literals with no token in either world. The ramp is the size list for the Creator Hub icon files, not verified against them.

### Thumbnail (Scene's Thumbnails)

Set [`20506:34728`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=20506-34728), 2 variants (`Property 1` Default `20506:34727`, Custom `20506:34729`). Size 681 × 781 (set). Read October 27, 2026. Code: inspector none · Creator Hub `SceneCard` and `ProjectCard` (`.thumbnail`, a fixed 260px card with a 10px top radius and a cover-fit image) and `EditorPage` `OptionBox`: drift on ratio (the card crops to its own box, not 16 : 9) and radius (the raster has none).

The set sits in the frame `thumbnails` `21454:39405` under a "Thumbnails" title (Snow); the set frame is dashed `#8A38F5` Figma chrome. Both variants are 640 × 360 (16 : 9) rasters stacked at left 21, Default at top 20 and Custom at top 400; no radius, border, overlay or state is drawn. Default is the empty-scene placeholder (a perspective grid on a grey ground, object-cover); Custom is a sample user-supplied image (a night landscape, in a clipped `image` layer).

| Variant | State | Content | Size | Contrast | A11y |
| --- | --- | --- | --- | --- | --- |
| Default | default | grid placeholder (no scene image set) | 640 × 360, 16 : 9 | raster: none to enforce; the grid lines are low-contrast by design | `alt=""` — the card title names the scene |
| Custom | default | the scene's own image | 640 × 360, 16 : 9 | raster | `alt=""`; the user's file is arbitrary, so any text over it needs its own scrim ✱ |
| any | ✱ hover / loading / error | — | — | — | not drawn |

### SectionImages (Section)

Set [`10525:291176`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=10525-291176), 6 variants (`Image` = Scenes `10525:291175`, Learn `10525:291177`, Videos `10525:291179`, Documents `10525:291191`, Links `10525:291194`, Image6 `20506:34773`). Size 1103 × 749 (set). Read October 27, 2026. Code: inspector none · Creator Hub none for the six renders (`Navbar` and `MorePage` carry the section names Scenes, Learn, Videos, Docs as text and glyphs only).

The set sits in the frame `images` `21457:18416` under a "Section Images" title (Snow); the set frame is dashed `#9747FF` chrome. Each is a PNG-export raster (`Export file type PNG` on all six) of a 3D-rendered icon in an orange → purple gradient; the page caption credits the open-source 3dicons library. On the canvas the order is laptop (Scenes), book (Learn), camera (Videos), document (Documents), chain (Links) and a hand-and-gems render (`Image6`, canvas reading — its name does not say what it is). The layer names inside two variants differ from the canvas reading: Videos holds `folder-dynamic-gradient`, Image6 holds `influence 1`.

| Variant | State | Content | Size | Contrast | A11y |
| --- | --- | --- | --- | --- | --- |
| Scenes | default | laptop render (inner `image` 256 × 256, centred) | 300 × 300 | raster | decorative `alt=""` beside the section name |
| Learn | default | book render (`image` overscanning −8.59%, clipped to the box) | 300 × 300 | raster | as above |
| Videos | default | camera render (layer `folder-dynamic-gradient` 300 × 300) | 300 × 300 | raster | as above |
| Documents | default | document render (`image` 300 × 300) | 300 × 300 | raster | as above |
| Links | default | chain render (`image` 300 × 300) | 300 × 300 | raster | as above |
| Image6 | default | hand-and-gems render (`influence 1` 331 × 285.57 at 0.18 / 6.82) | 331 × 300 — the only non-square cut | raster | as above |
| any | ✱ hover / focus / disabled | — | — | — | not drawn; the host card owns the states |

Caption `21457:18419`: "Some assets are part of the 3dicons open sourcelibrary" — Inter 600 32 / 100%, right-aligned, `Neutrals/Gray 3` `#A09BA8` (Silver), with the span "3dicons" underlined (solid, a link). Contrast `#A09BA8` on Pale Black 3.74:1 — passes only as large text (32px / 600). The missing space in "sourcelibrary" is a Figma typo; keep the credit wherever the renders ship.

## Settings

The Settings page: the App Settings modal, drawn as one screen set and two boards that compose it.

### Settings (App Settings)

Set [`21160:787`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21160-787), 5 variants (`Tab` × `State`, `Content` = Default on all: Scenes / Default `21160:786`, Editor / Default `21160:784`, Editor / Dropdown `21220:16040`, Experimental / Default `21160:785`, Experimental / Custom `21176:30197`). Size 4342 × 1200 (set). Read October 27, 2026. Code: inspector none · Creator Hub `Modals/AppSettings` over `Modals/TabsModal` (625 × 680 paper, `--black`, `#0000001a` body, 160px-min tab column, 8px header padding with a 1px `--light-gray` rule; tabs Scenes, Editor, AI, Experimental, About): drift on size, radius, fill, border, glow, title bar and sidebar labels, and the code has an About tab Figma does not draw (absence is not removal).

The page is a screen, not a control library; the screen is recorded here as an inventory note. Boards: **App Settings** [`21454:39028`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21454-39028) (layer `EditorHeader`; Hug 4510 × 1562, vertical, 64px radius, 2px White 10 border, padding 102 / 82, gap 35, Pale Black) holds the set; **Panel Components** [`21454:39030`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21454-39030) (Hug 1064 × 925, same chrome, gap 100) holds the two parts the modal is built from — a `TitleBar` instance (`21454:39034`) and a `Sidebar` instance (`21454:39042`, parent component `Sidebar`). Neither is a new set. Every variant is Fixed 800 × 700 (Experimental / Custom is Hug 800 × 1158), 24px radius, fill `#181225`, 1px White 10 border, overflow clipped, a vertical stack of `TitleBar` `21220:15180` then `Content` `21160:629` (horizontal, Fill 798 × Fill 648: the sidebar beside the pane) with a `Glow` `21160:647` (798 × 257.5 at bottom −231, `DCL/Rarities/Mythic` `#FF4BED` at 30%, layer blur 500, flipped vertically, decorative). Fill, border, radius and glow are the Modals `#181225` entries in "Surfaces tokens".

| Part | Fill | Border | Radius | Text | Size / spacing | Token (inspector · Creator Hub) | Contrast |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TitleBar | Black 20 `rgba(0,0,0,.2)` | bottom 1px White 10 | — | "Settings" Inter 600 18 / 100% (`H5 Semi`) Snow | 798 × 50, padding 10 / 20 | — · PROPOSED `--palette-blackTransparent-soft` (Black 20) | Snow 18.45:1 on the bar |
| TitleBar close button | White 10 | — | 100 | glyph inset 20% | 30 × 30 | — · missing | — |
| Sidebar | none | right 1px White 10 | — | — | `Options` column 180 wide, padding 10 / 0 | — · missing | — |
| Sidebar tab (`TabVertical` instance, ×4: SCENES, EDITOR, AI, EXPERIMENTAL) | none | selected: 2px right Snow | — | Inter 600 16 / 100% uppercase centred (`H6 Semi Caps`): selected Snow, others Silver `#A09BA8` | 46 high, padding 0 / 20 (the `TabVertical` set draws 20px, 75 high: the sidebar overrides it) | — · `--dcl-silver` | Silver 6.73:1, Snow 17.77:1 on `#181225` |
| Pane | — | — | — | section titles Inter 600 16 Snow; row labels Inter 400 14 Snow; help text Inter 400 14 Snow, or Gray `#CFCDD4` under a toggle; helper Inter 400 12 Silver | column 538 wide, padding left 30, gap 20 | — · `--dcl-silver` | Snow 17.77:1, Gray 11.58:1, Silver 6.73:1 on `#181225` |
| Scene Folder field / Code Editor dropdown (closed) | none | 1px White 40 (open: 1px Snow) | 12 | value Inter 400 16 Snow | 46 high, padding 0 / 16, gap 10 | — · missing | as `Text-Input` / `Dropdown-Input` |
| Code Editor menu (open) | Onix `#35333B` | 1px White 10 | 12 | rows Inter 400 16 Snow: "Visual Studio Code", "Choose from your device..." | padding 10 / 0, gap 10, shadow `0 4px 8px rgba(0,0,0,.4)`; rows 38 high, padding 0 / 10, 8px radius; divider White 10 | — · missing | as `Dropdown-Input` Selected |
| Connect accordion rows | none | — | 8 (row), 100 (status pill) | agent names Inter 600 14 Snow ("ChatGPT (codex)", "Claude Desktop"); status "Connected" Inter 400 12 Gray; "sign Out" Inter 400 12 Silver; "SIGN IN" Inter 400 12 Primary `#FF2D55`; install sub-rows "Via Terminal" Inter 600 12 Snow, "Install" / "Sign In" Inter 400 12 Silver | padding 6 / 0, gap 10; sub-rows 26 high, 6px radius | — · `--primary`, `--dcl-silver` | Primary 5.00:1 on `#181225` |
| Command boxes | none | 1px White 20 | 8 | Inter 400 12 Snow | 30 high, padding 7 / 11 | — · missing | — |
| MCP block | none | config box 1px White 20 | 8 (accordion), 10 (config box) | "Expose AI assistant MCP server" Inter 600 14 Snow; description and note Inter 400 12 Silver | config box padding 17; note 538 wide | — · missing | — |
| Glow | Mythic `#FF4BED` @ 30%, blur 500 | — | — | — | 798 × 257.5 | — · PROPOSED `--palette-rarity-mythic` | decorative |

| Variant | State | Pane content | Controls (existing spec) | Contrast | A11y |
| --- | --- | --- | --- | --- | --- |
| Scenes / Default | default | "Scene Folder" label + a path field with a folder glyph; "Scene Dependencies" with three radios (Auto-update all my scenes, Notify me of new version updates — selected, Do nothing) | `Text-Input` (container, folder glyph), `Radio` (On) | Snow 17.77:1 on `#181225`; Primary radio dot 5.00:1; inactive tab labels Silver 6.73:1 | `role="dialog" aria-modal` named by the title; tabs `role="tab"` in a vertical `tablist`; the path value is user data, never a fixture |
| Editor / Default | default | "Code Editor of Choice" dropdown ("Visual Studio Code"); "Preview Options" checkboxes (Open Debug Console off, Enable Landscape Terrains on); "App Warnings" checkbox on, with a two-line label ("Show a warning message each time you preview or publish a scene that contains custom code.") | `Dropdown-Input`, `Checkbox` Primary | as Scenes; checked fill Primary 5.00:1 | native `<select>` or `role="combobox"`; each checkbox named by its label |
| Editor / Dropdown | open menu | as Editor / Default with the dropdown open: "Visual Studio Code" (check mark) and "Choose from your device..." under a rule | `Dropdown-Input` open menu, `Menu` items | menu rows Snow on the lifted fill; the check mark is the selected cue, not colour alone | `role="listbox"`, `aria-activedescendant`; Escape closes and returns focus |
| Experimental / Default | default | two switches, both off: "Enable Bevy Scene Renderer", "Enable UI Editor" + a Gray description under the second ("Enabling this feature will allow you to combine GUI objects, properties and scripting to build UI in the editor.") | `Switch` (the 52 × 30 set, Off) | Off track vs the modal ≈ 2.7:1 — the `Switch` spec's 3:1 non-text fail applies | `role="switch"`, description via `aria-describedby`; a restart or reload note is ✱ missing |
| Experimental / Custom | **shows the AI tab, not Experimental** | AI Assistant: "Enable AI Assistant" switch (on) with a Gray description, a "Bill this to an API key instead" checkbox (Inter 600 14) with a Silver 12px helper, a "Connect" accordion with two agent rows (a connected state and a sign-in action, each with install / sign-in command boxes), an "Expose AI assistant MCP server" accordion with a config code block (placeholder credentials, not copied) and the note "Localhost only. The URL and token change each time Creator Hub restarts." | `Switch` On, `Checkbox` Primary, `Accordion`, `Button-Contained-Text` | Snow 10.90:1 and Primary 3.07:1 at the brightest point of the glow (`#5D2361`, computed) — the glow sits at the bottom, keep the controls above it | code blocks need a copy button named "Copy" and `font-family: monospace`; the command text is selectable |
| any | ✱ focus / disabled | — | — | ring `--ui-designer-control-accent` 8.15:1 on `#181225` (as Modals) | `:focus-visible` 2px, first focus on the active tab; Escape closes |
| any | ✱ About tab | — | — | — | not drawn; the code ships it — add a fifth `TabVertical` and a variant |

Settings is named by its content: the `Experimental / Custom` frame shows the AI tab (sidebar item AI selected), so there is no Figma variant for the Experimental tab in a non-default state, and no "AI / Default".

## Editor

The Editor section covers the AI Assistant, the 3D Editor Bottom Panel, the UI Editor (the inspector's UI Designer), the Viewport and the Viewport Toolbar, in Figma's page order.

### Editor tokens

The Editor pages run on the UI Designer's own surface (`--ui-designer-panel-bg` `#242129`, Figma Charcoal `#25212A`) and on the Creator Hub's AI panel. Literals the Editor pages use and where they land:

| Figma swatch | Value | Inspector (UI Designer) | Creator Hub | Status |
| --- | --- | --- | --- | --- |
| Neutrals/Charcoal | `#25212A` | `--ui-designer-panel-bg` (`#242129`, deviation within 1/255) | AI panel `palette.background.paper` (value not verified) | match / documented deviation |
| Neutrals/Onix | `#35333B` | `--ui-designer-control-bg`, `--palette-neutral-onyx` | `--ai-menu-bg` `#2f2d34` (the AI chat-history menu) | inspector match; `--ai-menu-bg` drift → `#35333B` (pending spoke) |
| Neutrals/Onix Dark 1 | `#2D2A33` | missing: PROPOSED `--palette-neutral-onyxDark1` | `--title-bar-button` `#2d2a33`; `--ai-input-bg` `#28252d` (the ChatInput container) | missing in inspector; `--ai-input-bg` drift → `#2D2A33` (pending spoke). Fills `InputAction`, the 2D `Viewport` and the `ChatInput` container |
| Neutrals/Pale Black | `#43404A` | `--gray-0` | `--dark-gray` | match: `InputAction` hover fill, the `ColourPanel` hex cells, the AI menu's hover row |
| Neutrals/Cloudy Sky | `#716B7C` | `--ui-designer-glyph` (→ `--palette-neutral-gray2`); `--ui-designer-text-muted` is Silver | `--dropdown` | match: idle glyphs, the `Position` / `Size` icons, the Logic placeholders and empty lines |
| Neutrals/Black | `#000000` | `--black` | — | match: the `BottomPanel3D` surface behind its 1px gaps |
| System/Blue Dark 2 | `#244B7D` | `--palette-system-blueDark2` (`--ui-designer-control-active-bg`; the `UIDesigner.css` `--selected-item` override) | `--ai-session-selected` | match |
| System/Blue Dark 3 | `#243852` | `--palette-system-blueDark3` | `--ai-session-selected-hover` | match: the tree row, selected-hover and `On` + hover toggle fill |
| White 5 / 10 / 20 | `rgba(255,255,255,.05 / .1 / .2)` | `--ui-designer-control-empty-bg` / `--ui-designer-control-selected-bg` · `--ui-designer-control-border` / `--ui-designer-control-border-strong` | — | match; the row hover is White 5 in Figma, the toggle and icon-button hover White 10 |
| White 40 / 60 | `rgba(255,255,255,.4 / .6)` | `--palette-whiteTransparent-blurry` / `--palette-whiteTransparent-backdrop` | — | match: placeholders, the Scale Slider hover track, scrollbar-handle borders, bound-input borders |
| White 8 (raw alpha, no variable) | `rgba(255,255,255,.08)` | missing: PROPOSED `--palette-whiteTransparent-hint` | — | missing: the `InputAction` and MobileHUD `TextureInput` fill (code paints `--ui-designer-control-bg`) |
| Black 40 | `rgba(0,0,0,.4)` | `--palette-blackTransparent-blurry` | — | match: scrollbar handles in the bottom panels and the MobileHUD list |
| System/Orange | `#FE9C2A` | `--warning-main` `#fe9c2a` | `--ai-warning-bg` `rgba(244,130,33,.16)` | `--warning-main` ships in #1703; `--ai-warning-bg` drift → `rgba(254,156,42,.1)` (pending spoke), Figma's banner is `#FE9C2A` at 10% |
| System/Blue · Rarities/Epic Light | `#2196F3` · `#81E1FF` | missing | ui2 `palette.info.main` | missing: pinned-edge colours in `ConstraintsIcons` |
| Brand/Lavender | `#C640CD` | — | `--lavender` | demo colour in `ColourPanel` and `AspectRatio/Colour`, not a UI token |
| Menu shadow | `0 4px 8px rgba(0,0,0,.4)` | `--menu-shadow` | — | match: `EventsMenu`, `VariableMenu`, the AI chat-history `Menu` |
| Popover shadow (no variable) | `0 4px 10px rgba(0,0,0,.25)` | missing | — | missing: `ColourPanel` only; a second popover shadow beside `--menu-shadow`, or one shadow for both (a question for design) |
| Figma chrome | `#8A38F5` | — | — | the dashed frame around every set — never a token |

PROPOSED (names are the user's call): `--palette-neutral-onyxDark1` = `#2D2A33` in the inspector; `--palette-whiteTransparent-hint` = `rgba(255,255,255,.08)` for the `TextureInput` fill; `--type-caption-size` = 10px for the NodeLogic helper copy. The row hover fill is decided: tree and list rows hover White 5 `--palette-whiteTransparent-faint` (NodeTypeHierarchy, October 27, 2026); toggles and icon buttons hover White 10 per `UI Editor Buttons`.

### AI Assistant (page lead)

Page `21206:31202`. The page is a screen plus a component row, not a library: board `Frame 3112` `21206:31203` holds the title "AI Chat", `<AIAssistantPanel>` with the `AiChat` instance `21206:31298` (Fixed 342 × 1028, vertical, fill Charcoal; a component with a `Messages` = Default property) and `<Components>` `21206:31533` with `Menu` `21206:31885` (chat history), `Header`, `TitleBar` and the `ChatInput` set. Code: Creator Hub `components/AiChatPanel` (`component.styled.ts` `Panel`, `PanelHeader`, `IntroMessage`, `ErrorRow`, `Composer`, `AttachmentChip`; `ChatView.tsx`) and `AiChatWindow` (the detached window); inspector none.

### AiChat (AI Assistant)

Component [`21206:31298`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21206-31298), 1 variant (`Messages` = Default). Size 342 × 1028. Read October 27, 2026. Code: inspector none · Creator Hub `components/AiChatPanel` (`Panel`, `PanelHeader`, `IntroMessage`, `ErrorRow`, `Composer`) and `AiChatWindow`.

The usage card and the outdated-CLI banner are absolutely anchored (usage card at bottom 0, banner at bottom 176), so their stacking is a fixture, not a layout spec.

| Part | Fill | Border | Radius | Text | Glyph | Padding / gap / size | Creator Hub token | Contrast (on `#25212A`) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Panel | Charcoal `#25212A` | none | 0 | — | — | 342 × 1028, vertical, items centred | `palette.background.paper` (value not verified) | — |
| TitleBar | Shadow `#161518` | none | 0 | "AI Assistant" Inter 600 12 / 100%, uppercase, Snow `#FCFCFC` | `Open` 16; `Close-Button` 18 × 18 (White 5, 100px radius) | h 36, padding 10, gap 10 | — | Snow 17.73:1 on Shadow |
| Header | none | 1px White 10 bottom | 0 | "New Chat", "Claude": Inter 400 12, Gray `#CFCDD4` | `NewChat` 16 (flipped vertically), arrows 10 | h 39, padding 6 / 10, gap 10 | — | — |
| Header dropdowns | Onix `#35333B` | none | 6 | as Header | arrow 10 | h 26, flex 1 each (156 wide), padding 6 / 8, gap 8 | — | Gray on Onix 7.90:1 |
| Chat area | none | none | 0 | — | — | h 953, padding 16 / 10 / 10 / 10, gap 16; messages gap 20 | — | — |
| Intro message | none | none | 0 | Inter 400 12 (`H8`), White `#FFFFFF`, 310 wide | — | 310 × 60 | — | 15.79:1 |
| Usage card | Onix `#35333B` | none | 12 | title "About AI usage" Inter 600 14 (`H7 Semi`) White; body Inter 400 12 White | — | 322 wide, padding 20, gap 16 | — | body 12.44:1 on Onix |
| "Got It" button | White 10 `rgba(255,255,255,0.1)` | none | 8 | "Got It" Inter 600 12 (`H8 Semi`) Snow | — | Hug × 32, padding 10 / 20 | `Button-Contained-Text` Secondary | — |
| Outdated-CLI banner | System/Orange at 10% `rgba(254,156,42,0.1)` | none | 12 | Inter 400 12, System/Orange `#FE9C2A` | `ErrorOutline` 24 | 322 × Hug 65, padding 10 / 20, gap 16 | `--ai-warning-bg` drift → `rgba(254,156,42,.1)` (pending spoke) | text 6.27:1 on its tint; tint vs panel 1.20:1 |
| ChatInput | see ChatInput | — | — | — | — | h 70 | — | — |

Messages are `#FFFFFF` (not Snow) at 15.79:1; the usage card body is 12.44:1 on Onix; the banner text is 6.27:1 on its tint, and the tint is 1.20:1 against the panel — the icon and the words carry the warning. The hex typed into the page copy ("Claude CLI v…") is placeholder, not spec.

### Menu (AI Assistant)

Component [`21206:31885`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21206-31885), 1 variant: the chat-history menu, an instance of the shared `Menu` (Menu page `20749:386`) at 248 wide. Size 248 × 182. Read October 27, 2026. Code: inspector none · Creator Hub `components/AiChatPanel` session menu; the selected chat row takes `--ai-session-selected` / `--ai-session-selected-hover` (Blue Dark 2 / 3, match).

| Part | Fill | Border | Radius | Text | Glyph | Padding / gap / size | Shadow | Creator Hub token |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Container | Onix `#35333B` | 1px White 10 `rgba(255,255,255,0.1)` | 12 | — | — | 248 wide, padding 10 / 0, gap 10, slots padding 0 / 10 | `0 4px 8px rgba(0,0,0,0.4)` | `--ai-menu-bg` drift → `#35333B` (pending spoke) |
| Div | White 10 | none | 0 | — | — | h 1, full width | none | — |
| Menu-Entry | none | none | 8 | Inter 400 12 (`H8 Regular`), Snow `#FCFCFC` | `NewChat` 16 (flipped vertically); `Delete` 14 × 14 | h 38, padding 0 / 10, gap 10 | none | — |
| Section label "CHAT HISTORY" | none | none | 8 | Inter 400 12, Silver `#A09BA8`, typed in capitals | none | h 27, padding 0 / 10 | none | — |
| Hover / active entry ("Chat Test") | Pale Black `#43404A` | none | 8 | Snow | `Delete` 14 | h 38 | none | `--dark-gray` |

### Header (AI Assistant)

Component [`21206:31424`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21206-31424), 1 variant. Size 342 × 39. Read October 27, 2026 (inside `AiChat`). Code: inspector none · Creator Hub `AiChatPanel` `PanelHeader`.

| Part | Fill | Border | Radius | Text | Padding / gap / size |
| --- | --- | --- | --- | --- | --- |
| Header | none | 1px White 10 bottom | 0 | — | Fill 342 × 39, padding 6 / 10, gap 10 |
| Dropdown ×2 ("New Chat", "Claude") | Onix `#35333B` | none | 6 | Inter 400 12 (`H8`) Gray `#CFCDD4` | Fill 156 × 26, padding 6 / 8, gap 8; arrow 10 |

### TitleBar (AI Assistant)

Component [`21206:31412`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21206-31412), 1 variant. Size 342 × 36. Read October 27, 2026 (inside `AiChat`). Code: inspector none · Creator Hub `AiChatPanel` title row.

| Part | Fill | Text | Glyph | Padding / gap / size |
| --- | --- | --- | --- | --- |
| TitleBar | Shadow `#161518` | "AI Assistant" Inter 600 12 / 100%, uppercase, Snow `#FCFCFC` | `Open` 16; `Close-Button` (Search Bar) 18 × 18, White 5, 100px radius | Fill 342 × 36, padding 10, gap 10 |

### ChatInput (AI Assistant)

Set [`21206:31455`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21206-31455), 2 variants (Default `21206:31453`, Input `21206:31454`). Size 701 × 110 (dashed `#8A38F5` chrome); each variant 310 × 70. Read October 27, 2026. Code: inspector none · Creator Hub `components/AiChatPanel` (`Composer`, `AttachmentChip`).

- **Caret:** drawn as a 1px Snow border line 15 tall, at the empty position in Default and after the typed text in Input; not a separate glyph.
- **Selection row:** a separate 30-tall block above the container in both variants; its `Close-Button` (Search Bar) is 12 × 12 with an 8 × 8 glyph.

| Variant | State | Fill | Border | Radius | Text | Glyph | Padding / gap / size | Creator Hub token | Contrast (on `#25212A`) | A11y |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Root (both) | — | none | 1px White 10 `rgba(255,255,255,0.1)` top | 0 | — | — | 310 × 70 | — | — | — |
| Default | empty | Onix Dark 1 `#2D2A33` | 1px Snow `#FCFCFC` | 10 | "Ask Assistant" Inter 400 12 (`H8 Regular`), Silver `#A09BA8` | send `Button-Contained-Icon` 26 × 26, 100px radius, padding 12, Primary `#FF2D55` | container Fixed 310 × Hug 40, padding 6 / 10, gap 187 | `--ai-input-bg` drift → `#2D2A33` (pending spoke); `--title-bar-button` `#2d2a33`; send ui2 `palette.primary.main` | border 15.39:1; placeholder 5.20:1 on the container; send glyph Snow on Primary 3.55:1 (non-text ≥ 3:1) | `<textarea aria-label="Ask Assistant">`; send `<button aria-label="Send">`, disabled while empty ✱ |
| Input | typed | same | same | 10 | typed text Inter 400 12 Snow | same | same, padding right 8 | as Default | text 13.73:1; Primary vs container 3.86:1 | `Enter` sends, `Shift+Enter` newline ✱ |
| any | `Selection` row present | none | none | 12 | "Selection: Player" Inter 400 10, White 60 `rgba(255,255,255,0.6)` | `highlight_alt` 14 × 14; `Close-Button` 12 × 12, White 5, 100px radius | 310 × 30, padding 9, gap 6 | — | chip text 6.54:1; Onix vs panel 1.27:1 | the chip is removable by `Close-Button` named "Remove selection" ✱ |
| any | ✱ focus / disabled / sending | — | — | — | — | — | — | — | ring `--ui-designer-control-accent` 8.15:1 on Charcoal (the Snow border is a rest state) | not drawn; the page shows no streaming or error state either |

### 3D Editor Bottom Panel (page lead)

Page `21670:18705`, four boards: Feedback `21673:55006`, Components `21673:54749`, Editor 3D `21673:54990` and Editor 3D Bottom Panel `21673:54913`. Sets on the page: `BottomPanel3D` `21673:50122` (the assembly), `PreviewToggle` `21673:54906`, `FoldersHierarchy` `21671:45961`, `File Button States` `21671:46674`, `Scale Slider` `21673:47613`, `Right Panel` `21673:54433` and `Collapse/Expand Panel` `21673:54911`. `Entity Main_old` `21670:18706` (6 variants) is a stale set, not spec.

- **Editor 3D's hierarchy is stale.** `Editor 3D` → `Editor` `21673:49637` → `WorkSpace&SidePanels` `21673:49639` → `Entity-List` `21673:49646` (312 × 756, 4px radius, Charcoal) is the only in-scope drawing of the 3D Hierarchy. It is an **instance** of the set `Entity-List` `14589:108927` (variants v1 `14589:108024`, SpawnPoints `17931:192310`, v2 `14589:108928`, Script `16335:260763`, beside `Entity-Item` `14589:119035`) on the **Scene Editor 🟡 Outdated** page `20533:81937`. That main is stale: ruby selection, white Base-ramp labels (`Base/Base 01` `#FFFFFF`, `Base/Base 06` `#CCCCCC`), 22px `File` / `Folder` rows on a `_ListBase` (padding 3 / 12 / 3 / 24 at level 2, gap 6). The instance only overrides the selected row to Blue Dark 3. The 3D tree has no current set: NodeTypeHierarchy's state rule governs it (user, October 27, 2026; see NodeTypeHierarchy), and the board's rows are a stale kit (G35). The board is unit 4's reference for the panel's layout.
- The ids under that instance (`21822:*`, then `21831:*` after a reload) are session-synthetic instance children, not edits.
- The 3D Hierarchy's info triggers (Player, Camera, the scene root) are not keyboard reachable yet: gap G36, resolved at layer 3b unit 4 (the 3D Hierarchy panel assembly), where their accessible names go to the user.

### BottomPanel3D (3D Editor Bottom Panel)

Component [`21673:50122`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21673-50122), 1 variant: the Local Assets bottom panel, assembled from the sets below. Size 1888 × 573. Read October 27, 2026. Code: inspector `components/ProjectAssetExplorer/*` (`ProjectView.tsx`) · Creator Hub none.

| Part | Fill | Border | Radius | Text | Glyph | Padding / gap / size | Inspector token |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Panel | Neutrals/Black `#000000` | none | 0 | — | — | 1888 × 573, vertical, 1px gap between the header and the bottom row (the black shows through as rules) | `--black` |
| Header | Charcoal `#25212A` | none | 0 | — | — | h 54, full width; left group left 10, gap 10; middle centred, gap 20; right group right 10, gap 10 | `--ui-designer-panel-bg` (`--base-19`, ✱ deviation 1/255) |
| IMPORT ASSET button | White 10 `rgba(255,255,255,0.1)` | none | 8 | "IMPORT ASSET" Inter 600 14 uppercase (`H7 Semi Caps`), Snow `#FCFCFC` | 18 × 18 | h 32, padding 12 / 16, gap 10 | `--palette-whiteTransparent-subtle` |
| Icon buttons (Refresh, Open folder, Clean unused, Optimize) | none | none | 8 | — | glyph inset 20% (about 19) | 32 × 32, gap 10 | — |
| Tabs (middle) | none | active: 2px Snow bottom | 0 | "local assets" / "custom items" / "assets packs": Inter 600 14, uppercase by style, centred; active Snow `#FCFCFC`, inactive Silver `#A09BA8` | 24 icon + label | h 54, padding 18 / 4, gap 6; widths 144 / 147 / 143 | `--palette-neutral-softWhite`, `--palette-neutral-gray3` |
| PreviewToggle (right) | Blue Dark 2 `#244B7D` (selected drawn) | none | 8 | — | 24 × 24 at 4 / 4 | 32 × 32 | see PreviewToggle |
| Collapse/Expand (right) | none | none | 8 | — | inset 20% | 32 × 32 | see Collapse/Expand Panel |
| Bottom row | — | — | — | — | — | three columns, 1px gaps | — |
| Left column ("Folders") | Charcoal | none | 0 | "Folders" Inter 400 12 (`H8 Regular`) uppercase Silver | `Optimize` 24 | 300 wide, padding 0 / 10; header h 24, padding 4 / 5, gap 5 | `--ui-designer-panel-bg` |
| Folder rows | FoldersHierarchy states | none | 0 | Inter 400 12, Snow | arrow-right 8 × 8, `FolderOpen` 14 × 14 | h 24, gap 5; padding-left 5 (root), 20 (level 1), 36 (level 2) | see FoldersHierarchy |
| Middle header | Charcoal | none | 0 | — | PreviewToggle 32 (mirrored), Search-Bar, Scale Slider | h 40, padding 20 / 10, gap 10 | — |
| Search-Bar | none | 1px White 40 `rgba(255,255,255,0.4)` | 10 | "Search" Inter 400 12, White 40 | Search 24 | 300 × 32, padding 9 / 40 / 9 / 10, gap 10 | `--palette-whiteTransparent-blurry` |
| Filters (PillIconText) | active "All": White 10; others none | others 1.5px White 10 | 100 | Inter 600 12 (`H8 Semi`); active Snow, inactive White 60 `rgba(255,255,255,0.6)` | 24 × 24 | h 32, padding 8 / 12, gap 10; chips gap 5 ("All", "Models", "Avatar Animations", "Images", "Other") | `--palette-whiteTransparent-subtle`, `--palette-whiteTransparent-backdrop` |
| Path | Charcoal | none | 0 | breadcrumb of FoldersHierarchy rows | — | h 40, padding 20 / 10 | — |
| Scrollview | Charcoal | none | 0 | — | — | wrap, gap 5, padding 0 / 10 | — |
| File tile | File Button States | none | 10 | Inter 400 12 Snow, centred, ellipsis | `FolderOpen` 48 × 48 | 94 × 80, padding 3 / 10, gap 5 | see File Button States |
| Right column | Charcoal | none | 0 | — | — | 300 wide; two half-height panes (see Right Panel) | — |
| Scrollbar handles | Black 40 `rgba(0,0,0,0.4)` | 1px White 60 | 100 | — | — | 8 wide (left 8 × 303 at right 0 / top 0; right 8 × 50 at right 4 / top 3) | `--palette-blackTransparent-blurry`, `--palette-whiteTransparent-backdrop` |

Contrast on the Black gutters: Snow 20.47:1, Silver 7.75:1.

### PreviewToggle (3D Editor Bottom Panel — Components)

Set [`21673:54906`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21673-54906), 4 variants (`Status` × `Hover`: Not Visible / No `21671:45776`, Not Visible / Yes `21673:54701`, Visible / No `21673:47659`, Visible / Yes `21673:54706`). Size 222 × 72; each variant 32 × 32. Read October 27, 2026. Code: inspector `ProjectAssetExplorer` preview toggle · Creator Hub none.

The four fills are the single-toggle pattern (none, White 10, Blue Dark 2, Blue Dark 3) on a 32 × 32, 8px-radius box with a 24 × 24 glyph. Hover on a Visible toggle is darker (Blue Dark 3), as ToolbarButton.

| Status | Hover | Fill | Radius | Glyph | Inspector token | Contrast (on `#242129`) |
| --- | --- | --- | --- | --- | --- | --- |
| Not Visible | No | none | 8 | 24 × 24 at 4 / 4, Silver `#A09BA8` | `--ui-designer-text-muted` | 5.85:1 |
| Not Visible | Yes | White 10 `rgba(255,255,255,0.1)` | 8 | Silver | `--palette-whiteTransparent-subtle` | 4.31:1 on the fill |
| Visible | No | Blue Dark 2 `#244B7D` | 8 | Snow `#FCFCFC` | `--ui-designer-control-active-bg` | 8.61:1 |
| Visible | Yes | Blue Dark 3 `#243852` | 8 | Snow | `--palette-system-blueDark3` | 11.61:1 |

### FoldersHierarchy (3D Editor Bottom Panel — Components)

Set [`21671:45961`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21671-45961), 3 variants (`Status` = Default `21671:45960`, Hover `21671:45959`, Selected `21671:45958`), on the Components board `21673:54749`. Size 263 × 150; each variant Fixed 223 × 24. Read October 27, 2026. Code: inspector the Local Assets tree (`ProjectAssetExplorer/ProjectView.tsx`, `Tree<string>`) · Creator Hub none.

Horizontal, gap 5, padding 4 / 5 (Hover and Selected 3 / 5); an `arrow-right` chevron 8 × 8, a `FolderOpen` glyph 14 × 14 in Silver `#A09BA8`, label `H8 Regular` (Inter 400 12) Snow. No collapsed, focus or drag state is drawn. In `BottomPanel3D` the rows indent by padding-left 5 / 20 / 36. The code's tree is 26 tall, with the shared tree states (NodeTypeHierarchy). Unit 3b gives it this set's size, glyph and label colour. Unit 3b also gives it Figma's surface: `BottomPanel3D` `21673:49658` is Neutrals/Black `#000000` with a 1px gap between sub-panels, and the folder-tree panel `Left` is Charcoal `#25212A` (300 wide, padding 0 / 10). The code paints the whole `.Assets-content` (tree and tiles) `--tree-bg-color` `#161518` (user, October 27, 2026: Local Assets surface in 3b; G38).

| Variant | Fill | Padding T / B | Inspector token | Contrast (on `#242129`) | A11y |
| --- | --- | --- | --- | --- | --- |
| Default | none | 4 | — | Snow 15.45:1; Silver glyph 5.85:1 | `treeitem` in the "Local Assets" tree |
| Hover | `#FFFFFF` 5% | 3 | `--palette-whiteTransparent-faint` | Snow 13.37:1 | — |
| Selected | Blue Dark 3 `#243852` | 3 | `--palette-system-blueDark3` | Snow 11.61:1; fill vs panel 1.33:1 | `aria-selected="true"` |

### File Button States (3D Editor Bottom Panel — Components)

Set [`21671:46674`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21671-46674), 4 variants (`Status` × `Hover`: Default / No `21671:46667`, Default / Yes `21671:46675`, Selected / No `21671:46680`, Selected / Yes `21671:47486`). Size 136 × 422; each variant 94 × 80. Read October 27, 2026. Code: inspector `ProjectAssetExplorer` tile (`Tile`) · Creator Hub none.

A selected tile rests on Blue Dark **2**, where a selected tree row is Blue Dark **3**; hover on a selected tile is darker (Blue Dark 3), as ToolbarButton and the toggles.

| Status | Hover | Fill | Radius | Text | Glyph | Padding / gap | Inspector token | Contrast (on `#242129`) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Default | No | none | 10 | Inter 400 12 (`H8 Regular`), Snow `#FCFCFC`, centred, ellipsis | `FolderOpen` 48 × 48 | 94 × 80, padding 3 / 10, gap 5 | — | Snow 15.45:1 |
| Default | Yes | White 5 `rgba(255,255,255,0.05)` | 10 | Snow | 48 | same | `--palette-whiteTransparent-faint` | 13.37:1 |
| Selected | No | Blue Dark 2 `#244B7D` | 10 | Snow | 48 | same | `--palette-system-blueDark2` | 8.61:1 |
| Selected | Yes | Blue Dark 3 `#243852` | 10 | Snow | 48 | same | `--palette-system-blueDark3` | 11.61:1 |

### Scale Slider (3D Editor Bottom Panel — Components)

Set [`21673:47613`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21673-47613), 3 variants (`Status` = Default `21673:47612`, Hover `21673:47614`, Editing `21673:47618`). Size 100 × 107; each variant 60 × 4. Read October 27, 2026. Code: inspector `ProjectAssetExplorer` tile-size slider · Creator Hub none.

The track is 60 × 4; the filled value is drawn as a right padding of 43 (28%), and the handle sits at the track centre in every variant, a drawing convention rather than the value's position.

| Status | Track fill | Radius | Handle | Inspector token |
| --- | --- | --- | --- | --- |
| Default | White 20 `rgba(255,255,255,0.2)` | 100 | 10 × 10, Silver `#A09BA8` | `--palette-whiteTransparent-soft` |
| Hover | White 40 `rgba(255,255,255,0.4)` | 100 | 10 × 10, Snow `#FCFCFC` | `--palette-whiteTransparent-blurry` |
| Editing | White 40 | 100 | 10 × 10 with a 20 × 20 halo, Snow | `--palette-whiteTransparent-blurry` |

### Right Panel (3D Editor Bottom Panel — Components)

Set [`21673:54433`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21673-54433), 2 variants (Empty `21673:54432`, Asset Selected `21673:54434`). Size 340 × 1096; each variant 300 × 518. Read October 27, 2026. Code: inspector `components/ProjectAssetExplorer` preview / info pane · Creator Hub none.

| Variant | Part | Fill | Border | Radius | Text | Glyph | Padding / gap / size | Inspector token | Contrast (on `#242129`) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Empty | pane | Charcoal `#25212A` | none | 0 | title "Select and asset to preview it here" Inter 600 14 (`H7 Semi`), Snow `#FCFCFC`, centred; body "Drag and drop it into the scene to use it" Inter 400 12 (`H8 Regular`), Cloudy Sky `#716B7C`, centred | `Cube` 36 × 36 | 300 × 518, vertical, centred, padding 0 / 10, gap 20; title / body gap 5 | `--ui-designer-panel-bg`; body `--ui-designer-glyph` | title 15.45:1; body 3.09:1 (below 4.5:1) |
| Asset Selected | preview pane | White 10 `rgba(255,255,255,0.1)` | none | 0 | — | — | flex 1 (half height) | `--palette-whiteTransparent-subtle` | — |
| Asset Selected | name row | none | 1px White 10 top and bottom | 0 | "Asset Name" Inter 400 12 Gray `#CFCDD4` | `Videos` 14 × 14; Collapse/Expand 24 × 24, radius 8, glyph inset 20% | padding 2 / 10, gap 5 | `--palette-neutral-gray4` | 10.07:1 |
| Asset Selected | information | none | none | 0 | — | scrollbar handle Black 40, 1px White 60, radius 100 | scrollbar 8 × 50 at right 4 / top 3 | `--palette-blackTransparent-blurry` | — |

### Collapse/Expand Panel (3D Editor Bottom Panel — Components)

Set [`21673:54911`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21673-54911), 4 variants (`Status` × `Hover`: Selected / No `21673:54910`, Selected / Yes `21673:54908`, Default / No `21673:54909`, Default / Yes `21673:54907`). Size 222 × 72; each variant 32 × 32. Read October 27, 2026. Code: inspector `ProjectAssetExplorer` panel collapse buttons (header and name row) · Creator Hub none.

The names are inverted: `Selected` is the unfilled look and `Default` the Blue Dark 2 filled look with the glyph mirrored horizontally; the two are an expand / collapse pair, not a selected pair. The box matches PreviewToggle (32 × 32, radius 8, 24 glyph); in the Right Panel's name row the same control is drawn 24 × 24 with the glyph inset 20%.

| Status | Hover | Fill | Radius | Glyph | Inspector token | Contrast (on `#242129`) |
| --- | --- | --- | --- | --- | --- | --- |
| Selected | No | none | 8 | 24 × 24 at 4 / 4, Silver `#A09BA8` | `--ui-designer-text-muted` | 5.85:1 |
| Selected | Yes | White 10 `rgba(255,255,255,0.1)` | 8 | Silver | `--palette-whiteTransparent-subtle` | 4.31:1 on the fill |
| Default | No | Blue Dark 2 `#244B7D` | 8 | Snow `#FCFCFC`, mirrored | `--ui-designer-control-active-bg` | 8.61:1 |
| Default | Yes | Blue Dark 3 `#243852` | 8 | Snow, mirrored | `--palette-system-blueDark3` | 11.61:1 |

### UI Editor (page lead)

Page `21028:15887`, two boards. **Panels** `21028:34519` holds the screens: `LeftPanel2D` `21028:34521` (Fixed 312 × Hug 712, vertical, Charcoal, padding-bottom 100), `RightPanel2D` `21028:34544` (Hug 4068 × 1742, 24px radius, padding 20, gap 20: eleven right-panel states laid side by side) and `BottomPanel2D` `21221:41852`. **Components** `21028:30543` holds eight sub-boards, each 24px radius, fill Black 40, 1px White 20: `Components` `21028:15991` (956 × 958), `UI Editor Buttons` `21028:16485` (710 × 407), `Icons` `21028:16123` (1477 × 448), `PropertiesSections` `21028:30544` (2648 × 781), `PropertiesSubsections` `21028:30545`, `Variables&EventsMenus` `21032:43793`, `ColourPanel` `21032:44145` (621 × 513) and `InputActions` `21301:5375` (1662 × 336). Every control below maps to the inspector's UI Designer (`components/UIDesigner`; see [`UIDesigner.md`](UIDesigner.md)) — mapped by directory, not line by line. Existing specs reused, never duplicated: `ToolbarButton`, `IconContainedToggle`, `Menu`, `Menu-Entry`, `Close-Button`, `Switch`, `Checkbox` (`Tertiary`), `Tooltip`. Body copy and field labels are content, not spec.

The `AddCTA` chip (a 20 × 20 `+` button, glyph inset 20%) has a 6px radius in the right panel (Border, Devices, Interactions, MinMaxSize, AddAction, AddLogicInputs) and 5px in `HierarchySections`.

### LeftPanel2D (UI Editor — Panels)

Component [`21028:34521`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21028-34521), 1 variant: the 2D rail. Size 312 × 712. Read October 27, 2026. Code: inspector `LeftPanel/LeftPanel.tsx`, `NodeTree.tsx`, `CodeRootsList.tsx` · Creator Hub none. The rail's search field is not mapped in code yet; the 2D rail assembly (layer 3b unit 4) takes it.

| Part | Fill | Border | Radius | Text | Padding / gap / size | Inspector token |
| --- | --- | --- | --- | --- | --- | --- |
| Panel | Charcoal `#25212A` | none | 0 | — | Fixed 312 wide, vertical, items centred, padding-bottom 100, no gap between sections | `--ui-designer-panel-bg` `#242129` (✱ deviation 1/255) |
| TabBar | Shadow `#161518` | 1px White 10 bottom | 0 | Inter 600 12 uppercase; active Gray, inactive Silver | h 36, padding-bottom 1; tab padding 10 / 4; active 2px Gray bottom | see TabBar |
| Search-Bar | none | none | container 6 | placeholder "Search" Inter 400 12, White 40 | h 32, outer padding 4; container padding 6 / 40 / 6 / 6, gap 6; Search glyph 12 × 12 | `--palette-whiteTransparent-blurry` |
| HierarchySections ×2 (GUIS, NODES) | none | 1px White 10 top and bottom | 0 | Inter 600 12 uppercase Gray | h 28, padding 4 / 10 | see HierarchySections |
| GUIS list | none | none | 0 | Inter 400 12 Gray | padding 2 / 0; rows h 30, padding 0 / 10, gap 10; glyph 14 × 14 | see GUI |
| NODES list | none | none | 0 | Inter 400 12 Gray; Snow selected; White 40 hidden | padding 2 / 0; rows h 30; padding-left 10 (root), 40 (level 1), 70 (level 2); padding-right 10 | see NodeTypeHierarchy |

The board's rows are fixture data: GUIS is HUD (Default), PopUp (Hover), Modal (Default), Settings (Selected); NODES draws a root Image, hidden level-1 rows (White 40, lock + eye-off), a selected Container (Blue Dark 3, Snow, lock and eye shown), level-2 children, and a hidden Container whose children carry the inherited dots.

### RightPanel2D (UI Editor — Panels)

Set [`21028:34544`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21028-34544), 11 variants (`Property 1`: Container `21028:34554`, Image&Container `21028:34545`, Text `21028:34576`, Button `21028:34592`, Input `21028:34608`, Dropdown `21028:34624`, GUILogic `21028:34641`, NodeLogic1 `21143:4292`, NodeLogic2 `21151:7668`, Empty `21036:47478`, MobileHUD `21281:45188`). Size 4068 × 1742; each variant 348 wide. Read October 27, 2026. Code: inspector `RightPanel/RightPanel.tsx`, `RightPanel/PropertyPanel/*`, `RightPanel/LogicPanel/*`, `MobileHud/` · Creator Hub none.

Shared by every variant:

- **Panel:** Charcoal `#25212A` (`--ui-designer-panel-bg`, the 1/255 deviation), Fixed 348 wide, vertical, gap 12 between the TabBar, Header and Properties groups, items centred, padding-bottom 100 (MobileHUD: 20). The 24px radius belongs to the board, not the panel.
- **TabBar:** Shadow `#161518`, 1px White 10 bottom rule, h 36, padding-bottom 1; two flex-1 tabs, padding 10 / 4, Inter 600 12 uppercase centred. On the Properties tab the selected label is Gray `#CFCDD4` with a 2px Gray underline and "Logic" is Silver; on the Logic tab (GUILogic, NodeLogic1, NodeLogic2) the selected label is Snow `#FCFCFC` with a 2px Snow underline and "PROPERTIES" is Silver.
- **Header:** 348 wide, padding-top 6, gap 10; the header row (`NodeTypeHierarchy` PropertiesHeader) is 16 tall with padding 0 / 16 / 0 / 10, gap 8, an 18 × 18 node glyph, the name in `H7 Semi` (Inter 600 14) Gray and a 16 × 16 VisibilityToggle (radius 4, eye 14 × 14).
- **Toggles:** a column with padding 6 / 0, gap 6; each row h 15, padding 0 / 11, gap 10: a 14 × 14 Checkbox, the label Inter 400 12 Gray, a 12 × 12 `HelpCTA`.
- **Sections:** `PropertiesSections` rows (h 28, 1px White 10 top and bottom, padding 2 / 10, gap 10, 12 × 12 chevron) over 292-wide `Properties` columns; `Fill` is 290 wide.
- **Fields:** `Input` cells on Onix `#35333B`, h 26, radius 6, padding 6 / 24 / 6 / 8, value Inter 400 14 Gray, label Inter 400 12 Gray; an `AddVariant` 18 × 18 at right 4 / top 4 on editable cells.

| Variant | Part | Fill | Border | Radius | Text | Padding / gap / size | Inspector token |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Container (348 × 1573) | Dropdown block ("Scene Inset") | Onix `#35333B` | none | 6 | label Inter 400 12 Gray; value "Secure Area" Inter 400 14 Gray | padding 0 / 10, gap 6; input h 26, padding 6 / 8, gap 8, arrow 10 | `--ui-designer-control-bg` |
| Container | Fill (Paint) | — | — | — | label "Fill" Gray 12 | 290 wide, vertical, gap 6, padding 0 / 10 | see Fill |
| Container | Fill ToggleTabs | Charcoal slot | 1px Onix | 6 | — | 130 × 20, gap 8, five flex-1 cells; selected cell Blue Dark 2 `#244B7D`, no border; others 1px Onix; glyph 18 × 18 | `--ui-designer-control-active-bg`, `--palette-neutral-onyx` |
| Container | colour pair ("FFFFFF" / "100%") | Onix | none | 6 on the outer ends | Inter 400 14 Gray | two cells joined at 1px: left min-width 128, padding 0 / 24 / 0 / 8 with a `MarginsIcons` 16; right 75 wide with an `AddVariant` | `--ui-designer-control-bg` |
| Container | Border / Devices / Interactions headers | none | none | AddCTA 6 | label Gray 12 ("Border", "Device Variants", "Interaction States") | 292 wide, gap 10, padding 0 / 14 / 0 / 10; each after a 1px `Div` | `--palette-neutral-gray4` |
| Container | Constraints | Onix dropdowns | none | 6 | "Top", "Left" Inter 400 14 Gray | `ConstraintsIcons` 60 × 60; two `Input` Dropdown cells h 26, padding 6 / 8, gap 8; stack gap 6; row h 60, gap 10, padding-right 70 | `--ui-designer-control-bg` |
| Container | Position / Z-Index | Onix | none | 6 | "100", "1" Inter 400 14 Gray | X / Y cells h 26 with a 16 glyph and an `AddVariant`, gap 6; Z-Index one cell, no glyph | `--ui-designer-control-bg` |
| Image&Container (348 × 1186) | header "Image"; no Text section | — | — | — | — | — | — |
| Image&Container | Interaction States chips (Default active, Hover, Pressed, Selected) | active Blue Dark 3 `#243852`; others none | none | 6 | Inter 400 12; Snow active, Silver otherwise | h 20, padding 2 / 6, gap 2 | `--palette-system-blueDark3` (✱ code Blue Dark 2, see Interactions) |
| Image&Container | Device Variants chips (Desktop active, Mobile) | active Blue Dark 3; other none | none | 6 | as above | as above | `--palette-system-blueDark3` |
| Image&Container | Fill source ("Search") / Scale Type ("Cropped") | Onix | none | 6 | placeholder White 40; value Gray 14 | h 26 | `--ui-designer-control-bg` |
| Text (348 × 1504) | Text Input | Onix | none | 6 | Inter 400 14 Gray | h 100 (multiline), padding 6 / 26 / 6 / 8 | `--ui-designer-control-bg` |
| Text | Typography (font select), Size (14) | Onix | none | 6 | Inter 400 14 Gray | h 26; font select flex 1, padding 0 / 8; Size 80 wide, padding 0 / 24 / 0 / 8 | `--ui-designer-control-bg` |
| Text | Colour (hex + opacity) | Onix | none | 6 on the outer ends | Inter 400 14 Gray | joined pair, h 26; opacity cell 75 wide | `--ui-designer-control-bg` |
| Text | Alignment | Charcoal slot, 1px Onix | as slot | 6 | — | slot 142 wide; active cell Blue Dark 2 | see ToggleTabs |
| Text | Wrap / Truncate / Disabled | — | — | — | Inter 400 12 Gray | checkbox rows as Toggles | — |
| Button (348 × 1504) | as Text | — | — | — | header "Button"; Text Input value "Label" | as Text (fixture copy differs only) | — |
| Input (348 × 1549) | as Text, plus an "Input" section | — | 1px White 10 top and bottom on its header | — | section header Inter 600 12 Gray | header h 28, padding 2 / 10; Resize width 200 | — |
| Input | Placeholder / Value fields | Onix | none | 6 | label Inter 400 12 Gray; value Inter 400 14 Gray | h 50, padding 6 / 26 / 6 / 8, gap 8 | `--ui-designer-control-bg` |
| Dropdown (348 × 1702) | Options field | Onix | none | 6 | "Option 1" Inter 400 14 Gray | h 100, padding 12 / 24 / 6 / 8, gap 8 | `--ui-designer-control-bg` |
| Dropdown | value chip ("customValue") | White 10 `rgba(255,255,255,0.1)` | none | 100 | Inter 400 12 Snow | h 22, padding 6 / 4 / 6 / 8, gap 2 | `--palette-whiteTransparent-subtle` |
| Dropdown | Selected Index, Empty Label, Accept Empty | Onix | none | 6 | label Gray 12, value Gray 14 | h 26, padding 6 / 24 / 6 / 8 | `--ui-designer-control-bg` |
| Dropdown | Dropdown Events ("On Change") | `EventTag` pills | none | 100 | label Inter 400 12 Gray, 80 wide | h 22 | see EventTag |
| GUILogic (348 × 626) | header "GUIName" | none | none | — | `H7 Semi` Gray; GuiRoot glyph 18 | row h 16, gap 8, padding 0 / 16 / 0 / 10 | `--palette-neutral-gray4` |
| GUILogic | section headers (Variables, Inputs, Events) | none | 1px White 10 top and bottom | 0 | Inter 600 12 Gray | h 28, padding 2 / 10, gap 10; arrow-down 12 | `--palette-whiteTransparent-subtle` |
| GUILogic | description | none | none | — | Inter 400 12 Silver; the `{{` run Gray | padding 0 / 10, gap 12 | `--palette-neutral-gray3` |
| GUILogic | empty lines ("No variables yet." …) | none | none | — | Inter 400 12 Cloudy Sky `#716B7C` | 95 × 15 | `--ui-designer-glyph` |
| GUILogic | Name / Value / type cells, AddCTA | Onix | none | 6 (row 8) | placeholder Cloudy Sky; "string" Gray | as AddLogicInputs; AddCTA at 20% opacity until a name is typed | `--ui-designer-control-bg` |
| NodeLogic1 (348 × 413) | header "PrefabName" | none | none | — | `H7 Semi` Gray; prefab glyph 18 | row h 16, gap 8, padding 0 / 16 / 0 / 10 | `--palette-neutral-gray4` |
| NodeLogic1 | description | none | none | — | "Set the values for this component's inputs." Inter 400 12 Silver; the second sentence Inter 400 **10** Silver | gap 6, 328 wide; slot column gap 18, padding 0 / 10 | `--palette-neutral-gray3`; 10px: PROPOSED `--type-caption-size` |
| NodeLogic1 | LogicInputs row | none | none | 8 | "InputName" Inter 400 12 Gray, flex 1 | h 26, gap 6, 328 wide; value cell 146 wide | — |
| NodeLogic1 | value input, rest / bound | Onix | none / 1px White 60 `rgba(255,255,255,0.6)` | 6 | Inter 400 12 Gray | h 26; rest padding 6 / 24 / 6 / 8; bound padding 7 / 25 / 7 / 9 (border-box) with an `AddVariant` at right 3 / top 3 | `--ui-designer-control-bg`, `--palette-whiteTransparent-backdrop` |
| NodeLogic1 | DeleteCTA slot | none | — | — | — | 20 × 20, glyph 16; opacity 0 on an unbound row, shown on a bound row | — |
| NodeLogic1 | hint + "Open PrefabName" button (below the inputs) | none | 1px White 40 `rgba(255,255,255,0.4)` | 6 | hint Inter 400 10 Silver; button Inter 400 12 Snow | button 328 × 26, padding 12 / 24 | `--palette-whiteTransparent-blurry` |
| NodeLogic2 (348 × 365) | as NodeLogic1, with a `HelpCTA` 12 (Cloudy Sky) after the header name, the "Open PrefabName" button directly under the header (`CTA` row, padding 0 / 10), and no hint or bottom `Div` | — | — | — | — | header padding 6 / 0, column gap 6 | `--palette-neutral-gray2` (HelpCTA) |
| Empty (348 × 215) | panel | Charcoal `#25212A` | none | — | — | column, gap 10, centred both axes, padding 100 / 0, text centred | `--ui-designer-panel-bg` |
| Empty | title "No node selected" | — | — | — | `H6 Semi` Inter 600 16 / 100% Gray `#CFCDD4` | full width | `--palette-neutral-gray4` |
| Empty | body | — | — | — | Inter 400 12, one paragraph: "Select a " Silver, "node " Gray (regular weight), "to start editing its properties and logic." Silver; no icon drawn | full width | `--palette-neutral-gray3` / `--palette-neutral-gray4` |
| MobileHUD (348 × 1003) | header "MobileHUD" | none | none | — | `H7 Semi` Inter 600 14 Gray | column, gap 10, padding 12 / 0 / 6; header row h 16, gap 8, padding 0 / 16 / 0 / 10 | `--palette-neutral-gray4` |
| MobileHUD | Toggles (Hide Joystick, Hide Crosshair, Hide Input Actions) | none | none | — | Inter 400 12 Gray | column gap 6, padding 6 / 0; rows h 15, gap 10, padding 0 / 11; Checkbox 14 | — |
| MobileHUD | InputActions section | none | 1px White 10 top | — | title "Input Actions" Inter 600 12 Gray; hint "Choose one action as Main. Drag them to reorder." Inter 400 12 Silver (328 wide) | column, gap 4, padding 10 | `--palette-whiteTransparent-subtle` |
| MobileHUD | drop slot `Div` | `#D9D9D9` at opacity 0 | none | — | — | h 6, full width (the drop-indicator slot) | — |
| MobileHUD | InputAction cards ×8 | see InputAction | — | 6 | — | — | — |
| MobileHUD | scrollbar | handle Black 40 `rgba(0,0,0,0.4)` | handle 1px White 60 | 100 | — | 8 × 860 at right 2 / top 0, padding 4 / 0 / 500 | `--palette-blackTransparent-blurry`, `--palette-whiteTransparent-backdrop` |

Contrast on `#242129`: Gray 10.07:1, Silver 5.85:1, Snow 15.45:1, Cloudy Sky 3.09:1 (the empty lines miss 4.5:1); Gray on Onix 7.90:1; Cloudy Sky placeholder on Onix 2.43:1.

### BottomPanel2D (UI Editor — Panels)

Set [`21221:41852`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21221-41852), 2 variants (`Blocked` `21221:41853`, `Default` `21138:18798`). Size 1960 × 635 (dashed `#8A38F5` chrome); variants 1920 × 320 and 1920 × 225. Read October 27, 2026. Code: inspector `RightPanel/LogicPanel/` (`CodeCallbacksPanel.css`, `CodeVariablesPanel.css`) — the code has no bottom dock today (absence is not removal) · Creator Hub none.

The logic / code panel docked under the canvas. Default lists NODES (Full Screen, Container, Image, Label, Button, Input, Dropdown) and PREFABS (PopUp, SecondaryButton, PrimaryButton, Close, Dropdown, ProfileEntry), with a 314-wide 1px divider between the two lists; Blocked lists six NODES (no Full Screen) and no PREFABS.

| Variant | Part | Frame | Fill | Border | Radius | Text | Glyph | Contrast (on Charcoal) | A11y |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Default | panel | Fixed 1920 × Hug 320, vertical, padding 10 / 10 / 100 / 10, gap 10 | Charcoal `#25212A` | none | 0 | section labels "NODES", "PREFABS" Inter 400 12 (`H8 Regular`) Silver `#A09BA8` | — | Silver section labels 5.83:1; Gray names 10.03:1 | `role="region"` named by its heading ✱ |
| Default | node tile | 80 × 70, padding 20 / 10, gap 10; tiles gap 5 | none | 1px White 10 | 10 | Inter 400 12 Gray `#CFCDD4`, centred, ellipsis, no wrap | `NodeType` 20 × 20 | Gray 10.03:1 | — |
| Default | prefab tile | as node tile | none | none | 10 | Gray 12 | `NodeType` Prefab 20 | 10.03:1 | — |
| Default | scrollbar | 10 wide, at right 10 / top 10 | handle Black 40 `rgba(0,0,0,0.4)` | 1px White 60 `rgba(255,255,255,0.6)` | 100 | — | — | — | — |
| Blocked | panel | Fixed 1920 × Fixed 225, same padding and gap | Charcoal | none | 0 | the section label "NODES" is Silver `Inter` 400 12 (5.83:1) | — | the dimmed content: White 20 on Charcoal 1.91:1 | `aria-disabled="true"` on the controls, with the reason ✱ |
| Blocked | node tile | as Default | none | 1px White 10 | 10 | White 20 `rgba(255,255,255,0.2)` | 20 | 1.91:1 (disabled exemption) | — |

Tokens: Charcoal `--ui-designer-panel-bg` (✱ deviation 1/255); tile border `--palette-whiteTransparent-subtle`; blocked label `--palette-whiteTransparent-soft`; scrollbar `--palette-blackTransparent-blurry` with `--palette-whiteTransparent-backdrop`.

### Tooltip (UI Editor — Panels)

Component `21151:7716` (`Property 1` = Top; Figma defines this one variant only, so the other directions are genuinely undrawn), values not re-read 2026-10-27. Hug 340 × Hug 87.77, vertical; `Container` `21551:3941` Hug 340 × Hug 77, 12px radius, padding 16 / 20, gap 10, Onix `#35333B` with Snow text; `Peak` `21551:3943` 26 × 26, 5px radius, rotated −45°, Onix; shadow `0 2px 6px #000 25%`. This is a wider, shadowed copy of the shared Tooltip (Tooltips) — **a second tooltip spec: confirm with design whether the UI Editor tooltip replaces it** ✱. Snow on Onix 12.13:1. Code: help tooltips in `PropertyPanel`; the inspector has no shared tooltip component listed in this doc.

### MinMaxSize (UI Editor — PropertiesSubsections)

Set [`21028:16810`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21028-16810), 2 variants (`Off` `21028:16816`, `On` `21028:16811`). Size 332 × 143; `On` is Fixed 292 × Hug 47. Read October 27, 2026. Code: inspector `PropertyPanel/LengthVecField`, `BoxModelField` · Creator Hub none.

| Variant | Part | Fill | Radius | Text | Glyph | Padding / gap / size | Inspector token |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Off | header | none | 0 | "Min Size" Inter 400 12, Gray `#CFCDD4` | `HelpCTA` 12; `AddCTA` 20 × 20 (radius 6), plus inset 20% | 292 wide, padding 0 / 14 / 0 / 10, gap 10 | `--palette-neutral-gray4` |
| On | header | none | 0 | as Off | `HelpCTA` 12; `DeleteCTA` in a 26 × 16 box at right 0 | vertical, 292 wide, padding 0 / 10, gap 6; header gap 10 | — |
| On | Width / Height cells | Onix `#35333B` | 6 | value "20" Inter 400 14, Gray | size glyph 16 × 16; `AddVariant` 18 at right 4 / top 4 | h 26, flex 1 each, padding 6 / 24 / 6 / 8, gap 8; pair gap 6 | `--ui-designer-control-bg` |

### Interactions (UI Editor — PropertiesSubsections)

Set [`21028:16819`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21028-16819), 2 variants (`Off` `21028:16827`, `On` `21028:16820`). Size 332 × 143; `On` is Fixed 292 × Hug 45. Read October 27, 2026. Code: inspector the `useInteraction({ base, hover, press, active })` construct (`code/interaction-convention.ts`) through `PropertyPanel` · Creator Hub none.

| Variant | Part | Fill | Radius | Text | Glyph | Padding / gap / size | Inspector token |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Off | header | none | 0 | "Interaction States" Inter 400 12, Gray `#CFCDD4` | `HelpCTA` 12; `AddCTA` 20 × 20 (radius 6), plus inset 20% | 292 wide, padding 0 / 14 / 0 / 10, gap 10 | `--palette-neutral-gray4` |
| On | header | none | 0 | as Off | `HelpCTA` 12; `DeleteCTA` in a 26 × 16 box at right 0 | vertical, 292 wide, padding 0 / 10, gap 4; header gap 10 | — |
| On | active chip ("Default") | Blue Dark 3 `#243852` | 6 | Inter 400 12, Snow `#FCFCFC`, centred | none | h 20, padding 2 / 6, gap 2 | `--palette-system-blueDark3` |
| On | inactive chips ("Hover", "Pressed", "Selected") | none | 6 | Inter 400 12, Silver `#A09BA8`, centred | none | h 20, padding 2 / 6, gap 2; row gap 6, row h 26 | `--ui-designer-text-muted` |
| On | ✱ active chip in code (user decision October 22, 2026, see UI Editor Buttons) | code paints the active chip Blue Dark 2 and Blue Dark 3 on hover | — | — | — | — | `--ui-designer-control-active-bg`, `--palette-system-blueDark3` |

### Devices (UI Editor — PropertiesSubsections)

Set [`21028:16830`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21028-16830), 2 variants (`Off` `21028:16836`, `On` `21028:16831`). Size 332 × 143; `Off` is Fixed 292 × Hug 20, `On` Fixed 292 × Hug 45. Read October 27, 2026. Code: the device-variant section of `PropertyPanel` (platform variants are a recognised construct — see CLAUDE.md) · Creator Hub none.

Figma draws the Desktop / Mobile pair as `ToggleLabel` chips (20 tall, 6px radius, Blue Dark 3 when selected), not as the 16 × 16 `ViewModeToggle` set. The code's device-variant tabs follow the tab-toggle rule with the 1px Onyx border (✱ ViewModeToggle, user decision October 22, 2026).

| Variant | Part | Fill | Radius | Text | Glyph | Padding / gap / size | Inspector token |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Off | header | none | 0 | "Device Variants" Inter 400 12, Gray `#CFCDD4` | `HelpCTA` 12 (gap 6); `AddCTA` 20 × 20, radius 6, plus 12 × 12 | row, gap 10, centred, padding 0 / 14 / 0 / 10 | `--palette-neutral-gray4` |
| On | header | none | 0 | as Off | `DeleteCTA` slot 26 × 16 at right 0 | column, gap 4, padding 0 / 10; chip row h 26, gap 6 | — |
| On | Desktop chip (selected) | Blue Dark 3 `#243852` | 6 | "Desktop" Inter 400 12, centred, Snow `#FCFCFC` | icon 16 | row, gap 2, h 20, padding 2 / 6 | `--palette-system-blueDark3` |
| On | Mobile chip | none | 6 | "Mobile" Inter 400 12, Silver `#A09BA8` | icon 16 | as Desktop | `--palette-neutral-gray3` |

### Fill (UI Editor — PropertiesSubsections)

Set [`21028:16839`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21028-16839), 4 variants (`Property 1` = Paint `21028:16840`, Image `21028:16857`, Avatar `21028:16877`, None `21028:16890`). Size 332 × 307. Read October 27, 2026. Code: inspector `PropertyPanel/FillField` (Colour / Image / Avatar) · Creator Hub none.

Fill 290, padding L / R 10: Paint vertical Hug 52 gap 6; Image vertical Hug 111 gap 12 (adds scale type and image source); Avatar Hug 52 gap 6 (user id); None horizontal Hug 20 gap 10. **No video variant — the react-ecs authoring type has none** (see CLAUDE.md). Figma's mode control draws five cells, Video among them, in all four variants; the code offers Colour, Image and Avatar.

| Part | Fill | Border | Radius | Text | Glyph | Padding / gap / size | Inspector token |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Row | none | none | 0 | label "Fill" Inter 400 12 Gray `#CFCDD4` | `HelpCTA` 12 | 290 wide, padding 0 / 10 | `--palette-neutral-gray4` |
| Mode control (ToggleTabs slot) | Charcoal `#25212A` | 1px Onix `#35333B` | 6 | — | cell glyph 18 × 18 | 130 × 20, gap 8, five flex-1 cells (Paint, Image, Video, Avatar, None) | `--ui-designer-panel-bg` (✱ deviation 1/255), `--palette-neutral-onyx` |
| Mode cell, selected | Blue Dark 2 `#244B7D` | none | 0 (the slot clips the ends) | — | 18 | flex 1 | `--ui-designer-control-active-bg` |
| Mode cell, unselected | none | 1px Onix | 0 | — | 18 | flex 1 | `--palette-neutral-onyx` |
| Paint: colour pair | Onix | none | 6 on the outer ends (joined at 1px) | "FFFFFF" and "100%" Inter 400 14 Gray | `MarginsIcons` 16 (left); `AddVariant` 18 at right 4 / top 4 (right) | h 26; left min-width 128, padding 0 / 24 / 0 / 8; right 75 wide, padding 0 / 24 / 0 / 8 | `--ui-designer-control-bg` |
| Image: texture input | Onix | none | 6 | "Search" Inter 400 14, White 40 `rgba(255,255,255,0.4)` | icon 10 × 10; two round 26 × 26 buttons (radius 100, glyph inset 20%: link, local assets) | h 26, padding 6 / 8, gap 8; 6 between input and buttons | `--ui-designer-control-bg`, `--palette-whiteTransparent-blurry` |
| Image: scale type | Onix | none | 6 | label "Scale Type" Gray 12 (93 wide); value "Cropped" Inter 400 14 Gray | arrow 10 | h 26, padding 6 / 8 | `--ui-designer-control-bg` |
| Avatar: user id | Onix | none | 6 | "User ID" Inter 400 14, White 40 | none | h 26, padding 6 / 8 | `--ui-designer-control-bg` |
| None | none | none | — | label "Fill" | the mode control only, "None" selected | h 20 | — |

### Border (UI Editor — PropertiesSubsections)

Set [`21028:16901`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21028-16901), 2 variants (`Off` `21028:16902`: Fixed 292 × Hug 20, horizontal, padding R 14 L 10, gap 10 — a header with a `+`; `On` `21028:16905`: vertical, Fixed 290 × Hug 104, padding L / R 10, gap 10 — colour field + weight). Size 332 × 204. Read October 27, 2026. Code: inspector `PropertyPanel/BoxModelField`, `FillField` (colour row) · Creator Hub none.

| Variant | Part | Fill | Radius | Text | Glyph | Padding / gap / size | Inspector token |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Off | header | none | 0 | "Border" Inter 400 12, Gray `#CFCDD4` | `HelpCTA` 12; `AddCTA` 20 × 20 (radius 6), plus inset 20% | 292 wide, padding 0 / 14 / 0 / 10, gap 10 | `--palette-neutral-gray4` |
| On | colour pair | Onix `#35333B` (two cells joined at 1px) | 6 on the outer ends | "000000" and "100%" Inter 400 14, Gray | `MarginsIcons` 16; `AddVariant` 18 at right 4 / top 4 on the right cell | 290 wide, padding 0 / 10, gap 10 between blocks, 6 inside; cells h 26; left min-width 128, padding 0 / 24 / 0 / 8; right 75 wide | `--ui-designer-control-bg` |
| On | weight | Onix | 6 | label "Weight" Gray 12; value "1" Inter 400 14 Gray | `AddVariant` 18 at right 4 / top 4 | h 26, padding 6 / 24 / 6 / 8, gap 8 | `--ui-designer-control-bg` |

### EventHandler (UI Editor — PropertiesSubsections)

Set [`21028:16916`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21028-16916), 4 variants (`Default` `21028:16917`, `DefaultHover` `21028:16922`, `Defined` `21028:16927`, `DefinedHover` `21028:16930`). Size 332 × 200. Read October 27, 2026. Code: inspector `PropertyPanel/CallbackField`, `edit-event.ts` · Creator Hub none.

Fixed 292 × Hug 22, horizontal, padding L / R 10, gap 6; "Title" (`Inter` 400 12 / 100%, Gray `#CFCDD4`, 80 wide, 10.07:1 on panel) + a field or an `EventTag` chip. The field is an `Input` instance, flex 1 × Fixed 22, 100px radius, padding 6 / 4 / 6 / 8, gap 8, no border in any state; its placeholder "Bind an event handler" is `Inter` 400 12 Cloudy Sky `#716B7C`. In the Defined variants the tag is flex 1 (DefinedHover: fixed 186).

| Variant | Fill | Content | Contrast | A11y | Inspector token |
| --- | --- | --- | --- | --- | --- |
| Default | field Onix `#35333B` | empty bind field | placeholder 2.43:1 on Onix — **fails 4.5:1**; field vs panel 1.27:1 | `<input aria-label="<event> handler">` | `--ui-designer-control-bg` |
| DefaultHover | field White 10 | same, plus an `AddVariant` 18 × 18 at the field's right | placeholder 2.28:1 on the fill; field vs panel 1.36:1 | hover changes the fill (no border) and shows the `AddVariant` | `--palette-whiteTransparent-subtle` |
| Defined | none (chip is White 10) | `EventTag` Default | as `EventTag` | chip removal returns to Default | — |
| DefinedHover | none | `EventTag` Hover (close button White 10, glyph Snow) | as `EventTag` | — | — |

### EventTag (UI Editor — PropertiesSubsections)

Set [`21028:16933`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21028-16933), 2 variants (`Default` `21028:16937`, `Hover` `21028:16934`). Size 226 × 106. Read October 27, 2026 (through the EventHandler instances). Code: inspector `PropertyPanel/CallbackField` · Creator Hub none.

Fixed 186 × 22 pill, 100px radius, padding 6 / 4 / 6 / 8, gap 8, fill White 10 in both; a handler name (`Inter` 400 12 / 100%, Snow, 150 × 15) and a `Close-Button` (Search Bar) 16 × 16, 100px radius, glyph 8 × 8. Hover recolours the `Close-Button`: fill White 5 → White 10, glyph Silver → Snow. The `Close-Button` base `20768:59566` is 24 × 24 and is resized per use: 16 in the tag, 18 in the AI TitleBar, 12 in the AI Selection chip.

| Variant | Fill | Contrast (on `#242129`) | A11y | Inspector token |
| --- | --- | --- | --- | --- |
| Default | White 10; close button White 5 | Snow text 11.40:1 on the chip; Silver `×` 3.70:1; chip vs panel 1.36:1 | `<span>` with a `<button aria-label="Remove <handler>">` | `--palette-whiteTransparent-subtle`; close `--palette-whiteTransparent-faint` |
| Hover | White 10; close button White 10 | Snow `×` 8.36:1 on the lifted button | 22px chip, 16px `×` hit box below 24px ✱ | `--palette-whiteTransparent-subtle` |

### AddLogicInputs (UI Editor — PropertiesSubsections)

Set [`21028:16940`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21028-16940), 3 variants (`Variants` `21028:16941`, `Inputs` `21028:16946`, `Events` `21028:16950`). Size 332 × 158; each row Fixed 292 × 26 (Variants Hug 26). Read October 27, 2026. Code: inspector `LogicPanel/CodeVariablesPanel.tsx`, `VariablePicker/` · Creator Hub none.

`Variants` shows Name + type + Value, `Inputs` Name + type, `Events` Name only. The `AddCTA` is drawn at 20% opacity in every variant: the add stays disabled until a name is typed.

| Part | Fill | Radius | Text | Glyph | Padding / gap / size | Inspector token | Contrast |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Row | none | 8 | — | — | 292 wide, padding 0 / 10, gap 6 | — | — |
| Name field | Onix `#35333B` | 6 | placeholder "Name" Inter 400 12, Cloudy Sky `#716B7C` | none | flex 1 × 26, padding 6 / 24 / 6 / 8, gap 8 | `--ui-designer-control-bg` | 2.43:1 (fails 4.5:1) |
| Type dropdown (Variants, Inputs) | Onix | 6 | "string" Inter 400 12 Gray `#CFCDD4` | arrow 10 × 10 | 70 × 26, padding 6 / 8, gap 8 | `--ui-designer-control-bg` | 7.90:1 |
| Value field (Variants) | Onix | 6 | placeholder "Value" Cloudy Sky | none | 70 × 26, padding 6 / 24 / 6 / 8 | `--ui-designer-control-bg` | 2.43:1 |
| AddCTA | none | 6 | — | plus, inset 20% | 20 × 20, opacity 20% | — | disabled exemption |

### LogicInputs (UI Editor — PropertiesSubsections)

Set [`21032:44190`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21032-44190), 4 variants (`Property 1`: Empty `21032:44189`, Variables `21032:44191`, Inputs `21032:44335`, Events `21032:44353`). Size 332 × 241. Read October 27, 2026. Code: inspector `LogicPanel/CodeVariablesPanel.tsx`, `CodePropsPanel.tsx` · Creator Hub none.

| Variant | Part | Fill | Radius | Text | Glyph | Padding / gap / size | Inspector token | Contrast |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Empty | text | none | 0 | "No variables yet." Inter 400 12, Cloudy Sky `#716B7C` | — | 95 × 15 | `--ui-designer-glyph` | 3.09:1 (below 4.5:1) |
| Variables | row | none | 8 | "Name" Inter 400 12, Gray `#CFCDD4`, flex 1 | `DeleteCTA` in a 20 × 20 box (16 glyph) | Fill 290 × Hug 26, gap 6; inputs group 146 wide, gap 6 | `--palette-neutral-gray4` | 10.07:1 |
| Variables | type dropdown | Onix `#35333B` | 6 | "string" Inter 400 12 Gray | arrow 10 × 10 | 70 × 26, padding 6 / 8, gap 8 | `--ui-designer-control-bg` | 7.90:1 |
| Variables | value input | Onix | 6 | "Value" Inter 400 12 Gray | — | 70 × 26, padding 6 / 24 / 6 / 8, gap 8 | `--ui-designer-control-bg` | — |
| Inputs | row | none | 8 | "Name" Gray | `DeleteCTA` 20 | type dropdown 70 ("string") + delete; Fill 290 × Hug 26, gap 6 | — | — |
| Events | row | none | 8 | "Name" Gray, flex 1 | `DeleteCTA` 20 | vertical, Fill 290 × Hug 72, gap 2; name row gap 10 | — | — |
| Events | code field | Onix | 6 | placeholder "e.g. {{counter}}" Inter 400 12, Cloudy Sky | — | h 50, min-width 128, padding 6 / 24 / 6 / 8, gap 8 | `--ui-designer-control-bg` | 2.43:1 |

### LogicError and Header (UI Editor — PropertiesSubsections)

Not sets. `Header` [`21067:22621`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21067-22621) is a frame of three instances (`NodeTypeHierarchy` PropertiesHeader, `Toggles`, `Dropdown` `21180:30481`), 348 wide, column, gap 10, padding-top 6; read October 27, 2026. `LogicError` `21124:5300` (292 × 14), values not re-read 2026-10-27, is an `ErrorOutline` glyph + a one-line message, both `#FF2D55` Primary — **Primary on `#242129` is 4.35:1, below 4.5:1 for 12px text**; keep a distinct error token ✱ (the Creator Hub error red is `#FB3B3B`, 5.04:1). Code: `LogicPanel` error text; `PropertyPanel` header · Creator Hub none.

| Part | Layout | Text | Fill / radius | Glyph | Inspector token |
| --- | --- | --- | --- | --- | --- |
| Header row (`NodeTypeHierarchy` `21067:22573`) | row, gap 8, h 16, padding 0 / 16 / 0 / 10 | "Image": `H7 Semi` Inter 600 14 / 100% / 0, Gray `#CFCDD4` | none | node glyph 18 × 18; VisibilityToggle 16 × 16, radius 4, eye 14 × 14 | `--palette-neutral-gray4` |
| Toggles `21071:33460` | column, gap 6, padding 6 / 0 | — | — | — | — |
| Toggle ×2 ("Visibility is Active", "Ignore Layout Flow") | row, gap 10, h 15, padding 0 / 11, 348 wide | Inter 400 12 Gray | none | Checkbox 14 × 14, `HelpCTA` 12 | `--palette-neutral-gray4` |
| Dropdown `21180:30481` | column, gap 6, padding 0 / 10 | subtitle "Scene Inset" Inter 400 12 Gray (93 wide, gap 6, `HelpCTA`) | — | — | `--palette-neutral-gray4` |
| Dropdown input `21180:30483` | row, gap 8, h 26, padding 6 / 8 | "Secure Area" Inter 400 14 Gray | Onix `#35333B`, 6 | arrow-down 10 × 10 | `--ui-designer-control-bg` |

### AddAction (UI Editor — PropertiesSubsections)

Set [`21281:45569`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21281-45569), 2 variants (`AddAction` `21281:45570`, `NoMoreActions` `21281:45573`). Size 388 × 128; each 348 × 34 (the right-panel width). Read October 27, 2026. Code: inspector `LogicPanel/CodeCallbacksPanel.tsx` · Creator Hub none. A11y: the `+` is `<button aria-label="Add action">`; the empty line is plain text.

| Variant | Fill | Border | Text | Glyph | Padding / gap | Inspector token | Contrast (on `#242129`) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AddAction | none | 1px White 10 top and bottom | "Add Action" Inter 600 12, uppercase, Gray `#CFCDD4`, flex 1 | `AddCTA` 20 × 20 (radius 6), plus inset 20% | h 34, padding 0 / 14 / 0 / 10, gap 10, centred | `--palette-neutral-gray4`, `--palette-whiteTransparent-subtle` | 10.07:1 |
| NoMoreActions | none | 1px White 10 top only | "No more actions to add" Inter 400 12 (`H8 Regular`), Gray, centred | none | h 34, padding 0 / 14 / 0 / 10, aligned to the bottom | `--palette-neutral-gray4` | 10.07:1 |

### ColourPanel, HUE and Slider (UI Editor — ColourPanel)

`ColourPanel` [`21032:44156`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21032-44156) (component, 193 × 296) assembles `HUE` `21032:44154` (170 × 170) and the `Slider` set [`21032:44146`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21032-44146), 2 variants (`Property 1` = Colour `21032:44147` / Transparency `21032:44150`; 214 × 111). Read October 27, 2026 (HUE and Slider inside ColourPanel). Code: inspector the colour popover of `PropertyPanel/FillField` · Creator Hub none.

Slider: Fixed 170 × 20, 100px radius; Colour is the rainbow track, Transparency the checkered alpha ramp tinted to the current colour (canvas); the thumb is a white-ringed disc. `HUE` is the 6px-radius saturation / value square (linear gradient white → black over the hue). A11y: sliders are `role="slider"` with `aria-valuemin/max/now` and arrow-key steps ✱; the square is a 2D slider with a hex field as the keyboard path. Onix vs panel 1.27:1 — the 1px White 10 border and the shadow carry the popover edge.

| Part | Fill | Border | Radius | Text | Glyph | Padding / gap / size | Shadow | Inspector token |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ColourPanel | Onix `#35333B` | 1px White 10 `rgba(255,255,255,0.1)` | 12 | — | — | Fixed 193 × 296, vertical, padding 12 / 11, gap 12 | `0 4px 10px rgba(0,0,0,0.25)` | `--palette-neutral-onyx`; shadow missing (see Editor tokens) |
| HUE | white → black (top to bottom) under a 223.56° `rgb(242,0,255)` → transparent overlay | none | 6 | — | — | flex 1 (fills the free height) | none | canvas gradient |
| Slider, Colour | rainbow track | none | 100 | — | handle | 170 × 20 | none | — |
| Slider, Transparency | a checker under a gradient from the colour at 0 alpha to the colour | none | 100 | — | handle 24 × 24 at right −2 | 170 × 20 | none | — |
| Hex row | Pale Black `#43404A`, two cells joined at 1px | none | 6 on the pair | "C640CD" and "100%": Inter 400 14 Gray `#CFCDD4` (placeholder values) | swatch 16 × 16 `#C640CD`, radius 4, 1px White 20 | h 26; left flex 1, padding 0 / 8, gap 8; right padding 0 / 4 / 0 / 8 | none | `--gray-0` |

### EventsMenu (UI Editor — Variables&EventsMenus)

Set [`21032:43794`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21032-43794), 3 variants (`Property 1`): NewVariable `21032:43795` (Hug 202 × 90; it holds the empty events list), NewAction `21032:43801` (Hug 202 × 139), AddNewAction `21032:43809` (Hug 202 × 211). Size 676 × 277. Read October 27, 2026. Code: inspector `LogicPanel/CodeCallbacksPanel.tsx` · Creator Hub none.

Same anatomy as `VariableMenu`, shorter (no extra row): the shared `Menu` container with `Menu-Entry` rows. A11y for both: `role="menu"`, the name field is auto-focused, Escape closes and returns focus to the opener.

| Part | Fill | Border | Radius | Text | Glyph | Padding / gap / size | Shadow | Inspector token |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Menu | Onix `#35333B` | 1px White 10 `rgba(255,255,255,0.1)` | 12 | — | — | 200 wide, padding 10 / 0 (AddNewAction 10 / 0 / 20), gap 10; slots padding 0 / 10 | `0 4px 8px rgba(0,0,0,0.4)` | `--palette-neutral-onyx`, `--menu-shadow` |
| Menu-Entry | none | none | 8 | Inter 400 12, Snow `#FCFCFC`, capitalised | 16 × 16 (variable, check, info) | padding 4 / 10, gap 10 | none | — |
| Empty entry "No events yet" | none | none | 8 | Inter 400 12, Silver `#A09BA8` | none | padding 4 / 10 | — | Silver on Onix 4.59:1 |
| Div | White 10 | none | 0 | — | — | h 1 | — | `--palette-whiteTransparent-subtle` |
| Description field (AddNewAction) | none | 1.5px Snow `#FCFCFC` | 7 | label "Description" Inter 400 12 Snow; typed "Text" Inter 400 16 (`H6 Regular`) Snow with a 1px Snow caret | — | h 50; container padding 6 / 8, gap 10; slot padding 0 / 20, gap 10 | — | — |
| Add button (AddNewAction) | Primary `#FF2D55` at 20% opacity (disabled until a name is typed) | none | 7 | "Add" Inter 600 12, uppercase, Snow, line-height 22 | — | 60 × 26, padding 12 / 24 | — | `--primary-main` |

### VariableMenu (UI Editor — Variables&EventsMenus)

Set [`21032:43818`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21032-43818), 3 variants (`Property 1`): NewVariable `21032:43819` (Hug 202 × Hug 90), NewAction `21032:43825` (Hug 202 × Hug 163), AddNewAction `21032:43834` (Hug 202 × Hug 235). Size 676 × 306. Read October 27, 2026. Code: inspector `LogicPanel/VariablePicker/` · Creator Hub none.

A popover of `Menu-Entry` rows with a name field and a confirm action, at EventsMenu's values (Onix, 1px White 10, radius 12, `--menu-shadow`, 200 wide, entries padding 4 / 10 at radius 8, Inter 400 12 Snow, a 1px White 10 `Div`). Reuse `Menu` / `Menu-Entry` for the rows; spec only the three compositions.

| Variant | Content | Add button |
| --- | --- | --- |
| NewVariable | "No variables yet" (Silver), `Div`, "Add New Variable" with a variable glyph | — |
| NewAction | playerName (checkmark), score, health, time (info glyphs), `Div`, "Add New Variable" | — |
| AddNewAction | the four entries, `Div`, the Description field (1.5px Snow border, radius 7, 16px "Text") and the Add button | Primary `#FF2D55` at full opacity, 60 × 26, radius 7, "Add" Inter 600 12 uppercase Snow, line-height 22 (`--primary-main`) |

### Subtitle (UI Editor — Components)

Component `21028:15992`, values not re-read 2026-10-27. Code: inspector `BindableField` label row · Creator Hub none.

`Text` `21028:15993` (Fill 93 × Hug 15, gap 6: a `Checkbox` Secondary On instance 14 × 14 drawn with a Gray tick override; code follows the `Checkbox` set's `Tertiary` (Snow tick), the label "Text" `Inter` 400 12 / 100% Gray `#CFCDD4` (25 × 15, 10.07:1 on panel), and a `HelpCTA` Hover = No instance 12 × 12) and `DeleteCTA` `21028:15998` (26 × 16). `DeleteCTA` and `HelpCTA` states are in their own sections under UI Editor Buttons.

### ToggleTabs (UI Editor — Components)

Component [`21028:16000`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21028-16000), one definition with two `Slot` instances (`21028:16001`, `21028:16002`, each with a `Slot` = Default property). Size 292 × 27. Read October 27, 2026. Code: inspector `PropertyPanel/FlowField`, `ResizeField` (segmented groups) · Creator Hub none.

An empty segmented-control frame that the `ToggleTab` buttons drop into. Border Onix vs Charcoal 1.27:1; the frame is a container, the child cell carries the state. The code draws joined cells with no wrapper border (✱ "Segmented seams", see UI Editor Buttons).

| Part | Layout | Fill | Border | Radius | Inspector token |
| --- | --- | --- | --- | --- | --- |
| Frame | row, gap 8, centred, h 27, clips | none | none | 6 | `--ui-designer-radius-field` |
| Slot / Slot2 | flex 1 (142 each in 292), full height | Charcoal `#25212A` | 1px Onix `#35333B` | 6 | `--ui-designer-panel-bg` (✱ deviation 1/255); border `--palette-neutral-onyx` |

### Input (UI Editor — Components)

Set [`21028:16003`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21028-16003), 5 variants (`Property 1`): Single `21028:16016`, SingleBlocked `21028:16019`, Dropdown `21028:16012`, Icon `21028:16004`, IconBlocked `21028:16008`. Size 168 × 250. Read October 27, 2026. Code: inspector `RightPanel/PropertyPanel` fields (`FieldRow`, `LengthVecField`, `BoxModelField`) over `--ui-designer-control-bg`, `--ui-designer-radius-field`, `--ui-designer-text-value` · Creator Hub none.

All Fixed 128 × 26, horizontal, gap 8, 6px radius, fill Onix `#35333B`, padding T / B 6. Padding L / R: Single 8 / 24, SingleBlocked 8 / 4, Dropdown 8 / 8, Icon 8 / 24, IconBlocked 8 / 8. The value reads "100" (`Inter` 400 14 / 100%, Gray `#CFCDD4`, in Dropdown too), with a 16 × 16 `MarginsIcons` glyph (Icon, IconBlocked, Dropdown) or a 10 × 10 chevron (Dropdown). The editable variants (Single, Icon) carry an `AddVariant` instance (18 × 18, at right 4 / top 4) as the bind affordance; the Blocked variants carry none, and their values are White 20.

| Variant | State | Fill | Contrast (on Onix) | A11y |
| --- | --- | --- | --- | --- |
| Single / Icon | editable | Onix | value Gray 7.90:1; Onix vs panel 1.27:1 | `<input inputmode="numeric" aria-label="<field>">`; the unit glyph is `aria-hidden` |
| SingleBlocked / IconBlocked | blocked (value is bound or inherited) | Onix | value White 20 (`#FFFFFF` 20%) 1.88:1 on Onix — below 3:1, so the value is not legible; keep the bound-value tooltip and a ✱ ≥ 4.5:1 value | `aria-disabled` + a bound-value tooltip ✱; `Blocked` is a state, not a mode |
| Dropdown | opens a list | Onix | chevron Silver 4.59:1 | `role="combobox"` |
| any | ✱ focus / hover / error | — | ring `--ui-designer-control-accent` | not drawn |

### NodeTypeHierarchy (UI Editor — Components)

Set [`21028:16022`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21028-16022), 9 variants (`Property 1`): Default `21028:16027`, Hover `21028:16073`, Selected `21028:16094`, SelectedHover `21028:16099`, InvisibleDefault `21028:16031`, InvisibleHover `21028:16038`, InvisibleSelected `21028:16066`, InvisibleSelectedHover `21028:16059`, PropertiesHeader `21028:16023`. Size 265 × 406; each row variant 223 × 30. Read October 27, 2026. Code: inspector `LeftPanel/NodeTree.tsx` (+ `NodeTree.css`) over the shared `components/Tree` · Creator Hub none.

It draws the UI Designer's 2D node tree; its one board is `LeftPanel2D` `21028:34521`, whose NODES list `21028:34533` is twelve instances of it. The user extended its **state rule** to every inspector tree (decisions below). Shared:

- **Row:** Fixed 223 × 30 (a Fill instance on the board's 312 rail), horizontal, gap 10, padding 4 / 10 (3 / 10 on the six hover and selected variants; the height is fixed, so nothing moves).
- **Order:** the caret `Vector` (10 × 6.09, White 40, pointing down in every variant: no closed caret is drawn), the node glyph `NodeType/*` (16 × 16, in the label's colour), the label `Text` (Inter 400 12 / 100%), then `CTAs` (lock + eye, 16 + 16, gap 8, Gray, absolutely placed 10 from the right edge).
- **Nesting (board):** padding-left is 10 at the root and grows by 30 per level (40, 70). A leaf draws no caret and keeps no slot for one: its glyph starts where a sibling's caret does.
- **Inherited state (board):** the children of a hidden, locked Container are drawn InvisibleDefault, with LockLayerToggle `Parent = No` / `Active = On` dots where their lock and eye go. The 2D tree draws them per toggle (user, October 27, 2026): an eye dot only under a hidden ancestor, a lock dot only under a locked one; the other trees don't. Today the code has no inherited lock (locking a node doesn't lock its descendants on the canvas), so a descendant shows only the eye dot, with its lock slot reserved and empty; the lock dot arrives with inherited lock (G39).
- **Selected** also carries an extra `Label` instance `21028:16098` (73.5 × 15); nothing else in the set uses it.
- **Row actions (code):** in the 2D tree, lock, eye and delete, in that order (LockLayerToggle, VisibilityToggle, DeleteCTA; user, October 27, 2026); the 3D trees, the lock and eye. At rest an unpressed action takes no space; in the 2D tree an action area with nothing to show leaves the layout, so a long label runs to the row's 10px padding. A pressed toggle or an inherited dot stays visible at rest, and the row then reserves every action slot, the delete's included, so nothing moves on hover. Hover or keyboard focus inside the row shows them all. A 2D platform-variant row missing a device branch carries "Add Desktop variant" / "Add Mobile variant" buttons in the same area, under the same rule (Figma draws none).

PropertiesHeader is the `PropertyPanel` header (it sits in `Header` `21067:22621`), not a tree row; it is specced with the right panel: 223 × 20, gap 8, padding 0 / 16 / 0 / 10, an 18 × 18 glyph, the label `H7 Semi` (Inter 600 14) Gray and a 16 × 16 VisibilityToggle with a 4px radius.

Code: the 2D tree is `LeftPanel/NodeTree.tsx` (+ `NodeTree.css`) over the shared `components/Tree` (`Tree.tsx`, `Tree.css`, `ActionArea/ActionArea.css`), which also renders the 3D Hierarchy (`Hierarchy.tsx`, plus `PlayerTree.tsx`'s hand-written rows on the same CSS) and the Local Assets tree (`ProjectAssetExplorer/ProjectView.tsx`). Every tree takes the shared state rule from `Tree.css`: White 5 hover, Blue Dark 3 selection, Gray labels that turn Snow when selected, Figma's caret, the WAI-ARIA tree semantics and the arrow keys. The 2D size and spacing live in `NodeTree.css` (decisions below).

| Variant | State | Fill | Label / glyph / caret | Row actions | Contrast (on `#242129`, every tree's surface) | A11y |
| --- | --- | --- | --- | --- | --- | --- |
| Default | rest | none | Gray `#CFCDD4` / Gray / White 40 | hidden | label 10.07:1; caret 3.74:1 | `role="treeitem"`, `aria-level`, `aria-selected="false"`, `aria-expanded` on parents only |
| Hover | pointer over | White 5 `--palette-whiteTransparent-faint` | Gray | lock (open) + eye | fill vs panel 1.16:1; label 8.71:1 | — |
| Selected | selected | Blue Dark 3 `--palette-system-blueDark3` | Snow `#FCFCFC` | hidden | label 11.61:1; fill vs panel 1.33:1, so the Snow label carries it | `aria-selected="true"` |
| SelectedHover | selected + pointer over | Blue Dark 3, the same as Selected | Snow | lock + eye | as Selected | the row actions appearing is the hover cue (user, October 27, 2026) |
| InvisibleDefault | hidden | none | White 40 label, glyph and caret | closed lock + eye-off, shown at rest | ✱ label **3.74:1 on the panel**, below 4.5:1 (see the ✱ row) | the eye is pressed |
| InvisibleHover | hidden + pointer over | White 5 | White 40 | lock + eye-off | label 3.51:1 | — |
| InvisibleSelected | hidden + selected | Blue Dark 3 | White 40 | lock + eye-off | ✱ label **3.31:1** | `aria-selected="true"` |
| InvisibleSelectedHover | hidden + selected + pointer over | Blue Dark 3, pixel-identical to InvisibleSelected | White 40 | lock + eye-off | as InvisibleSelected | Figma defect: no hover cue at all (G10) |
| any | ✱ focus (Figma draws none; unit 1, October 26, 2026) | as the state | as the state | — | Snow `--focus-ring` 11.61:1 on Blue Dark 3, 13.37:1 on White 5, 15.45:1 on the panel | 1px inset Snow `--focus-ring` on `:focus-visible`, the same ring as the menu rows; one roving `tabindex="0"` per tree. The row's lock and eye show while focus is inside the row and nothing in it was focused by the mouse (`:focus-within:not(:focus:not(:focus-visible)):not(:has(:focus:not(:focus-visible)))`), so Tab reaches them but a mouse-focused row keeps them hidden, as Figma's Selected does at rest. A plain `:focus-visible` / `:has(:focus-visible)` pair breaks Tab: Tab blurs the row first and the lock hides before it can take focus. In the 3D tree those buttons take a 1px Snow `--focus-ring` at a 1px offset; in the 2D tree, the UI Designer icon-button ring (October 27, 2026) |
| any | ✱ hidden label (user, October 27, 2026) | — | White 40 as drawn, in **every** tree: the 2D nodes and the 3D Hierarchy's hidden entities and spawn points | — | **accepted AA miss: 3.74:1 on the panel, 3.31:1 when selected** (12px text needs 4.5:1) | the eye's `aria-pressed="true"` and its name say the node is hidden |
| any | ✱ drop target (Figma draws none; user, October 27, 2026) | none | — | — | `--palette-info-light` 7.09:1 on the panel, 5.33:1 on Blue Dark 3 | inside: a 1px inset `--palette-info-light` outline on the target row only, never its open subtree; before / after: a 2px `--palette-info-light` line. All four trees |
| InvisibleDefault (board) | inherited hidden: a descendant of a hidden node, 2D tree only | as its own state (none, White 5, Blue Dark 3) | White 40 label, glyph and caret | an inert 2 × 2 Gray dot in the eye slot (LockLayerToggle `Parent = No`, `Active = On`), and one in the lock slot too when an ancestor is locked (G39; until then the lock slot is reserved and empty); the row's own lock, eye and delete return on hover and focus, like every row's actions | label as the ✱ hidden label (3.74:1); dots Gray 10.07:1, decorative | the dots are `aria-hidden`; the row's own toggles keep their names and pressed state |
| — | inherited locked (G39, not built: the code has no inherited lock yet): a descendant of a locked node that no hidden node contains, 2D tree only | as its own state | as its own state (a lock doesn't dim the label) | an inert Gray dot in the lock slot only; the row's own actions return on hover and focus | dot Gray 10.07:1, decorative | as inherited hidden |

**Decisions** (layer 3b unit 3; the record for this component and the inspector's trees, so grep here before asking again):

| Date | Question | Answer |
| --- | --- | --- |
| 2026-10-27 | NodeTypeHierarchy draws only the 2D tree. How far does unit 3 reach? | Shared states, 2D size. Hover White 5, selected Blue Dark 3, labels Gray at rest and Snow when selected, Figma's caret, unit 1's focus ring, tree roles and arrow keys go into the shared `Tree`, so the 3D Hierarchy, PlayerTree, Local Assets and the 2D tree change together. The 30px row, the 30-per-level indent, the 16px glyphs and the lock / eye rule stay 2D-only. Before / After covers all four trees. `--selected-item` keeps its value; `Tree.css` doesn't read it. |
| 2026-10-27 | Order of the tree units? | 3 NodeTypeHierarchy → 3b FoldersHierarchy (Local Assets) → 3c GUI (the 2D GUI list) → 4 assemblies: the 3D Hierarchy panel against Editor 3D `Entity-List` `21673:49646`, the 2D rail against `LeftPanel2D` `21028:34521`. |
| 2026-10-27 | The 3D tree has no current set; the Editor 3D board draws it with stale Base-ramp rows. Which governs its rows? | NodeTypeHierarchy. The board's rows are a stale kit (G35); the 22 vs 24px row height is settled in unit 4. |
| 2026-10-27 | A selected GUI row is White 10, a selected tree row Blue Dark 3. Which? | Each set as drawn: GUI rows select White 10 (unit 3c), tree rows Blue Dark 3. No ✱. |
| 2026-10-27 | Figma gives a selected row no hover fill. What does it do on hover? | As Figma: Blue Dark 3 stays, and the lock and eye appearing is the cue. |
| 2026-10-27 | A hidden node's White 40 label is 3.74:1 (3.31:1 selected), below AA. Which colour? | White 40 as drawn: an accepted AA miss (✱ hidden label). |
| 2026-10-27 | Every hidden variant draws the lock closed. A rule? | Sample data. Lock and eye stay independent toggles; a pressed toggle stays visible at rest, as #1707 does. |
| 2026-10-27 | Figma draws no drop target. What does one look like? | An accent outline (✱ drop target): inside is a 1px inset accent outline on the target row only; before / after are accent lines. It reaches every tree, so the shared `Tree` reads `--palette-info-light` (decision below). |
| 2026-10-27 | The lock and eye flip both their name and `aria-pressed`. Which naming? | A stable name plus pressed: "Lock <label>" and "Hide <label>", with `aria-pressed="true"` when locked or hidden, in both trees. |
| 2026-10-27 | Standing rule for this flow? | Always follow Figma: this is a flow to align the code to Figma. Where Figma draws a value or a control, the code follows it; a ✱ is only for states Figma doesn't draw at all (focus, drop, keyboard), and those take Figma's nearest drawn value. Applies to layer 3b unit 3 and every unit after it. |
| 2026-10-27 | Arrow keys and tree semantics (G19)? | The full WAI-ARIA tree pattern, test-first: `role="tree"` with `aria-multiselectable`; `treeitem` with `aria-level`, `aria-expanded` and `aria-selected`; a roving tabindex; Up / Down, Right / Left, Home / End and Enter. All four trees, PlayerTree included. Closes G19. |
| 2026-10-27 | Each tree's accessible name? | "Hierarchy" (3D), "Nodes" (2D), "Local Assets". |
| 2026-10-27 | Row delete: does the 2D row carry a delete beside the lock and eye? | Yes. The 2D tree's row actions are DeleteCTA, LockLayerToggle and VisibilityToggle, in the order lock, eye, delete. The delete is DeleteCTA under the icon-button rule: Silver at rest, Snow (the ✱ for Figma's White) on White 10 with a 4px radius on hover, named "Delete <label>". It follows the row-action rules: hidden at rest, shown on hover or keyboard focus, its slot reserved in a row with a pressed toggle or an inherited dot. Delete is also in the right-click menu ("Delete") and on the Delete / Backspace keys (`useUINodeHotkeys`). |
| 2026-10-27 | No current Figma set draws the 3D tree: its one drawing, Editor 3D `Entity-List` `21673:49646`, is an instance of `Entity-List` `14589:108927` on the Scene Editor 🟡 Outdated page. Does the shared state rule still reach it? | Yes, re-confirmed. NodeTypeHierarchy governs the 3D rows: hover White 5, selected Blue Dark 3, Gray → Snow labels, unit 1's focus ring, tree semantics and arrow keys go to all four trees. The 2D sizing stays 2D-only. Confirmed again on review of the spec: the spec's reading of the newer answers (shared states in all four trees) is right. |
| 2026-10-27 | The board draws a hidden node's children dimmed with inert lock / eye dots. Add it? | Yes, in the 2D tree only, per toggle as LockLayerToggle draws (`Parent = No` / `Active = On` is the dot, `Active = Off` draws nothing): a descendant of a hidden node renders White 40 with an eye dot, and a descendant of a locked node carries a lock dot. Inherited lock itself (a locked parent locking its descendants on the canvas) is its own unit, G39; until it ships, the lock slot under a hidden ancestor is reserved and empty. |
| 2026-10-27 | Where does a pressed toggle alone (a locked but visible row) sit at rest? Figma draws the lock and eye as a fixed pair, and no variant shows this state. | Fixed slots, as Figma's lock + eye pair: a pressed toggle keeps its own slot at rest and on hover, so nothing moves. Only rows with a pressed toggle or an inherited dot reserve the empty slots (the delete's included); every other row keeps the full-width label. |
| 2026-10-27 | Figma draws every tree panel on Charcoal `#25212A`; `--tree-bg-color` is Shadow `#161518`. Which surface, and in which unit? | The 3D Hierarchy in unit 3: `.Hierarchy { background: var(--base-19); }` (`#242129`, the 1/255 Charcoal deviation `--ui-designer-panel-bg` already uses). Local Assets in unit 3b. `--tree-bg-color` keeps its value (16 consumers). Every tree's contrast is measured on the panel (`#242129`). Local Assets follows Figma's bottom-panel layout (Black, with Charcoal sub-panels) in layer 3b unit 3b. |
| 2026-10-27 | Figma's `CTAs` pair is 16px boxes with gap 8, the eye's box 10px from the row edge. The 2D lock and eye spacing? | Follows Figma's `CTAs`: a 24px glyph-centre pitch, the last 16px box 10px from the row edge. The 24 × 24 hit-target buttons (the October 22 ✱; lock, eye, delete) abut and the last overhangs the row padding by 4px, so the 16px `::before` boxes land on Figma's gap 8 and padding 10 (`.ui-designer-nodetree .Tree .item .selectable-area .action-area { column-gap: 0; padding-right: 0; margin-right: -4px; }`, specific enough to beat `ActionArea.css`'s padding). The 3D spacing waits for unit 4 (G37). |
| 2026-10-27 | The 2D tree's nesting? | As the board, under the align-with-Figma rule: padding-left 10 at the root plus 30 per level, and no caret slot on leaf rows (the glyph starts where a sibling's caret does). |
| 2026-10-27 | Does the ✱ hidden label (White 40) reach the 3D Hierarchy too? | Yes: hidden rows are White 40 in every tree, 3D entities and spawn points included, with the same accepted AA miss (3.74:1 on the panel). The 3D eye-off glyph keeps its look. |
| 2026-10-27 | The drop target reaches every tree. Which token? | A new `--palette-info-light` = `#63b4f6` (the MUI theme path; ui2's dark `palette.info.light`; Figma System/Blue Light 1). `--border-focused` keeps its value. |
| 2026-10-27 | Figma indents 30px per level in a 312px rail; ours is about 215px (162px at Creator Hub's 1080 minimum) with 24px row buttons. Which indent? | 30px per level, as Figma. Accepted: deep rows lose label room on hover in a narrow rail. Label room at the default 214.5px rail, rest / hover: level-0 parent 148.5 / 70.5px, level-1 parent 118.5 / 40.5px, level-2 parent 88.5 / 10.5px, level-2 leaf 108.5 / 30.5px (the three 24px actions, less the 4px overhang, plus the 10px gap take 78px on hover); at 162px a level-0 parent has 96 / 18px, a level-1 parent 66px / none and a level-2 parent 36px / none. Not a ✱: it matches Figma. |
| 2026-10-27 | Local Assets already moves and selects on the arrow keys, with Shift extending. One pattern? | One shared pattern in all four trees: the arrows move focus, Enter selects, and Shift + Up / Down move focus and extend the selection. Local Assets keeps range-select, and the other trees gain it. |
| 2026-10-27 | A pressed lock or eye showed Snow on a Blue Dark 2 fill (the October 22 single-toggle rule). Keep the fill? | No: the glyph shows the state. Every lock and eye follows LockLayerToggle and VisibilityToggle as drawn: the 2D tree rows, the node-header, GUI-list and MobileHUD eyes, the 3D trees' lock and eye and the spawn-point eye. Gray `--palette-neutral-gray4` glyph in every state, no fill at rest, White 10 with a 4px radius on hover, and no fill when locked or hidden (the closed lock or eye-off is the indicator). Focus rings keep their look. Wrap, Scale, View mode, the toolbar Run / Scene Info and the other single toggles keep the October 22 single-toggle rule until their own units. |
| 2026-10-27 | Sign-off of the Before / After / Figma set (layer 3b unit 3), standalone and inside Creator Hub | Signed off: the four trees take NodeTypeHierarchy's states and tree semantics, the 2D tree its size, nesting and `CTAs` spacing, and the 3D Hierarchy the `--base-19` surface. |
| 2026-10-27 | Sign-off of the Before / After / Figma set (lock / eye / delete and the MobileHUD action eye), standalone | Signed off: every lock and eye follows LockLayerToggle and VisibilityToggle (Gray, White 10 on hover, no pressed fill), the 2D row carries DeleteCTA after the lock and eye, the MobileHUD action eye follows InputAction, and a child under a hidden ancestor shows the eye dot only (G39 for the lock dot). |

### GUI (UI Editor — Components)

Set [`21085:34793`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21085-34793), 3 variants (`Property 1` = Default `21085:34794` / Hover `21085:34941` / Selected `21085:34947`). Size 265 × 158; each variant 223 × 30. Read October 27, 2026. Code: inspector `LeftPanel/CodeRootsList.tsx` row (26 tall, 14px Snow label, Cloudy Sky glyph, accent 15% hover, accent 21% selected): layer 3b unit 3c · Creator Hub none.

Fixed 223 × 30, horizontal, gap 10, padding L / R 10; a 14 × 14 `NodeType/GUIRoot` glyph in Neutrals/White `#FFFFFF`, then the label, Inter 400 12 / 100% Gray `#CFCDD4`. The `LeftPanel2D` board's GUIS list `21028:34527` is four instances (Default, Hover, Default, Selected), with no MobileHUD row and no row actions. The MobileHUD row in the code's GUI list shows no action icons: it is always visible and can't be deleted or locked (user, October 27, 2026; the code already matches, recorded for unit 3c).

| Variant | Padding T / B | Fill | Inspector token | Contrast (on `#242129`) | A11y |
| --- | --- | --- | --- | --- | --- |
| Default | 4 | none | — | Gray 10.07:1 | `role="button"`, `aria-current` (today's rows) |
| Hover | 3 | `#FFFFFF` 5% | `--palette-whiteTransparent-faint` | Gray 8.71:1 | — |
| Selected | 3 | White 10, as drawn (user, October 27, 2026: GUI rows select White 10, tree rows Blue Dark 3) | `--palette-whiteTransparent-subtle` | fill vs panel 1.36:1; Gray 7.43:1 | `aria-current="true"` |

### TabBar (UI Editor — Components)

Set [`21028:16109`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21028-16109), 2 variants (`Property 1` = Hierarchy `21028:16113`, the 2D | 3D pair / Properties `21028:16110`, the PROPERTIES | LOGIC pair). Size 352 × 132. Read October 27, 2026. Code: inspector `Toolbar/UIDesignerToolbar.tsx` mode tabs and the `RightPanel` tab strip (`role="tablist"`) · Creator Hub none.

Fixed 312 × 36, horizontal, fill Shadow `#161518`, 1px White 10 bottom rule, padding-bottom 1; two `TabHorizontal` instances (Tabs), each Fill 156 × Fill 35, vertical, padding T / B 10, R / L 4, label `Inter` 600 12 / 100% uppercase centred (the second label is typed "Logic" and shown uppercase by style). The active tab is the first in both variants. On the Logic tab of `RightPanel2D` the active label is Snow with a Snow underline (see RightPanel2D).

| Variant | State | Fill | Contrast | A11y | Inspector token |
| --- | --- | --- | --- | --- | --- |
| Hierarchy / Properties | active tab (`Active` True) | Shadow, 2px Gray `#CFCDD4` bottom border | Gray label 11.55:1 on Shadow (not Snow); underline 11.55:1; Shadow vs panel 1.15:1 — the underline is the cue | `role="tab" aria-selected`; arrow keys move | `--palette-neutral-gray4` |
| both | inactive tab | Shadow, no underline | Silver label 6.71:1 | — | `--ui-designer-text-muted` |
| Logic tab active (`RightPanel2D` GUILogic, NodeLogic1, NodeLogic2) | active tab | Shadow, 2px Snow `#FCFCFC` bottom border | Snow 17.73:1 on Shadow | as above | `--palette-neutral-softWhite` |
| both | ✱ hover / focus | — | — | not drawn | — |

### PropertiesSections (UI Editor — Components)

Set [`21028:16116`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21028-16116), 2 variants (`Hover` Off `21028:16117` / On `21028:16120`). Size 112 × 118. Read October 27, 2026. Code: inspector `RightPanel/PropertyPanel/PropertyPanel.tsx` section titles · Creator Hub none.

Fixed 70 × 28, padding 2, gap 10, 1px White 10 top and bottom; a 12 × 12 `arrow-down` chevron in White 40 + "Text" in Inter 600 12 / 100%, Gray `#CFCDD4`, not uppercase.

| Variant | Fill | Contrast | A11y | Inspector token |
| --- | --- | --- | --- | --- |
| Hover = Off | none | Gray on panel 10.07:1 | `<button aria-expanded>` per section | `--palette-neutral-gray4` |
| Hover = On | `#FFFFFF` 5% | fill vs panel 1.16:1; Gray 8.71:1 | ✱ focus ring as `HierarchySections` | `--palette-whiteTransparent-faint` |

### HierarchySections (UI Editor — Components)

Set [`21078:34715`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21078-34715), 3 variants (`HoverContainer` × `HoverPlus`: Off / Off `21028:16106`, On / Off `21078:34716`, On / On `21083:34730`). Size 352 × 164. Read October 27, 2026. Code: inspector `LeftPanel/LeftPanel.tsx` `.ui-designer-rail-header` with the `.ui-designer-rail-add` buttons ("New GUI", "Add widget"; `UIDesigner.css`): 32 tall, 11px / 400 White 50, no rules; layer 3b unit 4 (the 2D rail assembly) · Creator Hub none.

Fixed 312 × 28, horizontal, space-between, padding 4 / 10, 1px White 10 top and bottom; label "GUIS" in Inter 600 12 / 100% uppercase Gray `#CFCDD4`, and a `+` chip (`AddCTA`: 20 × 20, the glyph box inset 20% to 12 × 12, the visible plus 9 × 9). The `LeftPanel2D` board heads its two lists with it (`21028:34526` GUIS, `21028:34532` NODES).

| Variant | State | Fill | Border | Contrast (on `#242129`) | A11y |
| --- | --- | --- | --- | --- | --- |
| Off / Off (`21028:16106`) | default | none | White 10 top + bottom | Gray label 10.07:1 (read in On / On) | section header, `<button aria-expanded>` ✱ |
| On / Off (`21078:34716`) | row hover | `#FFFFFF` 5% | same | fill vs panel 1.16:1; Gray on it 8.71:1 | hover is a tint, not the only cue ✱ |
| On / On (`21083:34730`) | row hover + plus hover | `#FFFFFF` 5%; `AddCTA` chip 20 × 20, 5px radius, White 10 fill, `+` 9 × 9 with a 1px Silver stroke | same | Silver `+` on the chip 4.31:1 | `+` named "Add GUI" ✱, ≥ 24px hit target needs a larger box than the 28px row's glyph |
| any | ✱ focus / press / disabled | — | — | the `+` takes the icon-button rule's ring (`--ui-designer-control-accent`, offset 1px); the header itself is not focusable | not drawn |

### Icons — layout and box model (UI Editor — Icons)

Seven icon sets on the Icons board, values not re-read 2026-10-27.

| Set | Id | Variants | Glyph colour |
| --- | --- | --- | --- |
| LayoutIcons | `21028:16226` | 5 (`Free`, `ColumnDown`, `ColumnUp`, `RowRight`, `RowLeft`) | White |
| MarginsIcons | `21028:16135` | 4 (`Bottom`, `Top`, `Right`, `Left`) | White |
| PaddingIcons | `21028:16201` | 4 (`Bottom`, `Top`, `Right`, `Left`) | White |
| Spacing | `21028:16192` | 2 (`Vertical`, `Horizontal`) | White |
| TextAlign | `21028:16163` | 6 (`Middle`, `Bottom`, `Top`, `Left`, `Center`, `Right`) | White |
| Position | `21028:16219` | 2 (`Y`, `X`) | Cloudy Sky `#716B7C` |
| Size | `21028:16214` | 2 (`Height`, `Width`) | Cloudy Sky |

Each set is its own `###`-sized unit in Figma; they share one spec: 16 × 16 cells, filled vector glyphs, `fill="currentColor"`, no states. White on `#242129` 15.45:1; Cloudy Sky 3.09:1. Not sets: `AspectRatio/Colour` `21028:16224` (one `Rectangle` 16 × 16, 4px radius, 1px White 20, Lavender `#C640CD`) and `LayoutIcons/ViewMode/Align` `21028:16435` (three frames of nine align glyphs; Snow, White 40, White 0). Code: `PropertyPanel/icons/`, `Canvas/toolbar-icons.tsx`, `RightPanel/PropertyPanel/alignment-presets.ts` — the Figma names above are not the repo's file names. The icon cells carry no `aria-label`; the control around each names it.

### ConstraintsIcons — 25 (UI Editor — Icons)

Set [`21028:16247`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21028-16247), 25 variants (pin edges and scaling: `Scale`, `L`, `R`, `C`, `L+R`, `T`, `B`, `T+B` with `ScaleVertically` / `ScaleHorizontally` suffixes, combinations such as `L+T`, `L+T+B`, `L+C`). Size 1194 × 72; 16 × 16 cells on the Icons board. Values not re-read 2026-10-27. Code: inspector `PropertyPanel/AnchorPresetField` and `icons/` · Creator Hub none.

The pinned edge is System/Blue `#2196F3`; the rest White, White 40 and White 20, with Rarities/Epic Light `#81E1FF` in the aggregate. A second set [`21028:16124`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21028-16124) `ConstraintsIcons` has 2 variants (`L+R`, `T+B`, white) — same name, different set. In the right panel the constraints preview is drawn 60 × 60 (see RightPanel2D).

### UI Editor Buttons (Buttons)

Section [`21671:45251`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21671-45251) on the Buttons page `20705:10837`, 9 sets, 33 variants (4 + 5 + 4 + 4 + 2 + 4 + 6 + 2 + 2): a copy of the `UI Editor Buttons` board `21028:16485` (UI Editor page), identical in every value, and the reference the design review points to. Read October 27, 2026 on both copies. Copy ids: ScaleToggle `21671:45252`, WrapToggle `45277`, ToggleTab `45288`, ViewModeToggle `45297`, AddVariant `45306`, VisibilityToggle `45311`, LockLayerToggle `45320`, HelpCTA `45333`, DeleteCTA `45338`. Several sets are single flattened SVGs per variant (WrapToggle, HelpCTA, the LockLayerToggle `Parent = Yes` cells), so their radius and glyph geometry come from the panel read, not from layers. Code: every icon control in `components/UIDesigner`, the 2D toolbar included, through three shared rules (see "Icon buttons and toggles" in Tokens); the Figma glyphs live in `components/UIDesigner/icons.tsx` (trash, eye, eye-off, lock, unlock, monitor) and in the existing mask assets (aspect lock, wrap, flow Free, bind).

| Kind | Sets (and code) | Rest | Hover | Selected | Selected + hover | Focus | Disabled |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Icon button | DeleteCTA, HelpCTA, AddVariant (bind link); add, copy, clear, the toolbar's save / undo / redo | Silver `--ui-designer-text-muted`, no container (5.85:1) | Snow `--ui-designer-text` on White 10 `--palette-whiteTransparent-subtle`, 4px (11.40:1) | — | — | 2px `--ui-designer-control-accent`, offset 1px (7.09:1) | White 20 `--palette-whiteTransparent-soft` glyph, no fill (exempt) |
| Tab toggle (one choice out of a set) | ToggleTab; TextAlign, Flow direction, the canvas device pair, the device-variant and interaction-state tabs, the fill-mode chips, the toolbar gizmos | Silver, no fill, 1px `--palette-neutral-onyx` border (5.85:1) | Snow on White 10, 1px Onyx border (11.40:1) | Snow on `--ui-designer-control-active-bg` Blue Dark 2, border in the fill colour (8.61:1) | Snow on `--palette-system-blueDark3`, border in the fill colour (11.61:1) | accent ring, offset 1px standalone and −2px in a joined group; 3.95:1 on Blue Dark 2, 5.33:1 on Blue Dark 3 | White 20 glyph, no fill, 1px Onyx border (exempt) |
| Single toggle (on / off) | WrapToggle, ScaleToggle, ViewModeToggle (HUD / safe area); the toolbar Run / Scene Info | Silver, no fill, no border (5.85:1) | Snow on White 10, no border (11.40:1) | Snow on Blue Dark 2, no border (8.61:1) | Snow on Blue Dark 3, no border (11.61:1) | accent ring, offset 1px; 3.95:1 on Blue Dark 2, 5.33:1 on Blue Dark 3 | White 20 glyph, no fill, no border (exempt) |
| Lock and eye (on / off) | LockLayerToggle, VisibilityToggle; every lock and eye: the 2D tree rows, the node-header and GUI-list eyes, the 3D trees' lock and eye, the spawn-point eye | Gray `--palette-neutral-gray4`, no fill (10.07:1) | Gray on White 10, 4px radius (7.43:1) | the same Gray glyph, no fill; the closed lock or eye-off shape is the state (10.07:1) | Gray on White 10 (7.43:1) | accent ring, offset 1px (7.09:1 on the panel, 5.23:1 on White 10); 1px Snow `--focus-ring` in the 3D trees | not drawn; none in use |
| MobileHUD input-action eye (on / off) | InputAction's VisibilityToggle instance, 18 × 18; `MobileHudPanel.tsx` | Gray eye, no fill (8.95:1 on the Onix Dark 1 row) | Gray on White 10 | Blue Light 1 `--palette-info-light` eye-off on Blue Dark 3 `--palette-system-blueDark3` (5.33:1) | as selected (HidenHover draws it unchanged) | accent ring, offset 1px (5.33:1 on Blue Dark 3) | not drawn; none in use |

Joined tab toggles (TextAlign, Flow direction, the device pair, the device-variant tabs, the gizmos) overlap by 1px for one-pixel seams, take the outer radii on the first and last cell, and raise the selected or hovered cell over its neighbours; see "Segmented group" in Tokens. A control drawn smaller than 24px is a 24 × 24 transparent button whose Figma-size container is its `::before`; for a tab toggle the container carries the border too. Lock and eye follow LockLayerToggle and VisibilityToggle as drawn: a locked node's lock, a hidden node's eye and the GUI-list eye (`aria-pressed="true"` while the GUI is top-level, drawn as the open eye) keep the Gray glyph with no fill, and only the glyph's shape changes.

✱ Deviations from the Figma sets, decided by the user on October 22, 2026 (Validate does not flag these):

| ✱ | Figma | Code |
| --- | --- | --- |
| Unselected toggle hover glyph | ToggleTab, WrapToggle, ScaleToggle, ViewModeToggle Off + Hover: **Silver** glyph | **Snow** glyph; the White 10 fill matches Figma |
| Tab toggles drawn from borderless sets | ViewModeToggle (the canvas device pair, the `Devices` tabs) and ToolbarButton (the gizmos) draw no border | the tab-toggle rule: 1px `--palette-neutral-onyx` at rest, on hover and disabled, a fill-coloured border when selected, as ToggleTab |
| Segmented seams | `ToggleTabs` slot: a Charcoal frame with a 1px Onix border around unjoined `ToggleTab` cells | cells overlap by 1px (one-pixel seams), outer radii on the first and last cell, no wrapper border |
| Interaction-state chip | `Interactions` set: active chip Blue Dark 3 `#243852` | Blue Dark 2, Blue Dark 3 on hover |
| UI Designer toolbar (retired in `73a26ea5f`, user decision October 23, 2026) | `ToolbarButton` / `RuntimeControls`: a filled rest container | no rest container (icon-button, tab-toggle and single-toggle rules, scoped under `.ui-designer-toolbar`; the 3D toolbar keeps the set) |
| Help and bind link hover | HelpCTA and AddVariant draw no container; HelpCTA rests Cloudy Sky | White 10 container on hover; Help rests Silver |
| DeleteCTA hover glyph | `Neutrals/White` `#FFFFFF` | Snow `#FCFCFC` (3/255) |
| Canvas node-bar Delete hover | — (DeleteCTA) | the red danger hover is dropped |
| Focus, disabled, pressed | not drawn | accent ring in every state; WrapToggle Blocked for every disabled control (a tab toggle keeps its Onyx border); no pressed state |
| Hit target | 12–18px boxes | 24 × 24 button, Figma-size `::before` container |

### ScaleToggle (UI Editor Buttons)

Set [`21028:16486`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21028-16486) (copy `21671:45252`), 4 variants (`Selected` × `Hover`): Off/No `21028:16487`, Off/Yes `21096:37036`, On/No `21028:16492`, On/Yes `21096:37041`. Size 66 × 174; each 26 × 26. Read October 27, 2026 (on the copy). Code: inspector the aspect lock in `LengthVecField` and `ResizeField` (`.ui-designer-vec-lock`, `aria-pressed`) · Creator Hub none.

26 × 26, 6px radius; fills none / White 10 / `#244B7D` / `#243852`; a 16 × 16 outline glyph at 5 / 5 (with a 12 × 12 inner square), Silver `#A09BA8` Off and Snow `#FCFCFC` On, plus a hidden `link` layer. The Off glyph (square and corner brackets) is the code's `PropertyPanel/icons/aspect-unlinked.svg`; the On glyph adds a dashed diagonal (0.5px ticks) and replaces `aspect-linked.svg`. The aspect lock is a single toggle: no border, as the set. Code deviates from this set (✱, user decision October 22, 2026; see UI Editor Buttons): Off + hover glyph Snow.

| Selected | Hover | Fill | Contrast / A11y | Inspector token |
| --- | --- | --- | --- | --- |
| Off | No / Yes | none / White 10 | Silver 5.85:1 / 4.31:1; `aria-pressed="false"`, name "Lock aspect ratio" (pressed: "Unlock aspect ratio") | `--ui-designer-text-muted`; `--palette-whiteTransparent-subtle` |
| On | No / Yes | Blue Dark 2 / Blue Dark 3 | Snow 8.61:1 / 11.61:1; hover darker than rest | `--ui-designer-control-active-bg`; `--palette-system-blueDark3` |

### WrapToggle (UI Editor Buttons)

Set [`21028:16499`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21028-16499) (copy `21671:45277`), 5 variants (`Selected` × `Hover` × `Blocked`): Off/No/No `21028:16500`, Off/Yes/No `21096:37082`, On/No/No `21028:16502`, On/Yes/No `21096:37086`, Off/No/Yes `21028:16504`. Size 48 × 198; each 26 × 26. Read October 27, 2026. Code: inspector the wrap toggle in `FlowField` (`aria-pressed`); Blocked is the disabled look of every UI Designer icon control · Creator Hub none.

26 × 26, 6px radius; fills as `ScaleToggle` (none, White 10, Blue Dark 2, Blue Dark 3); Blocked = no fill, glyph White 20. The glyph (12.71 × 11.72) is Silver Off and Snow On, and is the code's `FlowField/icons/wrap.svg`. Each variant is one flattened SVG. Wrap is a single toggle: no border, as the set. Code deviates from this set (✱, user decision October 22, 2026; see UI Editor Buttons): Off + hover glyph Snow.

| Variant | Fill | A11y | Inspector token |
| --- | --- | --- | --- |
| Off / No / No | none | Silver glyph 5.85:1; `aria-pressed="false"`, name "Wrap" | `--ui-designer-text-muted` |
| Off / Yes / No | White 10 | Silver glyph 4.31:1 on the fill | `--palette-whiteTransparent-subtle` |
| On / No / No · On / Yes / No | Blue Dark 2 · Blue Dark 3 | `aria-pressed="true"`; Snow 8.61:1 · 11.61:1 | `--ui-designer-control-active-bg` · `--palette-system-blueDark3` |
| Off / No / Yes | none, glyph White 20 | glyph 1.91:1 on panel (below 3:1, the disabled-state exemption applies); `aria-disabled="true"` with the reason (no flex flow) ✱; Blocked has no hover / selected variant — **✱ proposal: Blocked × Selected is not drawn** | `--palette-whiteTransparent-soft` |

### ToggleTab (UI Editor Buttons)

Set [`21028:16506`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21028-16506) (copy `21671:45288`), 4 variants (`Selected` × `Hover`): Off/No `21028:16507`, Off/Yes `21096:37090`, On/No `21028:16509`, On/Yes `21096:37093`. Size 79 × 207; each Fixed 39 × 26. Read October 27, 2026. Code: inspector every segmented cell in `PropertyPanel` (`TextAlignField`, `FlowField`, `FillField` modes, the interaction-state and device-variant tabs) through the tab-toggle rule, keyed on `aria-checked` / `aria-selected` · Creator Hub none.

The cell has no radius: the `ToggleTabs` slot's 6px radius clips the first and last cell. Off variants have a 1px Onix `#35333B` border; Off + hover adds White 10; On fills Blue Dark 2 (rest) / Blue Dark 3 (hover) with no border. The glyph is a `LayoutIcons` instance (18 × 18, centred at 50% + 0.5px, vector 14 × 14; Free is the code's `FlowField/icons/absolute.svg`): Silver `#A09BA8` Off, Snow `#FCFCFC` On. Code deviates from this set (✱, user decision October 22, 2026; see UI Editor Buttons): Off + hover glyph Snow (the Onix Off border matches).

| Selected | Hover | Fill | Border | Radius | Contrast | A11y | Inspector token |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Off | No | none | 1px Onix | 0 | border vs panel 1.27:1; Silver glyph 5.85:1 | `role="radio"` in a `radiogroup` | `--palette-neutral-onyx` |
| Off | Yes | White 10 | 1px Onix | 0 | Silver glyph 4.31:1 on the fill | — | `--palette-whiteTransparent-subtle` |
| On | No | `#244B7D` | none | 0 | Snow glyph 8.61:1 | `aria-checked="true"` | `--ui-designer-control-active-bg` |
| On | Yes | `#243852` | none | 0 | Snow 11.61:1; darker than rest | as `ViewModeToggle` | `--palette-system-blueDark3` |

### ViewModeToggle (UI Editor Buttons)

Set [`21028:16511`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21028-16511) (copy `21671:45297`), 4 variants (`Selected` × `Hover`): Off/No `21028:16512`, Off/Yes `21096:37105`, On/No `21028:16514`, On/Yes `21096:37108`. Size 79 × 204; each 16 × 16. Read October 27, 2026. Code: inspector the Canvas preview toggles (HUD guides, safe area) and the Desktop / Mobile device pair (`Canvas.tsx`, `.ui-designer-canvas-zoom-btn`, `.ui-designer-device-toggle-btn`) and the `PropertyPanel` device-variant tabs · Creator Hub none.

16 × 16, 4px radius; an `Icon` instance 14 × 14 inset 1px (vector 10.66 × 8.98, a monitor). The Viewport draws the same cells at 22 × 22 (HUD, SafeArea) and 26 × 22 (the device pair), with no size variant. The monitor is `DesktopIcon` in `icons.tsx`, and the mobile, HUD and safe-area glyphs have no Figma counterpart yet (`useRestorePersistedMode` is a different control). Code deviates from this set (✱, user decision October 22, 2026; see UI Editor Buttons): Off + hover glyph Snow; the device pair and the device-variant tabs are tab toggles and add the 1px Onyx border, while the HUD and safe-area toggles are single toggles and, like the set, draw none.

| Selected | Hover | Fill | Contrast (on `#242129`) | A11y | Inspector token |
| --- | --- | --- | --- | --- | --- |
| Off | No | none | Silver glyph 5.85:1 | `role="radio"` / `aria-pressed` | `--ui-designer-text-muted` |
| Off | Yes | White 10 | Silver glyph 4.31:1 on the fill (non-text ≥ 3:1) | — | `--palette-whiteTransparent-subtle` |
| On | No | Blue Dark 2 `#244B7D` | fill vs panel 1.79:1; Snow glyph 8.61:1 | `aria-pressed="true"` | `--ui-designer-control-active-bg` |
| On | Yes | Blue Dark 3 `#243852` | fill vs panel 1.33:1; Snow 11.61:1 | **hover on a selected toggle is darker than rest** — as `ToolbarButton` | `--palette-system-blueDark3` |

### AddVariant (UI Editor Buttons)

Set [`21028:16516`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21028-16516) (copy `21671:45306`), 2 variants (`Hover` No `21028:16519` / Yes `21028:16517`). Size 58 × 98; each 18 × 18. Read October 27, 2026. Code: inspector the bind affordance (`BindAffordance.tsx`, `.ui-designer-bindable-link`, the `bind.svg` mask) and `BindIcon.tsx`, whose paths are this glyph exactly; `DiamondPlus.tsx` is a stroked redraw for the menu rows · Creator Hub none.

18 × 18 `VariableSmall` diamond-plus glyph (10.32 × 10.32, inset 3.84px); no fill in either; hover changes only the glyph colour. The variant names are inverted in Figma (the layer named `Hover=Yes` is the Silver rest look); code follows the design review: Silver at rest, Snow on hover. Code deviates from this set (✱, user decision October 22, 2026; see UI Editor Buttons): hover adds a White 10 container.

| Look | Fill | Contrast | A11y | Inspector token |
| --- | --- | --- | --- | --- |
| rest (Figma `Hover=Yes`) | none | Silver glyph 5.85:1 | `<button aria-label="Bind to variable">`; 18px is below the 24px target ✱ | `--palette-neutral-gray3` |
| hover (Figma `Hover=No`) | none | Snow glyph 15.45:1 | — | `--palette-neutral-softWhite` |

### VisibilityToggle (UI Editor Buttons)

Set [`21028:16532`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21028-16532) (copy `21671:45311`), 4 variants (`Visible` × `Hover`): No/Yes `21107:37466`, No/No `21028:16535`, Yes/Yes `21107:37461`, Yes/No `21028:16533`. Size 56 × 140; each 16 × 16. Read October 27, 2026. Code: inspector every eye toggle in the UI Designer (`NodeTree.tsx`, `CodeRootsList.tsx`, the `PropertyPanel` header, `MobileHudPanel.tsx`) with `EyeIcon` / `EyeOffIcon` from `icons.tsx`, and the 3D trees' entity and spawn-point eyes · Creator Hub none.

16 × 16, 4px radius, Hover = Yes adds White 10; Visible = No swaps the eye for an eye-off glyph; every variant's glyph is Gray `#CFCDD4`. The eye is a 14 × 14 instance inset 1px (eye 13.13 × 8.75); the eye-off is 15 × 15 at rest and 14 × 14 on hover (eye-off 13.13 × 10.49). Figma names the eye `Hide` and the eye-off `Show` (the action). The MobileHUD input-action eye takes InputAction's overrides (see InputAction); every other eye follows this set (user, October 27, 2026; see NodeTypeHierarchy): Gray glyph in every state, White 10 on hover, no fill when hidden; no border.

| Visible | Hover | Fill | Contrast / A11y | Inspector token |
| --- | --- | --- | --- | --- |
| Yes | No / Yes | none / White 10 | `aria-pressed="false"`, name "Hide <node>"; Gray glyph 10.07:1 on panel, 7.43:1 on White 10 | `--palette-neutral-gray4`; `--palette-whiteTransparent-subtle` |
| No | No / Yes | none / White 10 | `aria-pressed="true"`, name "Hide <node>" (the stable name; see NodeTypeHierarchy); Gray eye-off glyph 10.07:1 on panel, 7.43:1 on White 10 | `--palette-neutral-gray4`; `--palette-whiteTransparent-subtle` |

### LockLayerToggle (UI Editor Buttons)

Set [`21068:32238`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21068-32238) (copy `21671:45320`), 6 variants (`Parent` × `Active` × `Hover`): No/Off/No `21086:34988`, No/On/No `21086:34979`, Yes/Off/No `21068:32241`, Yes/Off/Yes `21107:37482`, Yes/On/Yes `21107:37478`, Yes/On/No `21068:32239`. Size 56 × 204. Read October 27, 2026. Code: inspector lock in `LeftPanel/NodeTree.tsx`, a `<button aria-pressed>` with `LockIcon` / `UnlockIcon` from `icons.tsx` · Creator Hub none.

`Parent` = No is 14 × 14 (a small dot-sized state), `Parent` = Yes is 16 × 16; Hover = Yes adds a 4px radius White 10 fill; Active toggles the closed / open lock glyph (shape only). Every variant's glyph is Gray `#CFCDD4`, and the set holds no other colour than Gray and White 10. Parent = Yes draws the lock (9.14 × 12); Parent = No / Active = On draws a 2 × 2 dot, and Parent = No / Active = Off draws nothing. No Parent = No / Hover = Yes variant exists. The `LeftPanel2D` board draws `Parent = No` dots on both the lock and the eye of a hidden Container's children; the 2D tree draws the eye dot under a hidden ancestor and, once inherited lock ships (G39), the lock dot under a locked one (user, October 27, 2026; see NodeTypeHierarchy). Code follows this set in every tree (user, October 27, 2026; see NodeTypeHierarchy): Gray glyph in every state, White 10 on hover, no fill when locked; no border.

| Parent | Active | Hover | Size | Fill | Contrast / A11y | Inspector token |
| --- | --- | --- | --- | --- | --- | --- |
| No | On | No | 14 × 14 | none | Gray 2 × 2 dot 10.07:1; an ancestor is locked or hidden, display only; `aria-hidden` ✱ | `--palette-neutral-gray4` |
| No | Off | No | 14 × 14 | none | draws nothing | — |
| Yes | Off | No / Yes | 16 × 16 | none / White 10 | Gray glyph 10.07:1 on panel, 7.43:1 on the White 10 hover fill (the glyph does not change on hover) | `--palette-neutral-gray4`; `--palette-whiteTransparent-subtle` |
| Yes | On | No / Yes | 16 × 16 | none / White 10 | same Gray glyph; `aria-pressed="true"`, name "Lock <node>" | `--palette-neutral-gray4`; `--palette-whiteTransparent-subtle` |
| No | any | Yes | — | ✱ not drawn | — | — |

### HelpCTA (UI Editor Buttons)

Set [`21107:37499`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21107-37499) (copy `21671:45333`), 2 variants (`Hover` Yes `21107:37500` / No `21107:37498`). Size 52 × 84; each 12 × 12. Read October 27, 2026. Code: inspector the shared `ui/InfoTooltip` trigger beside UI Designer labels and in the MobileHUD header; its `VscQuestion` glyph is kept (the component is shared with the 3D panels) and the colours are scoped under the UI Designer rails · Creator Hub none.

12 × 12 circle, 100px radius, 1px border: No = Cloudy Sky `#716B7C`, Yes = Snow `#FCFCFC`; the "?" glyph (3.34 × 5.94) takes the same colour as the border. Code deviates from this set (✱, user decision October 22, 2026; see UI Editor Buttons): Silver at rest, Snow on a White 10 container on hover.

| Variant | Border | Contrast (on `#242129`) | A11y | Inspector token |
| --- | --- | --- | --- | --- |
| Hover = No | Cloudy Sky | 3.09:1 — passes 3:1 non-text barely | `<button aria-label="Help: <field>">`, tooltip text via `aria-describedby` | `--palette-neutral-gray2` |
| Hover = Yes | Snow | 15.45:1 | 12px is far below 24px — hit box must be larger ✱ | `--palette-neutral-softWhite` |

### DeleteCTA (UI Editor Buttons)

Set [`21107:37893`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21107-37893) (copy `21671:45338`), 2 variants (`Hover` Yes `21107:37894` / No `21107:37892`). Size 56 × 92; each 16 × 16. Read October 27, 2026. Code: inspector every trash / remove / clear in `components/UIDesigner` (the 2D node-tree row's delete in `NodeTree.tsx`, Canvas node bar, CodeRootsList, PropertyPanel rows, CallbackField, the Logic panels) through the icon-button rule; glyph `TrashIcon` in `icons.tsx` · Creator Hub none.

16 × 16 glyph box; Hover = Yes adds a 4px radius White 10 fill.

| Variant | Fill | Contrast | A11y | Inspector token |
| --- | --- | --- | --- | --- |
| Hover = No | none | glyph Silver `#A09BA8` (a 12 × 12 `Delete` instance inset 2px), 5.85:1 on panel | `<button aria-label="Delete <item>">` | `--ui-designer-text-muted` |
| Hover = Yes | White 10, 4px radius | glyph White `#FFFFFF` 11.69:1 on the fill; code paints Snow (11.40:1), a 3/255 deviation | 16px is **below the 24px target**: a 24px button with the 16px container as `::before` ✱ | `--palette-whiteTransparent-subtle`; glyph `--ui-designer-text` (✱ deviation) |

### Properties (UI Editor — PropertiesSections)

Set [`21028:16539`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21028-16539), 8 variants (`Property`: Default `21028:16540`, Layout `21028:16566`, Style `21028:16605`, Text `21028:16621`, Input `21028:16664`, Dropdown `21028:16730`, MouseEvents `21028:16781`, Logic `21028:16787`). Size 2448 × 581; each variant 292 wide, on a 21px gutter. Read October 27, 2026 (structure only); the section values are those drawn inside RightPanel2D. Code: inspector `RightPanel/PropertyPanel/PropertyPanel.tsx` with `field-configs.groups.ts` (section grouping) and `LogicPanel` · Creator Hub none.

The assembled right panel's section columns: `Layout`, `Style`, `Text`, `Input`, `Dropdown`, `MouseEvents` and `Logic`, plus `Default`; three slot properties (`Input`, `Input2`, `Input3`) = Default. Each section is built from the Components and PropertiesSubsections sets here. No state of its own.

### InputAction (UI Editor — InputActions)

Set [`21301:5373`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21301-5373), 4 variants (`InputAction`): Default `21301:5372`, Hover `21301:5371`, Hiden `21301:5370`, HidenHover `21301:5369` (sic — "Hiden"). Size 1462 × 136; each Fixed 348 wide × Hug. Read October 27, 2026. Code: inspector `MobileHud/` (the MobileHUD input-action rows, `MobileHudPanel.tsx`) in `components/UIDesigner` · Creator Hub none.

Vertical, 6px radius, no border of its own (the `InputActions` section above the cards carries a 1px White 10 top rule), padding 4 / 10 / 12 / 10, gap 2: a drag handle (6 × 9), the action name (Inter 400 14 Gray), a "Main" radio, an 18 × 18 VisibilityToggle instance (Default and Hover: `Visible = Yes`, no fill; Hiden and HidenHover: `Visible = No`, `Hover = Yes` with two overrides, a System/Blue Dark 3 `#243852` fill and a System/Blue Light 1 `#63B4F6` eye-off, 5.33:1) and a "Custom Icon" texture row with link and folder buttons. The name row is 30 tall with padding-right 5 and gap 10; the CTAs sit 20 apart.

| Variant | State | Fill | Contrast (on `#242129`) | A11y | Inspector token |
| --- | --- | --- | --- | --- | --- |
| Default | rest | Onix Dark 1 `#2D2A33` | fill vs panel 1.13:1; Gray 8.95:1; Silver 5.20:1 | row is a `role="group"` named by the action | missing: PROPOSED `--palette-neutral-onyxDark1` |
| Hover | pointer over | Pale Black `#43404A` | fill vs panel 1.56:1; Gray 6.44:1; **Silver 3.74:1 — fails 4.5:1 for 12px text** | hover must not be the only cue ✱ | `--gray-0` |
| Hiden | hidden action | Onix Dark 1 | as Default | eye `aria-pressed` | PROPOSED `--palette-neutral-onyxDark1` |
| any | the eye (user, October 27, 2026: as drawn) | visible: none, White 10 on the eye's hover; hidden: Blue Dark 3 `--palette-system-blueDark3`, in Hiden and HidenHover alike | visible: Gray eye 8.95:1 on Onix Dark 1, 6.44:1 on Pale Black; hidden: Blue Light 1 `--palette-info-light` eye-off 5.33:1 on Blue Dark 3; the fill vs the row 1.18:1, so the glyph swap and colour carry the state | `aria-pressed="true"` when hidden; 18px box in a 24px hit target | — |
| HidenHover | hidden + hover | Pale Black | as Hover | — | `--gray-0` |
| any | "Main" radio | none; 1px White 40 ring, 100px radius; selected: a Primary `#FF2D55` dot inset 25% | — | label "Main" Inter 400 12 Gray, gap 5 | `--palette-whiteTransparent-blurry`; `--primary-main` |
| any | texture input ("None") | White 8 `rgba(255,255,255,0.08)`, 6px radius | "None" Inter 400 14 White 40: 3.17:1 on White 8 over Onix Dark 1 (below 4.5:1) | h 26, min-width 128, padding 6 / 8, gap 8, arrow 10; two 26 × 26 round buttons (100px radius, glyph inset 20%) 6 after it | missing: PROPOSED `--palette-whiteTransparent-hint` |
| any | ✱ focus / disabled / dragging | — | ring `--ui-designer-control-accent` | not drawn | — |

### Viewport (Viewport)

Set [`21032:43255`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21032-43255), 2 variants (`Property 1` = 2D `21032:43254` / 3D `21032:43256`). Size 1332 × 2100 (dashed chrome); each variant 1292 × 1020. Read October 27, 2026 (2D; the 3D variant holds a pasted scene screenshot). Code: inspector `Canvas/` (2D, `Canvas.tsx`: `.ui-designer-canvas-zoom-btn`, `.ui-designer-device-toggle-btn`) and the Babylon / Bevy viewport · Creator Hub none (it iframes the inspector).

Page `20506:34918`; board `Frame 1` `21221:39035` (title "Viewport" `21221:39108`). Both variants are Fixed 1292 × 1020, vertical, with a nested `Viewport` Default instance; 2D fills Onix Dark 1 `#2D2A33`; 3D (gap 954) holds a pasted scene screenshot — a fixture, never spec. Overlaid are the viewport `Toolbar` (next page) and the bottom-right preview-mode and zoom controls; in 3D a camera menu lists Free, Player and Insert Camera Position (canvas reading). Only the Desktop cell's selected state is drawn: the HUD, SafeArea and Mobile cells have no rest or hover state.

| Part | Fill | Border | Radius | Text | Glyph | Padding / gap / size | Inspector token |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Viewport 2D | Onix Dark 1 `#2D2A33` | none | 0 | — | — | 1292 × 1020, vertical; the 36 Toolbar on top, then the canvas | missing: PROPOSED `--palette-neutral-onyxDark1` |
| PreviewMode&Zoom | none | none | 0 | — | — | absolute at bottom 10 / right 10, gap 4 | — |
| DisplayMode frame | Charcoal `#25212A` | none | 5 | — | — | h 26, padding 0 / 2, gap 8 | `--ui-designer-panel-bg` (✱ deviation 1/255) |
| HUD, SafeArea toggles | none at rest | none | 4 | — | icon inset 6.25% of 22 | 22 × 22, gap 4 (group h 24) | single-toggle rule |
| Desktop / Mobile pair | Desktop selected Blue Dark 2 `#244B7D`; Mobile none | 0.692px Onix Dark 1 `#2D2A33` around the pair | 4 | — | icon inset 3.85% | cells 26 × 22 | `--ui-designer-control-active-bg` |
| Zoom frame | Charcoal | none | 5 | "100%" Inter 400 12, uppercase, Snow `#FCFCFC`, centred | minus / plus 10 × 10 | h 26, padding 2; ZoomOut / ZoomIn 22 × 22, radius 4; value cell 50 wide | `--ui-designer-panel-bg` |

| Variant | Fill | A11y |
| --- | --- | --- |
| 2D | Onix Dark 1 `#2D2A33` | canvas `role="application"` with a text alternative via the node tree; zoom keyboard shortcuts documented |
| 3D | renderer surface | the viewport is the one place where contrast is not enforced — overlay controls carry their own fills |

### Toolbar (Viewport Toolbar)

Set [`21028:42986`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21028-42986), 2 variants (`Property 1` = 2D `21028:42987` / 3D `21023:11108`). Size 1332 × 132; each variant Fixed 1292 × 36. Read October 27, 2026 (the set; the `<Menus>` values not re-read 2026-10-27). Code: inspector `Toolbar/` (`UIDesignerToolbar.tsx` and the 3D toolbar) · Creator Hub none.

Page `21023:11034`; board `EditorHeader` `21028:42719` (title "Viewport Toolbar").

- **Frames:** `<Toolbar>`, `<RuntimeControls>`, `<AudioControl>` and `<Menus>`.
- **Set:** each variant fill Shadow `#161518`, 1px Onix bottom border.
- **Group names:** the groups are named against their position: `RigthSide` is the left group, `LeftSide` the right one.

- **`RigthSide`** (the left group; 3D `21023:11116` Hug 374, 2D `21028:42995` Hug 166): Top 5, Left 10, gap 6. Its frames have a 6px radius, a 1px Onix border, an Onix fill and a 1px gap between cells. It holds:
  - undo / redo, 53 × 26 (3D `Back/Forward` `21023:11117`, 2D `Tools` `21028:42996`);
  - four gizmos, 107 × 26 (3D `Tools` `21023:11120`, 2D `Tools` `21028:42999`; in 2D, rotate is `Disabled`);
  - **3D only.** `Snap` `21719:56439`: a 46 × 26 split `ToolbarButton` (`Chevron=True`) in a `Tools` frame. The Snap toggle (grid and magnet glyph), a White 20 seam, then a chevron that opens the snap menu;
  - **3D only.** `CameraSettings` `21023:11130` (Fixed 86 × 26) → `CameraButton` `21023:11131`: Hug 88.12 × 26, 6px radius, a 1.06px border, **Shadow fill**, padding 0 / 8 / 0 / 4, gap 4. It holds an 18 × 18 `Camera` icon (Silver outline), the label "Player" (Inter 400 12px / 100%, Gray `#CFCDD4`) and an 8 × 8 `arrow-down` (White 60);
  - **3D only.** `Interact` `21023:11128`: 26 × 26;
  - **3D only.** `Sound` `21723:57310`: Mute, a framed 26 × 26 `ToolbarButton`. Its states are drawn in `<AudioControl>` (`21723:57634`, the AudioToggle set): **On** is a speaker with waves, **Off** a speaker with an ×, both Gray on a Shadow cell. Neither has a selected fill.
- **3D left-group x positions** (in the 1292 bar): undo / redo 10–63, gizmos 69–176, Snap 182–228, camera 234–320, Interact 326–352, Mute 358–384.
- **`RuntimeControls`** (3D `21028:33543`, 2D `21028:43015`): `Preview=Off`, Left 618, 55 wide, gap 3, so it sits at the true bar centre (645.5 of 1292).
- **`LeftSide`** (the right group; 3D `21023:11109`, 2D `21028:42988`): Left 1202, gap 6, padding-right 4. It holds the `Edit` and `Save` frames (26 × 26, 6px radius, a 1px Onix border and fill), a `Div` (a 24px White 10 vertical rule) and a 16 × 16 `Kebab` (three Snow dots) in a 26-tall Shadow `Menu` frame with a 4px radius.
- **`<Menus>` `21719:56867`** (the open menus, each a 0.71-scaled `Menu`: Fixed 176, Onix, a 0.71px White 10 border, radius 8.52, padding 7.1, drop shadow `0 2.84 5.68` Black 40):
  - **Snap menu** `21719:56868`:
    - Position / Rotation / Scale rows (168 × 26, padding 0 / 7.1, Inter 400 12 Gray labels);
    - each with an `Input` 50 × 20, radius 6, a 1px White 40 border, Onix fill;
    - a White 10 rule;
    - an "Align to World" checkbox row.
  - **Camera menu** `21719:56872`: Free ✓, Player, a rule, an "Invert Camera Rotation" checkbox row. Its trigger is drawn Onix-filled, unlike the bar's `CameraButton`; the bar instance is the source (✱, G10).
  - **⋮ menu** `21722:57105` (named "CameraSettings", sic): one "Enable Autosave" checkbox row.

| Part | Fill | Border | Radius | Text | Glyph | Padding / gap / size | Inspector token |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Bar | Shadow `#161518` | 1px Onix `#35333B` bottom | 0 | — | — | h 36, 1292 wide | `--base-20`, `--palette-neutral-onyx` |
| Left group frames | Onix `#35333B` | 1px Onix | 6 | — | — | left 10, gap 6, h 26, centred vertically | `--ui-designer-control-bg` |
| Joined cells (Tools, Back/Forward, Edit, Save, Snap, Sound, Play, Pause) | Shadow cell inside an Onix frame | 1px Onix | 6 | — | `ToolbarButton` 26 × 26, icon inset 3.85% (about 24 × 24) | cells 1px apart | `--base-20` |
| Selected cell (first gizmo, Interact) | Blue Dark 2 `#244B7D` | — | — | — | — | — | `--ui-designer-control-active-bg` |
| CameraButton | Shadow | 1.06px Onix | 6 | "Player" Inter 400 12 Gray, 40 wide | Camera 18 × 18 (Silver stroke); arrow 8 × 8 | padding 0 / 8 / 0 / 4, gap 4 | `--palette-neutral-gray3` (stroke) |
| Right group (`LeftSide`): Edit, Save | Onix frame + Shadow cell | 1px Onix | 6 | — | 26 × 26 | right 0, padding-right 4, gap 6 | — |
| Divider | — | 1px White 10 line, 24 tall | — | — | — | — | `--palette-whiteTransparent-subtle` |
| Kebab frame | Shadow | none | 4 | — | Kebab 16 × 16 | h 26 | `--base-20` |

**Design** (user decisions October 22–23, 2026; layers 3a3 and 3a4):

- **Bar:** 36px tall with a 1px `--palette-neutral-onyx` bottom border, insets 10 / 4, 6px gaps.
- **Groups:** each joined group's cells carry their own 1px Onix border and overlap by 1px, so seams are single pixels and groups come out 51 / 103px wide (✱; the code has no frame wrappers).
- **3D, left to right:** undo / redo, gizmos, the **Snap split button**, the **camera button**, Interact, **Mute**. Tab order follows the same order (DOM order, no `tabindex`).
  - **Snap split:** 46 wide; the "Snap increments" chevron always shows, 20 × 26 (✱ below the 24px floor, accepted).
  - **Snap menu:** hangs from the Snap toggle's left edge; bordered Position / Rotation / Scale fields, a White 10 rule inset with the rows (the documented menu-divider deviation), an "Align to World" checkbox (`CheckboxField color="tertiary"`, 16px box, 12px Gray label like the rows above). There is no separate Align toggle.
  - **Mute:** framed, a Shadow cell and a Gray glyph in both states; the glyph swap and `aria-pressed` carry the state.
  - **Camera button:** Shadow fill + 1px Onix border, icon stroke `--palette-neutral-gray3`, accessible name "Camera mode". Its menu has the "Invert Camera Rotation" checkbox.
- **2D:** undo / redo and gizmos; **no snap control** (as `21028:42987` draws it; snapping still works).
- **RuntimeControls:** at the **true bar centre**, as Figma draws them. When the left controls leave no room, they fall back to sit right after the last left control: Mute under Bevy, the Snap chevron under Babylon. The code wraps the left controls in `LeftContent` and the right ones in `RightContent`, equal flexible halves around the run controls. `RightContent` carries `padding-left: 6px`, which cancels the bar's 10 / 4 inset asymmetry; without it the run controls would land 3px right of centre (✱, accepted in Validate 3a4 round 1).
- **Right side:** Edit ("Edit Scene"), Save, the rule and a ⋮ named "More options".
  - **Save** is hidden while auto-save is on and shown while it is off.
  - **2D has no Save** (✱): code-as-source writes every edit to its file.
  - **2D Edit** switches to 3D and selects the scene root.
- **⋮ menu** (the Menu-Entry look), in both bars under every renderer (✱: Figma draws only "Enable Autosave"):
  - **3D, always:** "Enable Autosave" (checkable), and Scene Info when the scene has scene info.
  - **3D, only while the Babylon renderer is active:** "Invert Camera Rotation" (Babylon has no camera menu) and Inspector.
  - **2D:** Scene Info when the scene has scene info; the ⋮ is hidden when it would be empty.
  - **Preferences** is removed.
- **Hover:** Figma's Charcoal (→ `--base-19`) with the glyph unchanged, in both bars; the split button's chevron cell hovers on its own.
- **Focus:** Snow `--focus-ring` on every control of both bars.

**Decisions** (the record for this toolbar; grep here before asking again):

| Date | Question | Answer |
| --- | --- | --- |
| 2026-10-23 | Figma moved the 3D camera button while it was being read (16:35 → 16:53 CEST). Is the 16:53 layout settled? | Yes. Re-read the board before the final screenshots |
| 2026-10-23 | Apply the new 3D order exactly as drawn? | Yes: undo / redo · gizmos · Snap · camera · Interact · Mute, with tab order following |
| 2026-10-23 | Where do the run controls go? | The true bar centre. When there is no room, right after the last left control (Mute under Bevy, Snap under Babylon). This retires the earlier "centred in the free space" deviation (✱7) |
| 2026-10-23 | Does the 2D bar change with the reorder? | No: `21028:42987` is unchanged |
| 2026-10-23 | Below a window of about 890 the 3D bar's content no longer fits and the right group clips. What should happen? | Creator Hub enforces a minimum window width so the 3D toolbar never clips: **1080px** (`minWidth` in `main`). Measured needs: the 3D toolbar 901 with Save shown; Creator Hub's top nav 1071 signed out, 1059 signed in |
| 2026-10-23 | The camera trigger (`role="combobox"`) has no accessible name. What is it called? | "Camera mode" (`aria-label`; a new, user-approved string) |

**Measured in Creator Hub:**

- At a 1440 window both bars centre the run controls exactly (0.00px off).
- From a 1200 window down, the 3D run controls sit 6px after Mute.
- Creator Hub's 1080px minimum window width keeps the 3D bar clear of clipping; its content needs 901.

| Variant | Fill | Border | Contrast | A11y |
| --- | --- | --- | --- | --- |
| 2D (`21028:42987`) | Shadow `#161518`, Fixed 1292 × 36 | 1px Onix bottom | Snow 17.73:1; border 1.46:1 | `role="toolbar"` with arrow-key roving focus (not implemented in either bar yet, G31) |
| 3D (`21023:11108`) | Shadow `#161518`, Fixed 1292 × 36 | 1px Onix bottom | identical to 2D: Snow 17.73:1; border 1.46:1 | the camera menu: `aria-haspopup="menu"` |

### RuntimeControls (Viewport Toolbar)

Set [`21028:16521`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21028-16521), 2 variants (`Preview` Off `21028:16522` / On `21028:16527`). Size 93 × 109 with dashed chrome; each variant 55 × 26. Read October 27, 2026. Code: inspector `Toolbar/` run controls · Creator Hub none.

- **Layout:** a Hug 55 × 26 row, gap 3, of two `ToolbarButton` instances in 26 × 26, 6px-radius frames (layers `Play` and `Pause`); each cell sits at −1 / −1 inside its frame, so the Onix border shows as a 1px ring.
- **Stop:** in `Preview=On`, the `Play` slot holds a **Stop** (square) glyph.
- **Labels:** the board labels the rows **"Default"** (Off) and **"Play"** (On, Group 3 `21723:57629`): `Preview=On` is the running scene, with Pause shown selected.
- **Figma-side:** the `Disabled` property on `Preview=Off`'s Pause doesn't change its look (G10).

**Design** (user decision October 23, 2026; layer 3a3), both bars: one centred group, placed at the true bar centre (see the Toolbar decisions); 2D's Play leaves 2D before it runs the scene (see [`UIDesigner.md`](UIDesigner.md)).

- **Slots:** slot 1 is Play / Stop; slot 2 is Pause, a plain button (no `aria-pressed`) whose name flips "Pause scene" ↔ "Resume scene".
- **Stopped:** `Preview=Off`, Pause disabled.
- **Running:** `Preview=On`: slot 1 Stop, Pause Blue Dark 2 + Snow (a `running` class; hover Blue Dark 3), named "Pause scene".
- **Paused:** slot 1 Stop, Pause in the rest look (Shadow, Gray), named "Resume scene".

| Preview | Play slot | Pause slot | A11y | Inspector token |
| --- | --- | --- | --- | --- |
| Off (`21028:16522`) | Play glyph, Gray `#CFCDD4` (11.55:1 on Shadow); Shadow cell in an Onix frame, 1px Onix border, 6px radius; `Active` On, `Selected` Off | Shadow cell in an Onix frame, 1px Onix border; Gray glyph; `Active` Off, `Selected` Off, `Disabled` true | slot 1 `aria-label="Run scene"`; Pause native `disabled` | `--base-20`, `--palette-neutral-onyx`, `--palette-neutral-gray4` |
| On (`21028:16527`) | **Stop** glyph (Gray); Shadow cell in an Onix frame, 1px Onix border; `Active` On, `Selected` Off | the cell is Blue Dark 2 `#244B7D` with no frame fill and no border; Snow glyph; `Active` On, `Selected` On | slot 1 named for Stop; Pause named "Pause scene", no `aria-pressed`; Snow on Blue Dark 2 8.61:1 | `--ui-designer-control-active-bg` |

### AudioToggle (Viewport Toolbar)

Set [`21723:57693`](https://www.figma.com/design/5ecKgNHjChZEe05LUwKGku/?node-id=21723-57693), 2 variants (`Audio` On `21723:57692`, Off `21723:57691`). Size 66 × 127; each 26 × 26. Read October 27, 2026. Code: inspector the 3D toolbar's Mute (`Toolbar/`) · Creator Hub none.

The bar's `Sound` frame. The cell sits at −1 / −1 inside its frame, so the Onix border shows as a 1px ring. No hover or focus state is drawn; the code follows the Toolbar's design (Mute framed, a Shadow cell and a Gray glyph in both states; the glyph swap and `aria-pressed` carry the state).

| Audio | Fill | Border | Radius | Glyph | Inspector token | Contrast |
| --- | --- | --- | --- | --- | --- | --- |
| On | Shadow `#161518` cell inside an Onix `#35333B` frame | 1px Onix | 6 | speaker with waves, icon inset 3.85%, Gray `#CFCDD4` | `--base-20`, `--palette-neutral-onyx`, `--palette-neutral-gray4` | Gray 11.55:1 on Shadow |
| Off | same | same | 6 | speaker with an ×, Gray | same | same |

---

## Creator Hub (renderer)

Creator Hub's own chrome (home, scenes list, editor shell, settings, and modals) is styled by MUI through `decentraland-ui2`, plus a small set of CSS variables. The focus, contrast, ARIA, and motion rules in [Component & CSS conventions](#component--css-conventions) apply here too. The tokens don't.

### Creator Hub token sources

- **Theme:** `ThemeProvider theme={dark}` from `decentraland-ui2/dist/theme`, set in `packages/creator-hub/renderer/src/index.tsx`. Inside styled components, read palette, spacing, typography, and breakpoints from `theme`.
- **CSS variables:** `:root` in `packages/creator-hub/renderer/src/themes/theme.css`, for plain CSS and values the ui2 theme doesn't cover.

### `theme.css` by role

| Role | Tokens | Status |
| --- | --- | --- |
| Surfaces | `--bg` `#161518`, `--background` `#161518`, `--card` / `--modal` / `--secondary` `#242129`, `--darker-gray` `#242129`, `--toast` `#3d3b43`, `--dimmer` `#000000dd` | `--bg` ships in #1703, `--background` ships in #1703; `#242129` is the Charcoal **✱ deviation** |
| Text | `--text` `#ffffff`, `--text-on-secondary` `#ffffffb2`, `--secondary-text` `#676370`, `--dcl-silver` `#a09ba8` | match |
| Brand and actions | `--primary` / `--dcl` `#ff2d55`, `--primary-hover` `#ff6280` (the primary hover), `--dcl-hover` `#f70038` and `--dcl-dark` `#9c1c34` (no consumers) | `--primary-hover` ships in #1703 |
| Status | `--success` `#34ce77`, `--danger` `#fe9c2a`, `--error` `#fb3b3b` | `--danger` ships in #1703, `--error` ships in #1703 |
| Lines | `--divider` `#67637033`, `--text-area-border` `#676370`, `--clear-divider` `#a09ba8` | match |
| AI assistant | `--ai-selected` `#214272`, `--ai-selected-hover` `#2e4a7a`, `--ai-session-selected` `#244b7d`, `--ai-session-selected-hover` `#243852`, `--ai-menu-bg` `#2f2d34`, `--ai-input-bg` `#28252d`, `--ai-warning-bg` `rgba(244,130,33,.16)` | `--ai-menu-bg` drift → `#35333B` (pending spoke); `--ai-input-bg` drift → `#2D2A33` (pending spoke); `--ai-warning-bg` drift → `rgba(254,156,42,.1)` (pending spoke) |
| ui2 overrides | `--mui-shape-borderRadius` `6px`, `--mui-palette-action-disabled`, `--mui-palette-secondary-contrast` | match |

The brand pink matches the inspector's `--primary-main`, but it's defined separately on each side of the iframe. Change both, or neither.

**Figma alignment of the status, surface, and hover tokens.** `--error`, `--danger`, `--background`, `--bg`, `--primary-hover` and `--purple-banner` carry Figma's System/Red, System/Orange, Neutrals/Shadow, Primary Light 1 and Brand/Purple values, which ship in #1703. Names are unchanged.

- `--primary-hover` is the primary-button hover at five sites: the wrapper `components/Button` (`.Button.MuiButton-colorPrimary:hover`), the editor header actions (`EditorPage/styles.css`), both `CreateButton` segments, and the AI `SendButton`; those sites read the token in #1707. Raw ui2 contained-primary `Button`s (`SignInPage`, `UpdateAvailable`, `WarningModal` and others) hover to ui2 `palette.primary.dark` `#F70038`. `--dcl-hover` and `--dcl-dark` have no consumers left; removing them is a naming decision for the user. White text on `#ff6280` measures 2.87:1 (Snow `#fcfcfc` 2.80:1); the value is the user's pick from Figma and a known trade-off, not a pass. The fill itself is 6.36:1 against the page.
- `--bg` and `--purple-banner` have no consumer.
- `--background` paints cards on the page (`HeroStat`, `StatsRow`, `EngagementTab .SocialChart`) and the `Deploy` error-detail block; `--danger` and `--error` paint text, icons and one border.

| Pair (consumer) | Contrast | Threshold |
| --- | --- | --- |
| `--error` text on modal paper `#1d1c20` (`CreateProject`, `RenameFolder`, `AppSettings` Scenes, `DeleteProject`, `Deploy`, `AlternativeServers`, `AddUserForm` CSV, `DeploymentHistory`, `RangeField`) | 4.67 | 4.5 text: passes |
| `--error` icon on `#1d1c20` (`ConnectionModal`) | 4.67 | 3 non-text: passes |
| `--error` on page `#16141a` (`ConnectionStatusIndicator` icon) | 5.04 | 3 non-text: passes |
| `--error` delta text and icon on its card (`HeroStat`) | 5.02 on `#161518` | 4.5 text: passes |
| `--danger` border and icon on `#1d1c20` (`WorldPermissionsAccessTab`, `ConnectionModal`, `ConnectionStatusIndicator`) | 8.07 | 3 non-text: passes |
| `--danger` icon on `#4f3020` (`#ec7122` at 24% over `#1d1c20`, `LayoutTab` warning) | 5.63 | 3 non-text: passes |
| `--danger` icon on `#4a2b1a` (`ConfirmationPanel` warning) | 6.06 | 3 non-text: passes |
| `--dcl-silver` `#a09ba8` text on its `--background` card (`Deploy` error detail) | 6.71 | 4.5 text: passes |
| Card `--background` vs modal paper `#1d1c20` | 1.07 | decorative |

### Conventions

- Styled components follow CLAUDE.md → "Styled Components Conventions": import from `decentraland-ui2`, use object syntax, take values from the theme, and keep them in `Component.styled.ts`.
- Reuse a component the renderer already imports, from `decentraland-ui2` or an existing `@mui/material` import, before you build one. Don't add an import of an MUI module the renderer doesn't use yet. Pulling a not-yet-bundled module into a running dev session retriggers Vite's dependency optimizer. When no imported component fits, hand-roll it, as the settings Accordion is.
- ui2 pins secondary-text buttons to a grey `secondary.contrast` at high specificity. Overriding their color takes a repeated-`&` selector (see `Tabs/AiTab/component.tsx`), not `!important`.
- ui2 styles a contained-primary `Button` through a 3-class compound selector (`.css-hash.MuiButton-sizeMedium.MuiButton-containedPrimary`), adds a 10px gap between any two adjacent buttons through a global `.MuiButton-root + .MuiButton-root` rule, and sets the hover through `.css-hash.MuiButton-sizeMedium.MuiButton-containedPrimary:not(.Mui-disabled):not(.Mui-focusVisible):hover`. A single-class override loses to all three, so a styled override needs `&&&` for the base styles and `&&&&&&:hover` for the hover (see `CreateButton/component.styled.ts`).

---

## Component & CSS conventions

Derived from the Vercel Web Interface Guidelines (`web-design-guidelines` skill) and applied throughout the inspector:

- **Focus:** every interactive element has a visible `:focus-visible` ring — `--focus-ring` (Snow) on the shared controls, `--ui-designer-control-accent` in UI Designer panels, `--ui-designer-accent` on the canvas. Text fields show focus as a `--focus-ring` border instead of a ring. Prefer `:focus-visible` over `:focus`. **Never** `outline: none` without a replacement ring.
- **Contrast (WCAG AA):** text ≥ **4.5:1**, non-text/UI (borders, focus rings, canvas markers, icons) ≥ **3:1** against their background.
- **ARIA/semantics:** icon-only buttons need `aria-label`; use `<button>` for actions and `<a>`/`<Link>` for navigation (never `<div onClick>`); tie every input to a `<label>` or `aria-label`; async updates use `aria-live="polite"`.
- **Motion:** honor `prefers-reduced-motion` (reduced/none variant); animate only `transform`/`opacity`; **never** `transition: all` — list properties.
- **During drag:** `user-select: none` + `touch-action: manipulation`.
- **Content:** truncate/clamp long text (flex children need `min-width: 0`); handle empty states; placeholders end with `…`.
- **Color:** tokens only — no new hardcoded hex. A translucent state of a token, such as the `CheckboxField` checked hover halo at 20%, is `color-mix(in srgb, var(--token) 20%, transparent)`; that is styling with tokens, so it needs no new token name. A disabled control is dimmed with `opacity`, not with a translucent token (`Button`: the whole node at 0.2).
- **A background on a `<Box>` root does nothing.** `Box.css` paints `--main-bg-color` on the `.content` div it wraps children in, which covers the root. Put panel surfaces on `<yourClass> > .content`.
- **Pickers and bound values.** Popover pickers (event, variable) are a raised `--ui-designer-control-bg` card at the 12px menu radius: rows highlight on `--ui-designer-control-accent-21`, the selected row carries a leading checkmark, and a diamond-plus `Add New …` row reveals a `Description` field and an auto-width `--primary-main` `ADD` confirm (dimmed to 40% until the name is valid). Event fields are horizontal — a left label and a full-width rounded pill: `--ui-designer-control-bg` when a handler is bound (with the name and an inline clear) and a fainter fill reading `Bind an event handler` in `--ui-designer-text-muted` when empty. The pill is neutral, not accent — an event is not a bound-variable field.
- **Portalled menus take a scope, not a descendant selector.** A `Dropdown`'s option list renders into `document.body`, so a panel rule like `.my-panel .OptionList` can never reach it. The panel declares `data-dropdown-scope="<name>"` on an ancestor; on open the `Dropdown` finds it with `closest()` and sets the same attribute on its `OptionList`, so the panel styles `.OptionList[data-dropdown-scope="<name>"]` (the UI Designer uses `ui-designer`, `PropertyPanel.tsx` / `PropertyPanel.css`).
- **Keyboard and names on `ui/Dropdown`.** The trigger is a `role="combobox"` in the tab order (`-1` and `aria-disabled` when disabled): Enter, Space, and the arrow keys open it; arrows clamp and skip disabled and header options; Enter selects through the same path as a click; Escape closes without a change; Tab from the search field closes and returns to the trigger. The search field is itself a combobox and carries `aria-activedescendant` while focused. A string `label` names the trigger; a label that comes only from an enclosing `Block` doesn't, so pass `aria-label` there.

Reviewing UI against these? Run the `web-design-guidelines` skill over the changed files.

---

## Open items

Everything here is current and unresolved. Design owns the Figma-side defects; the user owns the questions and every proposed token name.

### Figma-side defects (for design)

| Set (page) | Defect |
| --- | --- |
| INFO (Colors) | Blue Dark 1 fills `#1A75D2` but its label reads `#1F87E5`; Blue Dark 2 fills `#244B7D` but its label reads `#1764C0`. |
| Primary Alt (Colors) | Every swatch in the Oranges column is named "Primary Alt" (not Dark 1 / Dark 2 / Light 1 / Light 2), and the Dark 2 swatch's hex label reads `#FF7439` over a `#D84900` fill. |
| Rarities (Colors) | Every Light swatch's label repeats the base rarity's hex or an unrelated one (Mythic Light reads `#FFBC5B`, Exotic Light `#BDFD4E`); Epic and Epic Light read `#289CFF` over a `#438FFF` fill. |
| Gradients (Colors) | Brand/Flare, Cerise and Amin carry no stops (image fills), and Flare ends at `#FFBC5B`, not Brand/Yellow `#FFC95B`. |
| Transparencies (Colors) | The variable `Transparency (White)/Transparent` is empty. |
| Transparencies (Colors) | Two naming schemes for one alpha: the swatch borders reference `Transparencies/Black 10` and `White 20`, while the column names its steps Subtle and Soft. |
| Variables (Colors) | `DCL/*` duplicates (`DCL/Snow`, `DCL/Pale Black`, `DCL/White10%`, `DCL/Rarities/\*`, `DCL/Ruby`) sit beside the `Neutrals/*`, `Primary/*` and `Rarities/\*` variables; `DCL/Red` `#FF0000` is a legacy variable, not the error role. |
| Size frame (Typography) | The caption reads "Perfect Fourth (1,5)": a perfect fourth is 1.333, and the steps (30 / 24 / 22 / 20 / 18 / 16 / 14 / 12) follow no 1.5 ratio. |
| Size frame (Typography) | Two H1 sizes under one name: the 48px display rows are local styles with `line-height: normal`, while the `H1 Semi` variable is 30px. |
| Size frame (Typography) | `H6 Semi` / `H6 Semi Caps` and `H7 Semi` / `H7 Semi Caps` differ only by case, which a variable can't carry. |
| Size frame (Typography) | Line-height is a percentage (100) on the H styles and a ratio (1.43, 2.66) on Body and Overline. |
| Editor (Icons) | Misspelled or inconsistent names: `smat-outline`, `smat-item`, `pain` (for paint), `layout-outline_small` beside `kebab-small`, a slash in `Collapse/ExpandHorizontally`; `NodeType/Desktop` and `Desktop`, `NodeType/Mobile` and `Mobile` share names across the 16 and 24 families. |
| Role tag (Tags / Labels) | Variant named "Tenat" (typo); its label reads "Tenant". |
| Role tag (Tags / Labels) | The page's board draws only Place; Privacy and Role tag are not placed on it. |
| Role tag (Tags / Labels) | Collaborator's fill uses the Blue Dark 1 swatch fill `#1A75D2`, whose swatch label reads `#1F87E5`. |
| Role tag (Tags / Labels) | Label is `H6 Regular` 16px inside a 4 / 10 pill, so the tag is 28 tall; the 18-high Place and Privacy labels use 14px. |
| Place (Tags / Labels) | Label text is the placeholder "worldname". |
| ProgressBar (Progress) | The progress fill is a raster PNG (`Rectangle 1`), not a gradient paint: Brand/Flare has no stops in the file. |
| Spinner Animation (Progress) | The variants are SVG exports: arc angles, stroke and track alpha are not in the node tree. |
| Snackbars (Snackbars) | No hover, press or focus drawn for the action or Close. |
| Snackbars (Snackbars) | Close is 20 × 20, under the 24px hit target. |
| Snackbars (Snackbars) | No shadow or border: the Shadow fill on a Shadow page is 1.00:1, so the snackbar has no edge. |
| Snackbars (Snackbars) | Warning keeps the "OK" action while Notification_Action says "Action" and adds Close: inconsistent action vocabulary. |
| Tooltip (Tooltips) | Neutrals/Onix `#35333B` is a variable on this page but appears only as a raw fill on the Colors frame (two sources for one colour). |
| Tooltip (Tooltips) | The board layer is named `snackbars` but titled "Tooltips". |
| Main Navigation (Header) | The divider and logo are SVG assets with no stroke or fill exposed. |
| Main Navigation (Header) | Layer names disagree with labels: the BADGES tab sits in a layer named "manage tab", next to the MANAGE tab. |
| Main Navigation (Header) | No hover, press, focus or disabled drawn for Create or Sign in on this page. |
| tab-bar (Header) | Only the resting look is drawn: no selected or hover variant. |
| TabVertical (Tabs) | The inactive Notification variant (`20902:5645`) draws no badge; only active + notification carries the dot. |
| TabHorizontal (Tabs) | The Tabs board's row labels repeat "Default" / "Active" for both the icon and no-icon grids. |
| AccordionEntry (Accordion) | The Expanded `Description` paragraph is hard-coded 596 wide inside a 596 row with 20px padding, so overflow-clip cuts it; header and body carry placeholder "Text". |
| LabelAccordion (Accordion) | Entry 2's header is the placeholder "Text", with its question in the Description slot; the label "create" is typed lowercase and cased by the style; the White 40 `H6 Semi Caps` label is 3.83:1 on `#161518` (fails 4.5:1). |
| Scene-Card (Cards) | Hover removes the 1px border and the clip, so the card edge changes between states; placeholder copy "Scene Title" / "N Parcels". |
| Template-Card (Cards) | The hover button sits at top 10, Scene-Card's at top 10.5 (0.5px apart). |
| Learn-Video-Card (Cards) | The subtitle relies on a hard line break plus a trailing space; the poster is a placeholder. |
| Learn-Doc-Card (Cards) | The Gradients/Cerise style has no stop values in the style list; the subtitle has a trailing space. |
| Published-Scene-Card (Cards) | Three stacked `Div` nodes between Place and Privacy where one rule is intended; the Revenue row aligns start at rest and centre on hover; the Div colour exists only as an SVG asset. |
| Menu-Entry (Menu) | The Section variant has no leading glyph and no gap, so its label sits 10px from the left, not aligned with row labels (16 + 10 = 26px). |
| DefaultModal (Modals) | The modal fill `#181225` is a raw hex, not a variable; the close X lives in a layer named `settings`; the exported vertical instance is size-full. |
| Help & Support Modal (Modals) | The group labels (Inter 16 / 400 White 60) differ from the page's own LabelAccordion `20932:5388` (`H6 Semi Caps` White 40); the "How do I become a Decentraland creator?" entry repeats its question as its Description. |
| DefaultModal, Help & Support, ReportBug, Secure-Sign-In (Modals) | Three close buttons in three sizes and two fills: 36 White 10 (DefaultModal), 30 White 10 (modal TitleBar), 46 Black 60 (Secure-Sign-In). |
| Secure-Sign-In (Modals) | The verification number's line-height is `normal`, not 100% like every other text style. |
| TitleBar (Sections Titles) | `typography/h3` is listed as Semi Bold (600) while the paragraph overrides it to Regular 400; the Graffito `.dcl.eth` suffix is 2.76:1 on `#16141a` (fails even 3:1). |
| Subtitle-Navigation (Sections Titles) | The forward chevron is a flipped-and-rotated BackTitle instance (`-scale-y` + 180°), with no dedicated forward component. |
| Editor Toolbar (TitleBar) | The title is `SF Pro Text` Medium 18, the only non-Inter text node in the file; the split-button divider is White 10 on Preview and White 20 on Publish. |
| Editor Toolbar buttons (TitleBar) | Preview / Publish `Left` padding and label size differ between this board (Preview 10 / 14px, Publish 14 / 13px) and the Editor Toolbar set (10 / 13 on both); the AIToggle toast (padding 2 / 10, 10px radius) and the button toasts (6 / 10, 8px) differ; `Neutrals/Cloudy Sky` is referenced but unused. |
| Play Options menus (TitleBar) | The heading is typed "play Options" and cased by the text style. |
| ConnectionStatus (Profile Snapshot) | A hidden or stray `Rarities/Legendary` `#A14BF3` fill is referenced inside the set. |
| ProfilePic (Profile Snapshot) | The 28 variant's (hidden) dot is `DCL/Grass` `#28AC00`, off System/Green; the blocked ring is `DCL/Red` (legacy) at 1.05:1 against the Lavender fill. |
| Switch (Buttons) + Switch (Switch) | Two Switch sets disagree: Buttons page 41 × 24 on the legacy `DCL/Ruby` / `DCL/Snow` collection; Switch page 52 × 30 on Graffito / Primary. |
| Switch (Buttons) | Built on the legacy `DCL/Ruby` and `DCL/Snow` variables, not `Primary/Primary` / `Neutrals/Snow` (same values). |
| rounded-button-contained, IconContainedToggle, TextureContainedRoundedButton (Buttons) | The Toast tooltips disagree: rounded-button-contained pads 6 / 10 with an 8px radius; IconContainedToggle and TextureContainedRoundedButton pad 2 / 10 with a 10px radius. |
| PillIconText, ButtonContainedVertical (24 Caps) and (20), ToggleLabel (Buttons) | Label line-height is `normal` where the other sets use 100%. |
| ToggleLabel (Buttons) | 20px tall, below the 24px target floor. |
| Buttons board `Frame 3112` (Buttons) | The toolbar "Tools" sample is a loose frame outside any set; the "Contained " section label has a trailing space. |
| Checkbox (Checkbox) | Secondary and Tertiary draw only their selected variants (no Off / Hover); every selected variant is a flattened svg that bakes fill, tick and halo together. |
| Checkbox (Checkbox) | The UI Editor `Header` frame `21067:22621` draws its toggle checkboxes as SVG assets, not instances of the Checkbox set. |
| Search-Bar (Search Bar) | The Selected placeholder is White 20 (1.88:1) while Text-Input Selected is White 40. |
| Text-Input (Text Field) | The caret is drawn three ways: a 1px left edge (Selected), a 1px right edge (Editing), a rotated `Line 1` (Error). The Editing and Input Highlighted frames are Hug while their container is Fixed 46. |
| Close-Button (Search Bar) | The White 5 fill is an unnamed fill, not a variable. |
| Slider (Slider) | The Handle's colour is baked into its svg; only `Primary/Primary` is referenced. |
| SectionImages (Section) | Layer names don't match the content: `Videos` holds `folder-dynamic-gradient`, `Image6` holds `influence 1`. Caption typo "sourcelibrary". |
| Settings (App Settings) | The `Experimental / Custom` variant shows the AI tab; no Experimental non-default variant, no AI / Default. |
| Settings (App Settings) | The sidebar draws the `TabVertical` set at a 46-high, 16px uppercase override of the set's 75-high, 20px size: design to decide whether that is a `TabVertical` size variant. |
| Settings (App Settings) | Copy: "sign Out" casing; one action labelled two ways ("SIGN IN" in Primary, "Sign In" in Silver). |
| Settings (App Settings) | The Scene Folder field fixture holds a real home-directory path; it should be a placeholder. |
| Settings (App Settings) | The command box reads `npm i -g @claude`, which is not a real install command for the Claude CLI. |
| Fill (UI Editor) | The mode control draws a Video cell in all four variants, a mode the react-ecs authoring type can't express (`UiBackgroundProps`). |
| Fill (UI Editor) | The mode control is 130 × 20 here but the `ToggleTabs` slot is 142 × 27. |
| RightPanel2D (UI Editor) | "Constratints" typo in the Constraints label (`21028:16548`), repeated in the Text, Button, Dropdown and Image&Container variants. |
| RightPanel2D (UI Editor) | The Text / Button layer text `{isMouseEvents ? "Mouse Events" : isStyle ? "Style" : ""}` is an unresolved component-property expression. |
| RightPanel2D (UI Editor) | The Dropdown variant repeats the Position and Layout groups (1702 tall); confirm whether the duplicate is intentional. |
| RightPanel2D (UI Editor) | NodeLogic1 and NodeLogic2 draw two layouts for one screen ("Open PrefabName" below the inputs vs under the header); design must say which governs. |
| RightPanel2D (UI Editor) | GUILogic description carries two spaces ("GUI's data - NewGUI.tsx"). |
| RightPanel2D (UI Editor) | The header row is 16 tall while the `NodeTypeHierarchy` PropertiesHeader variant it instances is 20. |
| RightPanel2D (UI Editor) | NodeLogic1's bound input compensates its 1px border with +1 padding; the unbound row's DeleteCTA is opacity 0 but still takes 20px. |
| RightPanel2D / InputAction (UI Editor) | The `TextureInput` fill is a raw White 8 `rgba(255,255,255,.08)` with no variable; the MobileHUD drop slot is a `#D9D9D9` placeholder at opacity 0. |
| HierarchySections vs right-panel sets (UI Editor) | `AddCTA` radius is 5 in HierarchySections and 6 in Border, Devices, Interactions, MinMaxSize, AddAction, AddLogicInputs. |
| HierarchySections (UI Editor) | The `AddCTA` glyph layer is named `settings` but draws a plus. |
| ScaleToggle (UI Editor Buttons) | The cell frame is 26 × 27 inside the right panel (aspect 27 / 27). |
| WrapToggle, HelpCTA, LockLayerToggle (UI Editor Buttons) | Variants are single flattened SVGs, so fill, radius and glyph geometry can't be read from layers. |
| LockLayerToggle (UI Editor Buttons) | `Parent = No` / `Active = Off` carries a 2 × 2 vector node though nothing is drawn. |
| VisibilityToggle (UI Editor Buttons) | The eye-off glyph is 15 × 15 at rest and 14 × 14 on hover. |
| AddVariant (UI Editor Buttons) | Variant names inverted (`Hover=Yes` is the rest look). |
| NodeTypeHierarchy (UI Editor) | InvisibleSelectedHover is pixel-identical to InvisibleSelected (G10); Selected carries an unused empty `Label` node; InvisibleHover's CTAs sit inline while every other variant anchors them absolutely. |
| Input (UI Editor) | The Blocked variants draw no bind link, so a bound field has no drawn way to unbind. |
| EventHandler (UI Editor) | Placeholder Cloudy Sky on Onix 2.43:1 fails 4.5:1; Defined / DefinedHover differ in tag width (flex vs 186); the `Close-Button` hover is drawn only inside the tag. |
| LogicInputs, AddLogicInputs (UI Editor) | "No variables yet." (3.09:1) and the Cloudy Sky placeholders on Onix (2.43:1) fail 4.5:1. |
| AddLogicInputs (UI Editor) | The three variants show different fields with no stated rule; the `AddCTA` is drawn at 20% opacity everywhere with no enabled state. |
| AddAction (UI Editor) | "Add Action" is 600 uppercase Gray while PropertiesSections titles are 600 not uppercase; no hover for the `AddCTA`. |
| EventsMenu (UI Editor) | Variant "NewVariable" holds events content; the 1.5px Snow Description border reads as a focus ring at rest; typed text is 16px where every other field is 12 / 14; the Add button is drawn only at 20% opacity. |
| VariableMenu (UI Editor) | Same Description-field border, 16px typed text and "NewVariable" naming as EventsMenu. |
| ColourPanel (UI Editor) | A lighter shadow (25%, blur 10) than the menus (40%, blur 8); hex cells are Pale Black where every other field is Onix. |
| Interactions (UI Editor) | Chips have no hover or focus state. |
| Devices (UI Editor) | The device pair is drawn as `ToggleLabel` chips, not the `ViewModeToggle` set; the Off variant has no label state for the pair. |
| MinMaxSize (UI Editor) | The label reads "Min Size" for both Min and Max uses. |
| BottomPanel2D (UI Editor) | The "Full Screen" tile label is 11px, every other 12px; NODES tiles are bordered and PREFABS tiles are not; the Default scrollbar track is 510 tall over a 320-tall panel. |
| LeftPanel2D (UI Editor) | The Search field draws no fill or border (unbounded hit area) and no focus state. |
| InputAction (UI Editor) | "Hiden" variant names; no focus or drag state; White 40 "None" on White 8 is 3.17:1. |
| Header (UI Editor) | The Toggle checkboxes are SVG assets, not Checkbox instances. |
| Right Panel (3D Editor Bottom Panel) | Title typo "Select and asset to preview it here"; Cloudy Sky 12px body is 3.09:1 (fails 4.5:1); the set frame is 340 × 1096 while each variant is 300 × 518. |
| Collapse/Expand Panel (3D Editor Bottom Panel) | Variant names inverted (`Selected` = no fill); two sizes (32 in the header, 24 in the name row) with no variant for the small one. |
| PreviewToggle, Collapse/Expand Panel (3D Editor Bottom Panel) | No focus or disabled state. |
| Scale Slider (3D Editor Bottom Panel) | The handle sits at the track centre in every variant, not at the value; the Editing halo is baked into the SVG; the 60 × 4 track has no hit target. |
| File Button States (3D Editor Bottom Panel) | The set's description maps it to an MUI `Button` although it is a tile. |
| BottomPanel3D (3D Editor Bottom Panel) | "IMPORT ASSET" is typed in capitals while the tab labels are styled uppercase; the file grid has no rule for selection vs hover. |
| FoldersHierarchy (3D Editor Bottom Panel) | No collapsed, focus or drag state. |
| ChatInput (AI Assistant) | The 1px Snow container border is drawn at rest in both variants, so a focus ring has to read differently; the 10px Selection chip text is below the 12px floor used elsewhere. |
| AiChat (AI Assistant) | User-facing strings are fixtures ("Claude CLI (v2.1.92)"); the usage card and banner are absolutely positioned. |
| Menu (AI Assistant) | The "CHAT HISTORY" label is typed in capitals rather than styled uppercase. |
| Viewport (Viewport) | HUD, SafeArea and Mobile cells have no rest or hover state (only Desktop selected); the pair's outline is 0.692px. |
| ViewModeToggle (UI Editor Buttons) | The set is 16 × 16 but the Viewport instances are 22 × 22 / 26 × 22 with no size variant. |
| Toolbar (Viewport Toolbar) | Groups named against their position (`RigthSide` is the left group). |
| RuntimeControls (Viewport Toolbar) | The `Disabled` property on `Preview=Off`'s Pause doesn't change its look (G10); the Play cell is offset −1 / −1. |
| AudioToggle (Viewport Toolbar) | No hover or focus state. |

### Figma silent or ambiguous (for the user)

Figma draws these two ways, or doesn't decide them. They wait for the user; none is a decision yet.

| Set (page) | Question |
| --- | --- |
| RightPanel2D, variants NodeLogic1 and NodeLogic2 (UI Editor) | Which variant governs: the "Open PrefabName" button under the header (NodeLogic1), or below the inputs (NodeLogic2)? |
| RightPanel2D, variant Dropdown (UI Editor) | The variant draws the Position and Layout groups twice. Is the second pair intended, or a leftover? |
| Settings (App Settings) | The sidebar draws `TabVertical` at 46 high with 16px uppercase labels, against the set's 75 high and 20px. Should that become a `TabVertical` size variant? |
| Devices (UI Editor) | The Devices toggle chips and the `ViewModeToggle` set draw the same control differently. Which one does the code follow? |

### Proposed tokens

Names are the user's call. A proposed token lands in the hub with its row here; a value change to an existing token ships in its own spoke with Before and After shots of every consumer.

| Proposed name | Value | Figma source | World | Would replace |
| --- | --- | --- | --- | --- |
| `--palette-primary-dark2` | `#D80029` | Primary/Primary Dark 2 | inspector | — (ui2 `colors.base.primaryDark2`) |
| `--palette-primary-light2` | `#FF93A8` | Primary/Primary Light 2 | inspector | — |
| `--palette-primaryAlt-dark2` | `#D84900` | Primary Alt/Primary Alt Dark 2 | inspector | — |
| `--palette-primaryAlt-light2` | `#FFCDBA` | Primary Alt/Primary Alt Light 2 | inspector | — |
| `--palette-neutral-gray5` | `#ECEBED` | Neutrals/Pearl | inspector | — (ui2 `neutral.gray5`) |
| `--palette-neutral-gray1` | `#5E5B67` | Neutrals/Graffito | inspector | — (Creator Hub `--light-gray`) |
| `--palette-neutral-onyxDark1` | `#2D2A33` | Onix Dark 1 (swatch) | inspector | — (Creator Hub `--title-bar-button`) |
| `--palette-success-dark2` | `#00A146` | System/Green Dark 2 | both | — |
| `--palette-success-light2` | `#C1EECF` | System/Green Light 2 | both | — |
| `--palette-warning-light` | `#FFB95B` | System/Orange Light 1 | inspector | — (ui2 `palette.warning.light`) |
| `--palette-warning-dark2` | `#EC7122` | System/Orange Dark 2 | both | the `#ec7122` literal in `LayoutTab` |
| `--palette-warning-light2` | `#FFCD88` | System/Orange Light 2 | both | — |
| `--palette-error-dark2` | `#CC1D2C` | System/Red Dark 2 | both | — |
| `--palette-error-light2` | `#FFCDD4` | System/Red Light 2 | both | — |
| `--palette-info-main` | `#2196F3` | Blue (swatch) | inspector | — (ui2 `palette.info.main`) |
| `--palette-info-dark1` | `#1A75D2` | Blue Dark 1 (swatch fill) | inspector | — (ui2 `palette.info.dark`) |
| `--palette-info-light2` | `#BBDEFB` | Blue Light 2 (swatch) | both | — |
| `--palette-rarity-<name>` and `--palette-rarity-<name>-light` (16) | the Rarities table | Rarities/\* | both | — (ui2 `colors.rarity` / `rarityLight`) |
| `--gradient-flare` / `--gradient-cerise` / `--gradient-amin` | `linear-gradient(135deg, …)` of the stops in the Gradients table | Brand/Flare, Cerise, Amin | both | — (`--metaverse-gradient` is another gradient) |
| `--palette-blackTransparent-subtle` | `rgba(0,0,0,.1)` | Transparency (Black)/Subtle | both | — |
| `--palette-blackTransparent-soft` | `rgba(0,0,0,.2)` | Transparency (Black)/Soft | both | `--contexify-separator-color` in the overlay role |
| `--palette-whiteTransparent-hint` | `rgba(255,255,255,.08)` | the MobileHUD input fill (no variable) | inspector | — |
| `--palette-whiteTransparent-hover` | `rgba(255,255,255,.15)` | card hover (no variable) | both | — (Creator Hub alternative name: `--transparent-gray-hover`) |
| `--shape-borderRadiusMedium` | `8px` | rows, swatches, a Toast tooltip | both | literals |
| `--shape-borderRadiusXLarge` | `16px` | cards | both | literals |
| `--shape-borderRadiusXXLarge` | `24px` | modals | both | literals |
| `--shadow-tooltip` | `0 2px 3px rgba(0,0,0,.25)` | Tooltip `20819:309` | both | literals |
| `--shadow-toast` | `0 4px 4px rgba(0,0,0,.1)` | the Toast tooltips | both | literals |
| `--modal-surface` | `#181225` | the modal shell (raw fill) | both | `--modal-content-bg-color` (inspector), `--modal` (Creator Hub) |
| `--type-<style>-size` / `-weight` / `-line-height` / `-letter-spacing` | the Proposed type tokens table | the 19 Typography styles | both | literal sizes in component CSS |
| `--type-caption-size` | `10px` | the NodeLogic descriptions (no style) | inspector | literals |
| `--lavender` | `#c640cd` | Brand/Lavender (avatar fill) | Creator Hub | none |
| `--menu-bg` | `#35333b` | Neutrals/Onix (menu fill) | Creator Hub | ui2 `Menu` paper default |
| `--menu-shadow` | `0 4px 8px rgba(0,0,0,.4)` | Menu drop shadow | Creator Hub | ui2 `MuiPaper` elevation |
| `--scrollbar-thumb` | `rgba(0,0,0,.4)` | Scrollbar handle, Black 40 | Creator Hub | `--dcl-silver` in the global `::-webkit-scrollbar` |
| `--scrollbar-thumb-border` | `rgba(255,255,255,.6)` | Scrollbar handle border, White 60 | Creator Hub | none |
| `--type-button-small-*` | 13 / 600 / 24px / 0.46px uppercase | `button/small` (legacy) | both | literals |
| Creator Hub White 5 / 10 / 20 / 40 / 60, Black 40 steps | `rgba(255,255,255,.05/.1/.2/.4/.6)`, `rgba(0,0,0,.4)` | Transparencies | Creator Hub | `theme.css` has none; names follow the inspector's `--palette-whiteTransparent-*` |
| (name pending) popover shadow | `0 4px 10px rgba(0,0,0,0.25)` | `ColourPanel` drop shadow (no variable) | inspector | a literal, or unify with `--menu-shadow` (a design question) |

---

## Related standards

- [`coding-standards.md`](./coding-standards.md) — React patterns (controlled-input prop-sync, memoized components).
- [`testing-standards.md`](./testing-standards.md) — E2E/Playwright patterns.
