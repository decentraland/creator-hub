import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { HiOutlineRefresh as RefreshIcon } from 'react-icons/hi';
import { VscFolderOpened as FileUploadIcon } from 'react-icons/vsc';
import { MdOutlineDriveFileRenameOutline as EditIcon } from 'react-icons/md';
import { VscTrash as RemoveIcon } from 'react-icons/vsc';

import { getSceneClient } from '../../../lib/rpc/scene';
import type { ScriptComponent, ScriptItem } from '../../../lib/sdk/components';
import { getDefaultScriptTemplate } from '../../../lib/data-layer/client/constants';
import { withSdk } from '../../../hoc/withSdk';
import { useHasComponent } from '../../../hooks/sdk/useHasComponent';
import { useComponentValue } from '../../../hooks/sdk/useComponentValue';
import { useArrayState } from '../../../hooks/useArrayState';
import { useAppDispatch, useAppSelector } from '../../../redux/hooks';
import { getDataLayerInterface, importAsset } from '../../../redux/data-layer';
import { Block } from '../../Block';
import { Container } from '../../Container';
import { ACCEPTED_FILE_TYPES } from '../../ui/FileUploadField/types';
import { TextField, InfoTooltip, FileUploadField } from '../../ui';
import { Message, MessageType } from '../../ui/Message';
import { AddButton } from '../AddButton';
import MoreOptionsMenu from '../MoreOptionsMenu';
import { Button } from '../../Button';
import { RemoveButton } from '../RemoveButton';
import { selectAssetCatalog } from '../../../redux/app';
import { ScriptParamField } from './ScriptParamField';

import {
  fromNumber,
  toNumber,
  isValidNumber,
  isValidPath,
  parseLayout,
  isScriptNode,
  isScriptNameAvailable,
  buildScriptPath,
  readScript,
} from './utils';
import { getScriptParams } from './parser';
import type { Props, ScriptLayout, ScriptParamUnion, ChangeEvt } from './types';

import './ScriptInspector.css';

