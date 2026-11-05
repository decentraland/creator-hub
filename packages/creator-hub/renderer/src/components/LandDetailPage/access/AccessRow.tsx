import type { ReactNode } from 'react';
import { IconButton } from 'decentraland-ui2';

import { t } from '/@/modules/store/translation/utils';

import { DeleteIcon } from '../../Icons';
import { AvatarWithInfo } from '../../AvatarWithInfo';
import { Row } from './access.styled';
import { useDisplayName } from './useDisplayName';

type Props = {
  address: string;
  select?: ReactNode;
  scope?: ReactNode;
  note?: ReactNode;
  onRemove: () => void;
};

/** One account with access to the LAND, with optional selection, scope and note slots. */
export function AccessRow({ address, select, scope, note, onRemove }: Props) {
  const displayName = useDisplayName();
  return (
    <Row>
      <span className="Lead">
        {select}
        <span className="Who">
          <AvatarWithInfo value={address} />
        </span>
      </span>
      {scope && <span className="Scope">{scope}</span>}
      {note && <span className="Note">{note}</span>}
      <IconButton
        className="Trash"
        aria-label={t('land_detail.collaborators.remove_label', { name: displayName(address) })}
        onClick={onRemove}
      >
        <DeleteIcon />
      </IconButton>
    </Row>
  );
}
