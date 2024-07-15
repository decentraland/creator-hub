import { useCallback, useState } from 'react';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import cx from 'classnames';
import { Dialog } from 'decentraland-ui2';
import { ModalContent } from 'decentraland-ui2/dist/components/Modal/Modal';
import { Link } from 'react-router-dom';

import { getThumbnailUrl } from '/@/modules/project';
import { t } from '/@/modules/store/translation/utils';

import { Button } from '../Button';
import { Dropdown } from '../Dropdown';

import type { Props } from './types';

import './styles.css';

export function ProjectCard({ project, onDelete, onDuplicate }: Props) {
  const [open, setOpen] = useState(false);
  const parcels = project.layout.cols * project.layout.rows;

  const handleDeleteProject = useCallback(() => {
    onDelete(project);
  }, [project, onDelete]);

  const handleDuplicateProject = useCallback(() => {
    onDuplicate(project);
  }, [project, onDuplicate]);

  const handleOpenModal = useCallback(() => {
    setOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setOpen(false);
  }, []);

  const thumbnailUrl = getThumbnailUrl(project);

  const dropdownOptions = [
    {
      text: t('scene_list.project_actions.duplicate_project'),
      handler: handleDuplicateProject,
    },
    {
      text: t('scene_list.project_actions.delete_project'),
      handler: handleOpenModal,
    },
  ];

  return (
    <div className={cx('ProjectCard', { 'has-thumbnail': !!thumbnailUrl })}>
      <Link
        to={`/editor?path=${encodeURIComponent(project.path)}`}
        className="project-thumbnail"
        style={thumbnailUrl ? { backgroundImage: `url(${thumbnailUrl})` } : {}}
      />
      <div className="project-data">
        <Link
          to={`/editor?path=${encodeURIComponent(project.path)}`}
          className="title-wrapper"
        >
          <div className="title">{project.title}</div>
          <div
            className="description"
            title={project.description}
          >
            <ViewModuleIcon className="Icon" /> {t('scene_list.parcel_count', { parcels })}
          </div>
        </Link>
        <Dropdown
          className="options-dropdown"
          options={dropdownOptions}
        />
      </div>
      <Dialog open={open}>
        <ModalContent
          title={`Delete "${project.title}"`}
          size="tiny"
          actions={
            <>
              <Button
                color="secondary"
                onClick={handleCloseModal}
              >
                {t('modal.cancel')}
              </Button>
              <Button onClick={handleDeleteProject}>{t('modal.confirm')}</Button>
            </>
          }
        >
          {t('modal.irreversible_operation')}
        </ModalContent>
      </Dialog>
    </div>
  );
}
