import { useCallback } from 'react';
import CheckIcon from '@mui/icons-material/Check';
import DeleteIcon from '@mui/icons-material/Delete';
import {
  Box,
  Checkbox,
  IconButton,
  FormControlLabel,
  Typography,
  FormGroup,
  Select,
  MenuItem,
  CircularProgress,
} from 'decentraland-ui2';

import type { EditorConfig } from '/shared/types/config';
import { t } from '/@/modules/store/translation/utils';
import type { EditorTabProps } from '../../types';

import './styles.css';

const EditorTab: React.FC<EditorTabProps> = ({
  settings,
  updateSettings,
  editors,
  loading,
  onSetDefaultEditor,
  onAddEditor,
  onRemoveEditor,
  onSelectEditorPath,
}) => {
  const handleEditorChange = useCallback(
    (selectedPath: string) => {
      if (selectedPath) {
        onSetDefaultEditor(selectedPath);
      }
    },
    [onSetDefaultEditor],
  );

  const handleAddCustomEditor = useCallback(async () => {
    const editorPath = await onSelectEditorPath();
    if (editorPath) {
      onAddEditor(editorPath);
    }
  }, [onSelectEditorPath, onAddEditor]);

  const handlePreviewOptionChange = useCallback(
    (option: keyof typeof settings.previewOptions, checked: boolean) => {
      const newSettings = {
        ...settings,
        previewOptions: {
          ...settings.previewOptions,
          [option]: checked,
        },
      };
      updateSettings(newSettings);
    },
    [settings, updateSettings],
  );

  return (
    <Box className="FormContainer">
      <FormGroup className="CodeEditorFormGroup">
        <Typography variant="body1">{t('modal.app_settings.fields.code_editor.label')}</Typography>
        {loading ? (
          <CircularProgress size={24} />
        ) : (
          <Select
            fullWidth
            displayEmpty
            value={(editors && editors.find(e => e.isDefault)?.path) || ''}
            renderValue={value =>
              (editors && editors.find(e => e.path === value)?.name) ||
              'Add or select a default editor'
            }
            onChange={event => handleEditorChange(event.target.value as string)}
          >
            {(editors || []).map((editor: EditorConfig) => (
              <MenuItem
                key={editor.path}
                value={editor.path}
                className="editor-select"
              >
                <span>{editor.name}</span>
                <Box className="EditorActionsBox">
                  {editor.isDefault && <CheckIcon className="default-icon menu-only" />}
                  <IconButton
                    size="small"
                    onClick={e => {
                      e.stopPropagation();
                      onRemoveEditor(editor.path);
                    }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              </MenuItem>
            ))}
            <MenuItem
              className="custom-editor"
              onMouseDown={async (e: React.MouseEvent) => {
                e.preventDefault();
                await handleAddCustomEditor();
              }}
            >
              {t('modal.app_settings.fields.code_editor.choose_device')}
            </MenuItem>
          </Select>
        )}
      </FormGroup>
      <FormGroup className="PreviewOptionsFormGroup">
        <Typography variant="body1">{t('editor.header.actions.preview_options.title')}</Typography>
        <FormControlLabel
          control={
            <Checkbox
              checked={!!settings.previewOptions.debugger}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                handlePreviewOptionChange('debugger', event.target.checked)
              }
            />
          }
          label={t('editor.header.actions.preview_options.debugger')}
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={!!settings.previewOptions.enableLandscapeTerrains}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                handlePreviewOptionChange('enableLandscapeTerrains', event.target.checked)
              }
            />
          }
          label={t('editor.header.actions.preview_options.landscape_terrain_enabled')}
        />
      </FormGroup>
      <FormGroup className="AppWarningsFormGroup">
        <Typography variant="body1">{t('modal.app_settings.fields.app_warnings.label')}</Typography>
        <FormControlLabel
          control={
            <Checkbox
              checked={!!settings.previewOptions.showWarnings}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                handlePreviewOptionChange('showWarnings', event.target.checked)
              }
            />
          }
          label={t('modal.app_settings.fields.app_warnings.show_warnings')}
        />
      </FormGroup>
    </Box>
  );
};

export default EditorTab;
