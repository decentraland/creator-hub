import { useCallback } from 'react';
import cx from 'classnames';

import { InfoTooltip } from '../../ui';
import { formatFileName } from '../utils';

import { Button } from '../../Button';

import type { ValidationError } from '../types';
import type { PropTypes } from './types';

import './Error.css';

export function Error({
  assets,
  errorMessage,
  description,
  primaryAction,
  secondaryAction,
}: PropTypes) {
  const getErrorMessage = useCallback((error: ValidationError): string => {
    switch (error?.type) {
      case 'type':
        return 'File type not supported';
      case 'model':
        return 'The model has some issues';
      case 'size':
        return 'File size is too large';
      default:
        return '';
    }
  }, []);

  return (
    <div className="ImportError">
      <div className="alert-icon"></div>
      <h3>{errorMessage}</h3>
      {description ? <p className="description">{description}</p> : null}
      <div className="errors">
        {assets.map(
          ($, i) =>
            $.error && (
              <ErrorMessage
                key={i}
                asset={$}
                message={getErrorMessage($.error)}
              />
            ),
        )}
      </div>
      <div
        className={cx('actions-container', {
          'space-between': !!secondaryAction,
          'flex-end': !secondaryAction,
        })}
      >
        {!!secondaryAction && (
          <Button
            onClick={secondaryAction.onClick}
            size="big"
          >
            {secondaryAction.name}
          </Button>
        )}
        <Button
          onClick={primaryAction.onClick}
          type="danger"
          size="big"
        >
          {primaryAction.name}
        </Button>
      </div>
    </div>
  );
}

function ErrorMessage({ asset, message }: { asset: PropTypes['assets'][0]; message: string }) {
  const errorMessage = asset.error?.message;
  // A rejected size is the whole story, so it reads inline; the other types
  // carry long validator output that only belongs in the tooltip.
  const showInline = asset.error?.type === 'dimensions' && !!errorMessage;
  return (
    <span>
      {formatFileName(asset)}
      {` - ${showInline ? errorMessage : message}`}
      {errorMessage && !showInline && (
        <InfoTooltip
          text={errorMessage}
          type="help"
        />
      )}
    </span>
  );
}
