import React, { useCallback, useEffect, useRef, useState } from 'react';
import { isValid as isValidAddress } from 'decentraland-ui2/dist/components/AddressField/utils';
import SearchIcon from '@mui/icons-material/Search';
import PeopleIcon from '@mui/icons-material/People';
import { Box, InputAdornment, Tab, Tabs, TextField, Typography } from 'decentraland-ui2';
import { t } from '/@/modules/store/translation/utils';
import { Button } from '/@/components/Button';
import communities, { type CommunityMinimal } from '/@/lib/communities';
import './styles.css';

enum InviteTab {
  WalletAddress = 0,
  Community = 1,
  ImportCsv = 2,
}

type Props = {
  onSubmitAddress: (address: string) => void;
  onSubmitCommunity: (communityId: string) => void;
  onCancel: () => void;
};

export const WorldPermissionsAddUserForm: React.FC<Props> = React.memo(
  ({ onSubmitAddress, onSubmitCommunity, onCancel }) => {
    const [address, setAddress] = useState('');
    const [hasError, setHasError] = useState(false);
    const [activeTab, setActiveTab] = useState<InviteTab>(InviteTab.WalletAddress);

    // Community search state
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<CommunityMinimal[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedCommunity, setSelectedCommunity] = useState<CommunityMinimal | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleChangeAddress = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
      setAddress(event.target.value);
      setHasError(false);
    }, []);

    const handleAddAddress = useCallback(async () => {
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

    const handleCancel = useCallback(() => {
      setAddress('');
      setHasError(false);
      setSearchQuery('');
      setSearchResults([]);
      setSelectedCommunity(null);
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
        const result = await communities.fetchCommunities({ search: searchQuery, limit: 10 });
        setSearchResults(result?.communities ?? []);
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
          <Tab
            label={t('modal.world_permissions.access.invite_tabs.import_csv')}
            disabled
          />
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
              value={searchQuery}
              onChange={handleSearchChange}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
            {isSearching && (
              <Typography
                className="CommunitySearchStatus"
                variant="body2"
              >
                {t('modal.world_permissions.access.community_searching')}
              </Typography>
            )}
            {!isSearching && searchQuery.length >= 3 && searchResults.length === 0 && (
              <Typography
                className="CommunitySearchStatus"
                variant="body2"
              >
                {t('modal.world_permissions.access.community_no_results')}
              </Typography>
            )}
            {searchResults.length > 0 && (
              <Box className="CommunitySearchResults">
                {searchResults.map(community => (
                  <Box
                    key={community.id}
                    className={`CommunitySearchItem ${selectedCommunity?.id === community.id ? 'Selected' : ''}`}
                    onClick={() => handleSelectCommunity(community)}
                  >
                    <PeopleIcon fontSize="small" />
                    <Box className="CommunitySearchItemInfo">
                      <Typography
                        variant="body2"
                        className="CommunityName"
                      >
                        {community.name}
                      </Typography>
                      <Typography
                        variant="caption"
                        className="CommunityMembers"
                      >
                        {t('modal.world_permissions.access.community_members', {
                          count: community.membersCount,
                        })}
                      </Typography>
                    </Box>
                  </Box>
                ))}
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
            onClick={isWalletTab ? handleAddAddress : handleConfirmCommunity}
            disabled={isWalletTab ? !address || hasError : !selectedCommunity}
            color="primary"
          >
            {t('modal.world_permissions.access.confirm')}
          </Button>
        </Box>
      </Box>
    );
  },
);
