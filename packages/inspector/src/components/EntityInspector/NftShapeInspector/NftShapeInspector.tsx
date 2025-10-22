import { useCallback, useMemo } from 'react';
import cx from 'classnames';
import { NftFrameType } from '@dcl/ecs';
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
import { Dropdown, type DropdownChangeEvent, InfoTooltip } from '../../ui';
import { toColor3 } from '../../ui/ColorField/utils';
import { useComponentInput } from '../../../hooks/sdk/useComponentInput';
import type { UrnTokens } from './utils';
import {
  fromNftShape,
  toNftShape,
  isValidInput,
  NFT_STYLES,
  NETWORKS,
  isValidUrn,
  getUrn,
  buildUrnTokens,
} from './utils';
import type { Props } from './types';

import './NftShapeInspector.css';

export default withSdk<Props>(({ sdk, entity, initialOpen = true }) => {
  const { NftShape, GltfContainer } = sdk.components;
  const hasNftShape = useHasComponent(entity, NftShape);
  const handleInputValidation = useCallback(({ urn }: { urn: string }) => isValidInput(urn), []);
  const { getInputProps } = useComponentInput(
    entity,
    NftShape,
    fromNftShape,
    toNftShape,
    handleInputValidation,
  );
  const color = getInputProps('color');
  const style = getInputProps('style');
  const urnValue = getInputProps('urn').value as string | undefined;
  const urnTokens = useMemo<UrnTokens>(() => buildUrnTokens(urnValue), [urnValue]);

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
      if (isValidUrn(urn)) {
        sdk.operations.updateValue(NftShape, entity, { ...NftShape.get(entity), urn });
        await sdk.operations.dispatch();
      }
    },
    [urnTokens],
  );

  const handleColorChange = useCallback(
    async ({ target: { value } }: React.ChangeEvent<HTMLInputElement>) => {
      sdk.operations.updateValue(NftShape, entity, {
        ...NftShape.get(entity),
        color: toColor3(value),
      });
      await sdk.operations.dispatch();
    },
    [],
  );

  const handleStyleChange = useCallback(async ({ target: { value } }: DropdownChangeEvent) => {
    const style = Number(value) as NftFrameType;
    sdk.operations.updateValue(NftShape, entity, {
      ...NftShape.get(entity),
      style,
    });
    await sdk.operations.dispatch();
  }, []);

  if (!hasNftShape) return null;

  return (
    <Container
      label="NftShape"
      className={cx('NftShape')}
      initialOpen={initialOpen}
      rightContent={
        <InfoTooltip
          text="URN structure: urn:decentraland:<CHAIN>:<CONTRACT_STANDARD>:<CONTRACT_ADDRESS>:<TOKEN_ID>."
          link="https://docs.decentraland.org/creator/development-guide/sdk7/display-a-certified-nft/#add-an-nft"
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
          autoSelect
        />
        <TextField
          type="text"
          label="Token"
          value={urnTokens.token}
          onChange={e => handleUrnTokenChange({ token: e.target.value })}
          autoSelect
        />
      </Block>
      <Block label="Color">
        <ColorField
          key={`nft-shape-inspector-color-${color.value?.toString() ?? ''}`}
          value={color.value}
          onChange={handleColorChange}
        />
      </Block>
      <Block label="Frame style">
        <Dropdown
          options={NFT_STYLES}
          value={style.value ?? NftFrameType.NFT_NONE}
          onChange={handleStyleChange}
        />
      </Block>
    </Container>
  );
});
