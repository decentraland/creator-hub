import { trackDom } from './dom-tracker';
import type { RecordedEventInput, StopTracker } from './types';

function mount(html: string): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = html;
  document.body.appendChild(root);
  return root;
}

function click(el: Element, type = 'click') {
  el.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: 10, clientY: 20 }));
}

function type(input: HTMLInputElement, value: string) {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function press(el: Element, key: string, init: KeyboardEventInit = {}) {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }));
}

describe('trackDom', () => {
  let root: HTMLElement;
  let emitted: RecordedEventInput[];
  let stop: StopTracker;
  let pointed: Element | null;

  beforeEach(() => {
    vi.useFakeTimers();
    emitted = [];
    pointed = null;
    root = mount(`
      <div class="Hierarchy">
        <div class="Tree" data-test-id="520" data-test-label="Barrel_3">
          <div class="item"><div class="selectable-area"><div>Barrel_3</div></div></div>
        </div>
      </div>
      <div class="EntityInspector">
        <div class="Text Field"><label class="Label">Name</label>
          <div class="InputContainer"><input id="name" value="Barrel_3" /></div>
        </div>
        <div class="Text Field"><label class="Label">API token</label>
          <div class="InputContainer"><input id="token" /></div>
        </div>
        <input id="password" type="password" />
      </div>
      <div class="Renderer"><canvas></canvas></div>`);
    stop = trackDom({
      doc: document,
      emit: event => emitted.push(event),
      ctx: { getInspectedEntity: () => ({ id: 520, name: 'Barrel_3' }) },
      elementFromPoint: () => pointed,
    });
  });

  afterEach(() => {
    stop();
    root.remove();
    vi.useRealTimers();
  });

  describe('when the user clicks an entity tree row', () => {
    beforeEach(() => click(root.querySelector('.selectable-area div')!));

    it('should record what was clicked, where, on which entity and at which point', () => {
      expect(emitted).toEqual([
        {
          kind: 'click',
          text: 'Clicked "Barrel_3" in the Entity tree (Barrel_3 #520)',
          area: 'Entity tree',
          entity: { id: 520, name: 'Barrel_3' },
          x: 10,
          y: 20,
        },
      ]);
    });
  });

  describe('when the user right-clicks the viewport canvas', () => {
    beforeEach(() => click(root.querySelector('canvas')!, 'contextmenu'));

    it('should record it as a viewport click', () => {
      expect(emitted.map(e => [e.kind, e.text])).toEqual([
        ['contextmenu', 'Right-clicked in the viewport'],
      ]);
    });
  });

  describe('when the user types into a field', () => {
    beforeEach(() => {
      const input = root.querySelector<HTMLInputElement>('#name')!;
      type(input, 'B');
      vi.advanceTimersByTime(100);
      type(input, 'Box');
    });

    it('should wait until typing pauses', () => {
      vi.advanceTimersByTime(600);
      expect(emitted).toEqual([]);
    });

    it('should then record the label and the final value once', () => {
      vi.advanceTimersByTime(700);
      expect(emitted).toEqual([
        {
          kind: 'input',
          text: 'Set "Name" to "Box" in the Entity inspector (Barrel_3 #520)',
          area: 'Entity inspector',
          entity: { id: 520, name: 'Barrel_3' },
        },
      ]);
    });
  });

  describe('when the user types into a secret-shaped or password field', () => {
    beforeEach(() => {
      type(root.querySelector<HTMLInputElement>('#token')!, 'sk-example123');
      type(root.querySelector<HTMLInputElement>('#password')!, 'hunter2-example');
      vi.advanceTimersByTime(700);
    });

    it('should never record the value', () => {
      const all = emitted.map(e => e.text).join('\n');
      expect(all).not.toContain('sk-example123');
      expect(all).not.toContain('hunter2-example');
      expect(emitted.every(e => e.text.includes('(value hidden)'))).toBe(true);
    });
  });

  describe('when the user presses keys', () => {
    beforeEach(() => {
      const input = root.querySelector('#name')!;
      press(input, 'a');
      press(input, 'Backspace');
      press(input, 'ArrowLeft');
      press(input, 'Enter');
      press(document.body, 'z', { ctrlKey: true });
      press(root.querySelector('.selectable-area')!, 'Delete');
      press(document.body, 'Shift');
    });

    it('should record only shortcuts and commands, not plain typing', () => {
      expect(emitted.map(e => e.text)).toEqual([
        'Pressed Enter in "Name" in the Entity inspector (Barrel_3 #520)',
        'Pressed Ctrl+Z',
        'Pressed Delete in the Entity tree (Barrel_3 #520)',
      ]);
    });
  });

  describe('when the pointer rests on an element', () => {
    beforeEach(() => {
      pointed = root.querySelector('.selectable-area div');
      document.dispatchEvent(new PointerEvent('pointermove', { clientX: 5, clientY: 6 }));
      vi.advanceTimersByTime(100 + 200);
    });

    it('should record a hover after it stays there', () => {
      expect(emitted).toEqual([
        expect.objectContaining({
          kind: 'hover',
          text: 'Pointer over "Barrel_3" in the Entity tree (Barrel_3 #520)',
          entity: { id: 520, name: 'Barrel_3' },
        }),
      ]);
    });

    describe('and then moves over the 3D viewport', () => {
      beforeEach(() => {
        pointed = root.querySelector('canvas');
        document.dispatchEvent(new PointerEvent('pointermove', { clientX: 50, clientY: 60 }));
        vi.advanceTimersByTime(1_000);
      });

      it('should leave the viewport to the renderer', () => {
        expect(emitted).toHaveLength(1);
      });
    });
  });

  describe('when the pointer only passes over an element', () => {
    beforeEach(() => {
      pointed = root.querySelector('.selectable-area div');
      document.dispatchEvent(new PointerEvent('pointermove', { clientX: 5, clientY: 6 }));
      vi.advanceTimersByTime(150);
      pointed = root.querySelector('canvas');
      document.dispatchEvent(new PointerEvent('pointermove', { clientX: 50, clientY: 60 }));
      vi.advanceTimersByTime(1_000);
    });

    it('should not record a hover', () => {
      expect(emitted).toEqual([]);
    });
  });

  describe('when a menu opens after a click', () => {
    let menu: HTMLElement;

    beforeEach(async () => {
      click(root.querySelector('.selectable-area')!, 'contextmenu');
      emitted = [];
      menu = mount(`
        <div role="menu" class="contexify">
          <div role="menuitem">Rename</div>
          <div role="menuitem">Duplicate</div>
          <div role="menuitem">Delete</div>
        </div>`);
      await vi.advanceTimersByTimeAsync(0);
    });

    afterEach(() => menu.remove());

    it('should record what the menu offers', () => {
      expect(emitted.map(e => [e.kind, e.text])).toEqual([
        [
          'menu',
          'Opened the context menu of "Barrel_3" in the Entity tree (Barrel_3 #520): Rename, Duplicate, Delete',
        ],
      ]);
    });

    describe('and the user picks an item', () => {
      beforeEach(() => {
        emitted = [];
        click(menu.querySelectorAll('[role="menuitem"]')[2]);
      });

      it('should record the choice and the menu it came from', () => {
        expect(emitted.map(e => [e.kind, e.text])).toEqual([
          [
            'menu',
            'Chose "Delete" in the context menu of "Barrel_3" in the Entity tree (Barrel_3 #520)',
          ],
        ]);
      });
    });
  });

  describe('when a dialog opens and closes', () => {
    beforeEach(async () => {
      const dialog = mount(
        '<div role="dialog"><h2>Delete 2 assets?</h2><button>Delete</button></div>',
      );
      await vi.advanceTimersByTimeAsync(0);
      dialog.remove();
      await vi.advanceTimersByTimeAsync(0);
    });

    it('should record both', () => {
      expect(emitted.map(e => [e.kind, e.text])).toEqual([
        ['dialog', 'Opened dialog "Delete 2 assets?"'],
        ['dialog', 'Closed dialog "Delete 2 assets?"'],
      ]);
    });
  });

  describe('when the tracker stops', () => {
    beforeEach(() => {
      type(root.querySelector<HTMLInputElement>('#name')!, 'Crate');
      stop();
    });

    it('should emit the field edit it was still debouncing', () => {
      expect(emitted.map(e => e.text)).toEqual([
        'Set "Name" to "Crate" in the Entity inspector (Barrel_3 #520)',
      ]);
    });

    it('should leave no timers and record nothing afterwards', async () => {
      emitted = [];
      click(root.querySelector('.selectable-area')!);
      press(document.body, 'z', { ctrlKey: true });
      document.dispatchEvent(new PointerEvent('pointermove', { clientX: 1, clientY: 1 }));
      mount('<div role="dialog">Late</div>');
      await vi.advanceTimersByTimeAsync(1_000);
      expect(emitted).toEqual([]);
      expect(vi.getTimerCount()).toBe(0);
    });
  });
});
