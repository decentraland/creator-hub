import { useCallback } from 'react';
import cx from 'classnames';

import { withSdk } from '../../../hoc/withSdk';
import { useAllEntitiesHaveComponent } from '../../../hooks/sdk/useHasComponent';
import { useMultiComponentInput } from '../../../hooks/sdk/useComponentInput';
import { getComponentValue } from '../../../hooks/sdk/useComponentValue';
import { useAssetOptions } from '../../../hooks/useAssetOptions';
import { analytics, Event } from '../../../lib/logic/analytics';
import { getAssetByModel } from '../../../lib/logic/catalog';
import { CoreComponents } from '../../../lib/sdk/components';
import { useAppSelector } from '../../../redux/hooks';
import { selectAssetCatalog } from '../../../redux/app';
import { Block } from '../../Block';
import { Container } from '../../Container';
import { CheckboxField, RangeField, FileUploadField, InfoTooltip } from '../../ui';
import { ACCEPTED_FILE_TYPES } from '../../ui/FileUploadField/types';
import { fromAudioSource, toAudioSource, isValidInput, isAudio, isValidVolume } from './utils';
import type { Props } from './types';

export default withSdk<Props>(({ sdk, entities, initialOpen = true }) => {
  const files = useAppSelector(selectAssetCatalog);
  const audioOptions = useAssetOptions(ACCEPTED_FILE_TYPES['audio']);
  const { AudioSource, GltfContainer } = sdk.components;

  const allEntitiesHaveAudioSource = useAllEntitiesHaveComponent(entities, AudioSource);

  const handleInputValidation = useCallback(
    ({ audioClipUrl }: { audioClipUrl: string }) => !!files && isValidInput(files, audioClipUrl),
    [files],
  );

  const { getInputProps, isValid } = useMultiComponentInput(
    entities,
    AudioSource,
    fromAudioSource,
    toAudioSource,
    handleInputValidation,
    [files],
  );

  const handleRemove = useCallback(async () => {
    for (const entity of entities) {
      sdk.operations.removeComponent(entity, AudioSource);
    }
    await sdk.operations.dispatch();
    const gltfContainer = getComponentValue(entities[0], GltfContainer);
    const asset = getAssetByModel(gltfContainer.src);
    analytics.track(Event.REMOVE_COMPONENT, {
      componentName: CoreComponents.AUDIO_SOURCE,
      itemId: asset?.id,
      itemPath: gltfContainer.src,
    });
  }, [sdk, entities, AudioSource, GltfContainer]);

  if (!allEntitiesHaveAudioSource) return null;

  const audioClipUrl = getInputProps('audioClipUrl', e => e.target.value);
  const playing = getInputProps('playing', e => e.target.checked);
  const loop = getInputProps('loop', e => e.target.checked);
  const global = getInputProps('global', e => e.target.checked);
  const volume = getInputProps('volume', e => e.target.value);

  return (
    <Container
      label="AudioSource"
      className={cx('AudioSource')}
      initialOpen={initialOpen}
      rightContent={
        <InfoTooltip
          text="Enables the playback of sound in your scene. The item emits sound that originates from its location, from an .mp3 file in your scene project"
          link="https://docs.decentraland.org/creator/scenes-sdk7/3d-content-essentials/sounds"
          type="help"
        />
      }
      onRemoveContainer={handleRemove}
    >
      <Block>
        <FileUploadField
          {...audioClipUrl}
          label="Path"
          accept={ACCEPTED_FILE_TYPES['audio']}
          options={audioOptions}
          error={files && !isValid}
          isValidFile={isAudio}
        />
      </Block>
      <Block label="Playback">
        <CheckboxField
          label="Start playing"
          checked={!!playing.value}
          {...playing}
        />
        <CheckboxField
          label="Loop"
          checked={!!loop.value}
          {...loop}
        />
        <CheckboxField
          label="Global"
          checked={!!global.value}
          {...global}
        />
      </Block>
      <Block className="volume">
        <RangeField
          {...volume}
          label="Volume"
          isValidValue={isValidVolume}
        />
      </Block>
    </Container>
  );
});
