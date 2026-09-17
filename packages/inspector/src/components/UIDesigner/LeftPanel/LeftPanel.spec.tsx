import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';

import type { UINode } from '../shared/tree-model';
import type * as AnalyticsModule from '../../../lib/logic/analytics';
import { Event } from '../../../lib/logic/analytics';
import { LeftPanel } from './LeftPanel';

const mocks = vi.hoisted(() => ({
  createRoot: vi.fn(),
  track: vi.fn(),
  roots: [] as { name: string; filename: string; topLevel: boolean }[],
  filename: null as string | null,
  tree: null as UINode | null,
  emptyRoot: false,
}));

vi.mock('../../../lib/logic/analytics', async importActual => ({
  ...(await importActual<typeof AnalyticsModule>()),
  analytics: { track: mocks.track },
}));

vi.mock('../code/store', () => ({
  createRoot: mocks.createRoot,
  useCodeState: () => ({
    roots: mocks.roots,
    filename: mocks.filename,
    emptyRoot: mocks.emptyRoot,
  }),
}));

vi.mock('../shared/useUINodeTree', () => ({ useUINodeTree: () => mocks.tree }));

vi.mock('../../../redux/hooks', () => ({ useAppSelector: () => 1, useAppDispatch: () => vi.fn() }));

// The two lists are stubbed: what the rail decides is WHICH sections exist and
// what term they get — the lists' own rendering is covered by their own specs.
vi.mock('./NodeTree', () => ({
  NodeTree: ({ filter }: { filter?: string }) => <div data-testid="nodes">{filter}</div>,
}));
vi.mock('./CodeRootsList', () => ({
  CodeRootsList: ({ filter }: { filter?: string }) => <div data-testid="guis">{filter}</div>,
}));
vi.mock('./WidgetPicker', () => ({ WidgetPicker: () => null }));

const root = (over: Partial<UINode> = {}): UINode =>
  ({ entity: 1, type: 'UiEntity', name: 'UiEntity', children: [], ...over }) as UINode;

const search = () => screen.getByLabelText('Search GUIs and nodes');
const guis = () => screen.queryByTestId('guis');
const nodes = () => screen.queryByTestId('nodes');

// ui/TextField reports changes through a debounce (0ms, but still a timer), so
// the term lands on the next tick. A controlled clock keeps every assertion
// synchronous instead of racing a waitFor.
function type(term: string) {
  fireEvent.change(search(), { target: { value: term } });
  act(() => {
    vi.advanceTimersByTime(1);
  });
}

function renderRail(term?: string) {
  render(<LeftPanel />);
  if (term !== undefined) type(term);
}

beforeEach(() => {
  vi.useFakeTimers();
  mocks.createRoot.mockClear();
  mocks.track.mockClear();
  mocks.roots = [{ name: 'MainUI', filename: 'src/ui/MainUI.tsx', topLevel: true }];
  mocks.filename = 'src/ui/MainUI.tsx';
  mocks.tree = root({ uiName: 'Sidebar', children: [] } as Partial<UINode>);
  mocks.emptyRoot = false;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('when no GUI is selected', () => {
  it('should not show the Nodes section at all', () => {
    mocks.filename = null;
    mocks.tree = null;
    renderRail();

    expect(guis()).not.toBeNull();
    expect(nodes()).toBeNull();
    expect(screen.queryByText('Nodes')).toBeNull();
  });
});

describe('when a GUI is selected', () => {
  it('should show both sections', () => {
    renderRail();

    expect(guis()).not.toBeNull();
    expect(nodes()).not.toBeNull();
  });

  it('should still show the Nodes section for an empty GUI, whose + adds the first element', () => {
    mocks.tree = null;
    mocks.emptyRoot = true;
    renderRail();

    expect(screen.queryByText('Nodes')).not.toBeNull();
    expect((screen.getByLabelText('Add widget') as HTMLButtonElement).disabled).toBe(false);
  });
});

describe('when searching', () => {
  it('should pass the same term to both lists', () => {
    renderRail('side');

    expect(guis()).toBeNull();
    expect(nodes()!.textContent).toBe('side');
  });

  it('should hide the Nodes section when only a GUI matches', () => {
    renderRail('mainui');

    expect(guis()!.textContent).toBe('mainui');
    expect(nodes()).toBeNull();
  });

  it('should hide the GUIs section when only a node matches', () => {
    renderRail('sidebar');

    expect(guis()).toBeNull();
    expect(nodes()).not.toBeNull();
  });

  it('should hide both sections when nothing matches', () => {
    renderRail('nothinghere');

    expect(guis()).toBeNull();
    expect(nodes()).toBeNull();
  });

  it('should restore both sections when the term is cleared', () => {
    renderRail('nothinghere');
    type('');

    expect(guis()).not.toBeNull();
    expect(nodes()).not.toBeNull();
  });
});

describe('when pressing an add button', () => {
  const ripples = (label: string) =>
    screen.getByLabelText(label).querySelectorAll('.ui-designer-rail-add-ripple');

  it('should show no ripple until the button is pressed', () => {
    renderRail();

    expect(ripples('New GUI')).toHaveLength(0);
    expect(ripples('Add widget')).toHaveLength(0);
  });

  it('should ripple the pressed button only', () => {
    renderRail();
    fireEvent.click(screen.getByLabelText('New GUI'));

    expect(ripples('New GUI')).toHaveLength(1);
    expect(ripples('Add widget')).toHaveLength(0);
  });

  it('should ripple the Nodes + too', () => {
    renderRail();
    fireEvent.click(screen.getByLabelText('Add widget'));

    expect(ripples('Add widget')).toHaveLength(1);
  });

  it('should replace the ripple on every press, so a second press restarts the animation', () => {
    renderRail();
    const button = screen.getByLabelText('New GUI');
    fireEvent.click(button);
    const first = ripples('New GUI')[0];
    fireEvent.click(button);

    expect(ripples('New GUI')).toHaveLength(1);
    expect(ripples('New GUI')[0]).not.toBe(first);
  });
});

describe('when creating a GUI from the section header', () => {
  it('should call createRoot', () => {
    renderRail();
    fireEvent.click(screen.getByLabelText('New GUI'));

    expect(mocks.createRoot).toHaveBeenCalled();
  });

  it('should track the creation', () => {
    renderRail();
    fireEvent.click(screen.getByLabelText('New GUI'));

    expect(mocks.track).toHaveBeenCalledWith(Event.CREATE_UI, {});
  });
});
