import { describe, it, expect, beforeEach } from 'vitest';

import type { HoverHint } from './hover-hint-bridge';
import { createHoverHintBridge } from './hover-hint-bridge';

/**
 * The hover-hint bridge turns agent `hover` BroadcastChannel messages into a DOM
 * prompt over the viewport, reading the hint from the host's `resolve`. Driven
 * with a fake channel + a real (happy-dom) container.
 */
describe('createHoverHintBridge', () => {
  let container: HTMLElement;
  let fakeChannel: { onmessage: ((ev: { data: unknown }) => void) | null; close(): void };
  let disconnect: () => void;
  const resolve = (entity: number): HoverHint | null =>
    entity === 522 ? { key: 'E', text: 'Press' } : null;

  const hover = (entity: number) =>
    fakeChannel.onmessage?.({ data: { to: 'page', msg: { kind: 'hover', entity } } });
  const hint = () => container.querySelector('.BevyHoverHint') as HTMLElement | null;
  const badge = () => hint()?.querySelector('.BevyHoverHint-key') as HTMLElement | null;
  // Assert on the rendered `display`, NOT on `.hidden`: both elements carry an
  // inline `display`, which outranks the UA's `[hidden]{display:none}` — a
  // `.hidden` assertion passes while the prompt is still painted on screen.
  const isShown = (el: HTMLElement | null | undefined) => el != null && el.style.display !== 'none';

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    fakeChannel = { onmessage: null, close() {} };
    disconnect = createHoverHintBridge({ container, resolve, channel: fakeChannel });
  });

  it('is not painted until something is hovered', () => {
    expect(isShown(hint())).toBe(false);
  });

  it('shows the key + text for an interactable entity', () => {
    hover(522);
    const el = hint();
    expect(isShown(el)).toBe(true);
    expect(isShown(badge())).toBe(true);
    expect(el?.querySelector('.BevyHoverHint-key')?.textContent).toBe('E');
    expect(el?.textContent).toContain('Press');
  });

  it('hides on entity 0 (pointer over nothing)', () => {
    hover(522);
    expect(isShown(hint())).toBe(true);
    hover(0);
    expect(isShown(hint())).toBe(false);
  });

  it('stays hidden for a non-interactable entity (resolve → null)', () => {
    hover(999);
    expect(isShown(hint())).toBe(false);
  });

  it('ignores messages that are not agent → page hovers', () => {
    fakeChannel.onmessage?.({ data: { to: 'scene', msg: { kind: 'hover', entity: 522 } } });
    expect(isShown(hint())).toBe(false);
    fakeChannel.onmessage?.({ data: { to: 'page', msg: { kind: 'pick', entity: 522 } } });
    expect(isShown(hint())).toBe(false);
  });

  it('removes the element and detaches on disconnect', () => {
    hover(522);
    disconnect();
    expect(hint()).toBeNull();
    expect(fakeChannel.onmessage).toBeNull();
  });
});
