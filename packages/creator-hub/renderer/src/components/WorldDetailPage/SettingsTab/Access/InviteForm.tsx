import { useEffect, useId, useRef, useState } from 'react';
import AddIcon from '@mui/icons-material/Add';
import FileIcon from '@mui/icons-material/InsertDriveFileOutlined';
import SearchIcon from '@mui/icons-material/Search';
import { InputAdornment, Tab } from 'decentraland-ui2';

import { useAuth } from '/@/hooks/useAuth';
import communities, { getCommunityThumbnailUrl, type CommunityMinimal } from '/@/lib/communities';
import { t } from '/@/modules/store/translation/utils';

import { Button } from '../../../Button';
import { RecipientField, type Recipient } from '../../../ManagePage/RecipientField';
import { FormTextInput } from '../../../TextInput';
import { parseCsv, type CsvResult } from './csv';
import {
  AddButtons,
  AddRow,
  BrowseButton,
  CsvBlock,
  CsvButton,
  DropZone,
  FileName,
  Invalid,
  InviteBlock,
  InviteTabs,
  Results,
} from './Access.styled';

const SEARCH_MIN = 3;
const SEARCH_DELAY_MS = 300;

type InviteTab = 'user' | 'community' | 'csv';

type Props = {
  onAddWallet: (address: string) => void;
  onAddCommunity: (id: string) => void;
  onAddCsv: (data: { addresses: string[]; communityIds: string[] }) => void;
};

function AddButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  return (
    <Button
      variant="contained"
      color="primary"
      startIcon={<AddIcon />}
      disabled={disabled}
      onClick={onClick}
    >
      {t('land_detail.collaborators.add')}
    </Button>
  );
}

function UserPanel({ onAdd }: { onAdd: (address: string) => void }) {
  const { wallet = '' } = useAuth();
  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const [round, setRound] = useState(0);
  return (
    <AddRow>
      <span className="Field">
        <RecipientField
          key={round}
          purpose="add"
          self={wallet}
          onResolved={setRecipient}
        />
      </span>
      <AddButtons>
        <AddButton
          disabled={!recipient}
          onClick={() => {
            if (!recipient) return;
            onAdd(recipient.address);
            setRound(value => value + 1);
          }}
        />
      </AddButtons>
    </AddRow>
  );
}