export default withSdk<Props>(({ sdk, entity: entityId, initialOpen = true }) => {
  const { Script } = sdk.components;
  const dispatch = useAppDispatch();
  const files = useAppSelector(selectAssetCatalog);

  const hasScript = useHasComponent(entityId, Script);
  const [componentValue, setComponentValue] = useComponentValue<ScriptComponent>(entityId, Script);

  const [scripts, addScript, updateScript, removeScript] = useArrayState<ScriptItem>(
    componentValue === null ? [] : componentValue.value,
  );

  const [dialogMode, setDialogMode] = useState<'create' | 'import' | undefined>(undefined);
  const [newScriptName, setNewScriptName] = useState('');

  // since this component only has 1 property, we can use a simple effect to update the component
  // value when the scripts array changes
  useEffect(() => {
    setComponentValue({ value: scripts });
  }, [scripts, setComponentValue]);

  const createScript = useCallback(
    (path: string, priority = 0, content: string) => {
      const { params, error } = getScriptParams(content);
      const layout: ScriptLayout = { params, error };

      const newScript: ScriptItem = {
        path,
        priority,
        layout: JSON.stringify(layout),
      };

      addScript(newScript);
      setDialogMode(undefined);
      setNewScriptName('');
    },
    [addScript, setDialogMode, setNewScriptName],
  );

  const handleRemove = useCallback(async () => {
    sdk.operations.removeComponent(entityId, Script);
    await sdk.operations.dispatch();
  }, [sdk, entityId, Script]);

  const handleRemoveScript = useCallback(
    (index: number) => {
      removeScript(index);
    },
    [removeScript],
  );

  const handleEditScript = useCallback(
    async (index: number) => {
      try {
        const script = scripts[index];
        if (!script) return;

        const sceneClient = getSceneClient();
        if (!sceneClient) return;

        await sceneClient.openFile(script.path);
      } catch (error) {
        console.error('Failed to open script:', error);
      }
    },
    [scripts],
  );

  const handleReloadScripts = useCallback(
    async (e: React.MouseEvent<SVGElement>) => {
      e.stopPropagation();
      if (scripts.length === 0) return;

      const dataLayer = getDataLayerInterface();
      if (!dataLayer) return;

      const updatedScripts = await Promise.all(
        scripts.map(async script => {
          const content = await readScript(dataLayer, script.path);
          if (!content) return script; // keep existing if read fails

          const { params, error } = getScriptParams(content);
          const layout: ScriptLayout = { params, error };

          return {
            ...script,
            layout: JSON.stringify(layout),
          };
        }),
      );

      setComponentValue({ value: updatedScripts });
    },
    [scripts, setComponentValue],
  );

  const handleCreateScript = useCallback(() => {
    if (!newScriptName.trim()) {
      return;
    }

    const template = getDefaultScriptTemplate(newScriptName);
    const scriptPath = buildScriptPath(newScriptName);
    const buffer = new Uint8Array(Buffer.from(template, 'utf-8'));
    const content = new Map([[scriptPath, buffer]]);
    dispatch(importAsset({ content, basePath: '', assetPackageName: '', reload: true }));

    createScript(scriptPath, 0, template);
  }, [newScriptName, createScript, dispatch]);

  const handleImportScript = useCallback(
    async (path: string) => {
      const dataLayer = getDataLayerInterface();
      if (!dataLayer) return;

      // retry logic for newly imported files (asset catalog needs time to index)
      let content: string | undefined;
      let retries = 5;

      while (retries > 0) {
        content = await readScript(dataLayer, path);

        if (content) {
          break;
        }

        if (retries > 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        retries--;
      }

      if (!content) {
        console.error(`Failed to read script after retries: ${path}`);
        return;
      }

      createScript(path, 0, content);
    },
    [createScript],
  );

  // memoize parsed layouts to avoid re-parsing on every render
  const parsedLayouts = useMemo(() => {
    return scripts.map(script => parseLayout(script.layout));
  }, [scripts]);

  const handleUpdateDynamicField = useCallback(
    (index: number, paramName: string, paramValue: ScriptParamUnion['value']) => {
      const script = scripts[index];
      const layout = parsedLayouts[index];
      if (!layout) return;

      const updatedLayout: ScriptLayout = {
        params: {
          ...layout.params,
          [paramName]: { ...layout.params[paramName], value: paramValue } as ScriptParamUnion,
        },
      };

      updateScript(index, { ...script, layout: JSON.stringify(updatedLayout) });
    },
    [scripts, parsedLayouts, updateScript],
  );

  const renderScriptParams = useCallback(
    (layout: ScriptLayout | undefined, index: number) => {
      if (!layout || !layout.params) return null;

      return (
        <Block label="Script Parameters:">
          <div className="params">
            {Object.entries(layout.params).map(([name, param]) => (
              <ScriptParamField
                key={name}
                name={name}
                param={param}
                onUpdate={value => handleUpdateDynamicField(index, name, value)}
              />
            ))}
          </div>
        </Block>
      );
    },
    [handleUpdateDynamicField],
  );

  const scriptNameError = useMemo(() => {
    if (!files) return '';
    if (!isScriptNameAvailable(files, newScriptName)) return 'Script name already exists';
  }, [files, newScriptName, isScriptNameAvailable]);

  if (!hasScript) return null;

  return (
    <Container
      label="Script"
      className="ScriptInspector"
      initialOpen={initialOpen}
      onRemoveContainer={handleRemove}
      rightContent={
        <InfoTooltip
          text="Reload scripts"
          disabled={scripts.length === 0}
          trigger={
            <RefreshIcon
              className="icon-item"
              onClick={handleReloadScripts}
              style={{
                cursor: scripts.length === 0 ? 'not-allowed' : 'pointer',
                opacity: scripts.length === 0 ? 0.5 : 1,
              }}
            />
          }
          openOnTriggerMouseEnter={true}
          closeOnTriggerClick={true}
          position="top center"
        />
      }
    >
      {scripts.length > 0 && (
        <>
          {scripts.map((script, index) => (
            <Block key={index}>
              <TextField
                label="Path"
                value={script.path}
                onChange={(e: ChangeEvt) => {
                  updateScript(index, { ...script, path: e.target.value });
                }}
                error={!isValidPath(script.path)}
              />
              <TextField
                label="Priority"
                type="number"
                value={fromNumber(script.priority)}
                onChange={(e: ChangeEvt) => {
                  updateScript(index, {
                    ...script,
                    priority: toNumber(e.target.value),
                  });
                }}
                error={!isValidNumber(fromNumber(script.priority))}
              />
              {parsedLayouts[index]?.error ? (
                <Message
                  text={`Errors found while parsing script: ${parsedLayouts[index].error!}`}
                  type={MessageType.ERROR}
                />
              ) : (
                renderScriptParams(parsedLayouts[index], index)
              )}
              <MoreOptionsMenu>
                <Button onClick={() => handleEditScript(index)}>
                  <EditIcon />
                  Edit
                </Button>
                <Button onClick={() => handleRemoveScript(index)}>
                  <RemoveIcon />
                  Remove
                </Button>
              </MoreOptionsMenu>
            </Block>
          ))}
        </>
      )}
      {dialogMode ? (
        <Block>
          {dialogMode === 'create' && (
            <TextField
              label="New script name"
              value={newScriptName}
              onChange={(e: ChangeEvt) => setNewScriptName(e.target.value)}
              placeholder="MyScript"
              error={scriptNameError}
            />
          )}
          {dialogMode === 'import' && (
            <FileUploadField
              label="Import script"
              accept={ACCEPTED_FILE_TYPES['script']}
              onDrop={handleImportScript}
              isValidFile={isScriptNode}
            />
          )}
          <div className="actions">
            {dialogMode === 'create' && (
              <AddButton
                onClick={handleCreateScript}
                disabled={!newScriptName.trim() || !!scriptNameError}
              >
                Create
              </AddButton>
            )}
            <RemoveButton
              variant="add"
              onClick={() => setDialogMode(undefined)}
            >
              Cancel
            </RemoveButton>
          </div>
        </Block>
      ) : (
        <div className="actions">
          <AddButton onClick={() => setDialogMode('create')}>Create new script</AddButton>
          <AddButton
            onClick={() => setDialogMode('import')}
            icon={<FileUploadIcon />}
          >
            Import script
          </AddButton>
        </div>
      )}
    </Container>
  );
});
