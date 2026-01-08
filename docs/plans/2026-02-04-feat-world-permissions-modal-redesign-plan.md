---
title: World Permissions Modal Redesign
type: feat
date: 2026-02-04
---

# World Permissions Modal Redesign

## Overview

Update the WorldPermissionsModal component to match the new Figma designs. This includes significant UI changes to the Access tab (new dropdown selector, password protection feature), and the Collaborators tab (new dialog forms, updated table layout). Styles should be reorganized so that WorldPermissionsModal-specific styles are consolidated in the modal's styles.css file.

## Design Reference

- `~/Desktop/public_and_invitations.png` - Access tab (Public, Invitation only states)
- `~/Desktop/password.png` - Access tab (Password protected states)
- `~/Desktop/collaborators.png` - Collaborators tab states

## Problem Statement / Motivation

The current WorldPermissionsModal implementation does not match the updated design specifications:
1. Access type uses a toggle switch instead of a dropdown selector
2. Password protection access type is not implemented
3. Add user forms are inline instead of dialog-based
4. Collaborators table layout differs from designs
5. Styles are spread across multiple files instead of being consolidated

## Proposed Solution

Redesign the modal to match the Figma designs while following existing codebase patterns.

## Technical Approach

### Key Changes by Component

#### 1. Access Tab (`WorldPermissionsAccessTab`)

**Current → New:**
- Toggle switch (Public/Private) → Dropdown selector (Public, Invitation only, Password protected)
- Inline add address form → "NEW INVITE" dialog
- Simple address list → Styled list with count badge

**New UI Elements:**
- Access type dropdown with 3 options
- "NEW INVITE" dialog modal for adding addresses
- Warning banner for non-public modes

#### 2. Password Protection (NEW)

**New Components Needed:**
- `WorldPermissionsPasswordSection/` - Password display and management
- Password creation dialog
- Password visibility toggle
- Copy to clipboard functionality

**States:**
- Empty (no password set) → "CREATE NEW PASSWORD" button
- Filled → Password field (masked), "COPY TO CLIPBOARD", "CHANGE PASSWORD" buttons

#### 3. Collaborators Tab (`WorldPermissionsCollaboratorsTab`)

**Current → New:**
- Inline add form → "ADD COLLABORATOR" dialog
- Current table → Updated grid with "All world" / "Custom" dropdown per row

**Dialog Flow:**
- "ADD" button opens "ADD COLLABORATOR" dialog
- Input accepts wallet address or ENS
- Cancel/Confirm buttons

#### 4. Style Consolidation

Move all WorldPermissionsModal-specific styles to:
```
WorldPermissionsModal/styles.css
```

Remove or reduce styles from:
- `tabs/WorldPermissionsAccessTab/styles.css`
- `tabs/WorldPermissionsCollaboratorsTab/styles.css`
- `tabs/WorldPermissionsParcelsTab/styles.css`
- `WorldPermissionsAddUserForm/styles.css`
- `WorldPermissionsAvatarWithInfo/styles.css`
- `WorldPermissionsItem/styles.css`

### File Structure (After Changes)

```
WorldPermissionsModal/
├── component.tsx                    # Main modal - add password state handling
├── index.ts
├── styles.css                       # CONSOLIDATED styles for entire modal
├── types.ts                         # NEW: Shared types
│
├── WorldPermissionsAddUserForm/
│   ├── component.tsx               # Convert to dialog-based form
│   └── index.ts
│
├── WorldPermissionsAvatarWithInfo/
│   ├── component.tsx
│   └── index.ts
│
├── WorldPermissionsItem/
│   ├── component.tsx
│   ├── index.ts
│   └── types.ts
│
├── WorldPermissionsPasswordSection/  # NEW
│   ├── component.tsx
│   └── index.ts
│
└── tabs/
    ├── WorldPermissionsAccessTab/
    │   ├── component.tsx           # Add dropdown, password section
    │   └── index.ts
    ├── WorldPermissionsCollaboratorsTab/
    │   ├── component.tsx           # Update table, add dialog
    │   └── index.ts
    └── WorldPermissionsParcelsTab/
        ├── component.tsx
        └── index.ts
```

## Acceptance Criteria

### Functional Requirements

- [x] Access tab shows dropdown with options: Public, Invitation only, Password protected
- [x] Selecting "Invitation only" shows allowlist management UI
- [x] Selecting "Password protected" shows password management UI
- [x] "NEW INVITE" opens dialog for adding wallet addresses
- [x] Password can be created, viewed (toggle), copied, and changed
- [x] "ADD COLLABORATOR" opens dialog for adding collaborators
- [x] Collaborators table shows "All world" / "Custom" dropdown per row
- [x] "Custom" option navigates to parcels selection view
- [x] All existing functionality preserved (add/remove permissions, etc.)

### Non-Functional Requirements

- [ ] All styles consolidated in `WorldPermissionsModal/styles.css`
- [x] Component follows existing patterns (React.memo, useCallback, etc.)
- [x] Uses existing CSS variables from `theme.css`
- [x] Uses `decentraland-ui2` components (Box, Typography, Select, Dialog, etc.)
- [x] Translations added for new text content

### Quality Gates

- [x] No TypeScript errors
- [x] Existing tests pass
- [ ] Manual testing of all modal states
- [ ] Responsive layout maintained

## Implementation Phases

### Phase 1: Style Consolidation
1. Move all existing styles to `WorldPermissionsModal/styles.css`
2. Update CSS selectors to use consistent naming
3. Remove individual `styles.css` files from subcomponents
4. Verify no visual regressions

### Phase 2: Access Tab Redesign
1. Replace toggle switch with dropdown selector
2. Create "NEW INVITE" dialog component
3. Update allowlist display styling
4. Add warning banner component

### Phase 3: Password Protection
1. Add `WorldPermissionsPasswordSection` component
2. Implement password creation dialog
3. Add copy to clipboard functionality
4. Integrate with Access tab

### Phase 4: Collaborators Tab Redesign
1. Create "ADD COLLABORATOR" dialog
2. Update table layout and styling
3. Add "All world" / "Custom" dropdown per row
4. Connect dropdown to parcels navigation

## Dependencies & Prerequisites

- `decentraland-ui2` Dialog/Modal component
- Existing world permissions API endpoints
- Password protection API (may need backend support - TBD)

## Risk Analysis & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Password protection API not ready | High | Implement UI first, mock API responses |
| Breaking existing functionality | High | Thorough manual testing of all states |
| Style conflicts after consolidation | Medium | Careful CSS specificity management |

## References & Research

### Internal References

- TabsModal pattern: `packages/creator-hub/renderer/src/components/Modals/TabsModal/component.tsx`
- Theme variables: `packages/creator-hub/renderer/src/themes/theme.css`
- Current modal: `packages/creator-hub/renderer/src/components/Modals/WorldPermissionsModal/`
- Worlds API types: `packages/creator-hub/renderer/src/lib/worlds.ts`

### Design References

- `~/Desktop/public_and_invitations.png`
- `~/Desktop/password.png`
- `~/Desktop/collaborators.png`
