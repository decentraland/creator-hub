import React, { useCallback, useState } from 'react';
import { getContentsUrl } from '../../../lib/logic/catalog';
import type { Props } from './types';
import './Themes.css';

const ThemeCard: React.FC<{ value: Props['catalog'][number]; onClick: Props['onClick'] }> = ({
  value,
  onClick,
}) => (
  <div
    key={value.id}
    className="theme"
    data-test-id={value.id}
    data-test-label={value.name}
    onClick={() => onClick(value)}
  >
    <img
      src={getContentsUrl(value.thumbnail)}
      alt={value.name}
    />
    <div className="theme-info">
      <h4 className="theme-info-name">{value.name}</h4>
      <div className="theme-info-items">{value.assets.length} items</div>
    </div>
  </div>
);

const Themes: React.FC<Props> = ({ catalog, externalCatalog, onClick }) => {
  const [externalExpanded, setExternalExpanded] = useState(false);
  const toggleExternal = useCallback(() => setExternalExpanded(prev => !prev), []);

  return (
    <div className="asset-catalog-themes-container">
      <div className="asset-catalog-themes">
        {catalog.map(value => (
          <ThemeCard
            key={value.id}
            value={value}
            onClick={onClick}
          />
        ))}
      </div>
      {externalCatalog && externalCatalog.length > 0 && (
        <>
          <div
            className="asset-catalog-section-divider"
            onClick={toggleExternal}
          >
            <span className={`section-chevron ${externalExpanded ? 'expanded' : ''}`} />
            <h3 className="section-title">Additional Catalogs</h3>
            <span className="section-subtitle">
              {externalCatalog.reduce((sum, pack) => sum + pack.assets.length, 0)} items
            </span>
          </div>
          {externalExpanded && (
            <div className="asset-catalog-themes">
              {externalCatalog.map(value => (
                <ThemeCard
                  key={value.id}
                  value={value}
                  onClick={onClick}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default React.memo(Themes);
