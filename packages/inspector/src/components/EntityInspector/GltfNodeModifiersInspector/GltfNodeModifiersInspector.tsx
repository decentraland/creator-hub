import React, { useCallback } from 'react';
import type { Entity, PBGltfNodeModifiers } from '@dcl/ecs';

import { withSdk } from '../../../hoc/withSdk';
import { useHasComponent } from '../../../hooks/sdk/useHasComponent';
import { useComponentInput } from '../../../hooks/sdk/useComponentInput';
import { useComponentValue } from '../../../hooks/sdk/useComponentValue';
import { Block } from '../../Block';
import { Container } from '../../Container';
import { CheckboxField, TextField, RangeField, InfoTooltip } from '../../ui';
import { Dropdown } from '../../ui';
import { AddButton } from '../AddButton';
import { type MaterialInput, MaterialType, TextureType } from '../MaterialInspector/types';
import {
  fromMaterial,
  isValidMaterial,
  toMaterial,
  MATERIAL_TYPES,
  TRANSPARENCY_MODES,
} from '../MaterialInspector/utils';
import { useAppSelector } from '../../../redux/hooks';
import { selectAssetCatalog } from '../../../redux/app';
import { ColorField } from '../../ui/ColorField';
import { Texture, type Props as TextureProps } from '../MaterialInspector/Texture';

type Props = { entity: Entity; initialOpen?: boolean };

type SwapInput = {
  path?: string;
  castShadows?: boolean;
  material: MaterialInput;
};

type Input = {
  swaps: SwapInput[];
};

function ensureTextureDefaults(material: MaterialInput): MaterialInput {
  const withDefaults = { ...(material as any) } as any;

  const apply = (key: string) => {
    if (!withDefaults[key]) return; // only apply if field exists
    const tx = withDefaults[key];
    tx.type = tx.type ?? TextureType.TT_TEXTURE;
    tx.wrapMode = tx.wrapMode ?? '0'; // Repeat
    tx.filterMode = tx.filterMode ?? '0'; // Point
    tx.offset = tx.offset ?? { x: '0', y: '0' };
    tx.offset.x = tx.offset.x ?? '0';
    tx.offset.y = tx.offset.y ?? '0';
    tx.tiling = tx.tiling ?? { x: '1', y: '1' };
    tx.tiling.x = tx.tiling.x ?? '1';
    tx.tiling.y = tx.tiling.y ?? '1';
  };

  apply('texture');
  apply('alphaTexture');
  apply('bumpTexture');
  apply('emissiveTexture');

  return withDefaults as MaterialInput;
}

const fromComponent =
  (basePath: string) =>
  (value: PBGltfNodeModifiers): Input => {
    return {
      swaps: (value.modifiers ?? []).map(sw => ({
        path: sw.path || '',
        castShadows: sw.castShadows === undefined ? true : !!sw.castShadows,
        material: ensureTextureDefaults(fromMaterial(basePath)(sw.material as any)),
      })),
    };
  };

function coerceSwaps(input: Input['swaps']): SwapInput[] {
  if (Array.isArray(input)) return input as SwapInput[];
  if (input && typeof input === 'object') {
    const obj = input as any;
    const keys = Object.keys(obj)
      .filter(k => /^\d+$/.test(k))
      .sort((a, b) => Number(a) - Number(b));
    return keys.map(k => obj[k]) as SwapInput[];
  }
  return [] as SwapInput[];
}

const toComponent =
  (basePath: string) =>
  (input: Input): PBGltfNodeModifiers => {
    const swaps = coerceSwaps((input as any).swaps);
    return {
      modifiers: swaps.map(sw => ({
        path: sw.path ?? '',
        castShadows: !!sw.castShadows,
        material: toMaterial(basePath)(sw.material) as any,
      })),
    } as PBGltfNodeModifiers;
  };

const isValidInput = (_input: Input) => isValidMaterial();

