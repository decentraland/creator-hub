import type { Tag } from '../../../../lib/sdk/components/Tags';

export interface DeleteConfirmationModalProps {
  tag: Tag;
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}
