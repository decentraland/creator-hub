import ReactEcs, { Dropdown, UiEntity, Label } from '@dcl/react-ecs';
import { getContentUrl } from '../../constants';
import { Button } from '../../Button';
import { Modal } from '../../Modal';
import { getSourceLabel, isPresentationBot, type FlattenedTrack, type Participant } from '../api';
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
  get STAR() {
    return `${getContentUrl()}/admin_toolkit/assets/icons/star.png`;
  },
};

type SpeakerShowcaseProps = {
  participants: Participant[];
  activeTrackSid: string | undefined;
  onSelectTrack: (track: FlattenedTrack) => void;
  onSetDefault: () => void;
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
  key?: string;
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

  const isBot = isPresentationBot(participant.name);
  const displayName = isBot ? 'Presentation' : participant.name;
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
    <UiEntity uiTransform={styles.userItem}>
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
              value={`<b>${displayName}</b>`}
              fontSize={14}
              color={colors.white}
            />
          </UiEntity>
        </UiEntity>
        <UiEntity uiTransform={styles.rowCenter}>
          {isBot ? (
            <Button
              id={`showcase-activate-${participant.identity}`}
              value={isActive ? '<b>Active</b>' : '<b>Activate</b>'}
              variant={isActive ? 'primary' : 'secondary'}
              disabled={isActive}
              fontSize={14}
              color={colors.white}
              uiTransform={styles.dropdownTransform}
              onMouseDown={() => {
                const track = participant.tracks[0];
                if (track) {
                  onSelectTrack(track);
                }
              }}
            />
          ) : (
            <UiEntity uiTransform={styles.rowCenter}>
              <UiEntity
                uiTransform={{ ...styles.starIcon, display: isActive ? 'flex' : 'none' }}
                uiBackground={iconBgs.star}
              />
              <UiEntity
                uiTransform={styles.dropdownWrapper}
                onMouseEnter={onHoverEnter}
                onMouseLeave={onHoverLeave}
              >
                <Dropdown
                  key={`showcase-dropdown-${participant.identity}-${activeTrackSid ?? 'none'}`}
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
          )}
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
  onSetDefault,
  onClose,
}: SpeakerShowcaseProps) {
  const [page, setPage] = ReactEcs.useState(1);
  const [hoveredDropdown, setHoveredDropdown] = ReactEcs.useState<string | undefined>(undefined);
  const isDefaultActive = !activeTrackSid;

  const styles = getSpeakerShowcaseStyles();
  const colors = getShowcaseColors();
  const iconBgs = getShowcaseIconBackgrounds();

  const totalPages = Math.ceil(participants.length / SPEAKERS_PER_PAGE);
  const startIndex = (page - 1) * SPEAKERS_PER_PAGE;
  const endIndex = Math.min(startIndex + SPEAKERS_PER_PAGE, participants.length);
  const currentPageParticipants = participants.slice(startIndex, endIndex);

  const paginationFooter = participants.length > SPEAKERS_PER_PAGE && (
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
  );

  return (
    <Modal
      id="showcase"
      title="SPEAKER SHOWCASE"
      titleFontSize={20}
      headerIcon={iconBgs.showcase}
      headerIconSize={24}
      headerMarginBottom={16}
      counterText={`(${participants.length} Speakers)`}
      counterFontSize={14}
      width={650}
      height={650}
      padding={16}
      onClose={onClose}
      footer={paginationFooter || undefined}
    >
      <UiEntity uiTransform={{ flexDirection: 'column', width: '100%' }}>
        <UiEntity
          uiTransform={styles.toggleRow}
          uiBackground={{ color: colors.softBlack }}
        >
          <UiEntity uiTransform={{ flexDirection: 'column' }}>
            <Label
              value="Automatic Showcase"
              fontSize={14}
              color={colors.white}
            />
            <Label
              value="Speakers will be automatically featured when they speak"
              fontSize={10}
              color={colors.gray}
            />
          </UiEntity>
          <Button
            id="showcase-default-speaker"
            value={isDefaultActive ? 'Active' : 'Turn On'}
            variant="secondary"
            disabled={isDefaultActive}
            fontSize={14}
            color={colors.white}
            icon={ICONS.STAR}
            iconTransform={{
              ...styles.starIcon,
              display: isDefaultActive ? 'flex' : 'none',
            }}
            iconBackground={{ color: colors.white }}
            uiTransform={{
              ...styles.toggleButton,
              ...(isDefaultActive ? { borderColor: colors.transparent } : {}),
            }}
            onMouseDown={() => {
              if (!isDefaultActive) {
                onSetDefault();
              }
            }}
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
              key={participant.identity}
              participant={participant}
              activeTrackSid={activeTrackSid}
              isHovered={hoveredDropdown === participant.identity}
              onSelectTrack={onSelectTrack}
              onHoverEnter={() => setHoveredDropdown(participant.identity)}
              onHoverLeave={() => setHoveredDropdown(undefined)}
            />
          ))}
        </UiEntity>
      </UiEntity>
    </Modal>
  );
}
