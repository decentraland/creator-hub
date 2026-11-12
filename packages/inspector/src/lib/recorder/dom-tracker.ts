import {
  describeElement,
  describePlace,
  findArea,
  findInteractiveTarget,
  isInteractive,
  labelOf,
  visibleText,
  type DescribeContext,
  type ElementDescription,
} from './describe-element';
import { humanizeIdentifier, listWithMore, round, truncate } from './text';
import type { Emit, StopTracker } from './types';

export type DomTrackerOptions = {
  doc: Document;
  emit: Emit;
  ctx?: DescribeContext;
  now?: () => number;
  elementFromPoint?: (x: number, y: number) => Element | null;
  hoverSampleMs?: number;
  hoverDwellMs?: number;
  inputDebounceMs?: number;
  scrollDebounceMs?: number;
};

// The inspector's own popups: native-role menus/listboxes, the ui `Dropdown`'s portalled
// `OptionList`, the `MoreOptionsMenu` popover and react-contexify's context menus.
const MENU_SELECTOR =
  '[role="menu"], [role="listbox"], .OptionList, .MoreOptionsContent, .contexify';
const MENU_ITEM_SELECTOR = '[role="menuitem"], [role="option"], .OptionContainer';
const DIALOG_SELECTOR = '[role="dialog"], .Modal';
const MENU_ITEMS_SHOWN = 6;
const OPENER_WINDOW_MS = 1500;
const VALUE_MAX_LENGTH = 60;
const SPECIAL_KEYS =
  /^(Delete|Backspace|Escape|Enter|F\d{1,2}|ArrowUp|ArrowDown|ArrowLeft|ArrowRight)$/;
const TEXT_EDITING_KEYS = /^(Delete|Backspace|ArrowUp|ArrowDown|ArrowLeft|ArrowRight)$/;
const MODIFIER_KEYS = new Set(['Control', 'Shift', 'Alt', 'Meta', 'AltGraph', 'CapsLock']);
const SECRET_FIELD = /pass(word)?|secret|token|api[-_ ]?key|private[-_ ]?key|mnemonic|seed phrase/i;
const NON_TEXT_INPUTS = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
]);

// `title` reads as 'menu "Add Component"' or 'the context menu of "Barrel_3"'.
type PopupInfo = { title: string; place: string };
type Opener = { label: string; place: string; contextMenu: boolean; t: number };
type HoverCandidate = { key: string; text?: string; desc?: ElementDescription; t: number };

function asElement(target: EventTarget | null): Element | null {
  if (!target) return null;
  if ((target as Node).nodeType === 1) return target as Element;
  return (target as Node).parentElement ?? null;
}

function isTextEditable(el: Element | null): boolean {
  if (!el) return false;
  if (el.tagName === 'TEXTAREA') return true;
  if (el.tagName === 'INPUT') return !NON_TEXT_INPUTS.has((el as HTMLInputElement).type);
  return (el as HTMLElement).isContentEditable === true;
}

function isViewportSurface(el: Element): boolean {
  return (el.tagName === 'CANVAS' || el.tagName === 'IFRAME') && findArea(el) === 'Viewport';
}

function isSecretField(el: Element, label: string): boolean {
  if ((el as HTMLInputElement).type === 'password') return true;
  const hints = [
    label,
    el.getAttribute('name'),
    el.getAttribute('id'),
    el.getAttribute('autocomplete'),
    el.getAttribute('placeholder'),
  ];
  return hints.some(hint => !!hint && SECRET_FIELD.test(hint));
}

function keyCombo(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  if (e.metaKey) parts.push('Cmd');
  const key = e.key === ' ' ? 'Space' : e.key.length === 1 ? e.key.toUpperCase() : e.key;
  parts.push(key);
  return parts.join('+');
}

function fieldValue(el: Element): string {
  if (el.tagName === 'SELECT') {
    const select = el as HTMLSelectElement;
    return select.selectedOptions?.[0]?.textContent?.trim() ?? select.value;
  }
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
    return (el as HTMLInputElement).value;
  }
  return el.textContent ?? '';
}

function popupItems(popup: Element): string[] {
  const items = Array.from(popup.querySelectorAll(MENU_ITEM_SELECTOR)).filter(
    item => !item.classList.contains('header') && !item.classList.contains('disabled'),
  );
  return items.map(item => visibleText(item.querySelector('.Option') ?? item, 40)).filter(Boolean);
}

function dialogName(dialog: Element): string {
  const heading = dialog.querySelector('h1, h2, h3, .title, .Title');
  return (
    dialog.getAttribute('aria-label') ||
    (heading ? visibleText(heading) : '') ||
    visibleText(dialog) ||
    'dialog'
  );
}

