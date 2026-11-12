import { collapseWhitespace, humanizeIdentifier, truncate } from './text';
import type { EntityRef } from './types';

export type ElementDescription = {
  /** What the user would call the element ('' when nothing usable was found). */
  label: string;
  area?: string;
  /** The component section of the Entity inspector the element sits in, e.g. 'Transform'. */
  section?: string;
  entity?: EntityRef;
};

export type DescribeContext = {
  /** The entity the Entity inspector is showing, i.e. the first selected one. */
  getInspectedEntity?: () => EntityRef | undefined;
};

const MAX_LABEL_LENGTH = 60;

// Nearest match wins, so nested regions (the Toolbar inside the viewport column, the
// catalog inside the Assets panel) resolve to the inner, more specific name.
export const AREAS: ReadonlyArray<readonly [selector: string, name: string]> = [
  ['.Hierarchy', 'Entity tree'],
  ['.ui-designer-left-rail', 'UI layers'],
  ['.ModeSwitcher', 'Mode switcher'],
  ['.EntityInspector', 'Entity inspector'],
  ['.ui-designer-right-rail', 'UI properties'],
  ['.SceneInfoPanel', 'Scene info'],
  ['.Toolbar', 'Toolbar'],
  ['.Renderer', 'Viewport'],
  ['.ui-designer-canvas-container', 'UI canvas'],
  ['.ui-designer-palette', 'UI palette'],
  ['.DebugConsole', 'Console'],
  ['.MobileDebugSession', 'Mobile debug'],
  ['.assets-catalog', 'Asset catalog'],
  ['.ProjectView', 'Local assets'],
  ['.custom-assets-browser, .custom-assets-empty', 'Custom items'],
  ['.RenameAsset', 'Rename asset'],
  ['.CreateCustomAsset', 'Create custom item'],
  ['.Assets', 'Assets panel'],
  ['.Modal, [role="dialog"]', 'Dialog'],
];

const ANY_AREA = AREAS.map(([selector]) => selector).join(', ');

const INTERACTIVE = [
  'button',
  'a[href]',
  'input',
  'select',
  'textarea',
  'label',
  'summary',
  '[role="button"]',
  '[role="tab"]',
  '[role="menuitem"]',
  '[role="option"]',
  '[role="combobox"]',
  '[role="checkbox"]',
  '[role="switch"]',
  '[role="treeitem"]',
  '[contenteditable="true"]',
  '.OptionContainer',
  '.contexify_item',
  '.selectable-area',
  '.Container > .title',
  '.tab',
  '.assets-catalog-asset',
  '.custom-asset-item',
  '[title]',
  '[aria-label]',
  '[data-test-label]',
].join(', ');

const MAX_INTERACTIVE_DEPTH = 8;

// Wrapper/state class names that say nothing about what the element is.
const GENERIC_CLASSES = new Set([
  'Button',
  'Field',
  'Text',
  'Block',
  'Container',
  'Tree',
  'InputContainer',
  'LeftContent',
  'RightContent',
  'OptionContent',
  'OptionContainer',
  'Option',
  'Dropdown',
  'DropdownContainer',
  'Label',
  'OptionList',
  'MoreOptionsContent',
]);

export function findArea(el: Element | null): string | undefined {
  for (let node = el; node; node = node.parentElement) {
    if (!node.matches(ANY_AREA)) continue;
    const match = AREAS.find(([selector]) => node!.matches(selector));
    if (match) return match[1];
  }
  return undefined;
}

/** The element the user meant: the nearest interactive or labelled ancestor, or `el` itself. */
export function findInteractiveTarget(el: Element): Element {
  let node: Element | null = el;
  for (let depth = 0; node && depth < MAX_INTERACTIVE_DEPTH; depth++) {
    if (node.matches(INTERACTIVE)) return node;
    node = node.parentElement;
  }
  return el;
}

export function isInteractive(el: Element): boolean {
  return el.matches(INTERACTIVE);
}

