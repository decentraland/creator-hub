import React from 'react';
import { MdChevronLeft as BackIcon, MdChevronRight as ChevronIcon } from 'react-icons/md';
import cx from 'classnames';
import { AssetSearchField } from '../../AssetSearchField';
import type { Props } from './types';

import './Header.css';

const Header: React.FC<Props> = ({ selectedTheme, search, onChangeTheme, onSearch }) => {
  const isMainHeader = !search && !selectedTheme;
  const placeholder = selectedTheme ? `Search ${selectedTheme.name}` : 'Search Asset Packs';

  const goToPacks = () => {
    onSearch('');
    onChangeTheme();
  };

  const goToPack = () => onSearch('');

  const crumbs: { label: string; onClick?: () => void }[] = [
    { label: 'Asset Packs', onClick: isMainHeader ? undefined : goToPacks },
  ];
  if (selectedTheme) {
    crumbs.push({ label: selectedTheme.name, onClick: search ? goToPack : undefined });
  }
  if (search) crumbs.push({ label: `Results for "${search}"` });

  return (
    <div className="assets-catalog-header">
      <div className="Assets-toolbar">
        {!isMainHeader && (
          <button
            className="Assets-iconButton"
            onClick={search && selectedTheme ? goToPack : goToPacks}
            title="Back"
            aria-label="Back"
          >
            <BackIcon />
          </button>
        )}
        <AssetSearchField
          className="assets-catalog-header-search"
          value={search}
          placeholder={placeholder}
          onChange={onSearch}
          debounceMs={300}
        />
      </div>
      <nav
        className="Assets-crumbs assets-catalog-header-title"
        aria-label="Asset pack path"
      >
        {crumbs.map((crumb, index) => (
          <React.Fragment key={crumb.label}>
            {index > 0 && <ChevronIcon />}
            <button
              className={cx({ current: index === crumbs.length - 1 })}
              onClick={crumb.onClick}
              disabled={!crumb.onClick}
            >
              {crumb.label}
            </button>
          </React.Fragment>
        ))}
      </nav>
    </div>
  );
};

export default React.memo(Header);
