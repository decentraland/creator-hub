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
import { analytics, Event } from '../../../lib/logic/analytics';
import { Container } from '../../Container';
import { ACCEPTED_FILE_TYPES } from '../../ui/FileUploadField/types';
import { InfoTooltip, FileUploadField } from '../../ui';
import { Message, MessageType } from '../../ui/Message';
import { AddButton } from '../AddButton';
import MoreOptionsMenu from '../MoreOptionsMenu';
import { Button } from '../../Button';
import { ScriptParamField } from './ScriptParamField';
import { resolveParamUpdate, type ParamUpdate } from './ScriptParamField/update';
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

// Only the Trigger Area has a box/sphere placeholder to swap when its `shape` dropdown changes.
// Matched on the file name like the placed copy (…/TriggerArea.tsx), so a renamed copy counts.
const TRIGGER_DETECTOR = /(^|\/)TriggerArea\.tsx$/i;

// Human phrasing for each reaction event a smart item can declare (via `@event`), used for the
// Reactions button labels and the prompt sentences. Unknown events fall back to a generic
// phrasing so a new `@event` still works without touching this map.
const EVENT_LABEL: Record<string, string> = {
  enter: 'When a player enters…',
  exit: 'When a player leaves…',
  click: 'When clicked…',
  open: 'When it opens…',
  close: 'When it closes…',
  activate: 'When activated…',
  deactivate: 'When deactivated…',
  toggle: 'When toggled…',
  unlock: 'When unlocked…',
};
const EVENT_CLAUSE: Record<string, (name: string) => string> = {
  enter: n => `when a player enters ${n}`,
  exit: n => `when a player leaves ${n}`,
  click: n => `when ${n} is clicked`,
  open: n => `when ${n} opens`,
  close: n => `when ${n} closes`,
  activate: n => `when ${n} is activated`,
  deactivate: n => `when ${n} is deactivated`,
  toggle: n => `when ${n} is toggled`,
  unlock: n => `when ${n} is unlocked`,
};
const ACTION_CHIPS = ['Play a sound', 'Show a message', 'Score points'];

const eventLabel = (event: string): string => EVENT_LABEL[event] ?? `When ${event}…`;
const eventClause = (event: string, name: string): string =>
  (EVENT_CLAUSE[event] ?? (n => `when ${n} fires "${event}"`))(name);
