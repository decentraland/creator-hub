import { Entity, IEngine } from '@dcl/ecs';
import { DeepReadonlyObject, PBVideoPlayer } from '@dcl/ecs';
import ReactEcs, { Label, UiEntity } from '@dcl/react-ecs';
import { copyToClipboard } from '~system/RestrictedActions';
import { Color4 } from '@dcl/sdk/math';
import { Button } from '../../Button';
import { FeedbackButton } from '../../FeedbackButton';
import { State } from '../../types';
import { VideoControlVolume } from '../VolumeControl';
import { createVideoPlayerControls, isDclCast } from '../utils';
import { LIVEKIT_STREAM_SRC } from '../LiveStream';
import { getDclCastStyles, getDclCastColors, getDclCastBackgrounds } from './styles';
import { CONTENT_URL } from '../../constants';

const ICONS = {
  COPY_TO_CLIPBOARD_ICON: `${CONTENT_URL}/admin_toolkit/assets/icons/copy-to-clipboard.png`,
};

const DclCastInfo = ({
  scaleFactor,
  state,
  engine,
  onResetRoomId,
  entity,
  video,
}: {
  scaleFactor: number;
  state: State;
  engine: IEngine;
  onResetRoomId: () => Promise<void>;
  entity: Entity;
  video: DeepReadonlyObject<PBVideoPlayer> | undefined;
}) => {
  const controls = createVideoPlayerControls(entity, engine);
  const styles = getDclCastStyles(scaleFactor);
  const colors = getDclCastColors();
  const backgrounds = getDclCastBackgrounds();
  return (
    <UiEntity uiTransform={styles.fullContainer}>
      <UiEntity uiTransform={styles.mainBorderedContainer}>
        <UiEntity uiTransform={styles.headerRow}>
          <UiEntity uiTransform={styles.columnFlexStart}>
            <Label
              value={'<b>Room ID</b>'}
              fontSize={24 * scaleFactor}
              color={Color4.White()}
            />
            <Label
              value={`Expires in ${state.videoControl.dclCast?.expiresInDays} days`}
              fontSize={14 * scaleFactor}
              color={colors.gray}
              uiTransform={styles.marginTopSmall}
            />
          </UiEntity>
          {video?.src && isDclCast(video.src) ? (
            <Button
              id="dcl_cast_deactivate"
              value="<b>Deactivate</b>"
              variant="text"
              fontSize={16 * scaleFactor}
              color={colors.white}
              uiTransform={styles.activateButton}
              onMouseDown={() => {
                controls.setSource('');
                state.videoControl.selectedStream = undefined;
              }}
            />
          ) : (
            <Button
              id="dcl_cast_activate"
              value="<b>Activate</b>"
              labelTransform={styles.activateButtonLabel}
              uiTransform={styles.activateButton}
              fontSize={16 * scaleFactor}
              uiBackground={backgrounds.success}
              color={colors.black}
              onMouseDown={() => {
                controls.setSource(LIVEKIT_STREAM_SRC);
                state.videoControl.selectedStream = 'dcl-cast';
              }}
            />
          )}
        </UiEntity>
        <UiEntity uiTransform={styles.columnContainer}>
          <UiEntity uiTransform={styles.rowCenterSpaceBetween}>
            <UiEntity
              uiTransform={{
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <Label
                value={'<b>Cast speakers</b>'}
                fontSize={18 * scaleFactor}
                color={colors.white}
              />
              <UiEntity
                uiText={{
                  value: 'This link grants streaming access.',
                  fontSize: 14 * scaleFactor,
                  color: colors.gray,
                  textAlign: 'top-left',
                }}
              />
            </UiEntity>
            <FeedbackButton
              id="dcl_cast_copy_stream_link"
              value="<b>Copy Link</b>"
              variant="text"
              fontSize={18 * scaleFactor}
              color={colors.white}
              iconRight={ICONS.COPY_TO_CLIPBOARD_ICON}
              iconRightTransform={styles.iconSmall}
              labelTransform={styles.marginRightSmall}
              uiTransform={styles.copyLinkButton}
              onMouseDown={() => {
                state.videoControl.dclCast?.streamLink &&
                  copyToClipboard({
                    text: state.videoControl.dclCast.streamLink,
                  });
              }}
            />
          </UiEntity>
          <UiEntity uiTransform={styles.separatorLine} />
          <UiEntity uiTransform={styles.rowCenterSpaceBetween}>
            <UiEntity uiTransform={styles.textInfoContainer}>
              <Label
                value={'<b>Viewers</b>'}
                fontSize={18 * scaleFactor}
                color={colors.white}
              />
              <UiEntity
                uiText={{
                  value: 'This link grants viewing access.',
                  fontSize: 14 * scaleFactor,
                  color: colors.gray,
                  textAlign: 'top-left',
                }}
              />
            </UiEntity>
            <FeedbackButton
              id="dcl_cast_copy_watcher_link"
              value="<b>Copy Link</b>"
              variant="text"
              fontSize={18 * scaleFactor}
              color={colors.white}
              iconRight={ICONS.COPY_TO_CLIPBOARD_ICON}
              iconRightTransform={styles.iconSmall}
              labelTransform={styles.marginRightSmall}
              uiTransform={styles.copyLinkButton}
              onMouseDown={() => {
                state.videoControl.dclCast?.watcherLink &&
                  copyToClipboard({
                    text: state.videoControl.dclCast.watcherLink,
                  });
              }}
            />
          </UiEntity>
        </UiEntity>
      </UiEntity>
      <UiEntity uiTransform={styles.columnWithMarginTop}>
        <VideoControlVolume
          engine={engine}
          entity={entity}
          video={video}
          label="<b>Cast volume</b>"
        />
        <UiEntity>
          <Button
            id="dcl_cast_reset_room_id"
            value="<b>Reset Room</b>"
            variant="text"
            fontSize={16 * scaleFactor}
            color={colors.danger}
            uiTransform={styles.resetButton}
            onMouseDown={onResetRoomId}
          />
        </UiEntity>
      </UiEntity>
    </UiEntity>
  );
};

export default DclCastInfo;
