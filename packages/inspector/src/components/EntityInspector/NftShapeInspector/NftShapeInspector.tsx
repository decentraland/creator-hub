import { useCallback, useMemo, useState, type ChangeEvent } from 'react';
import cx from 'classnames';
import { withSdk } from '../../../hoc/withSdk';
import { useHasComponent } from '../../../hooks/sdk/useHasComponent';
import { getComponentValue } from '../../../hooks/sdk/useComponentValue';
import { analytics, Event } from '../../../lib/logic/analytics';
import { getAssetByModel } from '../../../lib/logic/catalog';
import { CoreComponents } from '../../../lib/sdk/components';
import { Block } from '../../Block';
import { Container } from '../../Container';
import { TextField } from '../../ui/TextField';
import { ColorField } from '../../ui/ColorField';
import { Dropdown, InfoTooltip } from '../../ui';
import { useComponentInput } from '../../../hooks/sdk/useComponentInput';
import type { UrnTokens } from './utils';
import {
  fromNftShape,
  toNftShape,
  isValidInput,
  NFT_STYLES,
  NETWORKS,
  getUrn,
  buildUrnTokens,
} from './utils';
import type { Props } from './types';

import './NftShapeInspector.css';

export default withSdk<Props>(({ sdk, entity, initialOpen = true }) => {
  const { NftShape, GltfContainer } = sdk.components;
  const hasNftShape = useHasComponent(entity, NftShape);
  const handleInputValidation = useCallback(({ urn }: { urn: string }) => isValidInput(urn), []);
  const [touchedFields, setTouchedFields] = useState({ contract: false, token: false });
  const { getInputProps } = useComponentInput(entity, NftShape, fromNftShape, toNftShape, {
    validateInput: handleInputValidation,
  });
  const color = getInputProps('color');
  const style = getInputProps('style');
  const urnField = getInputProps('urn');
  const urnValue = urnField.value as string | undefined;
  const urnTokens = useMemo<UrnTokens>(() => buildUrnTokens(urnValue), [urnValue]);

  const getFieldError = useCallback(
    (field: 'contract' | 'token') => {
      if (touchedFields[field] && !urnTokens[field]) {
        return `${field.charAt(0).toUpperCase() + field.slice(1)} is required`;
      }
      return undefined;
    },
    [touchedFields, urnTokens],
  );

  const handleRemove = useCallback(async () => {
    sdk.operations.removeComponent(entity, NftShape);
    await sdk.operations.dispatch();
    const gltfContainer = getComponentValue(entity, GltfContainer);
    const asset = getAssetByModel(gltfContainer.src);
    analytics.track(Event.REMOVE_COMPONENT, {
      componentName: CoreComponents.NFT_SHAPE,
      itemId: asset?.id,
      itemPath: gltfContainer.src,
    });
  }, []);

  const handleUrnTokenChange = useCallback(
    async (tokens: UrnTokens) => {
      const newTokens = { ...urnTokens, ...tokens };
      const urn = getUrn(newTokens);
      if (isValidInput(urn)) {
        urnField?.onChange?.({ target: { value: urn } } as ChangeEvent<HTMLInputElement>);
      }
    },
    [urnTokens],
  );

  const handleFieldBlur = useCallback((field: 'contract' | 'token') => {
    setTouchedFields(prev => ({ ...prev, [field]: true }));
  }, []);

  if (!hasNftShape) return null;

  return (
    <Container
      label="NftShape"
      className={cx('NftShape')}
      initialOpen={initialOpen}
      rightContent={
        <InfoTooltip
          text="NftShape displays an image, gif, or video NFT as a framed picture"
          link="https://docs.decentraland.org/creator/scenes-sdk7/media/display-a-certified-nft"
          type="help"
        />
      }
      onRemoveContainer={handleRemove}
    >
      <Block
        label="Urn"
        className="urn"
      >
        <Dropdown
          options={NETWORKS}
          label="Network"
          value={urnTokens.network}
          onChange={e => handleUrnTokenChange({ network: Number(e.target.value) })}
        />
        <TextField
          type="text"
          label="Contract"
          value={urnTokens.contract}
          onChange={e => handleUrnTokenChange({ contract: e.target.value.toLowerCase() })}
          onBlur={() => handleFieldBlur('contract')}
          error={getFieldError('contract')}
          autoSelect
        />
        <TextField
          type="text"
          label="Token"
          value={urnTokens.token}
          onChange={e => handleUrnTokenChange({ token: e.target.value })}
          onBlur={() => handleFieldBlur('token')}
          error={getFieldError('token')}
          autoSelect
        />
      </Block>
      <Block label="Color">
        <ColorField
          key={`nft-shape-inspector-color-${color.value?.toString() ?? ''}`}
          {...color}
        />
      </Block>
      <Block label="Frame style">
        <Dropdown
          options={NFT_STYLES}
          {...style}
        />
      </Block>
    </Container>
  );
});