const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

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
      const { params, actions, events, error } = getScriptParams(content);
      const layout: ScriptLayout = { params, actions, events, error };

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

  const getScriptName = useCallback((path: string) => {
    const fileName = path.split('/').pop() || path;
    return fileName.replace(/\.(tsx?|jsx?)$/, '');
  }, []);

  const handleRemoveScript = useCallback(
    (index: number) => {
      const script = scripts[index];
      removeScript(index);

      if (script) {
        analytics.track(Event.REMOVE_SCRIPT, {
          scriptPath: script.path,
          scriptName: getScriptName(script.path),
        });
      }
    },
    [removeScript, scripts, getScriptName],
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

        analytics.track(Event.EDIT_SCRIPT, {
          scriptPath: script.path,
          scriptName: getScriptName(script.path),
        });
      } catch (error) {
        console.error('Failed to open script:', error);
      }
    },
    [scripts, getScriptName],
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

      analytics.track(Event.RELOAD_SCRIPTS, {
        scriptsCount: allEntitiesWithScripts.length,
      });
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

      analytics.track(Event.CREATE_SCRIPT, {
        scriptPath,
        scriptName,
      });
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
        const { params, actions, events, error: parseError } = getScriptParams(content);
        const layout: ScriptLayout = { params, actions, events, error: parseError };

        if (isNewScript) {
          addScript({
            path,
            priority: 0,
            layout: JSON.stringify(layout),
          });
          setEmptyScriptModuleMode(undefined);
          setError(undefined);

          analytics.track(Event.ADD_SCRIPT, {
            scriptPath: path,
            scriptName: getScriptName(path),
          });
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
    [scripts, addScript, updateScript, setError, setEmptyScriptModuleMode, getScriptName],
  );

  const handleUpdateDynamicField = useCallback(
    (index: number, paramName: string, update: ParamUpdate) => {
      // Apply against the FRESHEST component value via a functional setState, so concurrent edits
      // to sibling params (or nested container fields) compose instead of overwriting each other —
      // debounced leaf edits can otherwise land with a stale render-closure value (data loss).
      setComponentValue(prev => {
        const list = prev?.value ?? [];
        const script = list[index];
        if (!script) return prev;
        let layout: ScriptLayout;
        try {
          layout = JSON.parse(script.layout || '{"params":{}}');
        } catch {
          return prev;
        }
        const param = layout.params?.[paramName];
        if (!param) return prev;
        param.value = resolveParamUpdate(update, param.value) as ScriptParamUnion['value'];
        const newList = list.slice();
        newList[index] = { ...script, layout: JSON.stringify(layout) };
        return { value: newList };
      });

      // A Trigger Area's editor placeholder is a static glb and can't react to the script at
      // edit time, so keep it in sync with the shape dropdown here: swap the Placeholder src
      // to the box or sphere model (both ship in the smart item, so both are in the scene).
      const script = scripts[index];
      if (paramName === 'shape' && script && TRIGGER_DETECTOR.test(script.path)) {
        const nextShape = resolveParamUpdate(update, parsedLayouts[index]?.params?.shape?.value);
        const { Placeholder } = sdk.components;
        const placeholder = Placeholder.getOrNull(entityId);
        if (placeholder) {
          const file = nextShape === 'sphere' ? 'trigger-area-sphere.glb' : 'trigger-area.glb';
          sdk.operations.updateValue(Placeholder, entityId, {
            src: placeholder.src.replace(/[^/]+\.glb$/i, file),
          });
          void sdk.operations.dispatch();
        }
      }
    },
    [sdk, entityId, scripts, parsedLayouts, setComponentValue],
  );

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
                onUpdate={update => handleUpdateDynamicField(index, name, update)}
              />
            ))}
          </div>
        </Container>
      );
    },
    [handleUpdateDynamicField],
  );

  // The union of reaction events declared by this entity's scripts (via `@event`). Non-empty =>
  // show the Reactions section, with one prompt button per event.
  const reactionEvents = useMemo(() => {
    const all: string[] = [];
    for (const layout of parsedLayouts) {
      for (const event of layout?.events ?? []) if (!all.includes(event)) all.push(event);
    }
    return all;
  }, [parsedLayouts]);

  // Hand a natural-language reaction prompt to the host's AI assistant (opens the panel and
  // seeds the composer, without sending). The item's name binds the sentence to this instance.
  const promptReaction = useCallback(
    (build: (label: string) => string) => {
      const name = sdk.components.Name.getOrNull(entityId)?.value?.trim();
      const label = name ? `"${name}"` : 'this item';
      void getSceneClient()?.promptAssistant(build(label)).catch(console.error);
    },
    [sdk, entityId],
  );

  if (!hasScript) return null;

  return (
    <Container
      label="Script"
      className="ScriptInspector"
      initialOpen={initialOpen}
      component={Script}
      entity={entityId}
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
      {reactionEvents.length > 0 && (
        <Container
          label="Reactions"
          initialOpen
          variant="minimal"
        >
          <div className="ScriptReactions">
            <div className="description">
              Describe what should happen. The AI assistant writes a script and attaches it here.
            </div>
            <div className="asks">
              {reactionEvents.map(event => (
                <Button
                  key={event}
                  className="ReactionButton"
                  onClick={() => promptReaction(l => `${capitalize(eventClause(event, l))}, `)}
                >
                  {eventLabel(event)}
                </Button>
              ))}
            </div>
            <div className="chips">
              {ACTION_CHIPS.map(verb => (
                <Button
                  key={verb}
                  className="ReactionChip"
                  onClick={() =>
                    promptReaction(l => `${verb} ${eventClause(reactionEvents[0], l)}`)
                  }
                >
                  {verb}
                </Button>
              ))}
            </div>
          </div>
        </Container>
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
          <MoreOptionsMenu
            className="ScriptActionsMenu"
            icon={<>⌄</>}
          >
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
