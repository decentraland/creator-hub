import { useCallback, useId, useMemo, useState } from 'react';

import { useComponentInput } from '../../../hooks/sdk/useComponentInput';
import { useHasComponent } from '../../../hooks/sdk/useHasComponent';
import { withSdk } from '../../../hoc/withSdk';
import { Block } from '../../Block';
import { Container } from '../../Container';
import { TextField } from '../../ui/TextField';
import { FileUploadField } from '../../ui/FileUploadField';
import { ACCEPTED_FILE_TYPES } from '../../ui/FileUploadField/types';

import type { EditorComponentsTypes } from '../../../lib/sdk/components';
import { SceneCategory } from '../../../lib/sdk/components';
import { Dropdown } from '../../ui/Dropdown';
import { Label, TextArea } from '../../ui';
import { WalletField } from '../../ui/WalletField';
import { Tabs } from '../Tabs';
import { CheckboxField } from '../../ui/CheckboxField';
import { InfoTooltip } from '../../ui/InfoTooltip';
import RangeHourField from '../../ui/RangeHourField/RangeHourField';
import { useComponentValue } from '../../../hooks/sdk/useComponentValue';
import { useProfiles } from '../../../hooks/useProfiles';
import { useAppDispatch, useAppSelector } from '../../../redux/hooks';
import { useAssetOptions } from '../../../hooks/useAssetOptions';
import {
  getHiddenSceneInspectorTabs,
  getSelectedSceneInspectorTab,
  selectSceneInspectorTab,
} from '../../../redux/ui';
import { SceneInspectorTab } from '../../../redux/ui/types';
import { Tab } from '../Tab';
import { Modal } from '../../Modal';
import { Error as ImportError } from '../../ImportAsset/Error';
import { TransitionMode } from '../../../lib/sdk/components/SceneMetadata';
import { getConfig } from '../../../lib/logic/config';
import { getSceneClient } from '../../../lib/rpc/scene';
import { Layout } from './Layout';
import { ProfileRow } from './ProfileRow';
import type { Props } from './types';
import {
  fromScene,
  toScene,
  isValidInput,
  isImage,
  nextMultiplayerValue,
  MIDDAY_SECONDS,
  containsAddress,
  dedupeAddresses,
  withoutAddress,
  validateThumbnailFile,
  validateThumbnailPath,
} from './utils';
import { SceneInfoInput } from './SceneInfoInput';
import { ThumbnailPreview } from './ThumbnailPreview';

import './SceneInspector.css';

const CATEGORIES_OPTIONS = [
  {
    value: SceneCategory.ART,
    label: '🎨 Art',
  },
  {
    value: SceneCategory.GAME,
    label: '🕹️ Game',
  },
  {
    value: SceneCategory.CASINO,
    label: '🃏 Casino',
  },
  {
    value: SceneCategory.SOCIAL,
    label: '👥 Social',
  },
  {
    value: SceneCategory.MUSIC,
    label: '🎶 Music',
  },
  {
    value: SceneCategory.FASHION,
    label: '👠 Fashion',
  },
  {
    value: SceneCategory.CRYPTO,
    label: '🪙 Crypto',
  },
  {
    value: SceneCategory.EDUCATION,
    label: '📚 Education',
  },
  {
    value: SceneCategory.SHOP,
    label: '🛍️ Shop',
  },
  {
    value: SceneCategory.BUSINESS,
    label: '🏢 Business',
  },
  {
    value: SceneCategory.SPORTS,
    label: '🏅 Sports',
  },
];

