import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { getActionPickerState } from '../src/admin-toolkit-ui/utils';

type Field = { type: string; components?: string[]; actionsOf?: string; format?: string };
type ListOf = { item: { fields: Record<string, Field> } & Field };

function shippedLayout() {
  const composite = JSON.parse(
    readFileSync(
      join(__dirname, '../packs/smart_items/assets/admin_toolkit/composite.json'),
      'utf8',
    ),
  );
  const script = composite.components.find(
    (component: { name: string }) => component.name === 'asset-packs::Script',
  );
  const [entry] = (Object.values(script.data)[0] as { json: { value: { layout: string }[] } }).json
    .value;
  return JSON.parse(entry.layout).params;
}

describe('when the Admin Tools item is placed', () => {
  const params = shippedLayout();
  const list = (control: string, key: string): ListOf => params[control].fields[key];

  it('should offer only video screens as video players', () => {
    expect(list('videoControl', 'videoPlayers').item.fields.entity.components).toEqual([
      'asset-packs::VideoScreen',
    ]);
  });

  it('should offer only smart items, and their own actions as the default action', () => {
    const { fields } = list('smartItemsControl', 'smartItems').item;
    expect(fields.entity.components).toEqual(['asset-packs::Actions']);
    expect(fields.defaultAction.actionsOf).toBe('entity');
  });

  it('should offer only reward items as rewards', () => {
    expect(list('rewardsControl', 'rewardItems').item.fields.entity.components).toEqual([
      'asset-packs::Rewards',
    ]);
  });

  it('should edit the admin allow list as wallet addresses', () => {
    expect(list('authorizedAdminUsers', 'adminAllowList').item.format).toBe('wallet');
  });
});

describe('when an admin picks a smart item in the panel', () => {
  it('should keep the action picker closed while no item is picked', () => {
    expect(getActionPickerState(false, 0)).toEqual({
      disabled: true,
      emptyLabel: 'Select action',
    });
  });

  it('should keep the action picker closed, and say why, for an item with no actions', () => {
    expect(getActionPickerState(true, 0)).toEqual({
      disabled: true,
      emptyLabel: 'This item has no actions',
    });
  });

  it('should open the action picker for an item with actions', () => {
    expect(getActionPickerState(true, 3).disabled).toBe(false);
  });
});
