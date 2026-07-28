import type { IEngine } from '@dcl/ecs';
import ReactEcs, { UiEntity, Label } from '@dcl/react-ecs';

import { Button } from '../Button';
import { LoadingDots } from '../Loading';
import { Error } from '../Error';
import { COLORS, RADIUS, TYPE } from '../theme';
import { fetchAndSyncSceneAdmins } from '..';
import { cancelRemoveAdmin } from '../actions';
import { deleteSceneAdmin } from './api';
import type { SceneAdmin } from '.';

export function RemoveAdminConfirmation({ admin, engine }: { admin: SceneAdmin; engine: IEngine }) {
  const [isLoading, setIsLoading] = ReactEcs.useState(false);
  const [error, setError] = ReactEcs.useState('');

  return (
    <UiEntity
      uiTransform={{
        width: '100%',
        height: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <UiEntity
        uiTransform={{
          width: 675,
          minHeight: 279,
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: RADIUS.lg,
        }}
        uiBackground={{ color: COLORS.surfaceElevated }}
      >
        <UiEntity uiTransform={{ flexDirection: 'row', maxWidth: 675 }}>
          <Label
            value={'Are you sure you want to remove '}
            fontSize={TYPE.subtitle}
            color={COLORS.textPrimary}
          />
          <Label
            value={`<b>${admin.name || (admin.address ? `${admin.address.substring(0, 6)}...${admin.address.substring(admin.address.length - 4)}` : '')}</b>`}
            fontSize={TYPE.subtitle}
            color={COLORS.primary}
          />
          <Label
            value={' from the Admin list?'}
            fontSize={TYPE.subtitle}
            color={COLORS.textPrimary}
          />
        </UiEntity>

        <Label
          value="If you proceed, they will lose access to the Admin Tools for this scene."
          fontSize={TYPE.body}
          color={COLORS.textSecondary}
          uiTransform={{
            margin: { top: 12, bottom: 24 },
          }}
        />

        <UiEntity
          uiTransform={{
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            width: '100%',
          }}
        >
          {!isLoading && (
            <Button
              id="cancel-remove"
              value="<b>Cancel</b>"
              variant="secondary"
              fontSize={TYPE.button}
              color={COLORS.textPrimary}
              uiTransform={{
                width: 90,
                height: 40,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                margin: { right: 30, left: 30 },
              }}
              onMouseDown={() => {
                cancelRemoveAdmin();
              }}
            />
          )}
          {!isLoading && (
            <Button
              id="confirm-remove"
              value={'<b>Remove</b>'}
              variant="primary"
              fontSize={TYPE.button}
              uiTransform={{
                width: 160,
                height: 40,
                justifyContent: 'center',
                alignItems: 'center',
              }}
              onMouseDown={async () => {
                if (!isLoading && admin.address) {
                  setIsLoading(true);
                  const [error] = await deleteSceneAdmin(admin.address);
                  if (error) {
                    setError(error);
                  } else {
                    cancelRemoveAdmin();
                    await fetchAndSyncSceneAdmins();
                  }
                  setIsLoading(false);
                }
              }}
            />
          )}
        </UiEntity>
        {isLoading && <LoadingDots engine={engine} />}
        {error && (
          <Error
            uiTransform={{ margin: { top: 16 } }}
            text={error}
          />
        )}
      </UiEntity>
    </UiEntity>
  );
}