export default withSdk<Props>(({ sdk, entity, initialOpen = true }) => {
  const { Scene } = sdk.components;

  const hasScene = useHasComponent(entity, Scene);
  const imageOptions = useAssetOptions(ACCEPTED_FILE_TYPES['image']);
  const { getInputProps } = useComponentInput(entity, Scene, fromScene, toScene, {
    validateInput: isValidInput,
  });
  const nameProps = getInputProps('name');
  const descriptionProps = getInputProps('description');
  const thumbnailProps = getInputProps('thumbnail');
  const categoriesProps = getInputProps('categories');
  const authorProps = getInputProps('author');
  const emailProps = getInputProps('email');
  const transitionModeProps = getInputProps('skyboxConfig.transitionMode');
  const silenceVoiceChatProps = getInputProps('silenceVoiceChat', e => e.target.checked);
  const disablePortableExperiencesProps = getInputProps(
    'disablePortableExperiences',
    e => e.target.checked,
  );
  const disableNearbyVoiceChatProps = getInputProps(
    'disableNearbyVoiceChat',
    e => e.target.checked,
  );
  const hideLandscapeTerrainProps = getInputProps('hideLandscapeTerrain', e => e.target.checked);

  const [componentValue, setComponentValue] = useComponentValue<EditorComponentsTypes['Scene']>(
    entity,
    Scene,
  );
  const [rejectedThumbnail, setRejectedThumbnail] = useState<string | null>(null);

  const handleSkyboxAutoChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const isAuto = e.target.checked;
      const newValue = {
        ...componentValue,
        skyboxConfig: {
          ...componentValue.skyboxConfig,
          fixedTime: isAuto ? undefined : MIDDAY_SECONDS,
        },
      };

      setComponentValue(newValue);
    },
    [sdk, Scene, entity, componentValue, setComponentValue],
  );

  const handleSkyboxTimeChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const { value } = e.target as HTMLInputElement;
      const newValue = {
        ...componentValue,
        skyboxConfig: {
          ...componentValue.skyboxConfig,
          fixedTime: parseInt(value),
        },
      };

      setComponentValue(newValue);
    },
    [sdk, Scene, entity, componentValue, setComponentValue],
  );

  const handleCreatorChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const { value } = e.target;
      setComponentValue({
        ...componentValue,
        creator: value,
      });
    },
    [componentValue, setComponentValue],
  );

  const authServerSupported = useMemo(() => getConfig().authServerSupported, []);
  const multiplayerStatusId = useId();
  const [installingMultiplayer, setInstallingMultiplayer] = useState(false);
  const [multiplayerInstallFailed, setMultiplayerInstallFailed] = useState(false);

  const handleMultiplayerServerChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const { install, patch } = nextMultiplayerValue(e.target.checked, authServerSupported);

      if (!install) {
        setComponentValue({ ...componentValue, ...(patch ?? {}) });
        return;
      }

      setInstallingMultiplayer(true);
      setMultiplayerInstallFailed(false);
      try {
        const result = await getSceneClient()?.installMultiplayer();
        if (result?.ok) {
          setComponentValue({ ...componentValue, multiplayerServer: true });
        } else {
          setMultiplayerInstallFailed(true);
        }
      } catch {
        setMultiplayerInstallFailed(true);
      }
      setInstallingMultiplayer(false);
    },
    [componentValue, setComponentValue, authServerSupported],
  );

  const logsPermissionsId = useId();
  const [logsPermissionsCommits, setLogsPermissionsCommits] = useState(0);
  const [logsPermissionIsDuplicate, setLogsPermissionIsDuplicate] = useState(false);

  const addresses = useMemo(
    () => dedupeAddresses(componentValue.logsPermissions),
    [componentValue.logsPermissions],
  );

  const profiles = useProfiles(addresses);

  const handleAddLogsPermission = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setLogsPermissionIsDuplicate(false);
      const address = event.target.value;
      if (!address) return;

      const logsPermissions = componentValue.logsPermissions ?? [];
      if (containsAddress(logsPermissions, address)) {
        setLogsPermissionIsDuplicate(true);
        return;
      }

      setComponentValue({ ...componentValue, logsPermissions: [...logsPermissions, address] });
      setLogsPermissionsCommits(commits => commits + 1);
    },
    [componentValue, setComponentValue],
  );

  const handleRemoveLogsPermission = useCallback(
    (address: string) => {
      setComponentValue({
        ...componentValue,
        logsPermissions: withoutAddress(componentValue.logsPermissions, address),
      });
    },
    [componentValue, setComponentValue],
  );

  const handleThumbnailChange = useCallback(
    async (thumbnail: string) => {
      const error = await validateThumbnailPath(thumbnail);
      if (error) {
        setRejectedThumbnail(error.message);
        return;
      }
      const { operations } = sdk;
      operations.updateValue(Scene, entity, { thumbnail });
      await operations.dispatch();
    },
    [sdk, Scene, entity],
  );

  const dismissRejectedThumbnail = useCallback(() => setRejectedThumbnail(null), []);

  if (!hasScene) {
    return null;
  }

  const hiddenSceneInspectorTabs = useAppSelector(getHiddenSceneInspectorTabs);
  const selectedSceneInspectorTab = useAppSelector(getSelectedSceneInspectorTab);
  const dispatch = useAppDispatch();

  const handleSelectTab = useCallback(
    (tab: SceneInspectorTab) => {
      if (tab === selectedSceneInspectorTab) {
        return;
      }
      dispatch(selectSceneInspectorTab({ tab }));
    },
    [selectedSceneInspectorTab, dispatch],
  );

  const handleLayoutChange = useCallback(
    (layout: EditorComponentsTypes['Scene']['layout']) => {
      setComponentValue({ ...componentValue, layout });
    },
    [componentValue],
  );

  return (
    <Container
      className="Scene"
      gap
      initialOpen={initialOpen}
    >
      <Tabs className="SceneTabs">
        {hiddenSceneInspectorTabs[SceneInspectorTab.DETAILS] ? null : (
          <Tab
            active={selectedSceneInspectorTab === SceneInspectorTab.DETAILS}
            onClick={() => handleSelectTab(SceneInspectorTab.DETAILS)}
          >
            <i className="TabIcon details-icon" />
            &nbsp;Details
          </Tab>
        )}
        {hiddenSceneInspectorTabs[SceneInspectorTab.LAYOUT] ? null : (
          <Tab
            active={selectedSceneInspectorTab === SceneInspectorTab.LAYOUT}
            onClick={() => handleSelectTab(SceneInspectorTab.LAYOUT)}
          >
            <i className="TabIcon layout-icon" />
            &nbsp;Layout
          </Tab>
        )}
        {hiddenSceneInspectorTabs[SceneInspectorTab.SETTINGS] ? null : (
          <Tab
            active={selectedSceneInspectorTab === SceneInspectorTab.SETTINGS}
            onClick={() => handleSelectTab(SceneInspectorTab.SETTINGS)}
          >
            <i className="TabIcon cog-icon" />
            &nbsp;Settings
          </Tab>
        )}
      </Tabs>
      {selectedSceneInspectorTab === SceneInspectorTab.DETAILS ? (
        <>
          <TextField
            autoSelect
            label="Name"
            {...nameProps}
          />
          <TextArea
            label="Description"
            {...descriptionProps}
          />
          <div className="ThumbnailRow">
            <FileUploadField
              {...thumbnailProps}
              onChange={undefined}
              label="Thumbnail"
              accept={ACCEPTED_FILE_TYPES['image']}
              options={imageOptions}
              onDrop={handleThumbnailChange}
              isValidFile={isImage}
              validateFile={validateThumbnailFile}
            />
            <ThumbnailPreview path={(thumbnailProps.value as unknown as string) ?? ''} />
          </div>
          <Modal
            isOpen={rejectedThumbnail !== null}
            onRequestClose={dismissRejectedThumbnail}
            className="ImportAssetModal"
            overlayClassName="ImportAssetModalOverlay"
          >
            <ImportError
              assets={[]}
              errorMessage="Thumbnail not supported"
              description={rejectedThumbnail}
              primaryAction={{ name: 'OK', onClick: dismissRejectedThumbnail }}
            />
          </Modal>
          <Dropdown
            label="Categories"
            options={CATEGORIES_OPTIONS}
            multiple
            {...categoriesProps}
            onChange={event => {
              if ((event.target.value as unknown as string[]).length > 3) {
                return;
              }
              categoriesProps.onChange!(event);
            }}
          />
          <TextField
            autoSelect
            label="Creator name"
            placeholder="Decentraland user"
            {...authorProps}
          />
          <TextField
            autoSelect
            label="Creator contact email (optional)"
            placeholder="your@email.com"
            {...emailProps}
          />
          <Block className="CreatorAddrressContainer">
            <Label text="Creator wallet address (optional)" />
            <Label
              className="CreatorAddrressLabel"
              text="Enter the wallet address that will act as the beneficiary for transactions."
            />
            <WalletField
              value={componentValue?.creator ?? ''}
              onChange={handleCreatorChange}
            />
          </Block>
          <SceneInfoInput />
        </>
      ) : null}

      {selectedSceneInspectorTab === SceneInspectorTab.LAYOUT ? (
        <Layout
          value={componentValue.layout}
          onChange={handleLayoutChange}
        />
      ) : null}

      {selectedSceneInspectorTab === SceneInspectorTab.SETTINGS ? (
        <>
          <Block
            label="Scene Restrictions"
            className="underlined"
          ></Block>
          <CheckboxField
            label="Silence Voice Chat"
            checked={componentValue.silenceVoiceChat}
            {...silenceVoiceChatProps}
          />
          <CheckboxField
            label="Disable Smart Wearables & Portable Experiences"
            checked={componentValue.disablePortableExperiences}
            {...disablePortableExperiencesProps}
          />
          <CheckboxField
            label="Disable Nearby Voice Chat"
            checked={componentValue.disableNearbyVoiceChat}
            {...disableNearbyVoiceChatProps}
          />
          <Block
            label="Terrain"
            className="underlined"
          ></Block>
          <CheckboxField
            label={
              <>
                Hide Landscape Terrain
                <InfoTooltip text="Hides the auto-generated landscape (grassland, trees, and sea) around your scene, for example for scenes surrounded by open water or a void. Only applies to Worlds and local preview; Genesis City always shows terrain." />
              </>
            }
            checked={componentValue.hideLandscapeTerrain}
            {...hideLandscapeTerrainProps}
          />
          <Block
            label="Skybox"
            className="underlined"
          ></Block>
          <CheckboxField
            label="Auto (decentraland time)"
            checked={componentValue.skyboxConfig?.fixedTime === undefined}
            onChange={handleSkyboxAutoChange}
          />
          <RangeHourField
            value={componentValue.skyboxConfig?.fixedTime ?? MIDDAY_SECONDS}
            onChange={handleSkyboxTimeChange}
            disabled={componentValue.skyboxConfig?.fixedTime === undefined}
          />
          <Dropdown
            label="Transition Mode"
            options={[
              { label: 'Forward', value: TransitionMode.TM_FORWARD },
              { label: 'Backward', value: TransitionMode.TM_BACKWARD },
            ]}
            {...transitionModeProps}
            disabled={componentValue.skyboxConfig?.fixedTime === undefined}
          />
          <Block
            label="Advanced"
            className="underlined"
          ></Block>
          <CheckboxField
            label="Enable Multiplayer Server"
            aria-label="Enable Multiplayer Server"
            aria-describedby={multiplayerStatusId}
            checked={componentValue.multiplayerServer}
            disabled={installingMultiplayer}
            onChange={handleMultiplayerServerChange}
          />
          <div
            className="MultiplayerStatusRow"
            id={multiplayerStatusId}
            role="status"
          >
            {installingMultiplayer && (
              <Label
                className="MultiplayerStatus"
                text="Installing the multiplayer-server SDK…"
              />
            )}
            {multiplayerInstallFailed && (
              <Label
                className="MultiplayerStatus error"
                text="Couldn't install the multiplayer-server SDK package."
              />
            )}
          </div>
          {componentValue.multiplayerServer && (
            <div className="LogsAccess">
              <Label text="Log Access & Storage" />
              <div
                className="LogsAccessHint"
                id={`${logsPermissionsId}-hint`}
              >
                Add by User ID who can access this scene's logs and manage its storage.
              </div>
              <WalletField
                key={logsPermissionsCommits}
                aria-label="User ID"
                aria-describedby={
                  logsPermissionIsDuplicate
                    ? `${logsPermissionsId}-hint ${logsPermissionsId}-duplicate`
                    : `${logsPermissionsId}-hint`
                }
                onChange={handleAddLogsPermission}
              />
              {logsPermissionIsDuplicate && (
                <div
                  className="LogsAccessHint error"
                  id={`${logsPermissionsId}-duplicate`}
                  role="alert"
                >
                  This User ID is already on the list.
                </div>
              )}
              <div className="LogsAccessList">
                {addresses.map(address => {
                  const profile = profiles[address];
                  return (
                    <ProfileRow
                      key={address}
                      address={address}
                      name={profile?.name}
                      faceUrl={profile?.faceUrl}
                      removeLabel="Remove Address"
                      onRemove={() => handleRemoveLogsPermission(address)}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </>
      ) : null}
    </Container>
  );
});
