import { Color4 } from '@dcl/sdk/math';
import { DeepReadonlyObject, IEngine, PBVideoPlayer, Entity } from '@dcl/ecs';
import ReactEcs, { UiEntity, Input, Label } from '@dcl/react-ecs';
import { COLORS, ICONS } from '.';
import { createVideoPlayerControls, isVideoUrl } from './utils';
import { VideoControlVolume } from './VolumeControl';
import { Button } from '../Button';
import { Header } from '../Header';
import { openExternalUrl } from '~system/RestrictedActions';
import { LIVEKIT_STREAM_SRC } from '../../definitions';
import { CONTENT_URL } from '../constants';

const VIDEO_PLAYER_HELP_URL =
  'https://docs.decentraland.org/creator/editor/scene-admin/#video-playing';
export const HELP_ICON = `${CONTENT_URL}/admin_toolkit/assets/icons/help.png`;

export function VideoControlURL({
  engine,
  scaleFactor,
  video,
  entity,
}: {
  engine: IEngine;
  scaleFactor: number;
  entity: Entity;
  video: DeepReadonlyObject<PBVideoPlayer> | undefined;
}) {
  const [videoURL, setVideoURL] = ReactEcs.useState('');
  ReactEcs.useEffect(() => {
    const url = video?.src === LIVEKIT_STREAM_SRC ? '' : video?.src;
    setVideoURL(url ?? '');
  }, [entity]);
  const controls = createVideoPlayerControls(entity, engine);
  const isActive = video && isVideoUrl(video.src);
  return (
    <UiEntity uiTransform={{ flexDirection: 'column', width: '100%' }}>
      <UiEntity uiTransform={{ width: '100%', justifyContent: 'space-between' }}>
        <Header
          iconSrc={ICONS.VIDEO_SOURCE}
          title="Video URL"
          scaleFactor={scaleFactor}
        />
        <UiEntity
          onMouseDown={() => openExternalUrl({ url: VIDEO_PLAYER_HELP_URL })}
          uiTransform={{
            width: 25 * scaleFactor,
            height: 25 * scaleFactor,
            alignItems: 'center',
          }}
          uiBackground={{
            textureMode: 'stretch',
            color: Color4.White(),
            texture: { src: HELP_ICON },
          }}
        />
      </UiEntity>
      <Label
        value="Play videos from Vimeo by pasting a video URL below."
        color={Color4.fromHexString('#A09BA8')}
        fontSize={16 * scaleFactor}
      />
      <Label
        value="<b>Video URL<b>"
        color={Color4.White()}
        fontSize={16 * scaleFactor}
        uiTransform={{
          margin: { top: 16 * scaleFactor, bottom: 8 * scaleFactor },
        }}
      />

      <Input
        onChange={setVideoURL}
        value={videoURL}
        fontSize={16 * scaleFactor}
        textAlign="top-left"
        placeholder="Paste your video URL"
        placeholderColor={Color4.create(160 / 255, 155 / 255, 168 / 255, 1)}
        color={isActive ? Color4.Black() : Color4.fromHexString('#A09BA8')}
        uiBackground={{ color: Color4.fromHexString('#FCFCFC') }}
        uiTransform={{
          borderRadius: 12,
          borderColor: Color4.White(),
          width: '100%',
          height: 80 * scaleFactor,
        }}
      />

      <UiEntity
        uiTransform={{
          width: '100%',
          height: 40 * scaleFactor,
          flexDirection: 'row',
          justifyContent: 'flex-end',
          margin: { top: 10 * scaleFactor },
        }}
      >
        {video?.src && isVideoUrl(video.src) && (
          <Button
            id="video_control_share_screen_clear"
            value="<b>Deactivate</b>"
            variant="text"
            fontSize={16 * scaleFactor}
            color={Color4.White()}
            uiTransform={{
              margin: { right: 8 * scaleFactor },
              padding: { left: 8 * scaleFactor, right: 8 * scaleFactor },
            }}
            onMouseDown={() => {
              controls.setSource('');
            }}
          />
        )}
        {(!videoURL || videoURL !== video?.src) && (
          <Button
            disabled={!isVideoUrl(videoURL)}
            id="video_control_share_screen_share"
            value={
              video?.src && videoURL !== video.src && video.src !== LIVEKIT_STREAM_SRC
                ? '<b>Update</b>'
                : '<b>Activate</b>'
            }
            labelTransform={{
              margin: { left: 6 * scaleFactor, right: 6 * scaleFactor },
            }}
            fontSize={16 * scaleFactor}
            uiBackground={{
              color: isVideoUrl(videoURL) ? COLORS.SUCCESS : Color4.fromHexString('#274431'),
            }}
            color={Color4.Black()}
            onMouseDown={() => {
              controls.setSource(videoURL);
            }}
          />
        )}
      </UiEntity>

      <Label
        value="<b>Video Playback</b>"
        fontSize={16 * scaleFactor}
        color={Color4.White()}
        uiTransform={{ margin: { bottom: 10 * scaleFactor } }}
      />

      <UiEntity
        uiTransform={{
          flexDirection: 'row',
          width: '100%',
          margin: { bottom: 10 * scaleFactor },
        }}
      >
        <Button
          disabled={!isActive}
          id="video_control_play"
          value="<b>Play</b>"
          fontSize={18 * scaleFactor}
          labelTransform={{ margin: { right: 10 * scaleFactor } }}
          uiTransform={{
            margin: { top: 0, right: 16 * scaleFactor, bottom: 0, left: 0 },
            height: 42 * scaleFactor,
            minWidth: 69 * scaleFactor,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
          }}
          icon={ICONS.PLAY_BUTTON}
          iconTransform={{
            width: 35 * scaleFactor,
            height: 35 * scaleFactor,
          }}
          onMouseDown={() => {
            controls.play();
          }}
        />
        <Button
          disabled={!isActive}
          id="video_control_pause"
          value="<b>Pause</b>"
          fontSize={18 * scaleFactor}
          labelTransform={{
            margin: { left: 6 * scaleFactor, right: 6 * scaleFactor },
          }}
          uiTransform={{
            margin: { top: 0, right: 16 * scaleFactor, bottom: 0, left: 0 },
            height: 42 * scaleFactor,
            minWidth: 78 * scaleFactor,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
          }}
          onMouseDown={() => {
            controls.pause();
          }}
        />
        <Button
          disabled={!isActive}
          id="video_control_restart"
          value="<b>Restart</b>"
          labelTransform={{
            margin: { left: 6 * scaleFactor, right: 6 * scaleFactor },
          }}
          fontSize={18 * scaleFactor}
          uiTransform={{
            margin: { top: 0, right: 16 * scaleFactor, bottom: 0, left: 0 },
            height: 42 * scaleFactor,
            minWidth: 88 * scaleFactor,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
          }}
          onMouseDown={() => {
            controls.restart();
          }}
        />
        <Button
          disabled={!isActive}
          id="video_control_loop"
          onlyIcon
          variant={video?.loop ? 'primary' : 'secondary'}
          uiTransform={{
            height: 42 * scaleFactor,
            width: 49 * scaleFactor,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
          }}
          icon={ICONS.LOOP}
          iconTransform={{ width: 25 * scaleFactor, height: 25 * scaleFactor }}
          iconBackground={{
            color: !video?.loop ? Color4.White() : Color4.Black(),
          }}
          color={Color4.White()}
          onMouseDown={() => {
            controls.setLoop(!video?.loop);
          }}
        />
      </UiEntity>
      <VideoControlVolume
        engine={engine}
        entity={entity}
        video={video}
        label="<b>Video Volume</b>"
      />
    </UiEntity>
  );
}
