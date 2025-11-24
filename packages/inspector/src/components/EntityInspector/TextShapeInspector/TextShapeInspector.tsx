import { useCallback } from 'react';

import { withSdk } from '../../../hoc/withSdk';
import { useHasComponent } from '../../../hooks/sdk/useHasComponent';
import { useComponentInput } from '../../../hooks/sdk/useComponentInput';
import { Block } from '../../Block';
import { Container } from '../../Container';
import { TextField, CheckboxField, ColorField, Dropdown, TextArea } from '../../ui';
import { fromTextShape, toTextShape, isValidInput, TEXT_ALIGN_MODES } from './utils';
import type { Props } from './types';

export default withSdk<Props>(({ sdk, entity, initialOpen = true }) => {
  const { TextShape } = sdk.components;

  const hasTextShape = useHasComponent(entity, TextShape);
  const { getInputProps } = useComponentInput(
    entity,
    TextShape,
    fromTextShape,
    toTextShape,
    isValidInput,
  );

  const handleRemove = useCallback(async () => {
    sdk.operations.removeComponent(entity, TextShape);
    await sdk.operations.dispatch();
  }, []);

  if (!hasTextShape) return null;

  const fontAutoSize = getInputProps('fontAutoSize', e => e.target.checked);

  return (
    <Container
      label="TextShape"
      className="TextShape"
      initialOpen={initialOpen}
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