export function visibleText(el: Element, max = MAX_LABEL_LENGTH): string {
  // A bounded walk instead of `textContent`: a click on a panel background would
  // otherwise serialize the whole panel just to throw most of it away.
  const doc = el.ownerDocument;
  const walker = doc.createTreeWalker(el, 4 /* NodeFilter.SHOW_TEXT */);
  let text = '';
  while (text.length <= max * 2 && walker.nextNode()) {
    const parent = walker.currentNode.parentElement;
    if (parent && (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE')) continue;
    text += ` ${walker.currentNode.nodeValue ?? ''}`;
  }
  return truncate(collapseWhitespace(text), max);
}

function childWithClass(el: Element | null, className: string): Element | undefined {
  if (!el) return undefined;
  return Array.from(el.children).find(child => child.classList.contains(className));
}

function textOf(el: Element | null | undefined): string {
  return el ? collapseWhitespace(el.textContent ?? '') : '';
}

function isFormControl(el: Element): boolean {
  return ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName) || el.matches('[role="combobox"]');
}

/** The label of a form control: native `<label>`s, then the inspector's Block/Field/InputLabel. */
export function fieldLabel(el: Element): string {
  const parts: string[] = [];
  const add = (text: string) => {
    if (text && !parts.includes(text)) parts.push(text);
  };
  const native = (el as HTMLInputElement).labels;
  if (native && native.length > 0) add(textOf(native[0]));
  else add(textOf(el.closest('label')));

  const block = el.closest('.Block');
  add(textOf(childWithClass(childWithClass(block, 'Block-label-row') ?? null, 'Label')));
  const field = el.closest('.Field');
  add(textOf(childWithClass(field, 'Label')));
  add(textOf(el.closest('.InputContainer')?.querySelector('.InputLabel')));
  return parts.join(' ');
}

function ariaLabelledBy(el: Element): string {
  const ids = el.getAttribute('aria-labelledby');
  if (!ids) return '';
  return ids
    .split(/\s+/)
    .map(id => textOf(el.ownerDocument.getElementById(id)))
    .filter(Boolean)
    .join(' ');
}

function humanizedClass(el: Element): string {
  let node: Element | null = el;
  for (let depth = 0; node && depth < 3; depth++) {
    for (const cls of Array.from(node.classList)) {
      if (/^[A-Z][A-Za-z]+$/.test(cls) && !GENERIC_CLASSES.has(cls)) return humanizeIdentifier(cls);
    }
    node = node.parentElement;
  }
  return '';
}

function nearestTestLabel(el: Element): string {
  let node: Element | null = el;
  for (let depth = 0; node && depth < 5; depth++) {
    const label = node.getAttribute('data-test-label');
    if (label) return label;
    node = node.parentElement;
  }
  return '';
}

export function labelOf(el: Element): string {
  const candidates: Array<() => string | null | undefined> = [
    () => el.getAttribute('aria-label'),
    () => ariaLabelledBy(el),
    () => el.getAttribute('title'),
    () => el.getAttribute('alt'),
    () => (isFormControl(el) ? fieldLabel(el) : ''),
    () => el.getAttribute('placeholder'),
    () => el.getAttribute('data-test-label'),
    () => (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' ? '' : visibleText(el)),
    () => nearestTestLabel(el),
    () => textOf(el.querySelector('svg title')),
    () => humanizedClass(el),
    () => el.getAttribute('data-testid') ?? el.getAttribute('data-test-id'),
  ];
  for (const candidate of candidates) {
    const label = collapseWhitespace(candidate() ?? '');
    if (label) return truncate(label, MAX_LABEL_LENGTH);
  }
  return '';
}

function treeRowEntity(el: Element): EntityRef | undefined {
  const row = el.closest('.Tree[data-test-id]');
  const id = Number(row?.getAttribute('data-test-id'));
  if (!row || !Number.isInteger(id)) return undefined;
  const name = row.getAttribute('data-test-label') ?? undefined;
  return name ? { id, name } : { id };
}

function inspectorSection(el: Element): string | undefined {
  const container = el.closest('.Container');
  const title = childWithClass(container, 'title');
  const text = textOf(title?.querySelector('span'));
  return text ? truncate(text, MAX_LABEL_LENGTH) : undefined;
}

export function describeElement(el: Element, ctx: DescribeContext = {}): ElementDescription {
  let area = findArea(el);
  let entity: EntityRef | undefined;
  let section: string | undefined;

  if (area === 'Entity tree') {
    entity = treeRowEntity(el);
  } else if (area === 'Entity inspector') {
    entity = ctx.getInspectedEntity?.();
    section = inspectorSection(el);
    if (entity?.id === 0) {
      area = 'Scene settings';
      entity = undefined;
    }
  } else if (area === 'UI properties') {
    section = inspectorSection(el);
  }

  return {
    label: labelOf(el),
    ...(area && { area }),
    ...(section && { section }),
    ...(entity && { entity }),
  };
}

/** ' in the Entity inspector › Transform (Barrel_3 #520)' — the "where" half of an event line. */
export function describePlace(desc: Omit<ElementDescription, 'label'>): string {
  let place = '';
  if (desc.area) place += desc.area === 'Dialog' ? ' in a dialog' : ` in the ${desc.area}`;
  if (desc.section) place += ` › ${desc.section}`;
  if (desc.entity) place += ` (${desc.entity.name || 'Entity'} #${desc.entity.id})`;
  return place;
}
