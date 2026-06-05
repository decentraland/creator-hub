import React, { useCallback, useEffect, useMemo, useState } from 'react';

import type { Asset } from '@dcl/asset-packs';

import { type AssetPack, isGround } from '../../lib/logic/catalog';
import { analytics, Event } from '../../lib/logic/analytics';

import { Header } from './Header';
import { Themes } from './Themes';
import { Categories } from './Categories';
import { Assets } from './Assets';

import type { Props } from './types';

import './AssetsCatalog.css';

function searchAssets(assets: Asset[], searchLower: string): Asset[] {
  const starts: Asset[] = [];
  const includes: Asset[] = [];

  for (const asset of assets) {
    const name = (asset.name || '').toLowerCase();
    const description = (asset.description || '').toLowerCase();
    const tags = (asset.tags || []).map(tag => (tag || '').toLowerCase());

    const nameStarts = name.split(' ').some(word => word.startsWith(searchLower));
    const tagStarts = tags.some(tag => tag.startsWith(searchLower));

    if (nameStarts || tagStarts) {
      starts.push(asset);
    } else {
      const nameIncludes = name.includes(searchLower);
      const descriptionIncludes = description.includes(searchLower);
      const tagIncludes = tags.some(tag => tag.includes(searchLower));

      if (nameIncludes || descriptionIncludes || tagIncludes) {
        includes.push(asset);
      }
    }
  }

  return [...starts, ...includes];
}

interface SearchResults {
  curated: Asset[];
  ground: Asset[];
  external: Asset[];
}

const AssetsCatalog: React.FC<Props> = ({ catalog, externalCatalog = [] }) => {
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

  const allCatalogs = useMemo(() => [...catalog, ...externalCatalog], [catalog, externalCatalog]);

  const searchResults = useMemo<SearchResults>(() => {
    const trimmedSearch = search.trim();
    if (!trimmedSearch) return { curated: [], ground: [], external: [] };

    const searchLower = trimmedSearch.toLowerCase();

    if (selectedTheme) {
      const results = searchAssets(selectedTheme.assets, searchLower);
      return { curated: results, ground: [], external: [] };
    }

    const curatedAssets = catalog.flatMap(theme => theme.assets);
    const externalAssets = externalCatalog.flatMap(theme => theme.assets);

    const curatedResults = searchAssets(curatedAssets, searchLower);
    const externalResults = searchAssets(externalAssets, searchLower);

    return {
      curated: curatedResults.filter(a => !isGround(a)),
      ground: curatedResults.filter(a => isGround(a)),
      external: externalResults,
    };
  }, [allCatalogs, catalog, externalCatalog, selectedTheme, search]);

  const totalResults =
    searchResults.curated.length + searchResults.ground.length + searchResults.external.length;

  useEffect(() => {
    if (search) {
      analytics.track(Event.SEARCH_ITEM, {
        keyword: search,
        itemsFound: totalResults,
        category: selectedTheme?.name,
      });
    }
  }, [search, totalResults]);

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
    if (totalResults === 0) return renderEmptySearch();

    const { curated, ground, external } = searchResults;
    const showSections = !selectedTheme && (ground.length > 0 || external.length > 0);

    if (!showSections) {
      return <Assets assets={curated} />;
    }

    return (
      <div className="search-results-container">
        {curated.length > 0 && (
          <div className="search-results-section">
            <Assets assets={curated} />
          </div>
        )}
        {ground.length > 0 && (
          <div className="search-results-section">
            <div className="search-results-divider">
              <h4 className="section-title">Ground Tiles</h4>
              <span className="section-subtitle">
                {ground.length} items — placed across all parcels
              </span>
            </div>
            <Assets assets={ground} />
          </div>
        )}
        {external.length > 0 && (
          <div className="search-results-section">
            <div className="search-results-divider">
              <h4 className="section-title">Additional Catalogs</h4>
              <span className="section-subtitle">{external.length} items</span>
            </div>
            <Assets assets={external} />
          </div>
        )}
      </div>
    );
  }, [searchResults, totalResults, selectedTheme, renderEmptySearch]);

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
            externalCatalog={externalCatalog}
            onClick={handleThemeChange}
          />
        </div>
      )}
    </div>
  );
};

export default React.memo(AssetsCatalog);
