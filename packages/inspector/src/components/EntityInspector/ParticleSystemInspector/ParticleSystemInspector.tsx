import React, { useCallback } from 'react';

import { withSdk } from '../../../hoc/withSdk';
import { useAllEntitiesHaveComponent } from '../../../hooks/sdk/useHasComponent';
import { useMultiComponentInput } from '../../../hooks/sdk/useComponentInput';
import { useComponentValue } from '../../../hooks/sdk/useComponentValue';
import { useAssetOptions } from '../../../hooks/useAssetOptions';
import { analytics, Event } from '../../../lib/logic/analytics';
import { getAssetByModel } from '../../../lib/logic/catalog';
import { CoreComponents } from '../../../lib/sdk/components';
import type { ParticleSystemComponentType } from '../../../lib/sdk/components/ParticleSystem';
import { useAppSelector } from '../../../redux/hooks';
import { selectAssetCatalog } from '../../../redux/app';
import { isValidHttpsUrl } from '../../../lib/utils/url';
import { Block } from '../../Block';
import { Container } from '../../Container';
import { AddButton } from '../AddButton';
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
import { isModel, isTexture } from '../MaterialInspector/Texture/utils';
import type { Props } from './types';
import {
  ShapeType,
  SHAPE_TYPE_OPTIONS,
  BLEND_MODE_OPTIONS,
  PLAYBACK_STATE_OPTIONS,
  SIMULATION_SPACE_OPTIONS,
} from './types';
import { fromComponent, toComponent, isValidInput, createDefaultBurst } from './utils';

