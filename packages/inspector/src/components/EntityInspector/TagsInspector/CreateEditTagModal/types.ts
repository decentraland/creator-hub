import type { Tag } from '../../../../lib/sdk/components/Tags';

export type Props = {
  open: boolean;
  onClose: () => void;
  tag: Tag | null;
};
