import { useCallback, useState } from 'react';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { Box, IconButton, Typography } from 'decentraland-ui2';

import { t } from '/@/modules/store/translation/utils';
import type { CompositeEntry } from '/shared/types/composites';

import { ConfirmationPanel } from '/@/components/ConfirmationPanel';
import { Modal, onBackNoop } from '..';

import './styles.css';

type Props = {
  open: boolean;
  composites: CompositeEntry[];
  onClose: () => void;
  onDelete: (entry: CompositeEntry) => Promise<void> | void;
};

export function ManageCompositesModal({ open, composites, onClose, onDelete }: Props) {
  const [pendingDelete, setPendingDelete] = useState<CompositeEntry | null>(null);

  const handleClose = useCallback(
    (_event: unknown, reason?: 'backdropClick' | 'escapeKeyDown') => {
      if (reason === 'backdropClick') return;
      onClose();
    },
    [onClose],
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    const entry = pendingDelete;
    setPendingDelete(null);
    await onDelete(entry);
  }, [pendingDelete, onDelete]);

  const handleCancelDelete = useCallback(() => setPendingDelete(null), []);

  const nonMainComposites = composites.filter(c => !c.isMain);

  return (
    <Modal
      className="ManageCompositesModal"
      open={open}
      size="small"
      title={t('editor.composites.modal.title')}
      onBack={onBackNoop}
      onClose={handleClose}
    >
      {pendingDelete ? (
        <ConfirmationPanel
          title={t('editor.composites.modal.confirm_title', { name: pendingDelete.displayName })}
          warning={t('editor.composites.modal.confirm_warning')}
          cancelLabel={t('modal.cancel')}
          confirmLabel={t('editor.composites.modal.delete')}
          onCancel={handleCancelDelete}
          onConfirm={handleConfirmDelete}
        />
      ) : (
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
                  aria-label={t('editor.composites.modal.delete')}
                  onClick={() => setPendingDelete(entry)}
                >
                  <DeleteOutlineIcon />
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
      )}
    </Modal>
  );
}
