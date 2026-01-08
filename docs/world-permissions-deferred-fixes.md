# World Permissions Modal - Deferred Fixes

This document tracks code review findings that were identified but not applied during the initial implementation. These items are candidates for future improvements.

## P1 - Critical

### #3: Password Stored in Plaintext in Redux State

**File:** `packages/creator-hub/renderer/src/modules/store/management/slice.ts:61-62`

**Issue:** The access password is stored in plaintext in Redux state (`accessPassword: string | null`). While necessary for the feature (displaying the current password to the owner), this could be exposed in Redux DevTools or logging.

**Recommendation:**
- Add Redux middleware to redact `accessPassword` from logging/DevTools in production
- Consider encrypting the password in state or fetching it only when needed

**Example middleware:**
```typescript
const redactSensitiveData = (store) => (next) => (action) => {
  const result = next(action);
  // Redact accessPassword from logged state
  return result;
};
```

---

## P2 - Important

### #5: N+1 Profile Fetching

**File:** `packages/creator-hub/renderer/src/components/Modals/WorldPermissionsModal/WorldPermissionsItem/component.tsx`

**Issue:** Each `WorldPermissionsItem` component independently fetches its own profile data, causing N+1 queries when rendering a list of collaborators.

**Recommendation:**
- Implement batch profile fetching at the parent component level
- Pass profile data down as props
- Consider using a profile cache/store

**Example approach:**
```typescript
// In parent component
const walletAddresses = collaborators.map(c => c.address);
const profiles = useBatchProfiles(walletAddresses);

// Pass to children
<WorldPermissionsItem profile={profiles[address]} />
```

---

### #6: Re-fetching Permissions After Every Mutation

**Files:**
- `packages/creator-hub/renderer/src/modules/store/management/slice.ts:301-306`
- `packages/creator-hub/renderer/src/modules/store/management/slice.ts:322-327`

**Issue:** After every permission mutation (add/remove address, add/remove parcels), the entire permissions state is re-fetched from the server instead of optimistically updating the local state.

**Recommendation:**
- Implement optimistic updates for permission mutations
- Only re-fetch on error to reconcile state
- Reduces latency and improves UX

**Example pattern:**
```typescript
export const addAddressPermission = createAsyncThunk(
  'management/addAddressPermission',
  async (payload, { dispatch, rejectWithValue }) => {
    // Optimistically update state
    dispatch(optimisticAddAddress(payload));

    try {
      await WorldsAPI.putPermissionType(...);
      // Success - state already updated
    } catch (error) {
      // Rollback on failure
      dispatch(rollbackAddAddress(payload));
      return rejectWithValue(error);
    }
  },
);
```

---

### #8: WorldAtlas Layer Function Recreation During Drag

**File:** `packages/creator-hub/renderer/src/components/Modals/WorldPermissionsModal/tabs/WorldPermissionsParcelsTab/component.tsx:69-87`

**Issue:** The `selectedParcelsLayer` and `selectedParcelsStrokeLayer` callbacks are recreated whenever `dragStatus` changes, which happens frequently during drag operations.

**Current state:** The callbacks are already wrapped in `useCallback`, but they depend on `isHoverSelectedParcel` which depends on `dragStatus`.

**Recommendation:**
- Extract the layer logic to a stable reference that reads drag status from a ref
- Or accept the current performance as acceptable for the use case

**Example approach:**
```typescript
const dragStatusRef = useRef(dragStatus);
dragStatusRef.current = dragStatus;

const selectedParcelsLayer = useCallback(
  (x: number, y: number) => {
    const { isSelectingParcels, from, to } = dragStatusRef.current;
    // ... logic using ref instead of closure
  },
  [selectedParcels], // No longer depends on dragStatus
);
```

---

### #11: Inconsistent Form Patterns

**Files:**
- `WorldPermissionsPasswordDialog/component.tsx`
- `WorldPermissionsAddCollaboratorDialog/component.tsx`
- `WorldPermissionsAddUserForm/component.tsx`

**Issue:** The codebase has multiple patterns for form handling:
- Some use inline state management
- Some use callbacks with local state
- Validation approaches differ

**Recommendation:**
- Consider adopting a consistent form library (react-hook-form, formik)
- Or establish a standard pattern for form components
- Create a shared form hook for common validation patterns

---

## P3 - Nice to Have

### #13: Missing Error Context in API Methods

**File:** `packages/creator-hub/renderer/src/lib/worlds.ts`

**Issue:** API methods return `null` on failure without providing error context. This makes debugging difficult and prevents showing meaningful error messages to users.

**Current pattern:**
```typescript
if (result.ok) {
  return json as WorldScenes;
} else {
  return null; // No error information
}
```

**Recommendation:**
```typescript
if (result.ok) {
  return { data: json as WorldScenes, error: null };
} else {
  return {
    data: null,
    error: {
      status: result.status,
      message: await result.text()
    }
  };
}
```

---

### #14: Over-memoization of Trivial Computations

**File:** `packages/creator-hub/renderer/src/components/Modals/WorldPermissionsModal/tabs/WorldPermissionsAccessTab/component.tsx`

**Issue:** Some `useMemo` and `useCallback` hooks wrap trivial computations where the memoization overhead may exceed the computation cost.

**Recommendation:**
- Audit memoization usage
- Remove memoization for simple computations (string comparisons, boolean checks)
- Keep memoization for object/array creation and expensive computations

**Note:** This is a low-priority optimization. The current memoization is not harmful, just potentially unnecessary.

---

### #15: Inconsistent Method Syntax in Worlds Class

**File:** `packages/creator-hub/renderer/src/lib/worlds.ts`

**Issue:** The `Worlds` class mixes method declaration styles:
- Some methods use traditional syntax: `public async fetchWorld(name: string) {}`
- Some use arrow function properties: `public getPermissions = async () => {}`

**Recommendation:**
- Standardize on one style (preferably traditional methods)
- Arrow properties are only needed when `this` binding is required for callbacks

**Note:** This is a stylistic concern with no functional impact. Changing would be a breaking change if methods are passed as callbacks.

---

## Summary

| Priority | ID | Issue | Effort | Impact |
|----------|-----|-------|--------|--------|
| P1 | #3 | Password in Redux state | Medium | Security |
| P2 | #5 | N+1 Profile fetching | High | Performance |
| P2 | #6 | Re-fetching after mutations | High | Performance/UX |
| P2 | #8 | Layer function recreation | Medium | Performance |
| P2 | #11 | Inconsistent form patterns | High | Maintainability |
| P3 | #13 | Missing error context | Medium | Debugging/UX |
| P3 | #14 | Over-memoization | Low | Performance |
| P3 | #15 | Inconsistent method syntax | Low | Consistency |

## Related Files

- `packages/creator-hub/renderer/src/lib/worlds.ts`
- `packages/creator-hub/renderer/src/modules/store/management/slice.ts`
- `packages/creator-hub/renderer/src/components/Modals/WorldPermissionsModal/`
