import { useCallback, useMemo } from 'react';
import type { PBGltfNodeModifiers } from '@dcl/ecs';
import { withSdk } from '../../../hoc/withSdk';
import { useHasComponent } from '../../../hooks/sdk/useHasComponent';
import { useComponentInput } from '../../../hooks/sdk/useComponentInput';
import { useComponentValue } from '../../../hooks/sdk/useComponentValue';
import { Block } from '../../Block';
import { Container } from '../../Container';
import { CheckboxField, TextField, InfoTooltip } from '../../ui';
import { Dropdown } from '../../ui';
import { AddButton } from '../AddButton';
import MoreOptionsMenu from '../MoreOptionsMenu';
import { RemoveButton } from '../RemoveButton';
import { type MaterialInput, MaterialType } from '../MaterialInspector/types';
import { MATERIAL_TYPES } from '../MaterialInspector/utils';
import { useAppSelector } from '../../../redux/hooks';
import { selectAssetCatalog } from '../../../redux/app';
import { type Props as TextureProps } from '../MaterialInspector/Texture';
import { UnlitMaterial } from '../MaterialInspector/UnlitMaterial';
import { PbrMaterial } from '../MaterialInspector/PbrMaterial';
import { Texture } from '../MaterialInspector/Texture/types';
import type { Props } from './types';
import { ensureTextureDefaults, fromComponent, isValidInput, toComponent } from './utils';

import './GltfNodeModifiersInspector.css';

export default withSdk<Props>(({ sdk, entity, initialOpen = true }) => {
  const files = useAppSelector(selectAssetCatalog);
  const { GltfNodeModifiers } = sdk.components;

  const hasComponent = useHasComponent(entity, GltfNodeModifiers);
  const { getInputProps } = useComponentInput(
    entity,
    GltfNodeModifiers,
    fromComponent,
    toComponent,
    { validateInput: isValidInput },
  );

  const [componentValue] = useComponentValue<PBGltfNodeModifiers>(entity, GltfNodeModifiers);

  const handleRemove = useCallback(async () => {
    sdk.operations.removeComponent(entity, GltfNodeModifiers);
    await sdk.operations.dispatch();
  }, [entity, GltfNodeModifiers]);

  const addSwap = useCallback(() => {
    const current = componentValue ?? { modifiers: [] };
    const existing = fromComponent(current).swaps;
    const newSwaps = [
      ...existing,
      {
        path: '',
        castShadows: true,
        material: ensureTextureDefaults({
          type: MaterialType.MT_PBR,
          texture: {
            type: Texture.TT_TEXTURE,
            src: '',
            wrapMode: '0',
            filterMode: '0',
            offset: { x: '0', y: '0' },
            tiling: { x: '1', y: '1' },
          },
          bumpTexture: {
            type: Texture.TT_TEXTURE,
            src: '',
            wrapMode: '0',
            filterMode: '0',
            offset: { x: '0', y: '0' },
            tiling: { x: '1', y: '1' },
          },
          emissiveTexture: {
            type: Texture.TT_TEXTURE,
            src: '',
            wrapMode: '0',
            filterMode: '0',
            offset: { x: '0', y: '0' },
            tiling: { x: '1', y: '1' },
          },
        } as MaterialInput),
      },
    ];
    getInputProps('swaps').onChange?.({ target: { value: newSwaps } } as any);
  }, [componentValue, files, getInputProps]);

  const swapsValue = useMemo(() => {
    const current = componentValue ?? { modifiers: [] };
    return fromComponent(current).swaps;
  }, [componentValue, files]);

  const removeSwap = useCallback(
    (idx: number) => {
      const newSwaps = swapsValue.filter((_, i) => i !== idx);
      getInputProps('swaps').onChange?.({ target: { value: newSwaps } } as any);
    },
    [swapsValue, getInputProps],
  );

  if (!hasComponent) return null;

  return (
    <Container
      label="Swap Materials"
      className="GltfNodeModifiers"
      initialOpen={initialOpen}
      rightContent={
        <InfoTooltip
          text="Use this component to swap the material of a GLTF or GLB model. You can affect the entire model, or choose individual paths inside the model. See SDK7 docs."
          link="https://docs.decentraland.org/creator/scenes-sdk7/3d-content-essentials/materials#modify-gltf-materials"
          type="help"
        />
      }
      onRemoveContainer={handleRemove}
    >
      {swapsValue.map((_, idx) => (
        <Container
          key={idx}
          label={`Swap ${idx + 1}`}
          border
          initialOpen={false}
          rightContent={
            <MoreOptionsMenu>
              <div className="RightMenu">
                <RemoveButton onClick={() => removeSwap(idx)}>Remove Material Swap</RemoveButton>
              </div>
            </MoreOptionsMenu>
          }
        >
          <Block label="Path (optional)">
            <TextField {...getInputProps(`swaps.${idx}.path`)} />
          </Block>
          <Block label="Cast Shadows">
            <CheckboxField
              checked={!!getInputProps(`swaps.${idx}.castShadows`).value}
              {...getInputProps(`swaps.${idx}.castShadows`, e => e.target.checked)}
            />
          </Block>
          <MaterialProxy
            getInputPropsPrefix={`swaps.${idx}.material`}
            getInputProps={(
              path: string,
              getter?: (e: React.ChangeEvent<HTMLInputElement>) => any,
            ) => (getInputProps as any)(path, getter)}
          />
        </Container>
      ))}
      <AddButton onClick={addSwap}>Add Material Swap</AddButton>
    </Container>
  );
});

