export type NavItem = { id: string; level: number; expanded?: boolean };

export type NavResult =
  | { kind: 'focus'; id: string }
  | { kind: 'setOpen'; id: string; open: boolean }
  | { kind: 'select'; id: string }
  | { kind: 'extend'; id: string }
  | null;

/** Maps a key on a visible tree row (in screen order) to the WAI-ARIA tree action it triggers. */
export function navigate(
  items: NavItem[],
  currentId: string,
  key: string,
  shift: boolean,
): NavResult {
  const index = items.findIndex(item => item.id === currentId);
  if (index === -1) return null;
  const current = items[index];
  const at = (i: number) => items[i]?.id;

  if (shift) {
    const id = key === 'ArrowDown' ? at(index + 1) : key === 'ArrowUp' ? at(index - 1) : undefined;
    return id ? { kind: 'extend', id } : null;
  }

  switch (key) {
    case 'ArrowDown':
    case 'ArrowUp': {
      const id = at(index + (key === 'ArrowDown' ? 1 : -1));
      return id ? { kind: 'focus', id } : null;
    }
    case 'Home':
      return { kind: 'focus', id: items[0].id };
    case 'End':
      return { kind: 'focus', id: items[items.length - 1].id };
    case 'ArrowRight':
      if (current.expanded === false) return { kind: 'setOpen', id: current.id, open: true };
      if (current.expanded && items[index + 1]?.level > current.level) {
        return { kind: 'focus', id: items[index + 1].id };
      }
      return null;
    case 'ArrowLeft': {
      if (current.expanded) return { kind: 'setOpen', id: current.id, open: false };
      const parent = items
        .slice(0, index)
        .reverse()
        .find(item => item.level === current.level - 1);
      return parent ? { kind: 'focus', id: parent.id } : null;
    }
    case 'Enter':
      return { kind: 'select', id: current.id };
    default:
      return null;
  }
}
