import React, { useCallback, useMemo, useState, type ChangeEvent } from 'react';
import type { Entity } from '@dcl/ecs';
import { withSdk, type WithSdkProps } from '../../../../../hoc/withSdk';
import { Block } from '../../../../Block';
import { TextField, Dropdown, ColorField } from '../../../../ui';
import {
  fromNftShape,
  toNftShape,
  isValidInput,
  type UrnTokens,
  getUrn,
  NETWORKS,
  NFT_STYLES,
  buildUrnTokens,
} from '../../../NftShapeInspector/utils';
import { useComponentInput } from '../../../../../hooks/sdk/useComponentInput';

export default React.memo(
  withSdk<WithSdkProps & { entity: Entity }>(({ sdk, entity }) => {
    const { NftShape } = sdk.components;
    const handleInputValidation = useCallback(({ urn }: { urn: string }) => isValidInput(urn), []);
    const [touchedFields, setTouchedFields] = useState({ contract: false, token: false });
    const { getInputProps } = useComponentInput(
      entity,
      NftShape,
      fromNftShape,
      toNftShape,
      handleInputValidation,
    );
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

    const handleFieldBlur = useCallback((field: 'contract' | 'token') => {
      setTouchedFields(prev => ({ ...prev, [field]: true }));
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
          onBlur={() => handleFieldBlur('contract')}
          error={getFieldError('contract')}
          autoSelect
        />
        <TextField
          type="text"
          label="Token ID"
          value={urnTokens.token}
          onChange={e => handleUrnTokenChange({ token: e.target.value })}
          onBlur={() => handleFieldBlur('token')}
          error={getFieldError('token')}
          autoSelect
        />
        <Block label="Background Color">
          <ColorField
            key={`nft-view-color-${color.value?.toString() ?? ''}`}
            {...color}
          />
        </Block>
        <Block label="Frame Type">
          <Dropdown
            options={NFT_STYLES}
            {...style}
          />
        </Block>
      </>
    );
  }),
);
