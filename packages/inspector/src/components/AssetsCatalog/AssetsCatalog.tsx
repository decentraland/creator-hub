import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { AssetPack } from '../../lib/logic/catalog';
import { analytics, Event } from '../../lib/logic/analytics';

import { Header } from './Header';
import { Themes } from './Themes';
import { Categories } from './Categories';
import { Assets } from './Assets';

import { Props } from './types';

import './AssetsCatalog.css';

const AssetsCatalog: React.FC<Props> = ({ catalog }) => {
  const [selectedTheme, setSelectedTheme] = useState<AssetPack>();
  const [search, setSearch] = useState<string>('');

  const handleThemeChange = useCallback(
    (value?: AssetPack) => setSelectedTheme(value),
    [setSelectedTheme],
  );

  const handleSearchAssets = useCallback(
    (value: string) => {
      setSearch(value);
    },
    [setSearch],
  );

  const filteredCatalog = useMemo(() => {
    const trimmedSearch = search.trim();
    if (!trimmedSearch) return [];

    const searchLower = trimmedSearch.toLowerCase();
    // Always start with a fresh array to avoid any state pollution
    const assets = selectedTheme
      ? [...selectedTheme.assets]
      : catalog.flatMap(theme => [...theme.assets]);

    // Create fresh arrays for each search to ensure no state leakage
    const starts: AssetPack['assets'] = [];
    const includes: AssetPack['assets'] = [];

    for (const asset of assets) {
      // Safely handle potentially missing fields
      const name = (asset.name || '').toLowerCase();
      const description = (asset.description || '').toLowerCase();
      const tags = (asset.tags || [])
        .map(tag => (tag || '').toLowerCase())
        .filter(tag => tag.length > 0);

      // Check if search matches name, description, or tags
      const nameMatches = name.includes(searchLower);
      const descriptionMatches = description.includes(searchLower);
      const tagsMatch = tags.some(tag => tag.includes(searchLower));

      // Priority: starts with (for name words or tags)
      const nameStarts = name.split(' ').some(word => word.startsWith(searchLower));
      const tagStarts = tags.some(tag => tag.startsWith(searchLower));

      if (nameStarts || tagStarts) {
        starts.push(asset);
      } else if (nameMatches || descriptionMatches || tagsMatch) {
        // Only add to includes if not already in starts (to avoid duplicates)
        includes.push(asset);
      }
    }

    // Deduplicate by asset id to prevent any edge cases where the same asset appears twice
    const seen = new Set<string>();
    const uniqueResults: AssetPack['assets'] = [];

    for (const asset of [...starts, ...includes]) {
      if (!seen.has(asset.id)) {
        seen.add(asset.id);
        uniqueResults.push(asset);
      }
    }

    return uniqueResults;
  }, [catalog, selectedTheme, search]);

  useEffect(() => {
    if (search) {
      analytics.track(Event.SEARCH_ITEM, {
        keyword: search,
        itemsFound: filteredCatalog.length,
        category: selectedTheme?.name,
      });
    }
  }, [search, filteredCatalog]);

  const renderEmptySearch = useCallback(() => {
    const ctaMethod = selectedTheme ? handleThemeChange : () => undefined;
    const ctaText = selectedTheme
      ? 'search all categories'
      : 'upload your own asset by drag & drop';
    return (
      <div className="empty-search">
        <span>No results for '{search}'.</span>
        <span>
          Try using another words or{' '}
          <span
            className="empty-search-cta"
            onClick={() => ctaMethod()}
          >
            {ctaText}
          </span>
          .
        </span>
      </div>
    );
  }, [search, selectedTheme, handleThemeChange]);

  const renderAssets = useCallback(() => {
    if (filteredCatalog.length > 0) {
      // Use search as key to force complete remount on search change, ensuring clean state
      return (
        <Assets
          key={search.trim()}
          assets={filteredCatalog}
        />
      );
    }

    return renderEmptySearch();
  }, [filteredCatalog, search]);

  if (!catalog) {
    return null;
  }

  return (
    <div className="assets-catalog">
      <Header
        search={search}
        selectedTheme={selectedTheme}
        onChangeTheme={handleThemeChange}
        onSearch={handleSearchAssets}
      />
      {search ? (
        renderAssets()
      ) : selectedTheme ? (
        <Categories
          onGoBack={handleThemeChange}
          value={selectedTheme}
        />
      ) : (
        <div className="assets-catalog-theme-container">
          <Themes
            catalog={catalog}
            onClick={handleThemeChange}
          />
        </div>
      )}
    </div>
  );
};

export default React.memo(AssetsCatalog);
