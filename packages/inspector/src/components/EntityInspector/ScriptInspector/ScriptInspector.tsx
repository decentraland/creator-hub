import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { HiOutlineRefresh as RefreshIcon } from 'react-icons/hi';
import { VscFolderOpened as FileUploadIcon } from 'react-icons/vsc';

import { withSdk } from '../../../hoc/withSdk';
import { useHasComponent } from '../../../hooks/sdk/useHasComponent';
import { useComponentValue } from '../../../hooks/sdk/useComponentValue';
import { useArrayState } from '../../../hooks/useArrayState';
import { useAppDispatch, useAppSelector } from '../../../redux/hooks';
import { getDataLayerInterface, importAsset } from '../../../redux/data-layer';
import { Block } from '../../Block';
import { Container } from '../../Container';
import { ACCEPTED_FILE_TYPES } from '../../ui/FileUploadField/types';
import { TextField, CheckboxField, InfoTooltip, FileUploadField } from '../../ui';
import { AddButton } from '../AddButton';
import MoreOptionsMenu from '../MoreOptionsMenu';
import type { ScriptComponent, ScriptItem } from '../../../lib/sdk/components';
import { RemoveButton } from '../RemoveButton';
import { getDefaultScriptTemplate } from '../../../lib/data-layer/client/constants';
import { selectAssetCatalog } from '../../../redux/app';

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
  getScriptParams,
} from './utils';
import type { Props } from './types';

import './ScriptInspector.css';

type ChangeEvt = React.ChangeEvent<HTMLInputElement>;

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
    (path: string, priority = 0, layout?: string) => {
      const newScript: ScriptItem = {
        path,
        priority,
        layout,
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

  const handleReloadScripts = useCallback(
    async (e: React.MouseEvent<SVGElement>) => {
      console.log('Reload scripts:', scripts);
      e.stopPropagation();
      if (scripts.length === 0) {
        return;
      }

      // TODO: Implement script reload functionality
      // This should trigger re-parsing of script files to update layout
      // For now, just refresh the component
      // In the future, this will call the parsing mechanism from issue #864
    },
    [scripts],
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

    createScript(scriptPath);
  }, [newScriptName, createScript]);

  const handleImportScript = useCallback(
    async (path: string) => {
      const dataLayer = getDataLayerInterface();
      if (!dataLayer) return;

      const content = await readScript(dataLayer, path);
      if (!content) return;

      const params = getScriptParams(content);
      console.log('asd params:', params);
      createScript(path, 0);
    },
    [createScript],
  );

  const handleUpdateDynamicField = useCallback(
    (index: number, layout: Record<string, any>, paramName: string, paramValue: any) => {
      const script = scripts[index];
      const paramConfig = layout.params[paramName];
      layout.params[paramName] = { ...paramConfig, value: paramValue };
      updateScript(index, { ...script, layout: JSON.stringify(layout) });
    },
    [updateScript],
  );

  const renderScriptParams = useCallback(
    (script: ScriptItem, index: number) => {
      const layout = parseLayout(script.layout);
      if (!layout || !layout.params) {
        return null;
      }

      return (
        <Block label="Script Parameters:">
          <div className="params">
            {Object.entries(layout.params).map(([paramName, { type, value }]) => {
              switch (type) {
                case 'number':
                  return (
                    <TextField
                      type="number"
                      key={paramName}
                      label={paramName}
                      value={fromNumber(value)}
                      onChange={(e: ChangeEvt) => {
                        handleUpdateDynamicField(
                          index,
                          layout,
                          paramName,
                          toNumber(e.target.value),
                        );
                      }}
                      error={!isValidNumber(fromNumber(value))}
                    />
                  );

                case 'boolean':
                  return (
                    <CheckboxField
                      key={paramName}
                      label={paramName}
                      checked={value}
                      onChange={(e: ChangeEvt) => {
                        handleUpdateDynamicField(index, layout, paramName, e.target.checked);
                      }}
                    />
                  );

                case 'string':
                default:
                  return (
                    <TextField
                      key={paramName}
                      label={paramName}
                      value={value}
                      onChange={(e: ChangeEvt) => {
                        handleUpdateDynamicField(index, layout, paramName, e.target.value);
                      }}
                    />
                  );
              }
            })}
          </div>
        </Block>
      );
    },
    [scripts, handleUpdateDynamicField],
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
              {renderScriptParams(script, index)}
              <MoreOptionsMenu>
                <RemoveButton onClick={() => handleRemoveScript(index)}>Remove script</RemoveButton>
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
