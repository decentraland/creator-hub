import { useCallback, useRef, useState } from 'react';
import AddIcon from '@mui/icons-material/Add';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import { MenuItem } from 'decentraland-ui2';

import { useWorkspace } from '/@/hooks/useWorkspace';
import { t } from '/@/modules/store/translation/utils';
import { CreateProject } from '../Modals/CreateProject';

import {
  StyledButtonRow,
  StyledLabelButton,
  StyledMenu,
  StyledToggleButton,
} from './component.styled';
import type { CreateProjectValue, NewProjectPayload } from './types';

export function CreateButton() {
  const { createProject, getAvailableProject, importProject } = useWorkspace();
  const anchorRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [newProject, setNewProject] = useState<NewProjectPayload | undefined>();

  const handleOpenMenu = useCallback(() => setOpen(true), []);
  const handleCloseMenu = useCallback(() => setOpen(false), []);

  const handleClickNewScene = useCallback(async () => {
    setOpen(false);
    const [error, data] = await getAvailableProject();
    if (error) return;
    const { name, path } = data;
    setNewProject({
      name,
      path: path.endsWith(name) ? path.slice(0, -name.length) : path,
    });
  }, [getAvailableProject]);

  const handleClickImportScene = useCallback(() => {
    setOpen(false);
    importProject();
  }, [importProject]);

  const handleCreateProject = useCallback(
    (value: CreateProjectValue) => {
      if (!newProject) return;
      createProject({ ...newProject, ...value });
      setNewProject(undefined);
    },
    [createProject, newProject],
  );

  return (
    <>
      <StyledButtonRow ref={anchorRef}>
        <StyledLabelButton
          variant="contained"
          disableRipple
          data-testid="create-button"
          startIcon={<AddIcon sx={{ fontSize: 18 }} />}
          onClick={handleClickNewScene}
        >
          {t('navbar.create.label')}
        </StyledLabelButton>
        <StyledToggleButton
          variant="contained"
          disableRipple
          data-testid="create-button-toggle"
          aria-label={t('navbar.create.label')}
          aria-haspopup="menu"
          aria-expanded={open ? 'true' : undefined}
          onClick={handleOpenMenu}
        >
          <ArrowDropDownIcon sx={{ fontSize: 18 }} />
        </StyledToggleButton>
      </StyledButtonRow>
      <StyledMenu
        anchorEl={anchorRef.current}
        open={open}
        onClose={handleCloseMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem
          data-testid="create-button-new-scene"
          onClick={handleClickNewScene}
        >
          <AddIcon fontSize="small" />
          {t('navbar.create.new_scene')}
        </MenuItem>
        <MenuItem
          data-testid="create-button-import-scene"
          onClick={handleClickImportScene}
        >
          <FileDownloadOutlinedIcon fontSize="small" />
          {t('navbar.create.import_scene')}
        </MenuItem>
      </StyledMenu>
      {newProject && (
        <CreateProject
          open
          initialValue={newProject}
          onClose={() => setNewProject(undefined)}
          onSubmit={handleCreateProject}
        />
      )}
    </>
  );
}
