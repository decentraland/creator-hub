import ReactEcs, { Dropdown, UiEntity, Label } from '@dcl/react-ecs';
import { getContentUrl } from '../../constants';
import { Button } from '../../Button';
import { getSourceLabel, type FlattenedTrack, type Participant } from '../api';
import {
  getSpeakerShowcaseStyles,
  getShowcaseColors,
  getShowcaseBackgrounds,
  getShowcaseIconBackgrounds,
  getPaginationColor,
  SHOWCASE_DROPDOWN_COLORS,
  SHOWCASE_PAGE_INDICATOR_COLOR,
} from './styles';

const SPEAKERS_PER_PAGE = 10;

const ICONS = {
  get BACK() {
    return `${getContentUrl()}/admin_toolkit/assets/icons/chevron-back.png`;
  },
  get NEXT() {
    return `${getContentUrl()}/admin_toolkit/assets/icons/chevron-forward.png`;
  },
  get CLOSE() {
    return `${getContentUrl()}/admin_toolkit/assets/icons/close.png`;
  },
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

function ParticipantRow({
  participant,
  activeTrackSid,
  isHovered,
  onSelectTrack,
  onHoverEnter,
  onHoverLeave,
}: {
  participant: Participant;
  activeTrackSid: string | undefined;
  isHovered: boolean;
  onSelectTrack: (track: FlattenedTrack) => void;
  onHoverEnter: () => void;
  onHoverLeave: () => void;
}) {
  const styles = getSpeakerShowcaseStyles();
  const backgrounds = getShowcaseBackgrounds();
  const colors = getShowcaseColors();
  const iconBgs = getShowcaseIconBackgrounds();

  const activeIndex = getActiveIndex(participant, activeTrackSid);
  const isActive = activeIndex !== -1;
  const options = getDropdownOptions(participant);
  const displayLabel = isActive
    ? getSourceLabel(participant.tracks[activeIndex].sourceType)
    : 'Showcase';

  const dropdownTextColor = isHovered
    ? SHOWCASE_DROPDOWN_COLORS.hover
    : isActive
      ? SHOWCASE_DROPDOWN_COLORS.active
      : SHOWCASE_DROPDOWN_COLORS.idle;

  const dropdownBgColor = isHovered
    ? SHOWCASE_DROPDOWN_COLORS.hoverBg
    : SHOWCASE_DROPDOWN_COLORS.transparentBg;

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
        <UiEntity uiTransform={styles.rowCenter}>
          {isActive && (
            <UiEntity
              uiTransform={styles.starIcon}
              uiBackground={iconBgs.star}
            />
          )}
          <UiEntity
            uiTransform={styles.dropdownWrapper}
            onMouseEnter={onHoverEnter}
            onMouseLeave={onHoverLeave}
          >
            <Dropdown
              key={`showcase-dropdown-${participant.name}`}
              acceptEmpty
              emptyLabel={displayLabel}
              options={options}
              selectedIndex={-1}
              onChange={(optionIndex: number) => {
                const track = participant.tracks[optionIndex];
                if (track) {
                  onSelectTrack(track);
                }
              }}
              textAlign="middle-left"
              fontSize={14}
              uiTransform={styles.dropdownTransform}
              uiBackground={{ color: dropdownBgColor }}
              color={dropdownTextColor}
            />
          </UiEntity>
        </UiEntity>
      </UiEntity>
      <UiEntity
        uiTransform={styles.divider}
        uiBackground={backgrounds.divider}
      />
    </UiEntity>
  );
}

export function SpeakerShowcase({
  participants,
  activeTrackSid,
  onSelectTrack,
  onClose,
}: SpeakerShowcaseProps) {
  const [page, setPage] = ReactEcs.useState(1);
  const [hoveredDropdown, setHoveredDropdown] = ReactEcs.useState<string | undefined>(undefined);

  const styles = getSpeakerShowcaseStyles();
  const backgrounds = getShowcaseBackgrounds();
  const colors = getShowcaseColors();
  const iconBgs = getShowcaseIconBackgrounds();

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
              uiBackground={iconBgs.showcase}
            />
            <Label
              value={'<b>SPEAKER SHOWCASE</b>'}
              fontSize={20}
              color={colors.white}
            />
            <Label
              value={`(${participants.length} Speakers)`}
              fontSize={14}
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
            {participants.length === 0 && (
              <UiEntity uiTransform={styles.messageContainer}>
                <Label
                  value="No current active participants in the Cast"
                  fontSize={16}
                  color={colors.gray}
                />
              </UiEntity>
            )}
            {currentPageParticipants.map(participant => (
              <ParticipantRow
                participant={participant}
                activeTrackSid={activeTrackSid}
                isHovered={hoveredDropdown === participant.name}
                onSelectTrack={onSelectTrack}
                onHoverEnter={() => setHoveredDropdown(participant.name)}
                onHoverLeave={() => setHoveredDropdown(undefined)}
              />
            ))}
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
              color={SHOWCASE_PAGE_INDICATOR_COLOR}
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