function MaterialProxy({
  getInputPropsPrefix,
  getInputProps,
}: {
  getInputPropsPrefix: string;
  getInputProps: (
    path: string,
    getter?: (event: React.ChangeEvent<HTMLInputElement>) => any,
  ) => any;
}) {
  // Minimal wrapper that renders the material UI sections by passing a prefixed getter
  // Importing MaterialInspector directly as a component expects sdk/entity; we cannot mount it standalone.
  // Therefore, we inline a micro-UI: delegate to fields accessed through getInputProps with prefix.

  const getTextureProps = ((
    key: string,
    getter?: (event: React.ChangeEvent<HTMLInputElement>) => any,
  ) => getInputProps(`${getInputPropsPrefix}.${key}`, getter)) as TextureProps['getInputProps'];

  const typeProps = getInputProps(`${getInputPropsPrefix}.type`);
  const materialType = typeProps?.value;
  const castShadows = getInputProps(
    `${getInputPropsPrefix}.castShadows`,
    (e: React.ChangeEvent<HTMLInputElement>) => e.target.checked,
  );

  return (
    <Container
      label="Material"
      border
      initialOpen={false}
    >
      <Block>
        <Dropdown
          label="Material"
          options={MATERIAL_TYPES}
          {...getInputProps(`${getInputPropsPrefix}.type`)}
        />
      </Block>

      {materialType === MaterialType.MT_UNLIT && (
        <UnlitMaterial
          diffuseColor={getInputProps(`${getInputPropsPrefix}.diffuseColor`)}
          castShadows={castShadows}
          alphaTest={getInputProps(`${getInputPropsPrefix}.alphaTest`)}
          getTextureProps={getTextureProps}
        />
      )}

      {materialType === MaterialType.MT_PBR && (
        <PbrMaterial
          castShadows={castShadows}
          metallic={getInputProps(`${getInputPropsPrefix}.metallic`)}
          roughness={getInputProps(`${getInputPropsPrefix}.roughness`)}
          albedoColor={getInputProps(`${getInputPropsPrefix}.albedoColor`)}
          reflectivityColor={getInputProps(`${getInputPropsPrefix}.reflectivityColor`)}
          specularIntensity={getInputProps(`${getInputPropsPrefix}.specularIntensity`)}
          directIntensity={getInputProps(`${getInputPropsPrefix}.directIntensity`)}
          transparencyMode={getInputProps(`${getInputPropsPrefix}.transparencyMode`)}
          alphaTest={getInputProps(`${getInputPropsPrefix}.alphaTest`)}
          emissiveIntensity={getInputProps(`${getInputPropsPrefix}.emissiveIntensity`)}
          emissiveColor={getInputProps(`${getInputPropsPrefix}.emissiveColor`)}
          getTextureProps={getTextureProps}
        />
      )}
    </Container>
  );
}
