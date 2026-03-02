import React, { useMemo } from 'react';
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
import { useSelector } from '#store';
import { coordsToId, RoleType } from '/@/lib/land';
import './styles.css';

type Props = {
  children: React.ReactNode;
  isWorld: boolean;
  name?: string;
  project: Project;
  className?: string;
};

enum UserRole {
  OWNER = 'owner',
  COLLABORATOR = 'collaborator',
}

const ProjectStepWrapper: React.FC<Props> = ({ isWorld, name, project, children, className }) => {
  const { chainId, wallet, avatar } = useAuth();
  const ensData = useSelector(state => state.ens.data);
  const landData = useSelector(state => state.land.data);

  const userRole: UserRole | null = useMemo(() => {
    if (!wallet) return null;

    if (isWorld && name) {
      const ensEntry = ensData[name];
      if (ensEntry) {
        const isOwner = ensEntry.nftOwnerAddress?.toLowerCase() === wallet.toLowerCase();
        return isOwner ? UserRole.OWNER : UserRole.COLLABORATOR;
      }
    } else if (!isWorld && project.scene.base) {
      const landEntry = landData.find(
        land =>
          (land.type === 'parcel' && coordsToId(land.x!, land.y!) === project.scene.base) ||
          (land.type === 'estate' &&
            land.parcels?.some(parcel => coordsToId(parcel.x!, parcel.y!) === project.scene.base)),
      );

      if (landEntry) {
        return landEntry.role === RoleType.OWNER ? UserRole.OWNER : UserRole.COLLABORATOR;
      }
    }

    return null;
  }, [wallet, isWorld, project, name, ensData, landData]);

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
        {userRole && (
          <div className="chip role">{t(`modal.publish_project.roles.${userRole}`)}</div>
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
