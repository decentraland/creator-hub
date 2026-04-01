import { FiAlertTriangle as WarningIcon } from 'react-icons/fi';

import { Button } from '../../Button';
import type { Asset } from '../types';
import type { TextureIssue, TextureImageInfo } from '../texture-validation';
import { formatFileName } from '../utils';

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

export function TextureWarnings({ textureIssues, isFixing, onFix, onBack }: TextureWarningsProps) {
  const totalIssues = textureIssues.reduce((sum, ti) => sum + ti.issues.length, 0);

  return (
    <div className="TextureWarnings">
      <div className="TextureWarnings-icon">
        <WarningIcon size={40} />
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
            {issues.map((issue, i) => (
              <div
                className="TextureWarnings-issue"
                key={i}
              >
                <span className="TextureWarnings-issue-tag">{ISSUE_LABELS[issue.type]}</span>
                <span className="TextureWarnings-issue-message">{issue.message}</span>
                {issue.suggestedWidth && issue.suggestedHeight && (
                  <span className="TextureWarnings-issue-suggestion">
                    → {issue.suggestedWidth}×{issue.suggestedHeight}
                  </span>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="TextureWarnings-actions">
        <Button onClick={onBack}>Back</Button>
        <Button
          type="danger"
          onClick={onFix}
          disabled={isFixing}
        >
          {isFixing ? 'Fixing...' : 'Fix & Import'}
        </Button>
      </div>
    </div>
  );
}
