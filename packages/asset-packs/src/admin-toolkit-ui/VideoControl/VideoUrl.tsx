import { Color4 } from '@dcl/sdk/math';
import type { DeepReadonlyObject, IEngine, PBVideoPlayer, Entity } from '@dcl/ecs';
import ReactEcs, { UiEntity, Input, Label } from '@dcl/react-ecs';
import { openExternalUrl } from '~system/RestrictedActions';
import { Button } from '../Button';
import { Header } from '../Header';
import { LIVEKIT_STREAM_SRC } from '../../definitions';
import { CONTENT_URL } from '../constants';
import { VideoControlVolume } from './VolumeControl';
import { createVideoPlayerControls, isVideoUrl } from './utils';
import { COLORS, ICONS } from '.';

const VIDEO_PLAYER_HELP_URL =
  'https://docs.decentraland.org/creator/scene-editor/interactivity/video-screen';
export const HELP_ICON = `${CONTENT_URL}/admin_toolkit/assets/icons/help.png`;

export function VideoControlURL({
  engine,
  video,
  entity,
}: {
  engine: IEngine;
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
        />
        <UiEntity
          onMouseDown={() => openExternalUrl({ url: VIDEO_PLAYER_HELP_URL })}
          uiTransform={{
            width: 25,
            height: 25,
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
        value="Play videos by pasting an .m3u8 video URL below."
        color={Color4.fromHexString('#A09BA8')}
        fontSize={16}
      />
      <Label
        value="<b>Video URL<b>"
        color={Color4.White()}
        fontSize={16}
        uiTransform={{
          margin: { top: 16, bottom: 8 },
        }}
      />

      <Input
        onChange={setVideoURL}
        value={videoURL}
        fontSize={16}
        textAlign="middle-left"
        placeholder="Paste your video URL"
        placeholderColor={Color4.create(160 / 255, 155 / 255, 168 / 255, 1)}
        color={isActive ? Color4.Black() : Color4.fromHexString('#A09BA8')}
        uiBackground={{ color: Color4.fromHexString('#FCFCFC') }}
        uiTransform={{
          borderRadius: 12,
          borderColor: Color4.White(),
          width: '100%',
          height: 80,
        }}
      />

      <UiEntity
        uiTransform={{
          width: '100%',
          height: 40,
          flexDirection: 'row',
          justifyContent: 'flex-end',
          margin: { top: 10 },
        }}
      >
        {video?.src && isVideoUrl(video.src) && (
          <Button
            id="video_control_share_screen_clear"
            value="<b>Deactivate</b>"
            variant="text"
            fontSize={16}
            color={Color4.White()}
            uiTransform={{
              margin: { right: 8 },
              padding: { left: 8, right: 8 },
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
              margin: { left: 6, right: 6 },
            }}
            fontSize={16}
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
        fontSize={16}
        color={Color4.White()}
        uiTransform={{ margin: { bottom: 10 } }}
      />

      <UiEntity
        uiTransform={{
          flexDirection: 'row',
          width: '100%',
          margin: { bottom: 10 },
        }}
      >
        <Button
          disabled={!isActive}
          id="video_control_play"
          value="<b>Play</b>"
          fontSize={18}
          labelTransform={{ margin: { right: 10 } }}
          uiTransform={{
            margin: { top: 0, right: 16, bottom: 0, left: 0 },
            height: 42,
            minWidth: 69,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
          }}
          icon={ICONS.PLAY_BUTTON}
          iconTransform={{
            width: 35,
            height: 35,
          }}
          onMouseDown={() => {
            controls.play();
          }}
        />
        <Button
          disabled={!isActive}
          id="video_control_pause"
          value="<b>Pause</b>"
          fontSize={18}
          labelTransform={{
            margin: { left: 6, right: 6 },
          }}
          uiTransform={{
            margin: { top: 0, right: 16, bottom: 0, left: 0 },
            height: 42,
            minWidth: 78,
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
            margin: { left: 6, right: 6 },
          }}
          fontSize={18}
          uiTransform={{
            margin: { top: 0, right: 16, bottom: 0, left: 0 },
            height: 42,
            minWidth: 88,
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
            height: 42,
            width: 49,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
          }}
          icon={ICONS.LOOP}
          iconTransform={{ width: 25, height: 25 }}
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
