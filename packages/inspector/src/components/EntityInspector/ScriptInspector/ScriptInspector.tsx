import React, { useCallback, useMemo, useState } from 'react';
import { HiOutlineRefresh as RefreshIcon } from 'react-icons/hi';
import { VscFolderOpened as FileUploadIcon } from 'react-icons/vsc';
import { MdOutlineDriveFileRenameOutline as EditIcon } from 'react-icons/md';
import { VscTrash as RemoveIcon } from 'react-icons/vsc';

import { getSceneClient } from '../../../lib/rpc/scene';
import { withSdk } from '../../../hoc/withSdk';
import { useHasComponent } from '../../../hooks/sdk/useHasComponent';
import { useComponentValue } from '../../../hooks/sdk/useComponentValue';
import { useAppDispatch, useAppSelector } from '../../../redux/hooks';
import { getDataLayerInterface, importAsset } from '../../../redux/data-layer';
import { selectAssetCatalog } from '../../../redux/app';
import { retry } from '../../../lib/utils/retry';
import { Block } from '../../Block';
import { Container } from '../../Container';
import { ACCEPTED_FILE_TYPES } from '../../ui/FileUploadField/types';
import { TextField, InfoTooltip, FileUploadField } from '../../ui';
import { Message, MessageType } from '../../ui/Message';
import { AddButton } from '../AddButton';
import MoreOptionsMenu from '../MoreOptionsMenu';
import { Button } from '../../Button';
import { RemoveButton } from '../RemoveButton';
import { ScriptParamField } from './ScriptParamField';

import { getScriptTemplateClass } from './templates';
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
  mergeLayout,
} from './utils';
import { getScriptParams } from './parser';
import type { Props, ScriptLayout, ScriptParamUnion, ChangeEvt, ScriptItem } from './types';

import './ScriptInspector.css';

export default withSdk<Props>(({ sdk, entity: entityId, initialOpen = true }) => {
  const { Script } = sdk.components;
  const dispatch = useAppDispatch();
  const files = useAppSelector(selectAssetCatalog);

  const hasScript = useHasComponent(entityId, Script);
  const [componentValue, setComponentValue] = useComponentValue(entityId, Script);
  const [dialogMode, setDialogMode] = useState<'create' | 'import' | undefined>(undefined);
  const [newScriptName, setNewScriptName] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const scripts = componentValue?.value ?? [];

  const addScript = useCallback(
    (script: ScriptItem) => {
      setComponentValue({ value: [...scripts, script] });
    },
    [scripts, setComponentValue],
  );

  const updateScript = useCallback(
    (index: number, script: ScriptItem) => {
      const newScripts = [...scripts];
      newScripts[index] = script;
      setComponentValue({ value: newScripts });
    },
    [scripts, setComponentValue],
  );

  const removeScript = useCallback(
    (index: number) => {
      const newScripts = scripts.filter((_, i) => i !== index);
      setComponentValue({ value: newScripts });
    },
    [scripts, setComponentValue],
  );

  // memoize parsed layouts to avoid re-parsing on every render
  const parsedLayouts = useMemo(() => {
    return scripts.map(script => parseLayout(script.layout));
  }, [scripts]);

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

  // this will reload ALL scripts, not only the current entity ones...
  const handleReloadScripts = useCallback(
    async (e: React.MouseEvent<SVGElement>) => {
      e.stopPropagation();
      setError(undefined);

      const dataLayer = getDataLayerInterface();
      if (!dataLayer) return;

      let firstError: string | undefined;
      const allEntitiesWithScripts = Array.from(sdk.engine.getEntitiesWith(Script));

      if (allEntitiesWithScripts.length === 0) return;

      await Promise.all(
        allEntitiesWithScripts.map(async ([entity, scriptComponent]) => {
          const entityScripts = scriptComponent.value || [];
          if (entityScripts.length === 0) return;

          const updatedScripts = await Promise.all(
            entityScripts.map(async script => {
              try {
                const content = await readScript(dataLayer, script.path);
                const newLayout = getScriptParams(content);
                const currentLayout = parseLayout(script.layout) || { params: {} };
                const layout = mergeLayout(newLayout, currentLayout);

                return {
                  ...script,
                  layout: JSON.stringify(layout),
                };
              } catch (error) {
                const msg = `Failed to reload script '${script.path}'`;
                console.error(`${msg}:`, error);
                if (!firstError) firstError = msg;
                return script; // keep existing if read fails
              }
            }),
          );

          Script.createOrReplace(entity, { value: updatedScripts });
        }),
      );

      if (firstError) setError(firstError);
      await sdk.operations.dispatch();
    },
    [sdk, Script, setError],
  );

  const handleCreateScript = useCallback(() => {
    if (!newScriptName.trim()) return;

    const template = getScriptTemplateClass(newScriptName);
    const scriptPath = buildScriptPath(newScriptName);
    const buffer = new Uint8Array(Buffer.from(template, 'utf-8'));
    const content = new Map([[scriptPath, buffer]]);
    dispatch(importAsset({ content, basePath: '', assetPackageName: '', reload: true }));

    createScript(scriptPath, 0, template);
  }, [newScriptName, createScript, dispatch]);

  const handleImportScript = useCallback(
    async (path: string) => {
      try {
        const dataLayer = getDataLayerInterface();
        if (!dataLayer) return;

        const content = await retry(readScript, [dataLayer, path]);

        createScript(path, 0, content);
      } catch (error) {
        const msg = 'Failed to import script';
        console.error(`${msg}:`, error);
        return setError(msg);
      }
    },
    [createScript, setError],
  );

  const handleChangeNewScriptName = useCallback(
    (e: ChangeEvt) => {
      setNewScriptName(e.target.value);
      if (!files) return;
      if (!isScriptNameAvailable(files, e.target.value)) {
        return setError('Script name already exists');
      }
      setError(undefined);
    },
    [setNewScriptName, setError, files],
  );

  const handleCancel = useCallback(() => {
    setDialogMode(undefined);
    setError(undefined);
  }, [setDialogMode, setError]);

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
      if (!layout) return null;
      const paramsEntries = Object.entries(layout.params);
      if (paramsEntries.length === 0) return null;

      return (
        <Block label="Script Parameters:">
          <div className="params">
            {paramsEntries.map(([name, param]) => (
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
                  text={`Error found while parsing script: ${parsedLayouts[index].error!}`}
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
              onChange={handleChangeNewScriptName}
              placeholder="MyScript"
              error={error}
            />
          )}
          {dialogMode === 'import' && (
            <FileUploadField
              label="Import script"
              accept={ACCEPTED_FILE_TYPES['script']}
              onDrop={handleImportScript}
              isValidFile={isScriptNode}
              error={error}
            />
          )}
          <div className="actions">
            {dialogMode === 'create' && (
              <AddButton
                onClick={handleCreateScript}
                disabled={!newScriptName.trim() || !!error}
              >
                Create
              </AddButton>
            )}
            <RemoveButton
              variant="add"
              onClick={handleCancel}
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
            disabled={!!error}
          >
            Import script
          </AddButton>
        </div>
      )}
    </Container>
  );
});
