import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AiOutlinePlus as AddIcon } from 'react-icons/ai';
import { MdOutlineDriveFileRenameOutline as RenameIcon } from 'react-icons/md';

import { type Entity } from '@dcl/ecs';

import { type WithSdkProps, withSdk } from '../../../hoc/withSdk';
import { useChange } from '../../../hooks/sdk/useChange';
import { isRoot, useEntityComponent } from '../../../hooks/sdk/useEntityComponent';
import { CAMERA, PLAYER, ROOT } from '../../../lib/sdk/tree';
import { type SdkContextEvents, type SdkContextValue } from '../../../lib/sdk/context';
import { getAssetByModel } from '../../../lib/logic/catalog';
import { analytics, Event } from '../../../lib/logic/analytics';
import { useAppSelector } from '../../../redux/hooks';
import { selectCustomAssets } from '../../../redux/app';

import { Edit as EditInput } from '../../Tree/Edit';
import CustomAssetIcon from '../../Icons/CustomAsset';
import { Container } from '../../Container';
import { Dropdown } from '../../ui';

import MoreOptionsMenu from '../MoreOptionsMenu';
import { RemoveButton } from '../RemoveButton';
import { TagsInspector } from '../TagsInspector';

import { getComponentConfig } from './utils';
import type { ComponentOption, ComponentRules, TooltipConfig } from './types';

import './EntityHeader.css';

export const getLabel = (sdk: SdkContextValue, entity: Entity) => {
  const nameComponent = sdk.components.Name.getOrNull(entity);
  switch (entity) {
    case ROOT:
      return 'Scene';
    case PLAYER:
      return 'Player';
    case CAMERA:
      return 'Camera';
    default:
      return nameComponent && nameComponent.value.length > 0
        ? nameComponent.value
        : entity
          ? entity.toString()
          : 'Unknown';
  }
};

