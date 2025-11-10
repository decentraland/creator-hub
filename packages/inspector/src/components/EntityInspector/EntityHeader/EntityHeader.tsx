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

      const isDisabled = (componentId: number, rules: ComponentRules = {}): boolean => {
        // If component is already on entity, disable it
        if (attachedComponents.has(componentId)) {
          return true;
        }

        // If requires is defined, evaluate the requirements
        // Nested arrays use OR logic within, AND logic between groups
        // Flat array uses AND logic for all
        if (rules.requires) {
          const allGroupsSatisfied = rules.requires.every((group: number | number[]) =>
            Array.isArray(group)
              ? group.some((id: number) => attachedComponents.has(id))
              : attachedComponents.has(group),
          );
          if (!allGroupsSatisfied) return true;
        }

        // If conflictsWith is defined, check if ANY conflicting component is present
        if (rules.conflictsWith) {
          const hasConflict = rules.conflictsWith.some((id: number) => attachedComponents.has(id));
          if (hasConflict) return true;
        }

        return false;
      };

      const getComponentName = (componentId: number): string => {
        const component = availableComponents.find(c => c.id === componentId);
        return component?.name || 'Unknown Component';
      };

      const getTooltip = (
        componentId: number,
        config: TooltipConfig,
        rules: ComponentRules = {},
      ): { text: string; link?: string } => {
        // If already on entity
        if (attachedComponents.has(componentId)) {
          return {
            text: 'This component is already added. An entity can only have one copy of each component.',
          };
        }

        // If disabled due to missing requirements
        if (rules.requires) {
          const allGroupsSatisfied = rules.requires.every((group: number | number[]) =>
            Array.isArray(group)
              ? group.some((id: number) => attachedComponents.has(id))
              : attachedComponents.has(group),
          );
          if (!allGroupsSatisfied) {
            if (config.disabledMessage) {
              return { text: config.disabledMessage };
            }
            // Generate default message showing required components
            const requirementParts = rules.requires.map((group: number | number[]) => {
              if (Array.isArray(group)) {
                const names = group.map(id => getComponentName(id));
                if (names.length === 1) return names[0];
                if (names.length === 2) return `either ${names[0]} or ${names[1]}`;
                return `either ${names.slice(0, -1).join(', ')}, or ${names[names.length - 1]}`;
              }
              return getComponentName(group);
            });

            let message = 'You must have ';
            if (requirementParts.length === 1) {
              message += requirementParts[0];
            } else if (requirementParts.length === 2) {
              message += `${requirementParts[0]} and ${requirementParts[1]}`;
            } else {
              message += `${requirementParts.slice(0, -1).join(', ')}, and ${requirementParts[requirementParts.length - 1]}`;
            }
            message += ' to use this component.';
            return { text: message };
          }
        }

        // If disabled due to conflicts
        if (rules.conflictsWith) {
          const hasConflict = rules.conflictsWith.some((id: number) => attachedComponents.has(id));
          if (hasConflict) {
            if (config.disabledMessage) {
              return { text: config.disabledMessage };
            }
            // Generate default message showing conflicting components
            const conflictingNames = rules.conflictsWith
              .filter((id: number) => attachedComponents.has(id))
              .map((id: number) => getComponentName(id));

            let message = 'This component cannot be used with ';
            if (conflictingNames.length === 1) {
              message += `${conflictingNames[0]}.`;
            } else if (conflictingNames.length === 2) {
              message += `${conflictingNames[0]} or ${conflictingNames[1]}.`;
            } else {
              message += `${conflictingNames.slice(0, -1).join(', ')}, or ${conflictingNames[conflictingNames.length - 1]}.`;
            }
            return { text: message };
          }
        }

        // Component is enabled, show normal description
        return { text: config.description, ...(config.link && { link: config.link }) };
      };

      const options: ComponentOption[] = [
        { header: '3D Content' },
        {
          id: sdk.components.GltfContainer.componentId,
          value: 'GLTF',
          onClick: () =>
            handleClickAddComponent(
              sdk.components.GltfContainer.componentId,
              sdk.components.GltfContainer.componentName,
            ),
          disabled: isDisabled(sdk.components.GltfContainer.componentId, {
            conflictsWith: [sdk.components.NftShape.componentId],
          }),
          tooltip: getTooltip(
            sdk.components.GltfContainer.componentId,
            {
              description:
                "The GLTF assigns a 3D model file for the item's visible shape. It also handles collisions, to make an item clickable or block the player from walking through it.",
            },
            {
              conflictsWith: [sdk.components.NftShape.componentId],
            },
          ),
        },
        {
          id: sdk.components.Material.componentId,
          value: 'Material',
          onClick: () =>
            handleClickAddComponent(
              sdk.components.Material.componentId,
              sdk.components.Material.componentName,
            ),
          disabled: isDisabled(sdk.components.Material.componentId, {}),
          tooltip: getTooltip(sdk.components.Material.componentId, {
            description:
              'Material determines the visual appearance of an object. It defines properties such as color, texture, and transparency',
            link: 'https://docs.decentraland.org/creator/development-guide/sdk7/materials/',
          }),
        },
        {
          id: sdk.components.VisibilityComponent.componentId,
          value: 'Visibility',
          onClick: () =>
            handleClickAddComponent(
              sdk.components.VisibilityComponent.componentId,
              sdk.components.VisibilityComponent.componentName,
            ),
          disabled: isDisabled(sdk.components.VisibilityComponent.componentId, {
            requires: [
              [sdk.components.GltfContainer.componentId, sdk.components.MeshCollider.componentId],
            ],
          }),
          tooltip: getTooltip(
            sdk.components.VisibilityComponent.componentId,
            {
              description:
                'Visibility controls whether an object is visible or not to the player. Items marked as invisible are shown on the editor, but not to players running the scene.',
            },
            {
              requires: [
                [sdk.components.GltfContainer.componentId, sdk.components.MeshCollider.componentId],
              ],
            },
          ),
        },
        {
          id: sdk.components.MeshRenderer.componentId,
          value: 'Mesh Renderer',
          onClick: () =>
            handleClickAddComponent(
              sdk.components.MeshRenderer.componentId,
              sdk.components.MeshRenderer.componentName,
            ),
          disabled: isDisabled(sdk.components.MeshRenderer.componentId, {
            conflictsWith: [sdk.components.NftShape.componentId],
          }),
          tooltip: getTooltip(
            sdk.components.MeshRenderer.componentId,
            {
              description:
                'Use MeshRenderer to assign a primitive 3D shape to the item. Instead of using a 3D file from GLTF, assign a simple cube, plane, sphere, or cylinder. These shapes can be used together with Materials',
              link: 'https://docs.decentraland.org/creator/development-guide/sdk7/shape-components/',
            },
            {
              conflictsWith: [sdk.components.NftShape.componentId],
            },
          ),
        },
        {
          id: sdk.components.GltfNodeModifiers.componentId,
          value: 'Swap material',
          onClick: () =>
            handleClickAddComponent(
              sdk.components.GltfNodeModifiers.componentId,
              sdk.components.GltfNodeModifiers.componentName,
            ),
          disabled: isDisabled(sdk.components.GltfNodeModifiers.componentId, {}),
          tooltip: getTooltip(sdk.components.GltfNodeModifiers.componentId, {
            description: 'Override GLTF/GLB materials',
          }),
        },
        {
          id: sdk.components.LightSource.componentId,
          value: 'Light Source',
          onClick: () =>
            handleClickAddComponent(
              sdk.components.LightSource.componentId,
              sdk.components.LightSource.componentName,
            ),
          disabled: isDisabled(sdk.components.LightSource.componentId, {}),
          tooltip: getTooltip(sdk.components.LightSource.componentId, {
            description: 'Add a point or spot light',
            link: 'https://docs.decentraland.org/creator/development-guide/sdk7/lights/',
          }),
        },
        {
          id: sdk.components.MeshCollider.componentId,
          value: 'Mesh Collider',
          onClick: () =>
            handleClickAddComponent(
              sdk.components.MeshCollider.componentId,
              sdk.components.MeshCollider.componentName,
            ),
          disabled: isDisabled(sdk.components.MeshCollider.componentId, {}),
          tooltip: getTooltip(sdk.components.MeshCollider.componentId, {
            description:
              'MeshCollider defines the collision properties of an item, based on its invisible collision geometry. Collisions serve to make an item clickable or to block the player from walking through an item',
            link: 'https://docs.decentraland.org/creator/development-guide/sdk7/colliders/',
          }),
        },
        {
          id: sdk.components.NftShape.componentId,
          value: 'Nft Shape',
          onClick: () =>
            handleClickAddComponent(
              sdk.components.NftShape.componentId,
              sdk.components.NftShape.componentName,
            ),
          disabled: isDisabled(sdk.components.NftShape.componentId, {
            conflictsWith: [
              sdk.components.GltfContainer.componentId,
              sdk.components.MeshRenderer.componentId,
              sdk.components.TextShape.componentId,
            ],
          }),
          tooltip: getTooltip(
            sdk.components.NftShape.componentId,
            {
              description: 'NftShape defines the shape of an item, based on its NFT',
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
        },
        { header: 'Interaction' },
        {
          id: sdk.components.States.componentId,
          value: 'States',
          onClick: () =>
            handleClickAddComponent(
              sdk.components.States.componentId,
              sdk.components.States.componentName,
            ),
          disabled: isDisabled(sdk.components.States.componentId, {}),
          tooltip: getTooltip(sdk.components.States.componentId, {
            description:
              'States specify the status of entities. Use triggers to check or change states, and set actions accordingly.',
            link: 'https://docs.decentraland.org/creator/smart-items/#states',
          }),
        },
        {
          id: sdk.components.Triggers.componentId,
          value: 'Triggers',
          onClick: () =>
            handleClickAddComponent(
              sdk.components.Triggers.componentId,
              sdk.components.Triggers.componentName,
            ),
          disabled: isDisabled(sdk.components.Triggers.componentId, {}),
          tooltip: getTooltip(sdk.components.Triggers.componentId, {
            description:
              'Triggers activate actions based on player interactions like clicks, entering/exiting areas, or global events like "on spawn".',
            link: 'https://docs.decentraland.org/creator/smart-items/#triggers',
          }),
        },
        {
          id: sdk.components.Actions.componentId,
          value: 'Actions',
          onClick: () =>
            handleClickAddComponent(
              sdk.components.Actions.componentId,
              sdk.components.Actions.componentName,
            ),
          disabled: isDisabled(sdk.components.Actions.componentId, {}),
          tooltip: getTooltip(sdk.components.Actions.componentId, {
            description:
              'Actions list the capabilities of entities, from playing animations to changing visibility. Customize or add new actions, which are activated by triggers.',
            link: 'https://docs.decentraland.org/creator/smart-items/#actions',
          }),
        },
        {
          id: sdk.components.AudioSource.componentId,
          value: 'Audio Source',
          onClick: () =>
            handleClickAddComponent(
              sdk.components.AudioSource.componentId,
              sdk.components.AudioSource.componentName,
            ),
          disabled: isDisabled(sdk.components.AudioSource.componentId, {}),
          tooltip: getTooltip(sdk.components.AudioSource.componentId, {
            description:
              'AudioSource enables the playback of sound in your scene. The item emits sound that originates from its location, from an .mp3 file in your scene project',
            link: 'https://docs.decentraland.org/creator/development-guide/sdk7/sounds',
          }),
        },
        {
          id: sdk.components.TextShape.componentId,
          value: 'Text Shape',
          onClick: () =>
            handleClickAddComponent(
              sdk.components.TextShape.componentId,
              sdk.components.TextShape.componentName,
            ),
          disabled: isDisabled(sdk.components.TextShape.componentId, {
            conflictsWith: [sdk.components.NftShape.componentId],
          }),
          tooltip: getTooltip(
            sdk.components.TextShape.componentId,
            {
              description: 'Use TextShape to display text in the 3D space',
              link: 'https://docs.decentraland.org/creator/development-guide/sdk7/text',
            },
            {
              conflictsWith: [sdk.components.NftShape.componentId],
            },
          ),
        },
        {
          id: sdk.components.PointerEvents.componentId,
          value: 'Pointer Events',
          onClick: () =>
            handleClickAddComponent(
              sdk.components.PointerEvents.componentId,
              sdk.components.PointerEvents.componentName,
            ),
          disabled: isDisabled(sdk.components.PointerEvents.componentId, {}),
          tooltip: getTooltip(sdk.components.PointerEvents.componentId, {
            description:
              'Use PointerEvents to configure the hints shown to players when they hover the cursor over the item. Change the text, the button, the max distance, etc',
            link: 'https://docs.decentraland.org/creator/development-guide/sdk7/click-events',
          }),
        },
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
              disabled: isDisabled(component.id, {}),
              tooltip: getTooltip(component.id, {
                description: `${component.name} component`,
              }),
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
            {componentOptions.some(option => !option.header) ? (
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
            <TagsInspector entity={entity} />
          </Container>
        )}
      </div>
    );
  }),
);
