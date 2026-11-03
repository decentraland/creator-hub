import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { Typography } from 'decentraland-ui2';

import { t } from '/@/modules/store/translation/utils';

import './styles.css';

const CONSEQUENCES = ['engagement', 'analytics', 'storage'] as const;

type Props =
  | { kind: 'land' }
  | {
      kind: 'world';
      /** Number of existing world scenes the new deployment overlaps. */
      overlap: number;
    };

/**
 * Warns that a deployment will be registered as a new place (its place_id changes), so the
 * scene's current listing in the Places directory and everything attached to it stay behind.
 */
export function PlaceContinuityWarning(props: Props) {
  return (
    <div
      className="PlaceContinuityWarning"
      role="alert"
      data-testid="place-continuity-warning"
    >
      <div className="PlaceContinuityWarning-icon">
        <WarningAmberIcon fontSize="inherit" />
      </div>
      <div className="PlaceContinuityWarning-body">
        <Typography
          variant="h6"
          className="PlaceContinuityWarning-title"
        >
          {t('modal.publish_project.place_continuity.title')}
        </Typography>
        <Typography
          variant="body2"
          className="PlaceContinuityWarning-description"
        >
          {props.kind === 'land'
            ? t('modal.publish_project.place_continuity.land_description')
            : t('modal.publish_project.place_continuity.world_description', {
                overlap: props.overlap,
              })}
        </Typography>
        <Typography
          variant="overline"
          className="PlaceContinuityWarning-subtitle"
        >
          {t('modal.publish_project.place_continuity.consequences_title')}
        </Typography>
        <ul className="PlaceContinuityWarning-list">
          {CONSEQUENCES.map(key => (
            <li key={key}>
              <Typography variant="body2">
                {t(`modal.publish_project.place_continuity.consequences.${key}`)}
              </Typography>
            </li>
          ))}
        </ul>
        <div className="PlaceContinuityWarning-tip">
          <InfoOutlinedIcon fontSize="inherit" />
          <Typography variant="body2">
            {t(
              props.kind === 'land'
                ? 'modal.publish_project.place_continuity.tip'
                : 'modal.publish_project.place_continuity.world_tip',
            )}
          </Typography>
        </div>
      </div>
    </div>
  );
}
