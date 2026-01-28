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
    const assets = selectedTheme ? selectedTheme.assets : catalog.flatMap(theme => theme.assets);

    const starts: AssetPack['assets'] = [];
    const includes: AssetPack['assets'] = [];

    for (const asset of assets) {
      const name = (asset.name || '').toLowerCase();
      const description = (asset.description || '').toLowerCase();
      const tags = (asset.tags || []).map(tag => (tag || '').toLowerCase());

      // Priority 1: name word or tag starts with search term
      const nameStarts = name.split(' ').some(word => word.startsWith(searchLower));
      const tagStarts = tags.some(tag => tag.startsWith(searchLower));

      if (nameStarts || tagStarts) {
        starts.push(asset);
      } else {
        // Priority 2: search term appears anywhere in name, description, or tags
        const nameIncludes = name.includes(searchLower);
        const descriptionIncludes = description.includes(searchLower);
        const tagIncludes = tags.some(tag => tag.includes(searchLower));

        if (nameIncludes || descriptionIncludes || tagIncludes) {
          includes.push(asset);
        }
      }
    }

    // Return high-priority matches first, then lower-priority matches
    return [...starts, ...includes];
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
      return <Assets assets={filteredCatalog} />;
    }

    return renderEmptySearch();
  }, [filteredCatalog, renderEmptySearch]);

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
