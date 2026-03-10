import ReactEcs, { Dropdown, UiEntity, Label } from '@dcl/react-ecs';
import { Color4 } from '@dcl/sdk/math';
import { Button } from '../../Button';
import { CONTENT_URL } from '../../constants';
import {
  getModalStyles,
  getModalBackgrounds,
  getModalColors,
  getPaginationColor,
} from '../../ModerationControl/styles/UsersListStyles';
import { getSourceLabel, type FlattenedTrack, type Participant } from '../api';

const SPEAKERS_PER_PAGE = 10;

const ICONS = {
  BACK: `${CONTENT_URL}/admin_toolkit/assets/icons/chevron-back.png`,
  NEXT: `${CONTENT_URL}/admin_toolkit/assets/icons/chevron-forward.png`,
  CLOSE: `${CONTENT_URL}/admin_toolkit/assets/icons/close.png`,
  PERSON: `${CONTENT_URL}/admin_toolkit/assets/icons/person-outline.png`,
  SHOWCASE: `${CONTENT_URL}/admin_toolkit/assets/icons/admin-panel-verified-user.png`,
  STAR: `${CONTENT_URL}/admin_toolkit/assets/icons/star.png`,
};

type SpeakerShowcaseProps = {
  participants: Participant[];
  activeTrackSid: string | undefined;
  onSelectTrack: (track: FlattenedTrack) => void;
  onClose: () => void;
};

function getDropdownOptions(participant: Participant): string[] {
  return participant.tracks.map(track => `Showcase ${getSourceLabel(track.sourceType)}`);
}

function getActiveIndex(participant: Participant, activeTrackSid: string | undefined): number {
  if (!activeTrackSid) return -1;
  return participant.tracks.findIndex(t => t.sid === activeTrackSid);
}

export function SpeakerShowcase({
  participants,
  activeTrackSid,
  onSelectTrack,
  onClose,
}: SpeakerShowcaseProps) {
  const [page, setPage] = ReactEcs.useState(1);
  const styles = getModalStyles();
  const backgrounds = getModalBackgrounds();
  const colors = getModalColors();

  const totalPages = Math.ceil(participants.length / SPEAKERS_PER_PAGE);
  const startIndex = (page - 1) * SPEAKERS_PER_PAGE;
  const endIndex = Math.min(startIndex + SPEAKERS_PER_PAGE, participants.length);
  const currentPageParticipants = participants.slice(startIndex, endIndex);

  return (
    <UiEntity uiTransform={styles.overlay}>
      <UiEntity
        uiTransform={styles.container}
        uiBackground={backgrounds.container}
      >
        <UiEntity uiTransform={styles.content}>
          <UiEntity uiTransform={styles.header}>
            <UiEntity
              uiTransform={styles.headerIcon}
              uiBackground={{
                textureMode: 'stretch',
                texture: { src: ICONS.SHOWCASE },
              }}
            />
            <Label
              value={'<b>SPEAKER SHOWCASE</b>'}
              fontSize={24}
              color={colors.white}
            />
            <Label
              value={`(${participants.length} Speakers)`}
              fontSize={16}
              color={colors.gray}
              uiTransform={styles.usersCount}
            />
            <Button
              id="close-showcase-modal"
              onlyIcon
              icon={ICONS.CLOSE}
              variant="secondary"
              fontSize={20}
              uiTransform={styles.closeButton}
              iconTransform={styles.closeIcon}
              onMouseDown={onClose}
            />
          </UiEntity>

          <UiEntity uiTransform={styles.listContainer}>
            {currentPageParticipants.map(participant => {
              const activeIndex = getActiveIndex(participant, activeTrackSid);
              const isActive = activeIndex !== -1;
              const options = getDropdownOptions(participant);

              return (
                <UiEntity
                  key={participant.name}
                  uiTransform={styles.userItem}
                >
                  <UiEntity uiTransform={styles.userRow}>
                    <UiEntity uiTransform={styles.userInfo}>
                      <UiEntity uiTransform={styles.personIconContainer}>
                        <UiEntity
                          uiTransform={styles.personIcon}
                          uiBackground={backgrounds.personIcon}
                        />
                      </UiEntity>
                      <UiEntity uiTransform={styles.userDetails}>
                        <Label
                          value={`<b>${participant.name}</b>`}
                          fontSize={14}
                          color={colors.white}
                        />
                      </UiEntity>
                    </UiEntity>
                    <UiEntity
                      uiTransform={{
                        flexDirection: 'row',
                        alignItems: 'center',
                      }}
                    >
                      {isActive && (
                        <UiEntity
                          uiTransform={{
                            width: 20,
                            height: 20,
                            margin: { right: 4 },
                          }}
                          uiBackground={{
                            textureMode: 'stretch',
                            texture: { src: ICONS.STAR },
                          }}
                        />
                      )}
                      <Dropdown
                        key={`showcase-dropdown-${participant.name}`}
                        acceptEmpty
                        emptyLabel="Showcase"
                        options={options}
                        selectedIndex={activeIndex}
                        onChange={(optionIndex: number) => {
                          const track = participant.tracks[optionIndex];
                          if (track) {
                            onSelectTrack(track);
                          }
                        }}
                        textAlign="middle-center"
                        fontSize={14}
                        uiTransform={{
                          height: 36,
                          width: 180,
                        }}
                        uiBackground={{ color: Color4.create(0.2, 0.2, 0.2, 1) }}
                        color={isActive ? Color4.Gray() : Color4.White()}
                      />
                    </UiEntity>
                  </UiEntity>
                  <UiEntity
                    uiTransform={styles.divider}
                    uiBackground={backgrounds.divider}
                  />
                </UiEntity>
              );
            })}
          </UiEntity>
        </UiEntity>

        {participants.length > SPEAKERS_PER_PAGE && (
          <UiEntity uiTransform={styles.pagination}>
            <Button
              id="showcase-prev"
              value="Prev"
              variant="secondary"
              disabled={page <= 1}
              fontSize={18}
              icon={ICONS.BACK}
              iconTransform={styles.prevIcon}
              iconBackground={{ color: getPaginationColor(page <= 1) }}
              color={getPaginationColor(page <= 1)}
              labelTransform={styles.prevLabel}
              uiTransform={styles.paginationButton}
              onMouseDown={() => setPage(page - 1)}
            />
            <Label
              value={`Page ${page}/${totalPages}`}
              fontSize={14}
              color={colors.white}
            />
            <Button
              id="showcase-next"
              value="<b>Next</b>"
              variant="secondary"
              fontSize={18}
              iconRight={ICONS.NEXT}
              iconRightTransform={styles.nextIcon}
              labelTransform={styles.nextLabel}
              iconRightBackground={{
                color: getPaginationColor(page >= totalPages),
              }}
              color={getPaginationColor(page >= totalPages)}
              disabled={page >= totalPages}
              uiTransform={styles.paginationButton}
              onMouseDown={() => setPage(page + 1)}
            />
          </UiEntity>
        )}
      </UiEntity>
    </UiEntity>
  );
}
