import { Alert, Typography } from 'decentraland-ui2';

import { t } from '/@/modules/store/translation/utils';

import './styles.css';

const CONSEQUENCES = ['storage', 'analytics', 'creator_fund', 'badges', 'other'] as const;

type Props =
  | { kind: 'land' }
  | {
      kind: 'world';
      /** Number of existing world scenes the new deployment overlaps. */
      overlap: number;
    };

/**
 * Warns that a deployment breaks the continuity of the scene's Place (its place_id changes),
 * and lists what is tied to the Place and may be lost.
 */
export function PlaceContinuityWarning(props: Props) {
  return (
    <Alert
      severity="warning"
      className="PlaceContinuityWarning"
      data-testid="place-continuity-warning"
    >
      <Typography
        variant="subtitle1"
        className="PlaceContinuityWarning-title"
      >
        {t('modal.publish_project.place_continuity.title')}
      </Typography>
      <Typography variant="body2">
        {props.kind === 'land'
          ? t('modal.publish_project.place_continuity.land_description')
          : t('modal.publish_project.place_continuity.world_description', {
              overlap: props.overlap,
            })}
      </Typography>
      <Typography
        variant="body2"
        className="PlaceContinuityWarning-subtitle"
      >
        {t('modal.publish_project.place_continuity.consequences_title')}
      </Typography>
      <ul>
        {CONSEQUENCES.map(key => (
          <li key={key}>
            <Typography variant="body2">
              {t(`modal.publish_project.place_continuity.consequences.${key}`)}
            </Typography>
          </li>
        ))}
      </ul>
      <Typography variant="body2">{t('modal.publish_project.place_continuity.tip')}</Typography>
    </Alert>
  );
}
