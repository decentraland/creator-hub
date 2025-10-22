import React, { useCallback, useMemo } from 'react';
import { type Entity, NftFrameType } from '@dcl/ecs';
import { withSdk, type WithSdkProps } from '../../../../../hoc/withSdk';
import { useHasComponent } from '../../../../../hooks/sdk/useHasComponent';
import { useEntityComponent } from '../../../../../hooks/sdk/useEntityComponent';
import { Block } from '../../../../Block';
import { TextField, Dropdown, ColorField, type DropdownChangeEvent } from '../../../../ui';
import { toColor3 } from '../../../../ui/ColorField/utils';
import { AddButton } from '../../../AddButton';
import {
  fromNftShape,
  toNftShape,
  isValidInput,
  type UrnTokens,
  getUrn,
  isValidUrn,
  NETWORKS,
  NFT_STYLES,
  buildUrnTokens,
} from '../../../NftShapeInspector/utils';
import { useComponentInput } from '../../../../../hooks/sdk/useComponentInput';

export default React.memo(
  withSdk<WithSdkProps & { entity: Entity }>(({ sdk, entity }) => {
    const { NftShape } = sdk.components;
    const { addComponent } = useEntityComponent();
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

    const handleAddComponent = useCallback(async () => {
      sdk.operations.addComponent(entity, NftShape.componentId);
      await sdk.operations.dispatch();
    }, [addComponent, entity, NftShape]);

    if (!hasNftShape) {
      return <AddButton onClick={handleAddComponent}>Add NFT Portrait Component</AddButton>;
    }

    return (
      <>
        <Dropdown
          options={NETWORKS}
          label="Network"
          value={urnTokens.network}
          onChange={e => handleUrnTokenChange({ network: Number(e.target.value) })}
        />
        <TextField
          type="text"
          label="NFT Collection Contract"
          value={urnTokens.contract}
          onChange={e => handleUrnTokenChange({ contract: e.target.value.toLowerCase() })}
          autoSelect
        />
        <TextField
          type="text"
          label="Token ID"
          value={urnTokens.token}
          onChange={e => handleUrnTokenChange({ token: e.target.value })}
          autoSelect
        />
        <Block label="Background Color">
          <ColorField
            key={`nft-view-color-${color.value?.toString() ?? ''}`}
            value={color.value}
            onChange={handleColorChange}
          />
        </Block>
        <Block label="Frame Type">
          <Dropdown
            options={NFT_STYLES}
            value={style.value ?? NftFrameType.NFT_NONE}
            onChange={handleStyleChange}
          />
        </Block>
      </>
    );
  }),
);
