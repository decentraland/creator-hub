import { useState } from 'react';
import AddIcon from '@mui/icons-material/Add';

import { useAuth } from '/@/hooks/useAuth';
import { t } from '/@/modules/store/translation/utils';

import { Button } from '../../Button';
import { RecipientField, type Recipient } from '../../ManagePage/RecipientField';
import { AddButton, AddRow } from './access.styled';

/** The add row: a wallet address or NAME field with an inline Add button. */
export function AddRecipient({ onAdd }: { onAdd: (recipient: Recipient) => void }) {
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
              disabled={!recipient}
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
    </AddRow>
  );
}
