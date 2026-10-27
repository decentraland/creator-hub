import React, { useCallback } from 'react';
import { IoEyeOutline as VisibleIcon, IoEyeOffOutline as InvisibleIcon } from 'react-icons/io5';
import { MdOutlineLock as LockIcon, MdOutlineLockOpen as UnlockIcon } from 'react-icons/md';
import cx from 'classnames';
import type { Entity } from '@dcl/ecs';

import type { WithSdkProps } from '../../../hoc/withSdk';
import { withSdk } from '../../../hoc/withSdk';
import { useHasComponent } from '../../../hooks/sdk/useHasComponent';
import { CAMERA, PLAYER, ROOT } from '../../../lib/sdk/tree';
import { InfoTooltip } from '../../ui';

import './ActionArea.css';
import { Event, analytics } from '../../../lib/logic/analytics';

type Props = {
  entity: Entity;
  label: string;
  tabIndex?: 0 | -1;
};

const ActionArea: React.FC<WithSdkProps & Props> = ({ sdk, ...props }) => {
  const {
    components: { Lock, Hide },
  } = sdk;
  const { entity, label, tabIndex } = props;

  const isEntityLocked = useHasComponent(entity, Lock);
  const isEntityHidden = useHasComponent(entity, Hide);

  const lock = useCallback(
    (value: boolean) => {
      sdk.operations.lock(entity, value);
      void sdk.operations.dispatch();
    },
    [entity, sdk],
  );

  const hide = useCallback(
    (value: boolean) => {
      sdk.operations.hide(entity, value);
      void sdk.operations.dispatch();
    },
    [entity, sdk],
  );

  const handleToggleHideComponent = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      const value = !isEntityHidden;
      hide(value);
      analytics.track(Event.HIDE, { value });
    },
    [hide, isEntityHidden],
  );

  const handleToggleLockComponent = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      const value = !isEntityLocked;
      lock(value);
      analytics.track(Event.LOCK, { value });
    },
    [lock, isEntityLocked],
  );

  const toggleLockButton = useCallback(() => {
    return (
      <button
        type="button"
        className="action-button"
        aria-label={`Lock ${label}`}
        aria-pressed={isEntityLocked}
        tabIndex={tabIndex}
        onClick={handleToggleLockComponent}
      >
        {isEntityLocked ? (
          <LockIcon
            className="lock-icon"
            size={16}
          />
        ) : (
          <UnlockIcon
            className="unlock-icon"
            size={16}
          />
        )}
      </button>
    );
  }, [isEntityLocked, handleToggleLockComponent, label, tabIndex]);

  const toggleVisibleButton = useCallback(() => {
    return (
      <button
        type="button"
        className="action-button"
        aria-label={`Hide ${label}`}
        aria-pressed={isEntityHidden}
        tabIndex={tabIndex}
        onClick={handleToggleHideComponent}
      >
        {isEntityHidden ? (
          <InvisibleIcon
            className="invisible-icon"
            size={16}
          />
        ) : (
          <VisibleIcon
            className="visible-icon"
            size={16}
          />
        )}
      </button>
    );
  }, [isEntityHidden, handleToggleHideComponent, label, tabIndex]);

  const isRoot = entity === ROOT;
  const isPlayer = entity === PLAYER;
  const isCamera = entity === CAMERA;
  const isEntity = !isPlayer && !isCamera && !isRoot;

  const infoTooltip = useCallback(
    (text: string, learnMore?: string) => (
      <div className="action-button">
        <InfoTooltip
          text={
            <>
              {text}
              {learnMore ? (
                <>
                  &nbsp;
                  <a
                    href={learnMore}
                    target="_blank"
                    rel="noopener"
                  >
                    Learn more
                  </a>
                </>
              ) : null}
            </>
          }
          type="info"
          position="right center"
        />
      </div>
    ),
    [],
  );

  return (
    <div className={cx('action-area', { 'is-hidden': isEntityHidden })}>
      {isEntity && toggleLockButton()}
      {isEntity && toggleVisibleButton()}
      {isPlayer &&
        infoTooltip(
          'The player’s avatar. Nested items are fixed to the player’s position.',
          'https://docs.decentraland.org/creator/scene-editor/get-started/scene-editor-essentials#special-entities',
        )}
      {isCamera &&
        infoTooltip(
          'The player’s camera. Nested items remain fixed to the camera’s position.',
          'https://docs.decentraland.org/creator/scene-editor/get-started/scene-editor-essentials#special-entities',
        )}
      {isRoot &&
        infoTooltip(
          'The root entity. All items in the scene are children of this entity. Open it to adjust the scene settings.',
          'https://docs.decentraland.org/creator/scenes-sdk7/kinds-of-projects/scene-metadata',
        )}
    </div>
  );
};

export default React.memo(withSdk(ActionArea));
