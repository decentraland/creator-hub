import { useCallback, useState } from 'react';
import FolderIcon from '@mui/icons-material/Folder';
import {
  Box,
  IconButton,
  OutlinedInput,
  Typography,
  FormGroup,
  InputAdornment,
  CircularProgress as Loader,
} from 'decentraland-ui2';

import { t } from '/@/modules/store/translation/utils';

import { useWorkspace } from '/@/hooks/useWorkspace';

import { PublishModal as Modal } from '../PublishProject/PublishModal';
import { Button } from '../../Button';

import type { Props, Value } from './types';

import './styles.css';

export function CreateProject({ open, initialValue, onClose, onSubmit }: Props) {
  const { validateProjectPath, selectNewProjectPath } = useWorkspace();
  const [value, setValue] = useState<Value>(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Runs on blur too, so it must never disable the Create button: pressing the
  // button blurs the input first (mousedown → blur → click), and a button disabled
  // by that blur swallows the click, forcing a second one (#832).
  const validate = useCallback(async () => {
    const result = await validateProjectPath(value.path, value.name);
    if (result === 'invalid-dir') {
      // The Path field expects an existing folder (via the picker) — a bare/typed
      // name isn't a valid directory. Say so, instead of the misleading "exists".
      setError(t('modal.create_project.errors.invalid_directory'));
    } else if (result === 'path-taken') {
      setError(t('modal.create_project.errors.path_exists_or_not_writable'));
    }
    return result === true;
  }, [value, validateProjectPath]);

  const handleChange = useCallback(
    (key: keyof Value) => (event: React.ChangeEvent<HTMLInputElement>) => {
      setError(null);
      setValue(prev => ({ ...prev, [key]: event.target.value }));
    },
    [],
  );

  const handleOpenFolder = useCallback(async () => {
    setError(null);
    setLoading(true);
    const folder = await selectNewProjectPath();
    setLoading(false);
    if (folder) setValue({ ...value, path: folder });
  }, [value]);

  const handleSubmit = useCallback(async () => {
    setLoading(true);
    const valid = await validate();
    setLoading(false);
    if (valid) onSubmit(value);
  }, [onSubmit, value, validate]);

  return (
    <Modal
      open={open}
      title={t('modal.create_project.title')}
      onClose={onClose}
      size="medium"
      actions={
        <>
          <Button
            color="secondary"
            onClick={onClose}
          >
            {t('modal.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !!error}
          >
            {loading ? <Loader size={20} /> : t('modal.create_project.actions.create')}
          </Button>
        </>
      }
    >
      <Box className="CreateProjectModal">
        <FormGroup className="CreateProjectFormControl">
          <Typography variant="body1">{t('modal.create_project.fields.name')}</Typography>
          <OutlinedInput
            color="secondary"
            value={value.name}
            onChange={handleChange('name')}
            onBlur={validate}
          />
          <Typography variant="body1">{t('modal.create_project.fields.path')}</Typography>
          <OutlinedInput
            color="secondary"
            value={value.path}
            onChange={handleChange('path')}
            onBlur={validate}
            endAdornment={
              <InputAdornment position="end">
                <IconButton
                  onClick={handleOpenFolder}
                  edge="end"
                >
                  <FolderIcon />
                </IconButton>
              </InputAdornment>
            }
          />
          {error && (
            <Typography
              variant="body1"
              className="error"
            >
              {error}
            </Typography>
          )}
        </FormGroup>
      </Box>
    </Modal>
  );
}
