import { useCallback, useEffect, useMemo, useState } from 'react';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import {
  Box,
  FormGroup,
  IconButton,
  Menu,
  MenuItem,
  OutlinedInput,
  Typography,
} from 'decentraland-ui2';

import { t } from '/@/modules/store/translation/utils';
import type { CompositeEntry } from '/shared/types/composites';

import { Button } from '/@/components/Button';
import { ConfirmationPanel } from '/@/components/ConfirmationPanel';
import { Modal, onBackNoop } from '..';

import './styles.css';

type Props = {
  open: boolean;
  composites: CompositeEntry[];
  existingCustomFolderNames: string[];
  onClose: () => void;
  onDelete: (entry: CompositeEntry) => Promise<void> | void;
  onDuplicate: (entry: CompositeEntry, newName: string) => Promise<void> | void;
};

type DeletePending = { type: 'delete'; entry: CompositeEntry };
type DuplicatePending = {
  type: 'duplicate';
  entry: CompositeEntry;
  name: string;
  error: string | null;
  submitting: boolean;
};
type Pending = DeletePending | DuplicatePending | null;

function sanitize(rawName: string): string {
  return rawName
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function ManageCompositesModal({
  open,
  composites,
  existingCustomFolderNames,
  onClose,
  onDelete,
  onDuplicate,
}: Props) {
  const [pending, setPending] = useState<Pending>(null);
  const [menuFor, setMenuFor] = useState<{ entry: CompositeEntry; anchorEl: HTMLElement } | null>(
    null,
  );

  useEffect(() => {
    if (!open) {
      setPending(null);
      setMenuFor(null);
    }
  }, [open]);

  const handleClose = useCallback(
    (_event: unknown, reason?: 'backdropClick' | 'escapeKeyDown') => {
      if (reason === 'backdropClick') return;
      onClose();
    },
    [onClose],
  );

  const closePrompt = useCallback(() => setPending(null), []);

  const openMenu = useCallback((entry: CompositeEntry, target: HTMLElement) => {
    setMenuFor({ entry, anchorEl: target });
  }, []);
  const closeMenu = useCallback(() => setMenuFor(null), []);

  const startDelete = useCallback((entry: CompositeEntry) => {
    setPending({ type: 'delete', entry });
  }, []);

  const startDuplicate = useCallback((entry: CompositeEntry) => {
    setPending({
      type: 'duplicate',
      entry,
      name: `${entry.displayName}_copy`,
      error: null,
      submitting: false,
    });
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!pending || pending.type !== 'delete') return;
    const entry = pending.entry;
    setPending(null);
    await onDelete(entry);
  }, [pending, onDelete]);

  const getEntrySourceFolder = (entry: CompositeEntry) => {
    const prefix = 'assets/custom/';
    if (!entry.relativePath.startsWith(prefix)) return '';
    const rest = entry.relativePath.slice(prefix.length);
    const slash = rest.indexOf('/');
    return slash >= 0 ? rest.slice(0, slash) : rest;
  };

  const validatePromptName = useCallback(
    (value: string, sourceFolder: string): string | null => {
      const trimmed = value.trim();
      if (!trimmed) return t('editor.composites.create_modal.errors.empty');
      const folder = sanitize(trimmed);
      if (!folder) return t('editor.composites.create_modal.errors.invalid');
      if (folder === sourceFolder) return t('editor.composites.create_modal.errors.exists');
      if (existingCustomFolderNames.includes(folder)) {
        return t('editor.composites.create_modal.errors.exists');
      }
      return null;
    },
    [existingCustomFolderNames],
  );

  const updatePromptName = useCallback(
    (value: string) => {
      setPending(prev => {
        if (!prev || prev.type === 'delete') return prev;
        const sourceFolder = getEntrySourceFolder(prev.entry);
        return {
          ...prev,
          name: value,
          error: validatePromptName(value, sourceFolder),
        };
      });
    },
    [validatePromptName],
  );

  const submitPrompt = useCallback(async () => {
    if (!pending || pending.type === 'delete') return;
    const sourceFolder = getEntrySourceFolder(pending.entry);
    const error = validatePromptName(pending.name, sourceFolder);
    if (error) {
      setPending({ ...pending, error });
      return;
    }
    setPending({ ...pending, submitting: true, error: null });
    try {
      await onDuplicate(pending.entry, pending.name.trim());
      setPending(null);
    } catch (err: any) {
      setPending(prev =>
        prev && prev.type !== 'delete'
          ? {
              ...prev,
              submitting: false,
              error: err?.message ?? t('editor.composites.create_modal.errors.invalid'),
            }
          : prev,
      );
    }
  }, [pending, validatePromptName, onDuplicate]);

  const nonMainComposites = useMemo(() => composites.filter(c => !c.isMain), [composites]);

  const renderList = () => (
    <Box className="ManageCompositesList">
      {composites.map(entry => (
        <Box
          key={entry.relativePath}
          className="ManageCompositesRow"
        >
          <Box className="ManageCompositesRowInfo">
            <span className="ManageCompositesRowName">{entry.displayName}</span>
            <span className="ManageCompositesRowPath">{entry.relativePath}</span>
          </Box>
          {entry.isMain ? (
            <span className="ManageCompositesRowMain">
              {t('editor.composites.modal.main_label')}
            </span>
          ) : (
            <IconButton
              aria-label={t('editor.composites.modal.actions_aria')}
              onClick={event => openMenu(entry, event.currentTarget)}
            >
              <MoreVertIcon />
            </IconButton>
          )}
        </Box>
      ))}
      {nonMainComposites.length === 0 && (
        <Typography
          className="ManageCompositesEmpty"
          variant="body2"
        >
          {t('editor.composites.modal.empty')}
        </Typography>
      )}
    </Box>
  );

  const renderPrompt = (state: DuplicatePending) => (
    <Box className="ManageCompositesPrompt">
      <Typography
        variant="h6"
        className="ManageCompositesPromptTitle"
      >
        {t('editor.composites.modal.duplicate_title', { name: state.entry.displayName })}
      </Typography>
      <FormGroup className="ManageCompositesPromptForm">
        <Typography variant="body1">{t('editor.composites.create_modal.label')}</Typography>
        <OutlinedInput
          autoFocus
          color="secondary"
          placeholder={t('editor.composites.create_modal.placeholder')}
          value={state.name}
          onChange={e => updatePromptName(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void submitPrompt();
            }
          }}
        />
        <Typography
          variant="caption"
          className="ManageCompositesPromptDescription"
        >
          {t('editor.composites.modal.duplicate_description')}
        </Typography>
        {state.error && (
          <Typography
            variant="body2"
            className="ManageCompositesPromptError"
          >
            {state.error}
          </Typography>
        )}
      </FormGroup>
      <Box className="ManageCompositesPromptActions">
        <Button
          color="secondary"
          onClick={closePrompt}
          disabled={state.submitting}
        >
          {t('modal.cancel')}
        </Button>
        <Button
          onClick={submitPrompt}
          disabled={state.submitting || !!state.error || !state.name.trim()}
        >
          {t('editor.composites.modal.duplicate_submit')}
        </Button>
      </Box>
    </Box>
  );

  const body =
    pending && pending.type === 'delete' ? (
      <ConfirmationPanel
        title={t('editor.composites.modal.confirm_title', { name: pending.entry.displayName })}
        warning={t('editor.composites.modal.confirm_warning')}
        cancelLabel={t('modal.cancel')}
        confirmLabel={t('editor.composites.modal.delete')}
        onCancel={closePrompt}
        onConfirm={handleConfirmDelete}
      />
    ) : pending ? (
      renderPrompt(pending)
    ) : (
      renderList()
    );

  return (
    <Modal
      className="ManageCompositesModal"
      open={open}
      size="small"
      title={t('editor.composites.modal.title')}
      onBack={onBackNoop}
      onClose={handleClose}
    >
      {body}
      <Menu
        anchorEl={menuFor?.anchorEl ?? null}
        open={!!menuFor}
        onClose={closeMenu}
      >
        <MenuItem
          onClick={() => {
            if (menuFor) startDuplicate(menuFor.entry);
            closeMenu();
          }}
        >
          {t('editor.composites.modal.duplicate')}
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menuFor) startDelete(menuFor.entry);
            closeMenu();
          }}
        >
          {t('editor.composites.modal.delete')}
        </MenuItem>
      </Menu>
    </Modal>
  );
}
