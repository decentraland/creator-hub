import { describe, expect, it } from 'vitest';

import { editUiPropertyEvent } from './edit-event';

describe('editUiPropertyEvent', () => {
  it('should derive the property key from the component and first patch key', () => {
    expect(editUiPropertyEvent('core::UiTransform', { maxWidth: 100 })).toEqual({
      property: 'core::UiTransform:maxWidth',
    });
  });

  it('should use the first key for a multi-key patch (e.g. a border write-all)', () => {
    const event = editUiPropertyEvent('core::UiTransform', {
      borderTopColor: {},
      borderRightColor: {},
    });

    expect(event.property).toBe('core::UiTransform:borderTopColor');
  });

  it('should attach the interaction layer when one is active', () => {
    expect(editUiPropertyEvent('core::UiBackground', { color: {} }, 'hover')).toEqual({
      property: 'core::UiBackground:color',
      interactionLayer: 'hover',
    });
  });

  it('should omit the interaction layer when none is active', () => {
    expect(editUiPropertyEvent('core::UiBackground', { color: {} })).not.toHaveProperty(
      'interactionLayer',
    );
  });
});
