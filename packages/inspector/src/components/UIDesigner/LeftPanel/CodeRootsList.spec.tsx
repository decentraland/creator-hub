import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { CodeRootsList } from './CodeRootsList';

const mocks = vi.hoisted(() => ({
  removeRoot: vi.fn(),
  toggleTopLevel: vi.fn(),
  selectRootFile: vi.fn(),
  renameRoot: vi.fn(),
  roots: [] as { name: string; filename: string; topLevel: boolean }[],
  filename: null as string | null,
}));

vi.mock('../code/store', () => ({
  removeRoot: mocks.removeRoot,
  renameRoot: mocks.renameRoot,
  selectRootFile: mocks.selectRootFile,
  toggleTopLevel: mocks.toggleTopLevel,
  useCodeState: () => ({
    roots: mocks.roots,
    filename: mocks.filename,
    parsed: null,
    error: null,
  }),
}));

vi.mock('react-dnd', () => ({ useDrag: () => [{ isDragging: false }, () => {}] }));
vi.mock('../../../redux/hooks', () => ({
  useAppDispatch: () => vi.fn(),
  useAppSelector: () => null,
}));

const root = (name: string, topLevel = true) => ({
  name,
  filename: `src/ui/${name}.tsx`,
  topLevel,
});

// Rows are queried through the name span rather than getByRole: under happy-dom
// the accessibility-tree filter reports this subtree inaccessible (same reason
// CallbackField.spec reaches for querySelector).
const rowNames = () =>
  [...document.querySelectorAll('.ui-designer-code-root-name')].map(n => n.textContent);

const rowFor = (name: string) =>
  [...document.querySelectorAll<HTMLElement>('.ui-designer-code-root-row')].find(
    r => r.querySelector('.ui-designer-code-root-name')?.textContent === name,
  )!;

beforeEach(() => {
  mocks.removeRoot.mockClear();
  mocks.toggleTopLevel.mockClear();
  mocks.roots = [root('MainUI'), root('Hud'), root('Card', false)];
  mocks.filename = 'src/ui/MainUI.tsx';
});

describe('when the rail passes no search term', () => {
  it('should list every root', () => {
    render(<CodeRootsList />);

    expect(rowNames()).toEqual(['MainUI', 'Hud', 'Card']);
  });
});

describe('when the rail passes a search term', () => {
  it('should keep only the roots whose name matches, case-insensitively', () => {
    render(<CodeRootsList filter="hu" />);

    expect(rowNames()).toEqual(['Hud']);
  });

  it('should match on any part of the name', () => {
    render(<CodeRootsList filter="ui" />);

    expect(rowNames()).toEqual(['MainUI']);
  });

  it('should list nothing when no root matches', () => {
    render(<CodeRootsList filter="zzz" />);

    expect(rowNames()).toEqual([]);
  });

  it('should ignore surrounding whitespace', () => {
    render(<CodeRootsList filter="  hud  " />);

    expect(rowNames()).toEqual(['Hud']);
  });
});

describe('when a root is a nested-only component', () => {
  it('should gray its row, since it renders nowhere on its own', () => {
    render(<CodeRootsList />);

    expect(rowFor('Card').className).toContain('is-hidden');
    expect(rowFor('MainUI').className).not.toContain('is-hidden');
  });
});

describe('when using a row action', () => {
  it('should delete the root from the trash button', () => {
    render(<CodeRootsList />);
    fireEvent.click(screen.getByLabelText('Delete Hud'));

    expect(mocks.removeRoot).toHaveBeenCalledWith('src/ui/Hud.tsx');
  });

  it('should toggle top-level from the eye button', () => {
    render(<CodeRootsList />);
    fireEvent.click(screen.getByLabelText('Toggle top-level for Card'));

    expect(mocks.toggleTopLevel).toHaveBeenCalledWith('src/ui/Card.tsx');
  });

  it('should not select the root when a row action is used', () => {
    render(<CodeRootsList />);
    fireEvent.click(screen.getByLabelText('Delete Hud'));

    expect(mocks.selectRootFile).not.toHaveBeenCalled();
  });
});
