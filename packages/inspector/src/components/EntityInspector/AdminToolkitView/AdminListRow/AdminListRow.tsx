import React from 'react';
import { VscTrash as RemoveIcon } from 'react-icons/vsc';

import { Block } from '../../../Block';
import { Button } from '../../../Button';
import MoreOptionsMenu from '../../MoreOptionsMenu';

import './AdminListRow.css';

type Props = {
  index: number;
  onRemove: () => void;
};

const AdminListRow: React.FC<React.PropsWithChildren<Props>> = ({ index, onRemove, children }) => (
  <Block className="AdminListRow">
    <div className="LeftColumn">
      <span>{index + 1}</span>
    </div>
    <div className="FieldsContainer">{children}</div>
    <div className="RightMenu">
      <MoreOptionsMenu>
        <Button
          className="RemoveButton"
          onClick={onRemove}
        >
          <RemoveIcon /> Remove
        </Button>
      </MoreOptionsMenu>
    </div>
  </Block>
);

export default AdminListRow;