export default withSdk<Props>(({ sdk, entity, initialOpen = true }) => {
  const files = useAppSelector(selectAssetCatalog);
  const { GltfNodeModifiers } = sdk.components as any;

  const has = useHasComponent(entity, GltfNodeModifiers);
  const { getInputProps } = useComponentInput(
    entity,
    GltfNodeModifiers,
    fromComponent(files?.basePath ?? ''),
    toComponent(files?.basePath ?? ''),
    isValidInput,
  );

  const [componentValue] = useComponentValue<PBGltfNodeModifiers>(entity, GltfNodeModifiers);

  const handleRemove = useCallback(async () => {
    sdk.operations.removeComponent(entity, GltfNodeModifiers);
    await sdk.operations.dispatch();
  }, [entity, GltfNodeModifiers]);

  // Manage list of swaps locally via nested inputs
  // We rely on nested paths swaps.N to bind fields

  const addSwap = () => {
    const current = componentValue ?? ({ modifiers: [] } as PBGltfNodeModifiers);
    const existing = fromComponent(files?.basePath ?? '')(current).swaps;
    const newSwaps = [
      ...existing,
      {
        path: '',
        castShadows: true,
        material: ensureTextureDefaults({
          type: MaterialType.MT_PBR,
          texture: {
            type: TextureType.TT_TEXTURE,
            src: '',
            wrapMode: '0',
            filterMode: '0',
            offset: { x: '0', y: '0' },
            tiling: { x: '1', y: '1' },
          } as any,
          bumpTexture: {
            type: TextureType.TT_TEXTURE,
            src: '',
            wrapMode: '0',
            filterMode: '0',
            offset: { x: '0', y: '0' },
            tiling: { x: '1', y: '1' },
          } as any,
          emissiveTexture: {
            type: TextureType.TT_TEXTURE,
            src: '',
            wrapMode: '0',
            filterMode: '0',
            offset: { x: '0', y: '0' },
            tiling: { x: '1', y: '1' },
          } as any,
        } as any),
      },
    ];
    getInputProps('swaps').onChange?.({ target: { value: newSwaps } } as any);
  };

  const swapsValue = React.useMemo(() => {
    const current = componentValue ?? ({ modifiers: [] } as PBGltfNodeModifiers);
    return fromComponent(files?.basePath ?? '')(current).swaps;
  }, [componentValue, files]);

  if (!has) return null;

  const removeSwap = (idx: number) => {
    const newSwaps = swapsValue.filter((_, i) => i !== idx);
    getInputProps('swaps').onChange?.({ target: { value: newSwaps } } as any);
  };

  return (
    <Container
      label="Swap Materials"
      className="GltfNodeModifiers"
      initialOpen={initialOpen}
      rightContent={
        <InfoTooltip
          text="Use this component to swap the material of a GLTF or GLB model. You can affect the entire model, or choose individual paths inside the model. See SDK7 docs."
          link="https://docs.decentraland.org/creator/development-guide/sdk7/materials/#modify-gltf-materials"
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
        >
          <Block label="Path (optional)">
            <TextField {...getInputProps(`swaps.${idx}.path`)} />
          </Block>
          <Block label="Cast Shadows">
            <CheckboxField {...getInputProps(`swaps.${idx}.castShadows`, e => e.target.checked)} />
          </Block>
          {/* Reuse Material UI by scoping getInputProps to swaps.idx.material */}
          <MaterialProxy
            getInputPropsPrefix={`swaps.${idx}.material`}
            getInputProps={(
              path: string,
              getter?: (e: React.ChangeEvent<HTMLInputElement>) => any,
            ) => (getInputProps as any)(path, getter)}
            files={files}
          />
          <AddButton onClick={() => removeSwap(idx)}>Remove Swap</AddButton>
        </Container>
      ))}
      <AddButton onClick={addSwap}>Add Material Swap</AddButton>
    </Container>
  );
});

