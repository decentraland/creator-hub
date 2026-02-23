import React, { useCallback, useMemo, useState } from 'react';
import { HiOutlineRefresh as RefreshIcon } from 'react-icons/hi';
import { VscFolderOpened as FileUploadIcon } from 'react-icons/vsc';
import { MdOutlineDriveFileRenameOutline as EditIcon } from 'react-icons/md';
import { VscTrash as RemoveIcon } from 'react-icons/vsc';
import { VscCode as CodeIcon } from 'react-icons/vsc';

import { getSceneClient } from '../../../lib/rpc/scene';
import { withSdk } from '../../../hoc/withSdk';
import { useHasComponent } from '../../../hooks/sdk/useHasComponent';
import { useComponentValue } from '../../../hooks/sdk/useComponentValue';
import { useAppDispatch, useAppSelector } from '../../../redux/hooks';
import { getDataLayerInterface, importAsset } from '../../../redux/data-layer';
import { selectAssetCatalog } from '../../../redux/app';
import { retry } from '../../../lib/utils/retry';
import { Container } from '../../Container';
import { ACCEPTED_FILE_TYPES } from '../../ui/FileUploadField/types';
import { InfoTooltip, FileUploadField } from '../../ui';
import { Message, MessageType } from '../../ui/Message';
import { AddButton } from '../AddButton';
import MoreOptionsMenu from '../MoreOptionsMenu';
import { Button } from '../../Button';
import { ScriptParamField } from './ScriptParamField';
import { CreateScriptModal } from './CreateScriptModal';

import { getScriptTemplateClass } from './templates';
import {
  isValidPath,
  parseLayout,
  isScriptNode,
  isScriptNameAvailable,
  buildScriptPath,
  readScript,
  mergeLayout,
  isScriptAlreadyAdded,
  isScriptFile,
} from './utils';
import { getScriptParams } from './parser';
import type { Props, ScriptLayout, ScriptParamUnion, ChangeEvt, ScriptItem } from './types';

import './ScriptInspector.css';

type ScriptModuleMode = 'create' | 'import' | undefined;

