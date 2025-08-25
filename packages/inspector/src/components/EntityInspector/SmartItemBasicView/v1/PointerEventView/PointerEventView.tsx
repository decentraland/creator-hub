import React, { useCallback } from 'react';
import { type Entity, type PBPointerEvents, type PBPointerEvents_Entry } from '@dcl/ecs';
import { withSdk, type WithSdkProps } from '../../../../../hoc/withSdk';
import { useComponentValue } from '../../../../../hooks/sdk/useComponentValue';
import { useArrayState } from '../../../../../hooks/useArrayState';
import { Block } from '../../../../Block';
import { TextField } from '../../../../ui';

export default React.memo(
  withSdk<WithSdkProps & { entity: Entity }>(({ sdk, entity }) => {
    const { PointerEvents } = sdk.components;
    const [pointerEventComponent, setPointerEventComponentValue, isComponentEqual] =
      useComponentValue<PBPointerEvents>(entity, PointerEvents);
    const [pointerEvents, , modifyPointerEvent] = useArrayState<PBPointerEvents_Entry>(
      pointerEventComponent === null ? [] : pointerEventComponent.pointerEvents,
    );

    const handleUpdatePointerEvents = useCallback(
      (updatedPointerEvents: PBPointerEvents_Entry[]) => {
        if (isComponentEqual({ pointerEvents: updatedPointerEvents })) return;
        setPointerEventComponentValue({ pointerEvents: updatedPointerEvents });
      },
      [pointerEvents, isComponentEqual, setPointerEventComponentValue],
    );

    const handleHoverTextChange = useCallback(
      ({ target: { value } }: React.ChangeEvent<HTMLInputElement>) => {
        modifyPointerEvent(
          0,
          {
            ...pointerEvents[0],
            eventInfo: {
              ...pointerEvents[0].eventInfo,
              hoverText: value,
            },
          },
          updatedPointerEvents => {
            handleUpdatePointerEvents(updatedPointerEvents);
          },
        );
      },
      [pointerEvents, modifyPointerEvent],
    );

    return (
      <>
        <Block>
          <TextField
            label="Hover Text"
            value={pointerEvents[0]?.eventInfo?.hoverText}
            onChange={handleHoverTextChange}
            autoSelect
          />
        </Block>
      </>
    );
  }),
);