function MaterialProxy({
  getInputPropsPrefix,
  getInputProps,
  files,
}: {
  getInputPropsPrefix: string;
  getInputProps: any;
  files: any;
}) {
  // Minimal wrapper that renders the material UI sections by passing a prefixed getter
  // We render a subset by composing MaterialInspector directly is not trivial; instead replicate fields via its utils
  // To keep the scope small and reuse exactly the same UI, embed MaterialInspector by faking props is non-trivial.
  // For now, reconstruct a concise material UI using MaterialInspector utils may be extensive; prefer render MaterialInspector with composition in future.
  // As a simpler approach, include a minimal set: dropdown for type + textures/colors/intensities mapped by MaterialInspector utils through same getInputProps.

  // Importing MaterialInspector directly as a component expects sdk/entity; we cannot mount it standalone.
  // Therefore, we inline a micro-UI: delegate to fields accessed through getInputProps with prefix.

  const getTextureProps = ((key: string, getter?: any) =>
    getInputProps(`${getInputPropsPrefix}.${key}`, getter)) as TextureProps['getInputProps'];

  const typeProps = getInputProps(`${getInputPropsPrefix}.type`);
  const materialType = typeProps?.value;

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
      <Block>
        <CheckboxField
          label="Cast shadows"
          {...getInputProps(
            `${getInputPropsPrefix}.castShadows`,
            ((e: React.ChangeEvent<HTMLInputElement>) => e.target.checked) as any,
          )}
        />
      </Block>

      {materialType === MaterialType.MT_UNLIT && (
        <Container
          label="Unlit"
          border
          initialOpen={false}
        >
          <Block label="Diffuse color">
            <ColorField {...getInputProps(`${getInputPropsPrefix}.diffuseColor`)} />
          </Block>
          <Block>
            <RangeField
              label="Alpha test"
              max={1}
              step={0.1}
              {...getInputProps(`${getInputPropsPrefix}.alphaTest`)}
            />
          </Block>
          <Texture
            label="Texture"
            texture={TextureType.TT_TEXTURE}
            files={files}
            getInputProps={(k: any, g?: any) => getTextureProps(`texture.${k}`, g)}
          />
          <Texture
            label="Alpha texture"
            texture={TextureType.TT_ALPHA_TEXTURE}
            files={files}
            getInputProps={(k: any, g?: any) => getTextureProps(`alphaTexture.${k}`, g)}
          />
        </Container>
      )}

      {materialType === MaterialType.MT_PBR && (
        <Container
          label="PBR"
          border
          initialOpen={false}
        >
          <Block>
            <RangeField
              label="Metallic"
              max={1}
              step={0.1}
              {...getInputProps(`${getInputPropsPrefix}.metallic`)}
            />
          </Block>
          <Block>
            <RangeField
              label="Roughness"
              max={1}
              step={0.1}
              {...getInputProps(`${getInputPropsPrefix}.roughness`)}
            />
          </Block>
          <Block>
            <ColorField
              label="Color"
              {...getInputProps(`${getInputPropsPrefix}.albedoColor`)}
            />
          </Block>
          <Block>
            <ColorField
              label="Reflectivity color"
              {...getInputProps(`${getInputPropsPrefix}.reflectivityColor`)}
            />
          </Block>
          <Texture
            label="Texture"
            texture={TextureType.TT_TEXTURE}
            files={files}
            getInputProps={(k: any, g?: any) => getTextureProps(`texture.${k}`, g)}
          />
          <Container
            label="Intensity"
            border
            initialOpen={false}
          >
            <RangeField
              label="Specular"
              max={1}
              step={0.1}
              {...getInputProps(`${getInputPropsPrefix}.specularIntensity`)}
            />
            <RangeField
              label="Direct"
              max={1}
              step={0.1}
              {...getInputProps(`${getInputPropsPrefix}.directIntensity`)}
            />
          </Container>
          <Container
            label="Transparency"
            border
            initialOpen={false}
          >
            <Block>
              <Dropdown
                label="Transparency Mode"
                options={TRANSPARENCY_MODES}
                {...getInputProps(`${getInputPropsPrefix}.transparencyMode`)}
              />
            </Block>
            <Block>
              <RangeField
                label="Alpha test"
                max={1}
                step={0.1}
                {...getInputProps(`${getInputPropsPrefix}.alphaTest`)}
              />
            </Block>
          </Container>
          <Container
            label="Emissive"
            border
            initialOpen={false}
          >
            <Block>
              <RangeField
                label="Emissive Intensity"
                max={1}
                step={0.1}
                {...getInputProps(`${getInputPropsPrefix}.emissiveIntensity`)}
              />
            </Block>
            <Block>
              <ColorField
                label="Emissive color"
                {...getInputProps(`${getInputPropsPrefix}.emissiveColor`)}
              />
            </Block>
            <Texture
              label="Emissive texture"
              texture={TextureType.TT_EMISSIVE_TEXTURE}
              files={files}
              getInputProps={(k: any, g?: any) => getTextureProps(`emissiveTexture.${k}`, g)}
            />
          </Container>
          <Texture
            label="Bump texture"
            texture={TextureType.TT_BUMP_TEXTURE}
            files={files}
            getInputProps={(k: any, g?: any) => getTextureProps(`bumpTexture.${k}`, g)}
          />
        </Container>
      )}
    </Container>
  );
}
