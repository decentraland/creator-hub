import { describeElement, describePlace, findArea, labelOf } from './describe-element';

function mount(html: string): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = html;
  document.body.appendChild(root);
  return root;
}

describe('describeElement', () => {
  let root: HTMLElement;

  afterEach(() => {
    root.remove();
  });

  describe('when the element is a row of the entity tree', () => {
    beforeEach(() => {
      root = mount(`
        <div class="Hierarchy">
          <div class="Tree" data-test-id="520" data-test-label="Barrel_3">
            <div class="item"><div class="item-area">
              <div class="selectable-area"><svg></svg><div>Barrel_3</div></div>
            </div></div>
          </div>
        </div>`);
    });

    it('should name the entity tree area, label the row and attach the entity', () => {
      const el = root.querySelector('.selectable-area')!;
      expect(describeElement(el)).toEqual({
        label: 'Barrel_3',
        area: 'Entity tree',
        entity: { id: 520, name: 'Barrel_3' },
      });
    });
  });

  describe('when the element is a field of a component in the entity inspector', () => {
    beforeEach(() => {
      root = mount(`
        <div class="EntityInspector">
          <div class="Container open">
            <div class="title"><svg></svg><span>Transform</span></div>
            <div class="content">
              <div class="Block">
                <span class="Block-label-row"><label class="Label">Position</label></span>
                <div class="content">
                  <div class="Text Field">
                    <div class="InputContainer">
                      <div class="LeftContent"><label class="Label InputLabel">X</label></div>
                      <input class="input" value="8" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>`);
    });

    it('should combine the block and axis labels and name the component section', () => {
      const input = root.querySelector('input')!;
      const desc = describeElement(input, {
        getInspectedEntity: () => ({ id: 520, name: 'Barrel_3' }),
      });
      expect(desc).toEqual({
        label: 'Position X',
        area: 'Entity inspector',
        section: 'Transform',
        entity: { id: 520, name: 'Barrel_3' },
      });
    });

    it('should describe the place as one readable phrase', () => {
      const input = root.querySelector('input')!;
      const desc = describeElement(input, {
        getInspectedEntity: () => ({ id: 520, name: 'Barrel_3' }),
      });
      expect(describePlace(desc)).toBe(' in the Entity inspector › Transform (Barrel_3 #520)');
    });
  });

  describe('when the entity inspector is showing the scene root', () => {
    beforeEach(() => {
      root = mount('<div class="EntityInspector"><button>Layout</button></div>');
    });

    it('should call the area Scene settings and attach no entity', () => {
      const desc = describeElement(root.querySelector('button')!, {
        getInspectedEntity: () => ({ id: 0, name: 'Scene' }),
      });
      expect(desc).toEqual({ label: 'Layout', area: 'Scene settings' });
    });
  });

  describe('when an icon-only control has no text', () => {
    beforeEach(() => {
      root = mount(`
        <div class="EntityInspector">
          <div class="DropdownContainer AddComponent" role="combobox">
            <div class="AddComponentTrigger"><svg></svg></div>
          </div>
        </div>`);
    });

    it('should fall back to its humanized component class name', () => {
      expect(labelOf(root.querySelector('[role="combobox"]')!)).toBe('Add Component');
    });
  });

  describe('when the element has an aria-label, a title and text', () => {
    beforeEach(() => {
      root = mount(
        '<div class="Toolbar"><button aria-label="Undo" title="Undo (Ctrl+Z)">U</button></div>',
      );
    });

    it('should prefer the aria-label', () => {
      expect(describeElement(root.querySelector('button')!)).toEqual({
        label: 'Undo',
        area: 'Toolbar',
      });
    });
  });

  describe('when the element is a search box of the asset catalog', () => {
    beforeEach(() => {
      root = mount(`
        <div class="Assets"><div class="assets-catalog">
          <div class="Assets-search"><input placeholder="Search" /></div>
        </div></div>`);
    });

    it('should use the placeholder and the innermost area', () => {
      expect(describeElement(root.querySelector('input')!)).toEqual({
        label: 'Search',
        area: 'Asset catalog',
      });
    });
  });

  describe('when the element has a long visible text', () => {
    beforeEach(() => {
      root = mount(`<div class="Toolbar"><button>${'word '.repeat(40)}</button></div>`);
    });

    it('should collapse and truncate the label to 60 characters', () => {
      const { label } = describeElement(root.querySelector('button')!);
      expect(label.length).toBeLessThanOrEqual(60);
      expect(label.endsWith('…')).toBe(true);
    });
  });
});

describe('findArea', () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = mount(`
      <div class="composite-renderer">
        <div class="Toolbar"><button id="b">Play</button></div>
        <div class="Renderer"><canvas id="c"></canvas></div>
      </div>`);
  });

  afterEach(() => root.remove());

  describe('when regions are nested', () => {
    it('should resolve to the nearest one', () => {
      expect(findArea(root.querySelector('#b'))).toBe('Toolbar');
      expect(findArea(root.querySelector('#c'))).toBe('Viewport');
    });
  });

  describe('when the element is outside every known region', () => {
    it('should return undefined', () => {
      expect(findArea(root)).toBeUndefined();
    });
  });
});
