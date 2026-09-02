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

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    fakeChannel = { onmessage: null, close() {} };
    disconnect = createHoverHintBridge({ container, resolve, channel: fakeChannel });
  });

  it('shows the key + text for an interactable entity', () => {
    hover(522);
    const el = hint();
    expect(el?.hidden).toBe(false);
    expect(el?.querySelector('.BevyHoverHint-key')?.textContent).toBe('E');
    expect(el?.textContent).toContain('Press');
  });

  it('hides on entity 0 (pointer over nothing)', () => {
    hover(522);
    expect(hint()?.hidden).toBe(false);
    hover(0);
    expect(hint()?.hidden).toBe(true);
  });

  it('stays hidden for a non-interactable entity (resolve → null)', () => {
    hover(999);
    expect(hint()?.hidden).toBe(true);
  });

  it('ignores messages that are not agent → page hovers', () => {
    fakeChannel.onmessage?.({ data: { to: 'scene', msg: { kind: 'hover', entity: 522 } } });
    expect(hint()?.hidden).toBe(true);
    fakeChannel.onmessage?.({ data: { to: 'page', msg: { kind: 'pick', entity: 522 } } });
    expect(hint()?.hidden).toBe(true);
  });

  it('removes the element and detaches on disconnect', () => {
    hover(522);
    disconnect();
    expect(hint()).toBeNull();
    expect(fakeChannel.onmessage).toBeNull();
  });
});
