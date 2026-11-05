import { useState } from 'react';
import AddIcon from '@mui/icons-material/Add';

import { useAuth } from '/@/hooks/useAuth';
import { t } from '/@/modules/store/translation/utils';

import { Button } from '../../Button';
import { RecipientField, type Recipient } from '../../ManagePage/RecipientField';
import { AddButton, AddRow, Notice } from './access.styled';

type Props = {
  onAdd: (recipient: Recipient) => void;
  notice?: string;
};

/** The add row: a wallet address or NAME field with an inline Add button; a `notice` blocks Add and says why. */
export function AddRecipient({ onAdd, notice }: Props) {
  const { wallet = '' } = useAuth();
  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const [round, setRound] = useState(0);

  return (
    <AddRow>
      <RecipientField
        key={round}
        purpose="add"
        self={wallet}
        onResolved={setRecipient}
        action={
          <AddButton>
            <Button
              variant="contained"
              color="primary"
              size="small"
              startIcon={<AddIcon />}
              disabled={!recipient || !!notice}
              onClick={() => {
                if (!recipient) return;
                onAdd(recipient);
                setRound(value => value + 1);
              }}
            >
              {t('land_detail.collaborators.add')}
            </Button>
          </AddButton>
        }
      />
      {notice && <Notice role="status">{notice}</Notice>}
    </AddRow>
  );
}
