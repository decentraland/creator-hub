import { recording } from '#preload';
import type { RecordedEvent } from '/shared/types/recording';

// The renderer's handle on the running recording: which session events belong to, and the relay
// both event sources go through — the inspector iframe (scene RPC `record_events`) and the
// Creator Hub's own window (below). Nothing is forwarded while no recording runs.

let activeSessionId: string | null = null;

export function setActiveRecordingSession(sessionId: string | null): void {
  activeSessionId = sessionId;
}

export function getActiveRecordingSession(): string | null {
  return activeSessionId;
}

export function forwardRecordedEvents(events: RecordedEvent[]): void {
  if (activeSessionId === null || events.length === 0) return;
  recording.sendEvents(activeSessionId, events);
}

const MAX_LABEL = 60;

function collapse(text: string | null | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_LABEL);
}

// A label for what was clicked in the Creator Hub window: the closest element that names itself.
export function describeHubElement(target: Element): string {
  const named = target.closest(
    '[aria-label], [title], button, a, [role="button"], [role="menuitem"]',
  );
  const el = named ?? target;
  const label =
    collapse(el.getAttribute('aria-label')) ||
    collapse(el.getAttribute('title')) ||
    collapse(el.textContent) ||
    testIdLabel(target);
  return label || el.tagName.toLowerCase();
}

// Last resort for an unlabelled control: its test id, made readable ("editor-page-back-button"
// → "editor page back button"). MUI icons carry their own test id ("ArrowBackIosIcon"), which
// names the glyph, not the control, so they are skipped.
function testIdLabel(target: Element): string {
  for (let el: Element | null = target; el; el = el.parentElement) {
    const id = el.getAttribute('data-testid');
    if (id && !(el instanceof SVGElement)) return collapse(id.replace(/[-_]+/g, ' '));
  }
  return '';
}

export function hubArea(target: Element): string {
  const tagged = target.closest('[data-recording-area]');
  if (tagged) return tagged.getAttribute('data-recording-area') ?? 'Creator Hub';
  if (target.closest('.Header')) return 'Editor header';
  if (target.closest('[role="dialog"]')) return 'Dialog';
  if (target.closest('[role="menu"], [role="listbox"]')) return 'Menu';
  return 'Creator Hub';
}

const SHORTCUT_KEYS = new Set(['Escape', 'Enter', 'Delete', 'Backspace']);

function isTextField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target.tagName === 'TEXTAREA' || target.tagName === 'INPUT';
}

function shortcutName(e: KeyboardEvent): string | null {
  const modified = e.metaKey || e.ctrlKey || e.altKey;
  if (!modified && !SHORTCUT_KEYS.has(e.key) && !/^F\d+$/.test(e.key)) return null;
  if (!modified && isTextField(e.target) && e.key !== 'Escape') return null;
  if (['Meta', 'Control', 'Alt', 'Shift'].includes(e.key)) return null;
  const parts = [e.ctrlKey && 'Ctrl', e.metaKey && 'Cmd', e.altKey && 'Alt', e.shiftKey && 'Shift'];
  return [...parts.filter(Boolean), e.key.length === 1 ? e.key.toUpperCase() : e.key].join('+');
}

// Clicks and shortcuts in the Creator Hub window itself (header buttons, dialogs, the assistant
// panel). The inspector's iframe records its own; its events never reach this document.
export function startHubDomRecorder(doc: Document = document): () => void {
  const onClick = (e: MouseEvent) => {
    if (!(e.target instanceof Element) || e.target.closest('[data-recording-ignore]')) return;
    forwardRecordedEvents([
      {
        t: Date.now(),
        kind: 'click',
        text: `Clicked "${describeHubElement(e.target)}" in the ${hubArea(e.target)}`,
        area: hubArea(e.target),
        x: e.clientX,
        y: e.clientY,
      },
    ]);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    const name = shortcutName(e);
    if (!name) return;
    const area = e.target instanceof Element ? hubArea(e.target) : 'Creator Hub';
    forwardRecordedEvents([
      { t: Date.now(), kind: 'key', text: `Pressed ${name} in the ${area}`, area },
    ]);
  };
  doc.addEventListener('click', onClick, true);
  doc.addEventListener('keydown', onKeyDown, true);
  return () => {
    doc.removeEventListener('click', onClick, true);
    doc.removeEventListener('keydown', onKeyDown, true);
  };
}
