import React, { useCallback } from 'react';
import { IoEyeOutline as VisibleIcon, IoEyeOffOutline as InvisibleIcon } from 'react-icons/io5';
import { MdOutlineLock as LockIcon, MdOutlineLockOpen as UnlockIcon } from 'react-icons/md';
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
};

const ActionArea: React.FC<WithSdkProps & Props> = ({ sdk, ...props }) => {
  const {
    components: { Lock, Hide },
  } = sdk;
  const { entity } = props;

  // Subscribe to the components so the icon + toggle closure recompute when the
  // component is added/removed (a plain useMemo over getOrNull never re-fires —
  // its deps [entity, sdk] don't change on a component write — so the button
  // would freeze on its first state and look dead after one click).
  const isEntityLocked = useHasComponent(entity, Lock);
  const isEntityHidden = useHasComponent(entity, Hide);

  // lock/hide only write the component; dispatch flushes it to the engine. The row's
  // selection handler used to do that as the click bubbled, which it no longer does.
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

  // The buttons sit inside the row's selectable area, whose click handler treats
  // event.detail > 1 as a double-click that focuses the camera. Rapidly toggling an
  // icon must not select the row, let alone fly the camera to it (#368).
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
      <div
        className="action-button"
        role="button"
        aria-label={isEntityLocked ? 'Unlock item' : 'Lock item'}
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
      </div>
    );
  }, [isEntityLocked, handleToggleLockComponent]);

  const toggleVisibleButton = useCallback(() => {
    return (
      <div
        className="action-button"
        role="button"
        aria-label={isEntityHidden ? 'Show item' : 'Hide item'}
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
      </div>
    );
  }, [isEntityHidden, handleToggleHideComponent]);

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
    <div className="action-area">
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
