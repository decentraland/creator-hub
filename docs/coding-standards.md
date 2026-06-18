# Coding standards

Project-specific patterns to apply (and antipatterns to avoid) when writing code in this repo. See also: [testing-standards.md](./testing-standards.md).

## React

### Don't mirror props into local state via `useEffect`

Components that hold a `value` prop in local state for debounced/buffered input
must not unconditionally sync the prop back into local state:

```ts
// BAD — race against the user's keystrokes
const [inputValue, setInputValue] = useState(value);
useEffect(() => {
  if (inputValue !== value) setInputValue(value);
}, [value]);
```

Any re-render carrying a stale `value` (e.g. an engine→input sync round-trip in
`useComponentInput`) will overwrite the user's just-typed character. Symptom:
fast typing drops chars — "90" becomes "9".

If you need local state (debounced commit, staged validation), gate the sync
on a "user is active" signal so the local state is authoritative while the
user owns the field:

```ts
const [isFocused, setFocused] = useState(false);

useEffect(() => {
  if (isFocused) return;
  if (inputValue !== value) setInputValue(value);
}, [value, isFocused]);
```

Applied in `packages/inspector/src/components/ui/TextField/TextField.tsx`.

### Don't build a memoized component inside render

A factory function that returns `React.memo(...)` (or any HOC-wrapped
component) on every call gives the result a fresh component identity per
call. Using it as JSX inside render makes React read it as a different
component type each render and remount the entire subtree:

```ts
// BAD — every parent re-render remounts every child Tree
function TreeChildren<T>(props: Props<T>) {
  const CompTree = Tree<T>();  // returns a fresh React.memo(...) each call
  return children.map($ => <CompTree key={getId($)} value={$} {...props} />);
}
```

Under an open Hierarchy this remounts every visible row on every engine
update — detaching focused inputs, MutationObservers, Playwright element
handles, etc. Memoize at the call site so identity is stable:

```ts
const CompTree = useMemo(() => Tree<T>(), []);
```

Applied in `packages/inspector/src/components/Tree/Tree.tsx`.