export default withSdk<Props>(({ sdk, entities, initialOpen = true }) => {
  const { ParticleSystem, GltfContainer } = sdk.components;

  const imageOptions = useAssetOptions(ACCEPTED_FILE_TYPES['image']);
  const files = useAppSelector(selectAssetCatalog);
  const allEntitiesHaveParticleSystem = useAllEntitiesHaveComponent(entities, ParticleSystem);
  const { getInputProps } = useMultiComponentInput(
    entities,
    ParticleSystem,
    fromComponent,
    toComponent,
    { validateInput: isValidInput },
  );

  const burstsEntity = entities[0];
  const [burstsComponentValue, setBurstsComponentValue] =
    useComponentValue<ParticleSystemComponentType>(burstsEntity, ParticleSystem);
  const bursts = burstsComponentValue?.bursts?.values ?? [];

  const updateBursts = useCallback(
    (next: NonNullable<ParticleSystemComponentType['bursts']>['values']) => {
      if (!burstsComponentValue) return;
      setBurstsComponentValue({
        ...burstsComponentValue,
        bursts: next.length > 0 ? { values: next } : undefined,
      });
    },
    [burstsComponentValue, setBurstsComponentValue],
  );

  const handleAddBurst = useCallback(() => {
    const def = createDefaultBurst();
    updateBursts([
      ...bursts,
      {
        time: Number(def.time),
        count: Number(def.count),
        cycles: Number(def.cycles),
        interval: Number(def.interval),
        probability: Number(def.probability),
      },
    ]);
  }, [bursts, updateBursts]);

  const handleRemoveBurst = useCallback(
    (idx: number) => {
      updateBursts(bursts.filter((_, i) => i !== idx));
    },
    [bursts, updateBursts],
  );

  const handleBurstFieldChange = useCallback(
    (idx: number, field: 'time' | 'count' | 'cycles' | 'interval' | 'probability', raw: string) => {
      const num = Number(raw);
      if (isNaN(num)) return;
      updateBursts(bursts.map((b, i) => (i === idx ? { ...b, [field]: num } : b)));
    },
    [bursts, updateBursts],
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

  const handleTextureChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const srcInput = (getInputProps as any)('texture.src');
      srcInput?.onChange?.(event);
    },
    [getInputProps],
  );

  const handleTextureDrop = useCallback(
    (src: string) => {
      const srcInput = (getInputProps as any)('texture.src');
      srcInput?.onChange?.({
        target: { value: src },
      } as React.ChangeEvent<HTMLInputElement>);
    },
    [getInputProps],
  );

  const isValidTexturePath = useCallback(
    (value: string | number | readonly string[]) => {
      if (typeof value !== 'string' || value.length === 0) return true;
      if (isValidHttpsUrl(value)) return true;
      if (!files) return true;
      return files.assets.some(asset => asset.path === value);
    },
    [files],
  );

  if (!allEntitiesHaveParticleSystem) return null;

  const active = getInputProps('active', e => e.target.checked);
  const billboard = getInputProps('billboard', e => e.target.checked);
  const faceTravelDirection = getInputProps('faceTravelDirection', e => e.target.checked);
  const loop = getInputProps('loop', e => e.target.checked);
  const prewarm = getInputProps('prewarm', e => e.target.checked);
  const textureEnabled = getInputProps('textureEnabled', e => e.target.checked);
  const spriteSheetEnabled = getInputProps('spriteSheetEnabled', e => e.target.checked);
  const limitVelocityEnabled = getInputProps('limitVelocityEnabled', e => e.target.checked);
  const shapeType = getInputProps('shapeType');
  const textureSrc = (getInputProps as any)('texture.src');
  const currentShape = String(shapeType.value);

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
      <Block
        label={
          <>
            Active{' '}
            <InfoTooltip
              text="Whether the system is actively emitting new particles."
              type="help"
            />
          </>
        }
      >
        <CheckboxField
          checked={!!active.value}
          {...active}
        />
      </Block>
      <Block>
        <Dropdown
          label={
            <>
              Playback{' '}
              <InfoTooltip
                text="Playing: emitting and simulating. Paused: freeze in place. Stopped: stop and clear all particles."
                type="help"
              />
            </>
          }
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
            label={
              <>
                Shape{' '}
                <InfoTooltip
                  text="Where particles spawn from. Point: a single position. Sphere/Box: random points inside the volume. Cone: from the base, projected outward along the entity's forward axis."
                  type="help"
                />
              </>
            }
            options={SHAPE_TYPE_OPTIONS}
            {...shapeType}
          />
        </Block>
        {currentShape === ShapeType.SPHERE && (
          <Block
            label={
              <>
                Radius{' '}
                <InfoTooltip
                  text="Sphere radius in meters."
                  type="help"
                />
              </>
            }
          >
            <TextField
              type="number"
              {...(getInputProps as any)('sphere.radius')}
              autoSelect
            />
          </Block>
        )}
        {currentShape === ShapeType.CONE && (
          <>
            <Block
              label={
                <>
                  Angle{' '}
                  <InfoTooltip
                    text="Half-angle of the cone in degrees. Wider angles spread particles outward."
                    type="help"
                  />
                </>
              }
            >
              <RangeField
                min={0}
                max={90}
                step={1}
                {...(getInputProps as any)('cone.angle')}
              />
            </Block>
            <Block
              label={
                <>
                  Radius{' '}
                  <InfoTooltip
                    text="Cone base radius in meters."
                    type="help"
                  />
                </>
              }
            >
              <TextField
                type="number"
                {...(getInputProps as any)('cone.radius')}
                autoSelect
              />
            </Block>
          </>
        )}
        {currentShape === ShapeType.BOX && (
          <Block
            label={
              <>
                Size{' '}
                <InfoTooltip
                  text="Box dimensions in meters; particles spawn anywhere inside the volume."
                  type="help"
                />
              </>
            }
          >
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
        <Block
          label={
            <>
              Rate (particles/sec){' '}
              <InfoTooltip
                text="Continuous particles emitted per second. Set 0 to disable continuous emission and rely only on Bursts."
                type="help"
              />
            </>
          }
        >
          <TextField
            type="number"
            {...getInputProps('rate')}
            autoSelect
          />
        </Block>
        <Block
          label={
            <>
              Max Particles{' '}
              <InfoTooltip
                text="Hard cap on simultaneous live particles. The engine also enforces a per-scene budget of 1000."
                type="help"
              />
            </>
          }
        >
          <TextField
            type="number"
            {...getInputProps('maxParticles')}
            autoSelect
          />
        </Block>
        <Block
          label={
            <>
              Lifetime (sec){' '}
              <InfoTooltip
                text="How long each particle lives before disappearing."
                type="help"
              />
            </>
          }
        >
          <TextField
            type="number"
            {...getInputProps('lifetime')}
            autoSelect
          />
        </Block>
        <Block
          label={
            <>
              Loop{' '}
              <InfoTooltip
                text="When off, the system runs once and stops automatically after all particles have died."
                type="help"
              />
            </>
          }
        >
          <CheckboxField
            checked={!!loop.value}
            {...loop}
          />
        </Block>
        <Block
          label={
            <>
              Prewarm{' '}
              <InfoTooltip
                text="Simulate one full loop cycle on start, so particles already fill the scene when first seen. Requires Loop = true."
                type="help"
              />
            </>
          }
        >
          <CheckboxField
            checked={!!prewarm.value}
            {...prewarm}
          />
        </Block>
      </Container>

      {/* Bursts */}
      <Container
        label="Bursts"
        border
        initialOpen={false}
        rightContent={
          <InfoTooltip
            text="Emit a batch of particles at specific moments instead of (or in addition to) a constant Rate. Useful for explosions, fireworks, or staggered effects."
            type="help"
          />
        }
      >
        {bursts.map((burst, idx) => (
          <React.Fragment key={idx}>
            <Block
              label={
                <>
                  {`Burst ${idx + 1}`}{' '}
                  <InfoTooltip
                    text="Time: seconds after playback starts. Count: particles to emit per burst."
                    type="help"
                  />
                </>
              }
            >
              <TextField
                leftLabel="Time"
                type="number"
                value={String(burst.time ?? 0)}
                onChange={e => handleBurstFieldChange(idx, 'time', e.target.value)}
                autoSelect
              />
              <TextField
                leftLabel="Count"
                type="number"
                value={String(burst.count ?? 0)}
                onChange={e => handleBurstFieldChange(idx, 'count', e.target.value)}
                autoSelect
              />
            </Block>
            <Block
              label={
                <>
                  Cycles &amp; Interval{' '}
                  <InfoTooltip
                    text="Cycles: number of repeats (0 = infinite). Interval: seconds between cycles."
                    type="help"
                  />
                </>
              }
            >
              <TextField
                leftLabel="Cycles"
                type="number"
                value={String(burst.cycles ?? 1)}
                onChange={e => handleBurstFieldChange(idx, 'cycles', e.target.value)}
                autoSelect
              />
              <TextField
                leftLabel="Interval"
                type="number"
                value={String(burst.interval ?? 0.01)}
                onChange={e => handleBurstFieldChange(idx, 'interval', e.target.value)}
                autoSelect
              />
            </Block>
            <Block
              label={
                <>
                  Probability{' '}
                  <InfoTooltip
                    text="Chance the burst fires each cycle (0–1). Use lower values for randomized, natural-feeling effects."
                    type="help"
                  />
                </>
              }
            >
              <RangeField
                min={0}
                max={1}
                step={0.01}
                value={burst.probability ?? 1}
                onChange={e =>
                  handleBurstFieldChange(idx, 'probability', (e.target as HTMLInputElement).value)
                }
              />
            </Block>
            <AddButton onClick={() => handleRemoveBurst(idx)}>Remove Burst</AddButton>
          </React.Fragment>
        ))}
        <AddButton onClick={handleAddBurst}>Add Burst</AddButton>
      </Container>

      {/* Motion */}
      <Container
        label="Motion"
        border
        initialOpen={false}
      >
        <Block
          label={
            <>
              Gravity{' '}
              <InfoTooltip
                text="Multiplier on scene gravity (-9.81 m/s²). 0 = float in place, negative = rise upward, positive = fall faster."
                type="help"
              />
            </>
          }
        >
          <TextField
            type="number"
            {...getInputProps('gravity')}
            autoSelect
          />
        </Block>
        <Block
          label={
            <>
              Additional Force{' '}
              <InfoTooltip
                text="Constant force vector applied to every particle each frame, on top of gravity. Useful for wind or magnetic effects."
                type="help"
              />
            </>
          }
        >
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
        <Block
          label={
            <>
              Initial Speed{' '}
              <InfoTooltip
                text="Random launch speed range in m/s. Each particle picks a value between Min and Max at birth."
                type="help"
              />
            </>
          }
        >
          <TextField
            leftLabel="Min"
            type="number"
            {...(getInputProps as any)('initialVelocitySpeed.start')}
            autoSelect
          />
          <TextField
            leftLabel="Max"
            type="number"
            {...(getInputProps as any)('initialVelocitySpeed.end')}
            autoSelect
          />
        </Block>
        <Block>
          <Dropdown
            label={
              <>
                Simulation Space{' '}
                <InfoTooltip
                  text="Local: particles follow the emitter when it moves. World: particles stay at their spawn position, leaving a trail behind a moving emitter."
                  type="help"
                />
              </>
            }
            options={SIMULATION_SPACE_OPTIONS}
            {...getInputProps('simulationSpace')}
          />
        </Block>
        <Container
          label="Limit Velocity"
          border
          initialOpen={false}
        >
          <Block
            label={
              <>
                Enabled{' '}
                <InfoTooltip
                  text="Caps each particle's max speed. When off, particles aren't speed-limited."
                  type="help"
                />
              </>
            }
          >
            <CheckboxField
              checked={!!limitVelocityEnabled.value}
              {...limitVelocityEnabled}
            />
          </Block>
          {!!limitVelocityEnabled.value && (
            <>
              <Block
                label={
                  <>
                    Max Speed{' '}
                    <InfoTooltip
                      text="Maximum allowed particle speed in m/s."
                      type="help"
                    />
                  </>
                }
              >
                <TextField
                  type="number"
                  {...(getInputProps as any)('limitVelocity.speed')}
                  autoSelect
                />
              </Block>
              <Block
                label={
                  <>
                    Dampen{' '}
                    <InfoTooltip
                      text="Fraction of excess velocity removed per frame (0–1). 1 = hard clamp."
                      type="help"
                    />
                  </>
                }
              >
                <RangeField
                  min={0}
                  max={1}
                  step={0.01}
                  {...(getInputProps as any)('limitVelocity.dampen')}
                />
              </Block>
            </>
          )}
        </Container>
      </Container>

      {/* Size */}
      <Container
        label="Size"
        border
        initialOpen={false}
        rightContent={
          <InfoTooltip
            text="Scale relative to the texture's native size (1 = original). The entity Transform's scale does NOT affect particle size."
            type="help"
          />
        }
      >
        <Block
          label={
            <>
              Initial Size{' '}
              <InfoTooltip
                text="Random size at birth. Each particle picks a value between Min and Max."
                type="help"
              />
            </>
          }
        >
          <TextField
            leftLabel="Min"
            type="number"
            {...(getInputProps as any)('initialSize.start')}
            autoSelect
          />
          <TextField
            leftLabel="Max"
            type="number"
            {...(getInputProps as any)('initialSize.end')}
            autoSelect
          />
        </Block>
        <Block
          label={
            <>
              Size Over Time{' '}
              <InfoTooltip
                text="Random size at the end of the particle's lifetime. Each particle picks a value between Min and Max, then lerps from its Initial Size to this value."
                type="help"
              />
            </>
          }
        >
          <TextField
            leftLabel="Min"
            type="number"
            {...(getInputProps as any)('sizeOverTime.start')}
            autoSelect
          />
          <TextField
            leftLabel="Max"
            type="number"
            {...(getInputProps as any)('sizeOverTime.end')}
            autoSelect
          />
        </Block>
      </Container>

      {/* Color */}
      <Container
        label="Color"
        border
        initialOpen={false}
        rightContent={
          <InfoTooltip
            text="Each particle picks a random Initial Color (between Start and End) at birth and a random Final Color (between Start and End) at death, then lerps between them over its lifetime. Set the Final Color alpha to 0 to fade out."
            type="help"
          />
        }
      >
        <Block label="Initial Color Start">
          <ColorField {...(getInputProps as any)('initialColor.startColor')} />
        </Block>
        <Block label="Alpha">
          <RangeField
            min={0}
            max={1}
            step={0.01}
            {...(getInputProps as any)('initialColor.startAlpha')}
          />
        </Block>
        <Block label="Initial Color End">
          <ColorField {...(getInputProps as any)('initialColor.endColor')} />
        </Block>
        <Block label="Alpha">
          <RangeField
            min={0}
            max={1}
            step={0.01}
            {...(getInputProps as any)('initialColor.endAlpha')}
          />
        </Block>
        <Block label="Final Color Start">
          <ColorField {...(getInputProps as any)('colorOverTime.startColor')} />
        </Block>
        <Block label="Alpha">
          <RangeField
            min={0}
            max={1}
            step={0.01}
            {...(getInputProps as any)('colorOverTime.startAlpha')}
          />
        </Block>
        <Block label="Final Color End">
          <ColorField {...(getInputProps as any)('colorOverTime.endColor')} />
        </Block>
        <Block label="Alpha">
          <RangeField
            min={0}
            max={1}
            step={0.01}
            {...(getInputProps as any)('colorOverTime.endAlpha')}
          />
        </Block>
      </Container>

      {/* Rendering */}
      <Container
        label="Rendering"
        border
        initialOpen={false}
      >
        <Block
          label={
            <>
              Use Texture{' '}
              <InfoTooltip
                text="Particles render as plain white squares unless a texture is supplied."
                type="help"
              />
            </>
          }
        >
          <CheckboxField
            checked={!!textureEnabled.value}
            {...textureEnabled}
          />
        </Block>
        {!!textureEnabled.value && (
          <Block label="Texture Path">
            <FileUploadField
              {...textureSrc}
              label="Path"
              accept={ACCEPTED_FILE_TYPES['image']}
              options={imageOptions}
              onDrop={handleTextureDrop}
              onChange={handleTextureChange}
              error={!!textureSrc.value && !isValidTexturePath(textureSrc.value)}
              isValidFile={isModel}
              acceptURLs
            />
          </Block>
        )}
        <Block>
          <Dropdown
            label={
              <>
                Blend Mode{' '}
                <InfoTooltip
                  text="Alpha: standard transparency. Additive: brightens what's behind (good for fire, glows). Multiply: darkens what's behind."
                  type="help"
                />
              </>
            }
            options={BLEND_MODE_OPTIONS}
            {...getInputProps('blendMode')}
          />
        </Block>
        <Block
          label={
            <>
              Billboard{' '}
              <InfoTooltip
                text="When on, each particle always faces the camera. Turn off for particles that should tumble in 3D."
                type="help"
              />
            </>
          }
        >
          <CheckboxField
            checked={!!billboard.value}
            {...billboard}
          />
        </Block>
        <Block
          label={
            <>
              Face Travel Direction{' '}
              <InfoTooltip
                text="Particles auto-rotate to point in their direction of movement, like asteroids. Overrides Billboard when on."
                type="help"
              />
            </>
          }
        >
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
        rightContent={
          <InfoTooltip
            text="Animate particles by treating the texture as a grid of frames played back in sequence."
            type="help"
          />
        }
      >
        <Block
          label={
            <>
              Enabled{' '}
              <InfoTooltip
                text="When off, the texture renders as a single static image."
                type="help"
              />
            </>
          }
        >
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
