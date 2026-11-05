import { t } from '/@/modules/store/translation/utils';

import { DeleteIcon } from '../../Icons';
import { BulkTrashButton } from './access.styled';

/** A list header's 30 trash, shown while rows are selected; removes the selection. */
export function BulkTrash({ onClick }: { onClick: () => void }) {
  return (
    <BulkTrashButton
      aria-label={t('land_detail.collaborators.remove_selected')}
      onClick={onClick}
    >
      <DeleteIcon />
    </BulkTrashButton>
  );
}