export default React.memo(
  withSdk<WithSdkProps & { entity: Entity }>(({ sdk, entity }) => {
    const { addComponent, getAvailableComponents } = useEntityComponent();
    const [label, setLabel] = useState<string | null>();
    const [editMode, setEditMode] = useState(false);
    const [instanceOf, setInstanceOf] = useState<string | null>(null);
    const customAssets = useAppSelector(selectCustomAssets);

    useEffect(() => {
      setLabel(getLabel(sdk, entity));
    }, [sdk, entity]);

    useEffect(() => {
      const customAssetId = sdk.components.CustomAsset.getOrNull(entity)?.assetId || null;
      const customAsset = customAssets.find(asset => asset.id === customAssetId);
      setInstanceOf(customAsset?.name || null);
    }, [customAssets, sdk, entity]);

    const handleUpdate = (event: SdkContextEvents['change']) => {
      if (event.entity === entity && event.component === sdk.components.Name) {
        setLabel(getLabel(sdk, entity));
      }
    };

    useChange(handleUpdate, [entity]);

    const handleAddComponent = useCallback(
      (componentId: number, componentName: string, value?: any) => {
        addComponent(entity, componentId, value);
        const { src: gltfSrc } = sdk.components.GltfContainer.getOrNull(entity) ?? { src: '' };
        const asset = getAssetByModel(gltfSrc);
        analytics.track(Event.ADD_COMPONENT, {
          componentName: componentName,
          itemId: asset?.id,
          itemPath: gltfSrc,
        });
      },
      [entity],
    );

    const availableComponents = getAvailableComponents(entity);

    const handleClickAddComponent = useCallback(
      (componentId: number, componentName: string, value?: any) => {
        handleAddComponent(componentId, componentName, value);
      },
      [handleAddComponent],
    );

    const componentOptions = useMemo(() => {
      const attachedComponents = new Set(
        availableComponents.filter(c => c.isOnEntity).map(c => c.id),
      );

      const createOption = (
        component: { componentId: number; componentName: string },
        label: string,
        config: TooltipConfig,
        rules: ComponentRules = {},
      ): ComponentOption => ({
        id: component.componentId,
        value: label,
        onClick: () => handleClickAddComponent(component.componentId, component.componentName),
        ...getComponentConfig(
          component.componentId,
          config,
          rules,
          attachedComponents,
          availableComponents,
        ),
      });

      const options: ComponentOption[] = [
        { header: '3D Content' },
        createOption(
          sdk.components.GltfContainer,
          'GLTF',
          {
            description:
              "The GLTF assigns a 3D model file for the item's visible shape. It also handles collisions, to make an item clickable or block the player from walking through it.",
          },
          {
            conflictsWith: [sdk.components.NftShape.componentId],
          },
        ),
        createOption(sdk.components.Material, 'Material', {
          description:
            'Material determines the visual appearance of an object. It defines properties such as color, texture, and transparency',
          link: 'https://docs.decentraland.org/creator/development-guide/sdk7/materials/',
        }),
        createOption(
          sdk.components.VisibilityComponent,
          'Visibility',
          {
            description:
              'Visibility controls whether an object is visible or not to the player. Items marked as invisible are shown on the editor, but not to players running the scene.',
          },
          {
            requires: [
              [sdk.components.GltfContainer.componentId, sdk.components.MeshRenderer.componentId],
            ],
          },
        ),
        createOption(
          sdk.components.MeshRenderer,
          'Mesh Renderer',
          {
            description:
              'Use MeshRenderer to assign a primitive 3D shape to the item. Instead of using a 3D file from GLTF, assign a simple cube, plane, sphere, or cylinder. These shapes can be used together with Materials',
            link: 'https://docs.decentraland.org/creator/development-guide/sdk7/shape-components/',
          },
          {
            conflictsWith: [sdk.components.NftShape.componentId],
          },
        ),
        createOption(sdk.components.GltfNodeModifiers, 'Swap material', {
          description:
            'Override materials from a GLTF 3D model. Dissable shadows, replace the texture or color or other properties. Apply to all the model or specific nodes.',
          link: 'https://docs.decentraland.org/creator/3d-modeling-and-animations/materials#override-gltf-materials',
        }),
        createOption(sdk.components.LightSource, 'Light Source', {
          description:
            'Add a light source. Can be point (in all directions) or spot light (in a specific direction).',
          link: 'https://docs.decentraland.org/creator/development-guide/sdk7/lights/',
        }),
        createOption(sdk.components.VirtualCamera, 'Virtual Camera', {
          description:
            'Momentarily replace the default camera with a virtual camera on the position of this entity.',
          link: 'https://docs.decentraland.org/creator/scenes-sdk7/3d-content-essentials/camera#using-virtual-cameras',
        }),
        createOption(sdk.components.MeshCollider, 'Mesh Collider', {
          description:
            'MeshCollider defines the collision properties of an item, based on its invisible collision geometry. Collisions serve to make an item clickable or to block the player from walking through an item',
          link: 'https://docs.decentraland.org/creator/development-guide/sdk7/colliders/',
        }),
        createOption(sdk.components.Animator, 'Animator', {
          description:
            'Animator controls the playback of animations for 3D models. Use it to play, stop, or loop animations on entities with GLTF models that contain animation data.',
          link: 'https://docs.decentraland.org/creator/development-guide/sdk7/animations/',
        }),
        createOption(
          sdk.components.NftShape,
          'Nft Shape',
          {
            description: 'NftShape displays an image, gif, or video NFT as a framed picture',
            link: 'https://docs.decentraland.org/creator/development-guide/sdk7/display-a-certified-nft/',
          },
          {
            conflictsWith: [
              sdk.components.GltfContainer.componentId,
              sdk.components.MeshRenderer.componentId,
              sdk.components.TextShape.componentId,
            ],
          },
        ),
        createOption(sdk.components.Billboard, 'Billboard', {
          description:
            'Make an entity automatically reorient its rotation to always face the camera, as in retro 3D games that used 2D sprites.',
          link: 'https://docs.decentraland.org/creator/scenes-sdk7/3d-content-essentials/entity-positioning#face-the-player',
        }),
        { header: 'Interaction' },
        createOption(sdk.components.States, 'States', {
          description:
            'States specify the status of entities. Use triggers to check or change states, and set actions accordingly.',
          link: 'https://docs.decentraland.org/creator/smart-items/#states',
        }),
        createOption(sdk.components.Triggers, 'Triggers', {
          description:
            'Triggers activate actions based on player interactions like clicks, entering/exiting areas, or global events like "on spawn".',
          link: 'https://docs.decentraland.org/creator/smart-items/#triggers',
        }),
        createOption(sdk.components.Actions, 'Actions', {
          description:
            'Actions list the capabilities of entities, from playing animations to changing visibility. Customize or add new actions, which are activated by triggers.',
          link: 'https://docs.decentraland.org/creator/smart-items/#actions',
        }),
        createOption(sdk.components.AudioSource, 'Audio Source', {
          description:
            'AudioSource enables the playback of sound in your scene. The item emits sound that originates from its location, from an .mp3 file in your scene project',
          link: 'https://docs.decentraland.org/creator/development-guide/sdk7/sounds',
        }),
        createOption(
          sdk.components.TextShape,
          'Text Shape',
          {
            description: 'Use TextShape to display text in the 3D space',
            link: 'https://docs.decentraland.org/creator/development-guide/sdk7/text',
          },
          {
            conflictsWith: [sdk.components.NftShape.componentId],
          },
        ),
        createOption(sdk.components.PointerEvents, 'Pointer Events', {
          description:
            'Use PointerEvents to configure the hints shown to players when they hover the cursor over the item. Change the text, the button, the max distance, etc',
          link: 'https://docs.decentraland.org/creator/development-guide/sdk7/click-events',
        }),
        createOption(sdk.components.VideoPlayer, 'Video Player', {
          description: 'VideoPlayer plays a video file in your scene',
          link: 'https://docs.decentraland.org/creator/development-guide/sdk7/video-playing/',
        }),
        createOption(sdk.components.Script, 'Script', {
          description:
            'Write code that is linked to the entity. Scripts can handle initialization and per-frame updates.',
          // link: 'https://docs.decentraland.org/creator/development-guide/sdk7/scripts/',
        }),
      ];

      const optionIds = options.reduce((set, option) => {
        if (!option.header && option.id) {
          set.add(option.id);
        }
        return set;
      }, new Set<number>());

      if (availableComponents.some(component => !optionIds.has(component.id))) {
        options.push({ header: 'Other' });
        for (const component of availableComponents) {
          if (!optionIds.has(component.id)) {
            options.push({
              id: component.id,
              value: component.name,
              onClick: () => handleClickAddComponent(component.id, component.name),
              ...getComponentConfig(
                component.id,
                { description: `${component.name} component` },
                {},
                attachedComponents,
                availableComponents,
              ),
            });
          }
        }
      }

      return options;
    }, [sdk, availableComponents, handleClickAddComponent]);

    const quitEditMode = useCallback(() => setEditMode(false), []);
    const enterEditMode = useCallback(() => setEditMode(true), []);

    const handleRenameEntity = useCallback(
      async (value: string) => {
        if (isRoot(entity)) return;
        const { Name } = sdk.components;
        sdk.operations.updateValue(Name, entity, { value });
        await sdk.operations.dispatch();
        quitEditMode();
      },
      [entity, sdk],
    );

    const handleRemoveEntity = useCallback(async () => {
      sdk.operations.removeEntity(entity);
      await sdk.operations.dispatch();
    }, [entity, sdk]);

    return (
      <div className="EntityHeader">
        <div className="TitleWrapper">
          <div className="Title">
            {instanceOf && <CustomAssetIcon />}
            {!editMode ? (
              <>
                {label}
                {!editMode && !isRoot(entity) ? <RenameIcon onClick={enterEditMode} /> : null}
              </>
            ) : typeof label === 'string' ? (
              <EditInput
                value={label}
                onCancel={quitEditMode}
                onSubmit={handleRenameEntity}
              />
            ) : null}
          </div>
          <div className="RightContent">
            {componentOptions.some(option => !option.header) && !isRoot(entity) ? (
              <Dropdown
                className="AddComponent"
                options={componentOptions}
                trigger={<AddIcon />}
              />
            ) : null}
            {!isRoot(entity) ? (
              <MoreOptionsMenu>
                <RemoveButton
                  className="RemoveButton"
                  onClick={handleRemoveEntity}
                >
                  Delete Entity
                </RemoveButton>
              </MoreOptionsMenu>
            ) : null}
          </div>
        </div>
        {!isRoot(entity) && (
          <Container className="componentInfo">
            {instanceOf && (
              <div className="customItemContainer">
                <span>Instance of:</span>
                <span className="Chip">
                  <CustomAssetIcon />
                  {instanceOf}
                </span>
              </div>
            )}
            <TagsInspector entities={[entity]} />
          </Container>
        )}
      </div>
    );
  }),
);