/** Captures the user's clicks, typing, shortcuts, scrolling, hovering and popups. */
export function trackDom({
  doc,
  emit,
  ctx = {},
  now = Date.now,
  elementFromPoint = (x, y) => doc.elementFromPoint(x, y),
  hoverSampleMs = 100,
  hoverDwellMs = 200,
  inputDebounceMs = 700,
  scrollDebounceMs = 400,
}: DomTrackerOptions): StopTracker {
  const describe = (el: Element) => describeElement(el, ctx);
  const popups = new WeakMap<Element, PopupInfo>();
  const openDialogs = new Map<Element, string>();
  let opener: Opener | null = null;

  function recentOpener(): Opener | null {
    return opener && now() - opener.t <= OPENER_WINDOW_MS ? opener : null;
  }

  // ---- clicks -------------------------------------------------------------------------

  function popupInfo(popup: Element): PopupInfo {
    const known = popups.get(popup);
    if (known) return known;
    const recent = recentOpener();
    const ownArea = findArea(popup);
    const ownClass = Array.from(popup.classList).find(
      cls => /^[A-Z][A-Za-z]+$/.test(cls) && cls !== 'OptionList' && cls !== 'MoreOptionsContent',
    );
    const place = ownArea ? describePlace(describe(popup)) : (recent?.place ?? '');
    const ariaLabel = popup.getAttribute('aria-label');
    if (!ariaLabel && recent?.contextMenu && recent.label) {
      return { title: `the context menu of "${recent.label}"`, place };
    }
    const name =
      ariaLabel || recent?.label || (ownClass ? humanizeIdentifier(ownClass) : '') || 'menu';
    return { title: `menu "${name}"`, place };
  }

  function onPointerAction(e: MouseEvent) {
    const target = asElement(e.target);
    if (!target) return;
    const position = { x: round(e.clientX, 0), y: round(e.clientY, 0) };

    const popup = target.closest(MENU_SELECTOR);
    const item = popup && target.closest(MENU_ITEM_SELECTOR);
    if (popup && item && e.type === 'click') {
      const info = popupInfo(popup);
      const label = visibleText(item.querySelector('.Option') ?? item) || labelOf(item);
      emit({
        kind: 'menu',
        text: `Chose "${label}" in ${info.title}${info.place}`,
        ...position,
      });
      return;
    }

    const verb =
      e.type === 'dblclick'
        ? 'Double-clicked'
        : e.type === 'contextmenu'
          ? 'Right-clicked'
          : 'Clicked';

    if (isViewportSurface(target)) {
      emit({ kind: e.type, text: `${verb} in the viewport`, area: 'Viewport', ...position });
      return;
    }

    const interactive = findInteractiveTarget(target);
    const desc = describe(interactive);
    const place = describePlace(desc);
    const text = desc.label ? `${verb} "${desc.label}"${place}` : `${verb}${place || ' the page'}`;
    opener = { label: desc.label, place, contextMenu: e.type === 'contextmenu', t: now() };
    emit({
      kind: e.type,
      text,
      ...(desc.area && { area: desc.area }),
      ...(desc.entity && { entity: desc.entity }),
      ...position,
    });
  }

  // ---- typing into fields -------------------------------------------------------------

  const pendingInputs = new Map<Element, ReturnType<typeof setTimeout>>();

  function emitInput(el: Element) {
    pendingInputs.delete(el);
    const desc = describe(el);
    const label = desc.label || 'a field';
    const place = describePlace(desc);
    let text: string;
    if (isSecretField(el, desc.label)) {
      text = `Edited "${label}"${place} (value hidden)`;
    } else if ((el as HTMLInputElement).type === 'checkbox' || el.matches('[role="checkbox"]')) {
      text = `${(el as HTMLInputElement).checked ? 'Checked' : 'Unchecked'} "${label}"${place}`;
    } else {
      const value = truncate(fieldValue(el).trim(), VALUE_MAX_LENGTH);
      text = value ? `Set "${label}" to "${value}"${place}` : `Cleared "${label}"${place}`;
    }
    emit({
      kind: 'input',
      text,
      ...(desc.area && { area: desc.area }),
      ...(desc.entity && { entity: desc.entity }),
    });
  }

  function onInput(e: Event) {
    const el = asElement(e.target);
    if (!el) return;
    clearTimeout(pendingInputs.get(el));
    pendingInputs.set(
      el,
      setTimeout(() => emitInput(el), inputDebounceMs),
    );
  }

  // ---- keyboard shortcuts -------------------------------------------------------------

  function onKeyDown(e: KeyboardEvent) {
    if (e.repeat || MODIFIER_KEYS.has(e.key)) return;
    const withModifier = e.ctrlKey || e.metaKey || e.altKey;
    if (!withModifier && !SPECIAL_KEYS.test(e.key)) return;
    const target = asElement(e.target);
    const editing = isTextEditable(target);
    if (!withModifier && editing && TEXT_EDITING_KEYS.test(e.key)) return;

    const combo = keyCombo(e);
    if (!target || target === doc.body || target === doc.documentElement) {
      emit({ kind: 'key', text: `Pressed ${combo}` });
      return;
    }
    const desc = describe(findInteractiveTarget(target));
    const place = describePlace(desc);
    const text =
      editing && desc.label
        ? `Pressed ${combo} in "${desc.label}"${place}`
        : `Pressed ${combo}${place}`;
    emit({
      kind: 'key',
      text,
      ...(desc.area && { area: desc.area }),
      ...(desc.entity && { entity: desc.entity }),
    });
  }

  // ---- scrolling ----------------------------------------------------------------------

  type ScrollBurst = { timer: ReturnType<typeof setTimeout>; top: number; left: number; t: number };
  const scrollBursts = new Map<Element, ScrollBurst>();
  const lastScroll = new WeakMap<Element, { top: number; left: number }>();

  function emitScroll(el: Element) {
    const burst = scrollBursts.get(el);
    scrollBursts.delete(el);
    if (!burst) return;
    const dy = el.scrollTop - burst.top;
    const dx = el.scrollLeft - burst.left;
    lastScroll.set(el, { top: el.scrollTop, left: el.scrollLeft });
    const vertical = Math.abs(dy) >= Math.abs(dx);
    const direction = vertical ? (dy >= 0 ? 'down' : 'up') : dx >= 0 ? 'right' : 'left';
    const range = vertical ? el.scrollHeight - el.clientHeight : el.scrollWidth - el.clientWidth;
    const offset = vertical ? el.scrollTop : el.scrollLeft;
    const percent = range > 0 ? ` (${Math.round((offset / range) * 100)}%)` : '';
    const area = findArea(el);
    const name = area ?? (labelOf(el) || 'page');
    emit({
      t: burst.t,
      kind: 'scroll',
      text: `Scrolled the ${name} ${direction}${percent}`,
      ...(area && { area }),
    });
  }

  function onScroll(e: Event) {
    const el =
      e.target === doc || e.target === doc.body ? doc.scrollingElement : asElement(e.target);
    if (!el || isTextEditable(el)) return;
    const burst = scrollBursts.get(el);
    if (burst) clearTimeout(burst.timer);
    const start = lastScroll.get(el) ?? { top: el.scrollTop, left: el.scrollLeft };
    scrollBursts.set(el, {
      top: burst?.top ?? start.top,
      left: burst?.left ?? start.left,
      t: burst?.t ?? now(),
      timer: setTimeout(() => emitScroll(el), scrollDebounceMs),
    });
  }

  let wheel: { timer: ReturnType<typeof setTimeout>; delta: number; t: number } | null = null;

  function emitWheel() {
    if (!wheel) return;
    const { delta, t } = wheel;
    wheel = null;
    emit({
      t,
      kind: 'scroll',
      area: 'Viewport',
      text: `Used the mouse wheel over the viewport (${delta < 0 ? 'up' : 'down'})`,
    });
  }

  // Only the viewport: everywhere else a wheel turns into a container `scroll`, recorded above.
  function onWheel(e: WheelEvent) {
    const target = asElement(e.target);
    if (!target || !isViewportSurface(target)) return;
    if (wheel) clearTimeout(wheel.timer);
    wheel = {
      delta: (wheel?.delta ?? 0) + e.deltaY,
      t: wheel?.t ?? now(),
      timer: setTimeout(emitWheel, scrollDebounceMs),
    };
  }

  // ---- hover --------------------------------------------------------------------------

  let pointer: { x: number; y: number } | null = null;
  let sampleTimer: ReturnType<typeof setTimeout> | null = null;
  let dwellTimer: ReturnType<typeof setTimeout> | null = null;
  let candidate: HoverCandidate | null = null;
  let lastHoverKey = '';

  function hoverCandidateAt(x: number, y: number): HoverCandidate {
    const t = now();
    const el = elementFromPoint(x, y);
    if (!el) return { key: 'none', t };
    // The 3D viewport's hover comes from the renderer, which knows the entity under it.
    if (isViewportSurface(el)) return { key: 'viewport', t };
    const target = findInteractiveTarget(el);
    const desc =
      isInteractive(target) || target !== el ? describe(target) : { label: '', area: findArea(el) };
    const place = describePlace(desc);
    if (!desc.label && !place) return { key: 'none', t };
    const text = desc.label
      ? `Pointer over "${desc.label}"${place}`
      : `Pointer over${place.replace(/^ in /, ' ')}`;
    return { key: text, text, desc, t };
  }

  function emitHover() {
    dwellTimer = null;
    if (!candidate?.text || candidate.key === lastHoverKey) return;
    lastHoverKey = candidate.key;
    const { desc } = candidate;
    emit({
      t: candidate.t,
      kind: 'hover',
      text: candidate.text,
      ...(desc?.area && { area: desc.area }),
      ...(desc?.entity && { entity: desc.entity }),
      ...(pointer && { x: pointer.x, y: pointer.y }),
    });
  }

  function sampleHover() {
    sampleTimer = null;
    if (!pointer) return;
    const next = hoverCandidateAt(pointer.x, pointer.y);
    if (next.key === candidate?.key) return;
    candidate = next;
    if (dwellTimer) clearTimeout(dwellTimer);
    dwellTimer = null;
    if (next.text) dwellTimer = setTimeout(emitHover, hoverDwellMs);
    else lastHoverKey = next.key;
  }

  function onPointerMove(e: PointerEvent) {
    pointer = { x: round(e.clientX, 0), y: round(e.clientY, 0) };
    if (!sampleTimer) sampleTimer = setTimeout(sampleHover, hoverSampleMs);
  }

  function onPointerOut(e: PointerEvent) {
    if (e.relatedTarget) return;
    pointer = null;
    candidate = { key: 'outside', t: now() };
    lastHoverKey = 'outside';
    if (dwellTimer) clearTimeout(dwellTimer);
    dwellTimer = null;
  }

  // ---- menus and dialogs --------------------------------------------------------------

  function announcePopup(popup: Element) {
    if (popups.has(popup)) return;
    const info = popupInfo(popup);
    popups.set(popup, info);
    const items = popupItems(popup);
    const list = items.length > 0 ? `: ${listWithMore(items, MENU_ITEMS_SHOWN)}` : '';
    emit({ kind: 'menu', text: `Opened ${info.title}${info.place}${list}` });
  }

  function announceDialog(dialog: Element) {
    if (openDialogs.has(dialog)) return;
    const name = dialogName(dialog);
    openDialogs.set(dialog, name);
    emit({ kind: 'dialog', text: `Opened dialog "${name}"` });
  }

  function matchesIn(node: Element, selector: string): Element[] {
    const found = node.matches(selector) ? [node] : [];
    if (node.firstElementChild) found.push(...Array.from(node.querySelectorAll(selector)));
    return found;
  }

  const observer = new MutationObserver(records => {
    let removed = false;
    for (const record of records) {
      if (record.removedNodes.length > 0) removed = true;
      for (const node of Array.from(record.addedNodes)) {
        if (node.nodeType !== 1) continue;
        const el = node as Element;
        matchesIn(el, DIALOG_SELECTOR).forEach(announceDialog);
        matchesIn(el, MENU_SELECTOR).forEach(announcePopup);
      }
    }
    if (!removed) return;
    for (const [dialog, name] of openDialogs) {
      if (dialog.isConnected) continue;
      openDialogs.delete(dialog);
      emit({ kind: 'dialog', text: `Closed dialog "${name}"` });
    }
  });

  // ---- wiring -------------------------------------------------------------------------

  const capture = { capture: true, passive: true } as const;
  const listeners: Array<[string, EventListener]> = [
    ['click', onPointerAction as EventListener],
    ['dblclick', onPointerAction as EventListener],
    ['contextmenu', onPointerAction as EventListener],
    ['input', onInput],
    ['change', onInput],
    ['keydown', onKeyDown as EventListener],
    ['scroll', onScroll],
    ['wheel', onWheel as EventListener],
    ['pointermove', onPointerMove as EventListener],
    ['pointerout', onPointerOut as EventListener],
  ];
  for (const [type, listener] of listeners) doc.addEventListener(type, listener, capture);
  if (doc.body) observer.observe(doc.body, { childList: true, subtree: true });

  return () => {
    for (const [type, listener] of listeners) doc.removeEventListener(type, listener, capture);
    observer.disconnect();
    if (sampleTimer) clearTimeout(sampleTimer);
    if (dwellTimer) clearTimeout(dwellTimer);
    if (candidate?.text && now() - candidate.t >= hoverDwellMs) emitHover();
    for (const [el, timer] of Array.from(pendingInputs)) {
      clearTimeout(timer);
      emitInput(el);
    }
    for (const [el, burst] of Array.from(scrollBursts)) {
      clearTimeout(burst.timer);
      emitScroll(el);
    }
    if (wheel) {
      clearTimeout(wheel.timer);
      emitWheel();
    }
    candidate = null;
    pointer = null;
  };
}