export default withSdk<Props>(({ sdk, entity: entityId, initialOpen = true }) => {
  const { Script } = sdk.components;
  const dispatch = useAppDispatch();
  const files = useAppSelector(selectAssetCatalog);

  const hasScript = useHasComponent(entityId, Script);
  const [componentValue, setComponentValue] = useComponentValue(entityId, Script);
  const [emptyScriptModuleMode, setEmptyScriptModuleMode] = useState<ScriptModuleMode>(undefined);
  const [showCreateModal, setShowCreateModal] = useState(false);
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

  const allScriptsInScene = useMemo(() => {
    return files?.assets.filter($ => isScriptFile($.path)) ?? [];
  }, [files]);

  const getDropdownOptions = useCallback(
    (currentScriptPath?: string) => {
      return allScriptsInScene
        .filter(({ path }) => path === currentScriptPath || !isScriptAlreadyAdded(scripts, path))
        .map(({ path }) => ({ label: path, value: path }));
    },
    [allScriptsInScene, scripts],
  );

  const createScript = useCallback(
    (path: string, priority = 0, content: string) => {
      const { params, actions, error } = getScriptParams(content);
      const layout: ScriptLayout = { params, actions, error };

      const newScript: ScriptItem = {
        path,
        priority,
        layout: JSON.stringify(layout),
      };

      addScript(newScript);
      setEmptyScriptModuleMode(undefined);
    },
    [addScript, setEmptyScriptModuleMode],
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

  const handleScriptModuleMode = useCallback((mode: ScriptModuleMode) => {
    setEmptyScriptModuleMode(mode);
    setError(undefined);
  }, []);

  const handleEditScript = useCallback(
    async (e: React.MouseEvent<HTMLButtonElement>, index: number) => {
      try {
        e.stopPropagation();
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

      if (scripts.length === 0) return;

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
    [sdk, Script, setError, scripts],
  );

  const isScriptValid = useCallback(
    (scriptNameOrPath: string): string | undefined => {
      const scriptPath = scriptNameOrPath.includes('/')
        ? scriptNameOrPath
        : buildScriptPath(scriptNameOrPath);

      if (isScriptAlreadyAdded(scripts, scriptPath)) {
        return 'This script is already added to this entity';
      }

      if (files && !isScriptNameAvailable(files, scriptPath)) {
        return 'Script name already exists';
      }
    },
    [files, scripts],
  );

  const handleCreateScript = useCallback(
    (scriptName: string) => {
      if (isScriptValid(scriptName) !== undefined) return;

      const template = getScriptTemplateClass(scriptName);
      const scriptPath = buildScriptPath(scriptName);
      const buffer = new Uint8Array(Buffer.from(template, 'utf-8'));
      const content = new Map([[scriptPath, buffer]]);
      dispatch(importAsset({ content, basePath: '', assetPackageName: '', reload: true }));

      createScript(scriptPath, 0, template);
      setShowCreateModal(false);
      setError(undefined);
    },
    [createScript, dispatch, isScriptValid, setError],
  );

  const handleCloseCreateModal = useCallback(() => {
    setShowCreateModal(false);
    setError(undefined);
  }, []);

  const handleScriptSelection = useCallback(
    async (path: string, index?: number) => {
      const isNewScript = index === undefined;
      try {
        const currentScript = isNewScript ? undefined : scripts[index];

        if (currentScript?.path === path) return;

        // check for duplicates (excluding current script when updating)
        const scriptsToCheck = isNewScript ? scripts : scripts.filter((_, i) => i !== index);
        const isDuplicate = isScriptAlreadyAdded(scriptsToCheck, path);

        if (isDuplicate) {
          if (isNewScript) {
            setError('This script is already added to this entity');
          }
          return;
        }

        const dataLayer = getDataLayerInterface();
        if (!dataLayer) return;

        const content = await retry(readScript, [dataLayer, path]);
        const { params, actions, error: parseError } = getScriptParams(content);
        const layout: ScriptLayout = { params, actions, error: parseError };

        if (isNewScript) {
          addScript({
            path,
            priority: 0,
            layout: JSON.stringify(layout),
          });
          setEmptyScriptModuleMode(undefined);
          setError(undefined);
        } else {
          updateScript(index, {
            ...currentScript!,
            path,
            layout: JSON.stringify(layout),
          });
        }
      } catch (err) {
        const msg = isNewScript ? 'Failed to import script' : 'Failed to update script path';
        console.error(`${msg}:`, err);
        if (isNewScript) {
          setError(msg);
        }
      }
    },
    [scripts, addScript, updateScript, setError, setEmptyScriptModuleMode],
  );

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

  const getScriptName = useCallback((path: string) => {
    const fileName = path.split('/').pop() || path;
    return fileName.replace(/\.(ts|js)$/, '');
  }, []);

  const renderScriptParams = useCallback(
    (layout: ScriptLayout | undefined, index: number) => {
      if (!layout) return null;
      const paramsEntries = Object.entries(layout.params);
      if (paramsEntries.length === 0) return null;

      return (
        <Container
          label="Script parameters"
          initialOpen
          variant="minimal"
        >
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
        </Container>
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
              size={15}
              style={{
                cursor: scripts.length === 0 ? 'not-allowed' : 'pointer',
                opacity: scripts.length === 0 ? 0.5 : 1,
              }}
            />
          }
          openOnTriggerMouseEnter
          closeOnTriggerClick
          position="top center"
        />
      }
    >
      {scripts.length > 0 && (
        <>
          {scripts.map((script, index) => (
            <Container
              key={index}
              label={getScriptName(script.path)}
              initialOpen
              border
              gap
              rightContent={
                <>
                  <Button
                    className="CodeButton"
                    onClick={e => handleEditScript(e, index)}
                  >
                    <CodeIcon />
                    Code
                  </Button>
                  <MoreOptionsMenu>
                    <Button onClick={() => handleRemoveScript(index)}>
                      <RemoveIcon />
                      Delete Script Module
                    </Button>
                  </MoreOptionsMenu>
                </>
              }
            >
              <FileUploadField
                label="Path"
                value={script.path}
                options={getDropdownOptions(script.path)}
                onDrop={(path: string) => handleScriptSelection(path, index)}
                onChange={(e: ChangeEvt) => handleScriptSelection(e.target.value, index)}
                isValidFile={isScriptNode}
                accept={ACCEPTED_FILE_TYPES['script']}
                error={!isValidPath(script.path) ? 'Invalid script path' : undefined}
              />
              {/* removed Priority field. Leaving it here just in case we need to restore it... */}
              {/* <TextField
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
              /> */}
              {parsedLayouts[index]?.error ? (
                <Message
                  text={`Error found while parsing script: ${parsedLayouts[index].error!}`}
                  type={MessageType.ERROR}
                />
              ) : (
                renderScriptParams(parsedLayouts[index], index)
              )}
            </Container>
          ))}
        </>
      )}
      {emptyScriptModuleMode || scripts.length === 0 ? (
        <Container
          label="Empty Script Module"
          initialOpen
          border
          gap
          rightContent={
            scripts.length > 0 ? (
              <MoreOptionsMenu>
                <Button onClick={() => handleScriptModuleMode(undefined)}>
                  <RemoveIcon />
                  Delete Script Module
                </Button>
              </MoreOptionsMenu>
            ) : undefined
          }
        >
          <FileUploadField
            label="Path"
            accept={ACCEPTED_FILE_TYPES['script']}
            onDrop={(path: string) => handleScriptSelection(path)}
            onChange={(e: ChangeEvt) => handleScriptSelection(e.target.value)}
            isValidFile={isScriptNode}
            error={error}
            openFileExplorerOnMount={emptyScriptModuleMode === 'import'}
            options={getDropdownOptions()}
          />
          <div className="actions">
            <AddButton onClick={() => setShowCreateModal(true)}>Create New Script</AddButton>
          </div>
        </Container>
      ) : (
        <div className="actions">
          <AddButton onClick={() => handleScriptModuleMode('create')}>
            Add New Script Module
          </AddButton>
          <MoreOptionsMenu icon={<>⌄</>}>
            <Button onClick={() => handleScriptModuleMode('import')}>
              <FileUploadIcon />
              Import Script File
            </Button>
            <Button onClick={() => setShowCreateModal(true)}>
              <EditIcon />
              Create a new Script File
            </Button>
          </MoreOptionsMenu>
        </div>
      )}
      <CreateScriptModal
        isOpen={showCreateModal}
        onClose={handleCloseCreateModal}
        onCreate={handleCreateScript}
        isValid={isScriptValid}
      />
    </Container>
  );
});
