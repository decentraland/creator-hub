import { IEngine } from '@dcl/ecs';
import { Color4 } from '@dcl/ecs-math';
import ReactEcs, { UiEntity, Label } from '@dcl/react-ecs';

import { Button } from '../Button';
import { deleteSceneAdmin } from './api';
import { moderationControlState, SceneAdmin } from '.';
import { LoadingDots } from '../Loading';
import { Error } from '../Error';
import { fetchSceneAdmins } from '..';

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
          borderRadius: 12,
        }}
        uiBackground={{ color: Color4.Black() }}
      >
        <UiEntity uiTransform={{ flexDirection: 'row', maxWidth: 675 }}>
          <Label
            value={`Are you sure you want to remove `}
            fontSize={18}
            color={Color4.White()}
          />
          <Label
            value={`<b>${admin.name || (admin.address ? `${admin.address.substring(0, 6)}...${admin.address.substring(admin.address.length - 4)}` : '')}</b>`}
            fontSize={18}
            color={Color4.fromHexString('#FF2D55')}
          />
          <Label
            value={` from the Admin list?`}
            fontSize={18}
            color={Color4.White()}
          />
        </UiEntity>

        <Label
          value="If you proceed, they will lose access to tehe Admin Tools for this scene."
          fontSize={14}
          color={Color4.Gray()}
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
              variant="primary"
              fontSize={16}
              color={Color4.Black()}
              uiTransform={{
                width: 90,
                height: 40,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                margin: { right: 30, left: 30 },
              }}
              onMouseDown={() => {
                moderationControlState.adminToRemove = undefined;
              }}
            />
          )}
          {!isLoading && (
            <Button
              id="confirm-remove"
              value={'<b>Remove</b>'}
              variant="primary"
              fontSize={16}
              color={Color4.White()}
              uiTransform={{
                width: 160,
                height: 40,
                justifyContent: 'center',
                alignItems: 'center',
              }}
              uiBackground={{ color: Color4.fromHexString('#FF2D55') }}
              onMouseDown={async () => {
                if (!isLoading && admin.address) {
                  setIsLoading(true);
                  const [error] = await deleteSceneAdmin(admin.address);
                  if (error) {
                    setError(error);
                  } else {
                    moderationControlState.adminToRemove = undefined;
                    await fetchSceneAdmins();
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
