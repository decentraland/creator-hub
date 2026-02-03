import React from 'react';
import cx from 'classnames';
import PinIcon from '@mui/icons-material/Place';
import ParcelsIcon from '@mui/icons-material/GridViewRounded';
import { ChainId } from '@dcl/schemas';
import { Address, Typography } from 'decentraland-ui2';
import { addBase64ImagePrefix } from '/@/modules/image';
import { formatWorldSize } from '/@/modules/world';
import { t } from '/@/modules/store/translation/utils';
import type { Project } from '/shared/types/projects';
import { useAuth } from '/@/hooks/useAuth';
import './styles.css';

type Props = {
  children: React.ReactNode;
  isWorld: boolean;
  project: Project;
  className?: string;
};

const ProjectStepWrapper: React.FC<Props> = ({ isWorld, project, children, className }) => {
  const { chainId, wallet, avatar } = useAuth();

  return (
    <div className="ProjectStepWrapper">
      <div className="ChipsContainer">
        <div className="chip network">
          {chainId === ChainId.ETHEREUM_MAINNET
            ? t('modal.publish_project.deploy.ethereum.mainnet')
            : t('modal.publish_project.deploy.ethereum.testnet')}
        </div>
        {wallet && (
          <div className="chip address">
            <Address
              value={wallet}
              shorten
            />
          </div>
        )}
        {isWorld ? (
          avatar && (
            <div className="chip username">
              {avatar.name}
              {avatar.hasClaimedName ? <i className="verified"></i> : null}
            </div>
          )
        ) : (
          <div className="chip parcel">
            <PinIcon className="pin" />
            {project.scene.base}
          </div>
        )}
      </div>
      <div className="ProjectContainer">
        <div className="info">
          <div
            className="thumbnail"
            style={{ backgroundImage: `url(${addBase64ImagePrefix(project.thumbnail)})` }}
          />
          <div className="text">
            <Typography variant="h6">{project.title}</Typography>
            <Typography
              variant="body2"
              className="parcels"
            >
              <ParcelsIcon />
              {t('modal.publish_project.deploy.scene_size', {
                size: formatWorldSize({ width: project.layout.cols, height: project.layout.rows }),
              })}
            </Typography>
          </div>
        </div>
        <div className={cx('content', className)}>{children}</div>
      </div>
    </div>
  );
};

export { ProjectStepWrapper };
