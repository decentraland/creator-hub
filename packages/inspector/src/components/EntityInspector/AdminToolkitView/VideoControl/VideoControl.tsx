import React from 'react';
import { AiOutlineInfoCircle as InfoIcon } from 'react-icons/ai';
import type { Entity } from '@dcl/ecs';

import { withSdk, type WithSdkProps } from '../../../../hoc/withSdk';
import { useComponentsWith } from '../../../../hooks/sdk/useComponentsWith';
import type { EditorComponentsTypes } from '../../../../lib/sdk/components';
import { CheckboxField, CheckboxGroup, TextField, Dropdown, Label } from '../../../ui';
import { AddButton } from '../../AddButton';
import { AdminListRow } from '../AdminListRow';
import { useAdminTools } from '../useAdminTools';

import './VideoControl.css';

type Props = {
  entity: Entity;
};

type VideoPlayers = NonNullable<
  EditorComponentsTypes['AdminTools']['videoControl']['videoPlayers']
>;

const VideoControl: React.FC<WithSdkProps & Props> = ({ sdk, entity }) => {
  const { AdminTools, Name } = sdk.components;
  const [adminComponent, updateControl] = useAdminTools(entity, AdminTools);
  const [videoPlayerEntities] = useComponentsWith(components => components.VideoScreen);

  if (!adminComponent) return null;

  const { videoControl } = adminComponent;
  const videoPlayers = videoControl.videoPlayers ?? [];
  const setVideoPlayers = (next: VideoPlayers) =>
    updateControl('videoControl', { videoPlayers: next });

  const selectedEntities = new Set(videoPlayers.map(videoPlayer => videoPlayer.entity));
  const optionsFor = (currentEntity: number) =>
    videoPlayerEntities.map(videoPlayer => ({
      value: videoPlayer.entity,
      label: Name.getOrNull(videoPlayer.entity)?.value || `Screen ${videoPlayer.entity}`,
      disabled:
        videoPlayer.entity !== 0 &&
        videoPlayer.entity !== currentEntity &&
        selectedEntities.has(videoPlayer.entity),
    }));

  return (
    <div className="VideoControl">
      <CheckboxGroup>
        <CheckboxField
          label="Disable sound (Only editable in Creator Hub)"
          checked={videoControl.disableVideoPlayersSound || false}
          onChange={e =>
            updateControl('videoControl', { disableVideoPlayersSound: e.target.checked })
          }
        />
      </CheckboxGroup>
      <Label
        className="Title"
        text="Screen Steup"
      />
      <div className="ScreenSetup">
        <InfoIcon size={16} />
        <Label text="Use the 'Video Screen' Smart Item to add screens to your scene, then select them from the drop down below to manage them through the Admin Tools panel in-world." />
      </div>

      {videoPlayers.map((videoPlayer, idx) => (
        <AdminListRow
          key={idx}
          index={idx}
          onRemove={() => setVideoPlayers(videoPlayers.toSpliced(idx, 1))}
        >
          <Dropdown
            label={`Video Screen ${idx + 1}`}
            value={videoPlayer.entity}
            options={optionsFor(videoPlayer.entity)}
            onChange={e =>
              setVideoPlayers(
                videoPlayers.with(idx, { ...videoPlayer, entity: Number(e.target.value) }),
              )
            }
          />
          <TextField
            label="Custom Name"
            value={videoPlayer.customName}
            onBlur={e => {
              if (e.target.value === videoPlayer.customName) return;
              setVideoPlayers(
                videoPlayers.with(idx, { ...videoPlayer, customName: e.target.value }),
              );
            }}
          />
        </AdminListRow>
      ))}
      <AddButton
        onClick={() => setVideoPlayers([...videoPlayers, { entity: 0, customName: '' }])}
        disabled={
          videoPlayerEntities.length === 0 || videoPlayerEntities.length === videoPlayers.length
        }
      >
        Add a Screen
      </AddButton>
    </div>
  );
};

export default React.memo(withSdk(VideoControl));
