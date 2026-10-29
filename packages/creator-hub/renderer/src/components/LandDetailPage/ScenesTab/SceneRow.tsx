import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/FileDownloadOutlined';
import GridIcon from '@mui/icons-material/GridViewOutlined';
import { IconButton, Tooltip } from 'decentraland-ui2';

import type { LandScene } from '/@/modules/store/management/utils';
import { t } from '/@/modules/store/translation/utils';
import FallbackThumbnail from '/assets/images/scene-thumbnail-fallback.png';

import { SelectCheckbox } from '../SelectCheckbox';
import { MapPinIcon } from '../../Icons';
import { Image } from '../../Image';
import { Loader } from '../../Loader';
import { DeployerCell } from './DeployerCell';
import { formatSceneDate } from './scenes';
import { Actions, Meta, SceneName, UpdatedAt } from './ScenesTab.styled';

export type RowMode = 'manage' | 'view';
export type DownloadState = { kind: 'idle' } | { kind: 'running'; done: number; total: number };

type Props = {
  scene: LandScene;
  mode: RowMode;
  selected: boolean;
  download: DownloadState;
  deployer?: string;
  onSelect: () => void;
  onDownload: () => void;
  onCancelDownload: () => void;
  onUnpublish: () => void;
};

/** One deployed scene in the LAND's Scenes table. */
export function SceneRow(props: Props) {
  const { scene, mode, selected, download } = props;
  const date = formatSceneDate(scene.timestamp);
  return (
    <tr className={selected ? 'Selected' : undefined}>
      {mode === 'manage' && (
        <td className="Select">
          <SelectCheckbox
            checked={selected}
            onChange={props.onSelect}
            inputProps={{ 'aria-label': t('land_detail.scenes.select', { scene: scene.title }) }}
          />
        </td>
      )}
      <td>
        <SceneName>
          <Image
            src={scene.thumbnail}
            alt=""
            fallbackSrc={FallbackThumbnail}
          />
          <span>{scene.title}</span>
        </SceneName>
      </td>
      <td>
        <Meta>
          <GridIcon aria-hidden />
          {scene.parcels.length}
        </Meta>
      </td>
      <td>
        <Meta role="status">
          {download.kind === 'running' ? (
            <>
              <Loader size={16} />
              {t('land_detail.download.progress', { done: download.done, total: download.total })}
            </>
          ) : (
            <>
              <MapPinIcon />
              {scene.base}
            </>
          )}
        </Meta>
      </td>
      <td>
        <Meta>
          <Tooltip title={date.long}>
            <UpdatedAt
              dateTime={date.iso}
              tabIndex={0}
            >
              {date.medium}
            </UpdatedAt>
          </Tooltip>
        </Meta>
      </td>
      <td>
        <DeployerCell address={props.deployer} />
      </td>
      <Actions>
        <span className={download.kind === 'running' ? 'Actions Running' : 'Actions'}>
          {download.kind === 'running' ? (
            <IconButton
              aria-label={t('land_detail.download.cancel', { scene: scene.title })}
              onClick={props.onCancelDownload}
            >
              <CloseIcon />
            </IconButton>
          ) : (
            <IconButton
              aria-label={t('land_detail.scenes.download', { scene: scene.title })}
              onClick={props.onDownload}
            >
              <DownloadIcon />
            </IconButton>
          )}
          {mode === 'manage' && download.kind !== 'running' && (
            <IconButton
              className="Unpublish"
              aria-label={t('land_detail.scenes.unpublish', { scene: scene.title })}
              onClick={props.onUnpublish}
            >
              <CloseIcon />
            </IconButton>
          )}
        </span>
      </Actions>
    </tr>
  );
}
