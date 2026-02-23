import { useCallback } from 'react';

import { withSdk } from '../../../hoc/withSdk';
import { useHasComponent } from '../../../hooks/sdk/useHasComponent';
import { useComponentInput } from '../../../hooks/sdk/useComponentInput';
import { useAssetOptions } from '../../../hooks/useAssetOptions';
import { Block } from '../../Block';
import { Container } from '../../Container';
import { FileUploadField, InfoTooltip } from '../../ui';
import { ACCEPTED_FILE_TYPES } from '../../ui/FileUploadField/types';
import { useAppSelector } from '../../../redux/hooks';
import { selectAssetCatalog } from '../../../redux/app';
import { fromPlaceholder, toPlaceholder, isValidInput, isModel } from './utils';
import type { Props } from './types';

export default withSdk<Props>(({ sdk, entity, initialOpen = true }) => {
  const files = useAppSelector(selectAssetCatalog);
  const modelOptions = useAssetOptions(ACCEPTED_FILE_TYPES['model']);
  const { Placeholder } = sdk.components;

  const hasPlaceholder = useHasComponent(entity, Placeholder);
  const handleInputValidation = useCallback(
    ({ src }: { src: string }) => !!files && isValidInput(files, src),
    [files],
  );
  const { getInputProps, isValid } = useComponentInput(
    entity,
    Placeholder,
    fromPlaceholder,
    toPlaceholder,
    handleInputValidation,
    [files],
  );

  const handleRemove = useCallback(async () => {
    sdk.operations.removeComponent(entity, Placeholder);
    await sdk.operations.dispatch();
  }, [sdk, entity]);

  const handleDrop = useCallback(async (src: string) => {
    const { operations } = sdk;
    operations.updateValue(Placeholder, entity, { src });
    await operations.dispatch();
  }, []);

  if (!hasPlaceholder) return null;

  return (
    <Container
      label="Placeholder"
      className="GltfInspector"
      initialOpen={initialOpen}
      rightContent={
        <InfoTooltip
          text="Assigns a 3D model to visualize this entity in the editor. Has no effect when the scene runs. Not counted in scene metrics."
          type="help"
        />
      }
      onRemoveContainer={handleRemove}
    >
      <Block>
        <FileUploadField
          {...getInputProps('src')}
          label="Path"
          accept={ACCEPTED_FILE_TYPES['model']}
          options={modelOptions}
          onDrop={handleDrop}
          error={files && !isValid}
          isValidFile={isModel}
        />
      </Block>
    </Container>
  );
});
