import { FiAlertTriangle as WarningIcon } from 'react-icons/fi';
import { FaMagic } from 'react-icons/fa';
import { AssetPreview } from '../../AssetPreview';
import { Button } from '../../Button';
import type { Asset } from '../types';
import { isModelAsset } from '../types';
import type { TextureIssue, TextureImageInfo } from '../texture-validation';
import { formatFileName, getAssetResources } from '../utils';

import './TextureWarnings.css';

interface TextureWarningsProps {
  textureIssues: { asset: Asset; issues: TextureIssue[]; images: TextureImageInfo[] }[];
  isFixing: boolean;
  onFix: () => void;
  onBack: () => void;
}

const ISSUE_LABELS: Record<TextureIssue['type'], string> = {
  'not-power-of-two': 'Not power of two',
  'not-square': 'Not square',
  'layer-size-mismatch': 'Layer size mismatch',
};

function cleanMessage(message: string): string {
  return message
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .trim()
    .replace(/(\d+×\d+)(?!px)/g, '$1px');
}

function groupIssuesByImage(issues: TextureIssue[]) {
  const grouped = new Map<
    string,
    {
      types: TextureIssue['type'][];
      message: string;
      suggestedWidth?: number;
      suggestedHeight?: number;
    }
  >();
  for (const issue of issues) {
    const key = cleanMessage(issue.message);
    const existing = grouped.get(key);
    if (existing) {
      if (!existing.types.includes(issue.type)) {
        existing.types.push(issue.type);
      }
      existing.suggestedWidth ??= issue.suggestedWidth;
      existing.suggestedHeight ??= issue.suggestedHeight;
    } else {
      grouped.set(key, {
        types: [issue.type],
        message: key,
        suggestedWidth: issue.suggestedWidth,
        suggestedHeight: issue.suggestedHeight,
      });
    }
  }
  return [...grouped.values()];
}

const noop = () => {};

export function TextureWarnings({ textureIssues, isFixing, onFix, onBack }: TextureWarningsProps) {
  const totalIssues = textureIssues.reduce((sum, ti) => sum + ti.issues.length, 0);

  return (
    <div className="TextureWarnings">
      <div className="TextureWarnings-icon">
        <WarningIcon size={28} />
      </div>
      <h2>Texture Issues Found</h2>
      <p className="TextureWarnings-description">
        {totalIssues} issue{totalIssues !== 1 ? 's' : ''} found. Textures should be power of two
        with equal width and height, and all layers in a material should have the same dimensions.
      </p>
      <div className="TextureWarnings-list">
        {textureIssues.map(({ asset, issues }) => (
          <div
            className="TextureWarnings-asset"
            key={asset.blob.name}
          >
            <div className="TextureWarnings-asset-name">{formatFileName(asset)}</div>
            <div className="TextureWarnings-asset-preview">
              <AssetPreview
                value={asset.blob}
                resources={isModelAsset(asset) ? getAssetResources(asset) : []}
                onScreenshot={noop}
              />
            </div>
            {groupIssuesByImage(issues).map((group, i) => (
              <div
                className="TextureWarnings-issue"
                key={i}
              >
                <div className="TextureWarnings-issue-tags">
                  {group.types.map(type => (
                    <span
                      className="TextureWarnings-issue-tag"
                      key={type}
                    >
                      {ISSUE_LABELS[type]}
                    </span>
                  ))}
                </div>
                <span className="TextureWarnings-issue-message">{group.message}</span>
                {group.suggestedWidth && group.suggestedHeight ? (
                  <span className="TextureWarnings-issue-fix">
                    Will resize to {group.suggestedWidth}×{group.suggestedHeight}px
                  </span>
                ) : (
                  <span />
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="TextureWarnings-actions">
        <Button onClick={onBack}>BACK</Button>
        <Button
          type="danger"
          onClick={onFix}
          disabled={isFixing}
        >
          <FaMagic size={14} />
          {isFixing ? 'FIXING...' : 'FIX & IMPORT'}
        </Button>
      </div>
    </div>
  );
}