function CommunityPanel({ onAdd }: { onAdd: (id: string) => void }) {
  const { wallet } = useAuth();
  const listId = useId();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CommunityMinimal[]>([]);
  const [picked, setPicked] = useState<CommunityMinimal | null>(null);

  useEffect(() => {
    if (picked || query.trim().length < SEARCH_MIN || !wallet) {
      setResults([]);
      return;
    }
    let current = true;
    const timer = setTimeout(async () => {
      const found = await communities.fetchCommunities(wallet, {
        search: query.trim(),
        minimal: true,
        limit: 10,
      });
      if (current) setResults(found?.data?.results ?? []);
    }, SEARCH_DELAY_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [query, picked, wallet]);

  return (
    <AddRow>
      <span className="Field">
        <FormTextInput
          fullWidth
          value={picked?.name ?? query}
          placeholder={t('world_detail.settings.access.search')}
          inputProps={{
            'aria-label': t('world_detail.settings.access.search'),
            'aria-controls': results.length ? listId : undefined,
          }}
          startAdornment={
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          }
          onChange={event => {
            setPicked(null);
            setQuery(event.target.value);
          }}
        />
      </span>
      <AddButtons>
        <AddButton
          disabled={!picked}
          onClick={() => {
            if (!picked) return;
            onAdd(picked.id);
            setPicked(null);
            setQuery('');
          }}
        />
      </AddButtons>
      {results.length > 0 && (
        <Results
          id={listId}
          role="listbox"
        >
          {results.map(community => (
            <li key={community.id}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => {
                  setPicked(community);
                  setResults([]);
                }}
              >
                <img
                  src={getCommunityThumbnailUrl(community.id)}
                  alt=""
                />
                {community.name}
              </button>
            </li>
          ))}
        </Results>
      )}
    </AddRow>
  );
}

function CsvPanel({ onAdd }: { onAdd: Props['onAddCsv'] }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<CsvResult | null>(null);
  const [dragging, setDragging] = useState(false);
  const invalidId = useId();

  useEffect(() => {
    const prevent = (event: Event) => event.preventDefault();
    document.addEventListener('dragover', prevent, true);
    document.addEventListener('drop', prevent, true);
    return () => {
      document.removeEventListener('dragover', prevent, true);
      document.removeEventListener('drop', prevent, true);
    };
  }, []);

  const read = (file: File | undefined) => {
    if (!file || !file.name.toLowerCase().endsWith('.csv')) return;
    void file.text().then(content => setResult(parseCsv(file.name, content)));
  };
  const browse = () => fileInput.current?.click();
  const invalid = result?.invalidLines.length ?? 0;

  return (
    <CsvBlock>
      <input
        ref={fileInput}
        data-testid="csv-input"
        type="file"
        accept=".csv,text/csv"
        hidden
        onChange={event => {
          read(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      {result ? (
        <AddRow>
          <FileName>
            <FileIcon />
            <span>{result.fileName}</span>
          </FileName>
          <AddButtons>
            <CsvButton
              type="button"
              tone="neutral"
              onClick={() => setResult(null)}
            >
              {t('modal.cancel')}
            </CsvButton>
            {invalid ? (
              <CsvButton
                type="button"
                tone="primary"
                aria-describedby={invalidId}
                onClick={browse}
              >
                {t('world_detail.settings.access.csv_replace')}
              </CsvButton>
            ) : (
              <AddButton
                disabled={!result.addresses.length && !result.communityIds.length}
                onClick={() => {
                  onAdd(result);
                  setResult(null);
                }}
              />
            )}
          </AddButtons>
        </AddRow>
      ) : (
        <DropZone
          dragging={dragging ? 'over' : 'idle'}
          tabIndex={0}
          onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              browse();
            }
          }}
          onDragOver={event => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={event => {
            event.preventDefault();
            setDragging(false);
            read(event.dataTransfer.files[0]);
          }}
        >
          {t('world_detail.settings.access.csv_drop_text')}
          <BrowseButton
            type="button"
            tabIndex={-1}
            onClick={browse}
          >
            {t('world_detail.settings.access.csv_browse')}
          </BrowseButton>
        </DropZone>
      )}
      {invalid > 0 && (
        <Invalid
          id={invalidId}
          aria-live="polite"
        >
          {t('world_detail.settings.access.csv_invalid_count', { count: invalid })}
        </Invalid>
      )}
    </CsvBlock>
  );
}

/** The Invitation Only add area: a wallet, a community or a CSV, each added at once. */
export function InviteForm({ onAddWallet, onAddCommunity, onAddCsv }: Props) {
  const [tab, setTab] = useState<InviteTab>('user');
  const panelId = useId();
  return (
    <InviteBlock>
      <InviteTabs
        value={tab}
        onChange={(_, next: InviteTab) => setTab(next)}
      >
        <Tab
          value="user"
          label={t('world_detail.settings.access.tab_user')}
          aria-controls={panelId}
        />
        <Tab
          value="community"
          label={t('world_detail.settings.access.tab_community')}
          aria-controls={panelId}
        />
        <Tab
          value="csv"
          label={t('world_detail.settings.access.tab_csv')}
          aria-controls={panelId}
        />
      </InviteTabs>
      <div
        role="tabpanel"
        id={panelId}
        className="InvitePanel"
      >
        {tab === 'user' && <UserPanel onAdd={onAddWallet} />}
        {tab === 'community' && <CommunityPanel onAdd={onAddCommunity} />}
        {tab === 'csv' && <CsvPanel onAdd={onAddCsv} />}
      </div>
    </InviteBlock>
  );
}
