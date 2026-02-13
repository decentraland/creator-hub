import React, { useCallback, useEffect, useRef, useState } from 'react';
import SearchIcon from '@mui/icons-material/Search';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import { isValid as isValidAddress } from 'decentraland-ui2/dist/components/AddressField/utils';
import {
  Box,
  CircularProgress,
  InputAdornment,
  Tab,
  Tabs,
  TextField,
  Typography,
} from 'decentraland-ui2';
import { t } from '/@/modules/store/translation/utils';
import { Button } from '/@/components/Button';
import { useAuth } from '/@/hooks/useAuth';
import communities, { type CommunityMinimal } from '/@/lib/communities';
import './styles.css';

enum InviteTab {
  WalletAddress = 0,
  Community = 1,
  ImportCsv = 2,
}

type CsvParseResult = {
  fileName: string;
  addresses: string[];
  communityIds: string[];
  invalidLines: string[];
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseCsvContent(fileName: string, content: string): CsvParseResult {
  const lines = content
    .split(/[\r\n]+/)
    .map(line => line.trim())
    .filter(line => line.length > 0);

  const addresses: string[] = [];
  const communityIds: string[] = [];
  const invalidLines: string[] = [];

  for (const line of lines) {
    if (isValidAddress(line)) {
      addresses.push(line.toLowerCase());
    } else if (UUID_REGEX.test(line)) {
      communityIds.push(line);
    } else {
      invalidLines.push(line);
    }
  }

  return {
    fileName,
    addresses: [...new Set(addresses)],
    communityIds: [...new Set(communityIds)],
    invalidLines,
  };
}

export type CsvData = {
  addresses: string[];
  communityIds: string[];
};

type Props = {
  onSubmitAddress: (address: string) => void;
  onSubmitCommunity: (communityId: string) => void;
  onSubmitCsv: (data: CsvData) => void;
  onCancel: () => void;
};

export const WorldPermissionsAddUserForm: React.FC<Props> = React.memo(
  ({ onSubmitAddress, onSubmitCommunity, onSubmitCsv, onCancel }) => {
    const { wallet } = useAuth();
    const [address, setAddress] = useState('');
    const [hasError, setHasError] = useState(false);
    const [activeTab, setActiveTab] = useState<InviteTab>(InviteTab.WalletAddress);

    // Community search state
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<CommunityMinimal[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedCommunity, setSelectedCommunity] = useState<CommunityMinimal | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // CSV state
    const [csvResult, setCsvResult] = useState<CsvParseResult | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleChangeAddress = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
      setAddress(event.target.value);
      setHasError(false);
    }, []);

    const handleAddAddress = useCallback(() => {
      if (hasError || !address) return;
      if (!isValidAddress(address)) {
        setHasError(true);
        return;
      }
      onSubmitAddress(address);
      setAddress('');
    }, [address, hasError, onSubmitAddress]);

    const handleConfirmCommunity = useCallback(() => {
      if (!selectedCommunity) return;
      onSubmitCommunity(selectedCommunity.id);
    }, [selectedCommunity, onSubmitCommunity]);

    const handleConfirmCsv = useCallback(() => {
      if (!csvResult) return;
      onSubmitCsv({
        addresses: csvResult.addresses,
        communityIds: csvResult.communityIds,
      });
    }, [csvResult, onSubmitCsv]);

    const handleCancel = useCallback(() => {
      setAddress('');
      setHasError(false);
      setSearchQuery('');
      setSearchResults([]);
      setSelectedCommunity(null);
      setCsvResult(null);
      onCancel();
    }, [onCancel]);

    const handleTabChange = useCallback((_: React.SyntheticEvent, newValue: InviteTab) => {
      setActiveTab(newValue);
      setSelectedCommunity(null);
    }, []);

    const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setSearchQuery(value);
      setSelectedCommunity(null);
    }, []);

    const handleSelectCommunity = useCallback((community: CommunityMinimal) => {
      setSelectedCommunity(community);
    }, []);

    // CSV file handling
    const processFile = useCallback((file: File) => {
      if (!file.name.toLowerCase().endsWith('.csv')) return;
      const reader = new FileReader();
      reader.onload = e => {
        const content = e.target?.result as string;
        setCsvResult(parseCsvContent(file.name, content));
      };
      reader.readAsText(file);
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
    }, []);

    const handleDrop = useCallback(
      (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) processFile(file);
      },
      [processFile],
    );

    const handleFileInputChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) processFile(file);
        // Reset input so same file can be selected again
        if (fileInputRef.current) fileInputRef.current.value = '';
      },
      [processFile],
    );

    const handleBrowseClick = useCallback(() => {
      fileInputRef.current?.click();
    }, []);

    // Debounced community search
    useEffect(() => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      if (searchQuery.length < 3) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      debounceRef.current = setTimeout(async () => {
        if (!wallet) {
          setIsSearching(false);
          return;
        }
        const result = await communities.fetchCommunities(wallet, {
          search: searchQuery,
          minimal: true,
          limit: 10,
        });
        setSearchResults(result?.data?.results ?? []);
        setIsSearching(false);
      }, 300);

      return () => {
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
        }
      };
    }, [searchQuery]);

    const isWalletTab = activeTab === InviteTab.WalletAddress;
    const isCommunityTab = activeTab === InviteTab.Community;
    const isCsvTab = activeTab === InviteTab.ImportCsv;

    const csvHasData =
      csvResult && (csvResult.addresses.length > 0 || csvResult.communityIds.length > 0);

    let confirmDisabled = true;
    let confirmHandler = handleAddAddress;
    if (isWalletTab) {
      confirmDisabled = !address || hasError;
      confirmHandler = handleAddAddress;
    } else if (isCommunityTab) {
      confirmDisabled = !selectedCommunity;
      confirmHandler = handleConfirmCommunity;
    } else if (isCsvTab) {
      confirmDisabled = !csvHasData;
      confirmHandler = handleConfirmCsv;
    }

    return (
      <Box className="AddUserForm">
        <Typography
          variant="h6"
          className="AddUserFormTitle"
        >
          {t('modal.world_permissions.access.new_invite')}
        </Typography>

        <Tabs
          className="AddUserFormTabs"
          value={activeTab}
          onChange={handleTabChange}
        >
          <Tab label={t('modal.world_permissions.access.invite_tabs.wallet_address')} />
          <Tab label={t('modal.world_permissions.access.invite_tabs.community')} />
          <Tab label={t('modal.world_permissions.access.invite_tabs.import_csv')} />
        </Tabs>

        {isWalletTab && (
          <TextField
            placeholder="0x..."
            variant="outlined"
            size="medium"
            fullWidth
            value={address}
            onChange={handleChangeAddress}
            error={hasError}
            helperText={hasError ? t('modal.world_permissions.access.wrong_address_format') : ''}
          />
        )}

        {isCommunityTab && (
          <Box className="CommunitySearchContainer">
            <TextField
              placeholder={t('modal.world_permissions.access.community_search_placeholder')}
              variant="outlined"
              size="medium"
              fullWidth
              value={selectedCommunity ? selectedCommunity.name : searchQuery}
              onChange={handleSearchChange}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    {isSearching ? <CircularProgress size={18} /> : <SearchIcon fontSize="small" />}
                  </InputAdornment>
                ),
              }}
            />
            {!isSearching &&
              !selectedCommunity &&
              searchQuery.length >= 3 &&
              searchResults.length === 0 && (
                <Typography
                  className="CommunitySearchStatus"
                  variant="body2"
                >
                  {t('modal.world_permissions.access.community_no_results')}
                </Typography>
              )}
            {searchResults.length > 0 && !selectedCommunity && (
              <Box className="CommunitySearchDropdown">
                {searchResults.map(community => (
                  <Box
                    key={community.id}
                    className="CommunitySearchDropdownItem"
                    onClick={() => handleSelectCommunity(community)}
                  >
                    <Typography variant="body2">
                      {community.name}{' '}
                      <Typography
                        component="span"
                        variant="caption"
                        className="CommunitySearchDropdownMembers"
                      >
                        (
                        {t('modal.world_permissions.access.community_members', {
                          count: community.membersCount,
                        })}
                        )
                      </Typography>
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
            {selectedCommunity && (
              <Typography
                className="CommunitySelectedInfo"
                variant="body2"
              >
                {selectedCommunity.privacy === 'public'
                  ? t('modal.world_permissions.access.community_privacy_public')
                  : t('modal.world_permissions.access.community_privacy_private')}
                {' · '}
                {t('modal.world_permissions.access.community_members', {
                  count: selectedCommunity.membersCount,
                })}
              </Typography>
            )}
          </Box>
        )}

        {isCsvTab && (
          <Box className="CsvContainer">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              style={{ display: 'none' }}
              onChange={handleFileInputChange}
            />
            {!csvResult ? (
              <Box
                className={`CsvDropZone ${isDragging ? 'Dragging' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <Typography
                  variant="body2"
                  className="CsvDropZoneText"
                >
                  {t('modal.world_permissions.access.csv_drop_text')}
                </Typography>
                <Typography
                  variant="body2"
                  className="CsvDropZoneBrowse"
                  onClick={handleBrowseClick}
                >
                  {t('modal.world_permissions.access.csv_browse')}
                </Typography>
              </Box>
            ) : (
              <Box
                className={`CsvDropZone CsvFileInfo ${isDragging ? 'Dragging' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <Box className="CsvFileDetails">
                  <Box className="CsvFileNameRow">
                    <InsertDriveFileOutlinedIcon fontSize="small" />
                    <Typography
                      variant="body2"
                      className="CsvFileName"
                    >
                      {csvResult.fileName}
                    </Typography>
                  </Box>
                  {csvResult.addresses.length > 0 && (
                    <Typography
                      variant="caption"
                      className="CsvFileStat"
                    >
                      {t('modal.world_permissions.access.csv_addresses_count', {
                        count: csvResult.addresses.length,
                      })}
                    </Typography>
                  )}
                  {csvResult.communityIds.length > 0 && (
                    <Typography
                      variant="caption"
                      className="CsvFileStat"
                    >
                      {t('modal.world_permissions.access.csv_communities_count', {
                        count: csvResult.communityIds.length,
                      })}
                    </Typography>
                  )}
                  {csvResult.invalidLines.length > 0 && (
                    <Typography
                      variant="caption"
                      className="CsvFileStatError"
                    >
                      {t('modal.world_permissions.access.csv_invalid_count', {
                        count: csvResult.invalidLines.length,
                      })}
                    </Typography>
                  )}
                </Box>
                <Typography
                  variant="body2"
                  className="CsvReplaceLink"
                  onClick={handleBrowseClick}
                >
                  {t('modal.world_permissions.access.csv_replace')}
                </Typography>
              </Box>
            )}
          </Box>
        )}

        <Box className="AddUserFormActions">
          <Button
            onClick={handleCancel}
            color="secondary"
          >
            {t('modal.world_permissions.access.cancel')}
          </Button>
          <Button
            onClick={confirmHandler}
            disabled={confirmDisabled}
            color="primary"
          >
            {t('modal.world_permissions.access.confirm')}
          </Button>
        </Box>
      </Box>
    );
  },
);
