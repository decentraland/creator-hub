import { useCallback } from 'react';

import { withSdk } from '../../../hoc/withSdk';
import { useAllEntitiesHaveComponent } from '../../../hooks/sdk/useHasComponent';
import { useMultiComponentInput } from '../../../hooks/sdk/useComponentInput';
import { useAssetOptions } from '../../../hooks/useAssetOptions';
import { analytics, Event } from '../../../lib/logic/analytics';
import { getAssetByModel } from '../../../lib/logic/catalog';
import { CoreComponents } from '../../../lib/sdk/components';
import { Block } from '../../Block';
import { Container } from '../../Container';
import {
  CheckboxField,
  Dropdown,
  TextField,
  RangeField,
  InfoTooltip,
  FileUploadField,
} from '../../ui';
import { ColorField } from '../../ui/ColorField';
import { ACCEPTED_FILE_TYPES } from '../../ui/FileUploadField/types';
import type { Props } from './types';
import {
  ShapeType,
  SHAPE_TYPE_OPTIONS,
  BLEND_MODE_OPTIONS,
  PLAYBACK_STATE_OPTIONS,
  SIMULATION_SPACE_OPTIONS,
} from './types';
import { fromComponent, toComponent, isValidInput } from './utils';

export default withSdk<Props>(({ sdk, entities, initialOpen = true }) => {
  const { ParticleSystem, GltfContainer } = sdk.components;

  const imageOptions = useAssetOptions(ACCEPTED_FILE_TYPES['image']);
  const allEntitiesHaveParticleSystem = useAllEntitiesHaveComponent(entities, ParticleSystem);
  const { getInputProps } = useMultiComponentInput(
    entities,
    ParticleSystem,
    fromComponent,
    toComponent,
    { validateInput: isValidInput },
  );

  const handleRemove = useCallback(async () => {
    for (const entity of entities) {
      sdk.operations.removeComponent(entity, ParticleSystem);
    }
    await sdk.operations.dispatch();

    const gltfContainer = GltfContainer.getOrNull(entities[0]);
    const asset = gltfContainer ? getAssetByModel(gltfContainer.src) : undefined;
    analytics.track(Event.REMOVE_COMPONENT, {
      componentName: CoreComponents.PARTICLE_SYSTEM,
      itemId: asset?.id,
      itemPath: gltfContainer?.src,
    });
  }, [sdk, entities, ParticleSystem, GltfContainer]);

  if (!allEntitiesHaveParticleSystem) return null;

  const active = getInputProps('active', e => e.target.checked);
  const billboard = getInputProps('billboard', e => e.target.checked);
  const faceTravelDirection = getInputProps('faceTravelDirection', e => e.target.checked);
  const loop = getInputProps('loop', e => e.target.checked);
  const prewarm = getInputProps('prewarm', e => e.target.checked);
  const textureEnabled = getInputProps('textureEnabled', e => e.target.checked);
  const spriteSheetEnabled = getInputProps('spriteSheetEnabled', e => e.target.checked);
  const shapeType = getInputProps('shapeType');
  const currentShape = Number(shapeType.value);

  return (
    <Container
      label="Particle System"
      className="ParticleSystem"
      initialOpen={initialOpen}
      rightContent={
        <InfoTooltip
          text="Create dynamic visual effects by emitting and animating particles."
          type="help"
        />
      }
      onRemoveContainer={handleRemove}
    >
      <Block label="Active">
        <CheckboxField
          checked={!!active.value}
          {...active}
        />
      </Block>
      <Block>
        <Dropdown
          label="Playback"
          options={PLAYBACK_STATE_OPTIONS}
          {...getInputProps('playbackState')}
        />
      </Block>

      {/* Emitter Shape */}
      <Container
        label="Emitter Shape"
        border
        initialOpen
      >
        <Block>
          <Dropdown
            label="Shape"
            options={SHAPE_TYPE_OPTIONS}
            {...shapeType}
          />
        </Block>
        {currentShape === ShapeType.SPHERE && (
          <Block label="Radius">
            <TextField
              type="number"
              {...(getInputProps as any)('sphere.radius')}
              autoSelect
            />
          </Block>
        )}
        {currentShape === ShapeType.CONE && (
          <>
            <Block label="Angle">
              <RangeField
                min={0}
                max={90}
                step={1}
                {...(getInputProps as any)('cone.angle')}
              />
            </Block>
            <Block label="Radius">
              <TextField
                type="number"
                {...(getInputProps as any)('cone.radius')}
                autoSelect
              />
            </Block>
          </>
        )}
        {currentShape === ShapeType.BOX && (
          <Block label="Size">
            <TextField
              leftLabel="X"
              type="number"
              {...(getInputProps as any)('box.x')}
              autoSelect
            />
            <TextField
              leftLabel="Y"
              type="number"
              {...(getInputProps as any)('box.y')}
              autoSelect
            />
            <TextField
              leftLabel="Z"
              type="number"
              {...(getInputProps as any)('box.z')}
              autoSelect
            />
          </Block>
        )}
      </Container>

      {/* Emission */}
      <Container
        label="Emission"
        border
        initialOpen={false}
      >
        <Block label="Rate (particles/sec)">
          <TextField
            type="number"
            {...getInputProps('rate')}
            autoSelect
          />
        </Block>
        <Block label="Max Particles">
          <TextField
            type="number"
            {...getInputProps('maxParticles')}
            autoSelect
          />
        </Block>
        <Block label="Lifetime (sec)">
          <TextField
            type="number"
            {...getInputProps('lifetime')}
            autoSelect
          />
        </Block>
        <Block label="Loop">
          <CheckboxField
            checked={!!loop.value}
            {...loop}
          />
        </Block>
        <Block label="Prewarm">
          <CheckboxField
            checked={!!prewarm.value}
            {...prewarm}
          />
        </Block>
      </Container>

      {/* Motion */}
      <Container
        label="Motion"
        border
        initialOpen={false}
      >
        <Block label="Gravity">
          <TextField
            type="number"
            {...getInputProps('gravity')}
            autoSelect
          />
        </Block>
        <Block label="Additional Force">
          <TextField
            leftLabel="X"
            type="number"
            {...(getInputProps as any)('additionalForce.x')}
            autoSelect
          />
          <TextField
            leftLabel="Y"
            type="number"
            {...(getInputProps as any)('additionalForce.y')}
            autoSelect
          />
          <TextField
            leftLabel="Z"
            type="number"
            {...(getInputProps as any)('additionalForce.z')}
            autoSelect
          />
        </Block>
        <Block label="Initial Speed">
          <TextField
            leftLabel="Min"
            type="number"
            {...(getInputProps as any)('initialVelocitySpeed.min')}
            autoSelect
          />
          <TextField
            leftLabel="Max"
            type="number"
            {...(getInputProps as any)('initialVelocitySpeed.max')}
            autoSelect
          />
        </Block>
        <Block>
          <Dropdown
            label="Simulation Space"
            options={SIMULATION_SPACE_OPTIONS}
            {...getInputProps('simulationSpace')}
          />
        </Block>
        <Container
          label="Limit Velocity"
          border
          initialOpen={false}
        >
          <Block label="Max Speed">
            <TextField
              type="number"
              {...(getInputProps as any)('limitVelocity.speed')}
              autoSelect
            />
          </Block>
          <Block label="Dampen">
            <RangeField
              min={0}
              max={1}
              step={0.01}
              {...(getInputProps as any)('limitVelocity.dampen')}
            />
          </Block>
        </Container>
      </Container>

      {/* Size */}
      <Container
        label="Size"
        border
        initialOpen={false}
      >
        <Block label="Initial Size">
          <TextField
            leftLabel="Min"
            type="number"
            {...(getInputProps as any)('initialSize.min')}
            autoSelect
          />
          <TextField
            leftLabel="Max"
            type="number"
            {...(getInputProps as any)('initialSize.max')}
            autoSelect
          />
        </Block>
        <Block label="Size Over Time">
          <TextField
            leftLabel="Min"
            type="number"
            {...(getInputProps as any)('sizeOverTime.min')}
            autoSelect
          />
          <TextField
            leftLabel="Max"
            type="number"
            {...(getInputProps as any)('sizeOverTime.max')}
            autoSelect
          />
        </Block>
      </Container>

      {/* Color */}
      <Container
        label="Color"
        border
        initialOpen={false}
      >
        <Block label="Initial Color From">
          <ColorField {...(getInputProps as any)('initialColor.from')} />
        </Block>
        <Block label="Alpha">
          <RangeField
            min={0}
            max={1}
            step={0.01}
            {...(getInputProps as any)('initialColor.fromAlpha')}
          />
        </Block>
        <Block label="Initial Color To">
          <ColorField {...(getInputProps as any)('initialColor.to')} />
        </Block>
        <Block label="Alpha">
          <RangeField
            min={0}
            max={1}
            step={0.01}
            {...(getInputProps as any)('initialColor.toAlpha')}
          />
        </Block>
        <Block label="Color Over Time From">
          <ColorField {...(getInputProps as any)('colorOverTime.from')} />
        </Block>
        <Block label="Alpha">
          <RangeField
            min={0}
            max={1}
            step={0.01}
            {...(getInputProps as any)('colorOverTime.fromAlpha')}
          />
        </Block>
        <Block label="Color Over Time To">
          <ColorField {...(getInputProps as any)('colorOverTime.to')} />
        </Block>
        <Block label="Alpha">
          <RangeField
            min={0}
            max={1}
            step={0.01}
            {...(getInputProps as any)('colorOverTime.toAlpha')}
          />
        </Block>
      </Container>

      {/* Rendering */}
      <Container
        label="Rendering"
        border
        initialOpen={false}
      >
        <Block label="Use Texture">
          <CheckboxField
            checked={!!textureEnabled.value}
            {...textureEnabled}
          />
        </Block>
        {!!textureEnabled.value && (
          <Block label="Texture Path">
            <FileUploadField
              label="Path"
              accept={ACCEPTED_FILE_TYPES['image']}
              options={imageOptions}
              {...(getInputProps as any)('texture.src')}
            />
          </Block>
        )}
        <Block>
          <Dropdown
            label="Blend Mode"
            options={BLEND_MODE_OPTIONS}
            {...getInputProps('blendMode')}
          />
        </Block>
        <Block label="Billboard">
          <CheckboxField
            checked={!!billboard.value}
            {...billboard}
          />
        </Block>
        <Block label="Face Travel Direction">
          <CheckboxField
            checked={!!faceTravelDirection.value}
            {...faceTravelDirection}
          />
        </Block>
      </Container>

      {/* Sprite Sheet */}
      <Container
        label="Sprite Sheet"
        border
        initialOpen={false}
      >
        <Block label="Enabled">
          <CheckboxField
            checked={!!spriteSheetEnabled.value}
            {...spriteSheetEnabled}
          />
        </Block>
        {!!spriteSheetEnabled.value && (
          <>
            <Block label="Tiles X">
              <TextField
                type="number"
                {...(getInputProps as any)('spriteSheet.tilesX')}
                autoSelect
              />
            </Block>
            <Block label="Tiles Y">
              <TextField
                type="number"
                {...(getInputProps as any)('spriteSheet.tilesY')}
                autoSelect
              />
            </Block>
            <Block label="Frames Per Second">
              <TextField
                type="number"
                {...(getInputProps as any)('spriteSheet.framesPerSecond')}
                autoSelect
              />
            </Block>
          </>
        )}
      </Container>
    </Container>
  );
});
