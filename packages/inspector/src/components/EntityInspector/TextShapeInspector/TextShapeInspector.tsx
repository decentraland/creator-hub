import { useCallback } from 'react';

import { withSdk } from '../../../hoc/withSdk';
import { useAllEntitiesHaveComponent } from '../../../hooks/sdk/useHasComponent';
import { useMultiComponentInput } from '../../../hooks/sdk/useComponentInput';
import { analytics, Event } from '../../../lib/logic/analytics';
import { CoreComponents } from '../../../lib/sdk/components';
import { Block } from '../../Block';
import { Container } from '../../Container';
import { TextField, CheckboxField, ColorField, Dropdown, TextArea, InfoTooltip } from '../../ui';
import { fromTextShape, toTextShape, isValidInput, TEXT_ALIGN_MODES } from './utils';
import type { Props } from './types';

export default withSdk<Props>(({ sdk, entities, initialOpen = true }) => {
  const { TextShape } = sdk.components;

  const allEntitiesHaveTextShape = useAllEntitiesHaveComponent(entities, TextShape);
  const { getInputProps } = useMultiComponentInput(
    entities,
    TextShape,
    fromTextShape,
    toTextShape,
    isValidInput,
  );

  const handleRemove = useCallback(async () => {
    for (const entity of entities) {
      sdk.operations.removeComponent(entity, TextShape);
    }
    await sdk.operations.dispatch();
    analytics.track(Event.REMOVE_COMPONENT, {
      componentName: CoreComponents.TEXT_SHAPE,
    });
  }, [sdk, entities, TextShape]);

  if (!allEntitiesHaveTextShape) return null;

  const fontAutoSize = getInputProps('fontAutoSize', e => e.target.checked);

  return (
    <Container
      label="TextShape"
      className="TextShape"
      initialOpen={initialOpen}
      rightContent={
        <InfoTooltip
          text="Display text in the 3D space"
          link="https://docs.decentraland.org/creator/scenes-sdk7/3d-content-essentials/text"
          type="help"
        />
      }
      onRemoveContainer={handleRemove}
    >
      <Block>
        <TextArea
          label="Text"
          {...getInputProps('text')}
        />
      </Block>
      <Block>
        <ColorField
          label="Text Color"
          {...getInputProps('textColor')}
        />
      </Block>
      <Block label="Font Size">
        <TextField
          autoSelect
          type="number"
          {...getInputProps('fontSize')}
        />
        <CheckboxField
          label="Font Auto-Size"
          {...fontAutoSize}
          checked={!!fontAutoSize.value}
        />
      </Block>
      <Block label="Text Align">
        <Dropdown
          options={TEXT_ALIGN_MODES}
          {...getInputProps('textAlign')}
        />
      </Block>
      <Block label="Padding">
        <TextField
          autoSelect
          leftLabel="↑"
          type="number"
          {...getInputProps('paddingTop')}
        />
        <TextField
          autoSelect
          leftLabel="→"
          type="number"
          {...getInputProps('paddingRight')}
        />
        <TextField
          autoSelect
          leftLabel="↓"
          type="number"
          {...getInputProps('paddingBottom')}
        />
        <TextField
          autoSelect
          leftLabel="←"
          type="number"
          {...getInputProps('paddingLeft')}
        />
      </Block>
      <Block label="Line">
        <TextField
          autoSelect
          leftLabel="Spacing"
          type="number"
          {...getInputProps('lineSpacing')}
        />
      </Block>
      <Block>
        <TextField
          autoSelect
          label="Outline Width"
          type="number"
          {...getInputProps('outlineWidth')}
        />
      </Block>
      <Block>
        <ColorField
          label="Outline color"
          {...getInputProps('outlineColor')}
        />
      </Block>
    </Container>
  );
});
