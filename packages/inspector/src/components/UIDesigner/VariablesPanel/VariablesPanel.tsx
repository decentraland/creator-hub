import React, { useCallback, useMemo, useState } from 'react';
import type { Entity, LastWriteWinElementSetComponentDefinition } from '@dcl/ecs';
import type { UI, UIVariable } from '@dcl/asset-packs';
import { ComponentName, VariableType } from '@dcl/asset-packs';

import { useChange } from '../../../hooks/sdk/useChange';
import { useSdk } from '../../../hooks/sdk/useSdk';
import { useAppSelector } from '../../../redux/hooks';
import { getSelectedRoot } from '../../../redux/ui-designer';
import { debounce } from '../../../lib/utils/debounce';
import { Container } from '../../Container';
import { Block } from '../../Block';
import { TextField } from '../../ui';

import './VariablesPanel.css';

const VALID_IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

const TYPE_OPTIONS: { value: VariableType; label: string }[] = [
  { value: VariableType.STRING, label: 'String' },
  { value: VariableType.NUMBER, label: 'Number' },
  { value: VariableType.BOOLEAN, label: 'Boolean' },
  { value: VariableType.COLOR, label: 'Color' },
  { value: VariableType.STRING_ARRAY, label: 'String[]' },
  { value: VariableType.CALLBACK, label: 'Callback' },
];

const DEFAULT_VALUE_FOR_TYPE: Record<VariableType, string> = {
  [VariableType.STRING]: '',
  [VariableType.NUMBER]: '0',
  [VariableType.BOOLEAN]: 'false',
  [VariableType.COLOR]: '#ffffff',
  [VariableType.STRING_ARRAY]: '',
  [VariableType.CALLBACK]: '',
};

const VariablesPanelComponent: React.FC = () => {
  const sdk = useSdk();
  const selectedRoot = useAppSelector(getSelectedRoot);
  const [tick, setTick] = useState(0);
  const bumpTick = useCallback(() => setTick(t => t + 1), []);
  const debouncedBump = useCallback(debounce(bumpTick, 10), [bumpTick]);
  useChange(debouncedBump, []);

  const marker = useMemo(() => {
    if (!sdk || selectedRoot === null) return null;
    void tick;
    const UIComp = sdk.engine.getComponentOrNull(
      ComponentName.UI,
    ) as LastWriteWinElementSetComponentDefinition<UI> | null;
    if (!UIComp) return null;
    return UIComp.getOrNull(selectedRoot as Entity);
  }, [sdk, selectedRoot, tick]);

  const nextVariableName = useCallback((existing: readonly UIVariable[]): string => {
    const taken = new Set(existing.map(v => v.name));
    let n = 1;
    while (taken.has(`variable_${n}`)) n++;
    return `variable_${n}`;
  }, []);

  const addVariable = useCallback(() => {
    if (!sdk || selectedRoot === null || !marker) return;
    const variable: UIVariable = {
      name: nextVariableName(marker.variables),
      type: VariableType.STRING,
      defaultValue: '',
    };
    sdk.operations.declareVariable(selectedRoot as Entity, variable);
    void sdk.operations.dispatch();
  }, [sdk, selectedRoot, marker, nextVariableName]);

  const patchVariable = useCallback(
    (oldName: string, patch: Partial<UIVariable>) => {
      if (!sdk || selectedRoot === null || !marker) return;
      const nextVariables = marker.variables.map(v => {
        if (v.name !== oldName) return v;
        const merged: UIVariable = { ...v, ...patch };
        // If the type changed, reset the default value to a sensible value for
        // the new type so we don't leave a stale "0" sitting in a Boolean field.
        if (patch.type !== undefined && patch.type !== v.type && patch.defaultValue === undefined) {
          merged.defaultValue = DEFAULT_VALUE_FOR_TYPE[patch.type];
        }
        return merged;
      });
      const UIComp = sdk.engine.getComponent(
        ComponentName.UI,
      ) as LastWriteWinElementSetComponentDefinition<UI>;
      sdk.operations.updateValue(UIComp, selectedRoot as Entity, { variables: nextVariables });
      void sdk.operations.dispatch();
    },
    [sdk, selectedRoot, marker],
  );

  const removeVariable = useCallback(
    (name: string) => {
      if (!sdk || selectedRoot === null) return;
      sdk.operations.deleteVariable(selectedRoot as Entity, name);
      void sdk.operations.dispatch();
    },
    [sdk, selectedRoot],
  );

  const rename = useCallback(
    (oldName: string, newName: string) => {
      if (!sdk || selectedRoot === null) return;
      sdk.operations.renameVariable(selectedRoot as Entity, oldName, newName);
      void sdk.operations.dispatch();
    },
    [sdk, selectedRoot],
  );

  if (!sdk || selectedRoot === null) {
    return (
      <div className="ui-designer-variables-empty">
        <p>Select a UI to declare variables.</p>
      </div>
    );
  }
  if (!marker) return null;

  return (
    <Container label="Variables">
      {marker.variables.map(v => (
        <VariableRow
          key={v.name}
          variable={v}
          existingNames={marker.variables.map(x => x.name)}
          onRename={(next: string) => rename(v.name, next)}
          onPatch={(patch: Partial<UIVariable>) => patchVariable(v.name, patch)}
          onDelete={() => removeVariable(v.name)}
        />
      ))}
      <button
        type="button"
        className="ui-designer-variables-add"
        onClick={addVariable}
      >
        + Add variable
      </button>
    </Container>
  );
};

interface VariableRowProps {
  variable: UIVariable;
  existingNames: string[];
  onRename: (next: string) => void;
  onPatch: (patch: Partial<UIVariable>) => void;
  onDelete: () => void;
}

const VariableRow: React.FC<VariableRowProps> = ({
  variable,
  existingNames,
  onRename,
  onPatch,
  onDelete,
}) => {
  const [localName, setLocalName] = useState(variable.name);
  const [nameError, setNameError] = useState<string | undefined>(undefined);
  const [localDefault, setLocalDefault] = useState(variable.defaultValue);

  // Re-sync local fields when the underlying variable changes (e.g. external
  // rename, type change resetting default).
  React.useEffect(() => {
    setLocalName(variable.name);
  }, [variable.name]);
  React.useEffect(() => {
    setLocalDefault(variable.defaultValue);
  }, [variable.defaultValue]);

  const commitName = useCallback(() => {
    if (localName === variable.name) {
      setNameError(undefined);
      return;
    }
    if (!VALID_IDENTIFIER.test(localName)) {
      setNameError('Not a valid identifier');
      return;
    }
    if (existingNames.includes(localName)) {
      setNameError('Name already in use');
      return;
    }
    setNameError(undefined);
    onRename(localName);
  }, [localName, variable.name, existingNames, onRename]);

  const commitDefault = useCallback(() => {
    if (localDefault === variable.defaultValue) return;
    onPatch({ defaultValue: localDefault });
  }, [localDefault, variable.defaultValue, onPatch]);

  return (
    <div className="ui-designer-variable-row">
      <Block label="Name">
        <TextField
          value={localName}
          onChange={e => setLocalName(e.target.value)}
          onBlur={commitName}
          error={nameError}
        />
      </Block>
      <Block label="Type">
        <select
          value={variable.type}
          onChange={e => onPatch({ type: e.target.value as VariableType })}
        >
          {TYPE_OPTIONS.map(t => (
            <option
              key={t.value}
              value={t.value}
            >
              {t.label}
            </option>
          ))}
        </select>
      </Block>
      <Block label="Default">
        <TextField
          value={localDefault}
          onChange={e => setLocalDefault(e.target.value)}
          onBlur={commitDefault}
          disabled={variable.type === VariableType.CALLBACK}
        />
      </Block>
      <div className="ui-designer-variable-row-actions">
        <button
          type="button"
          className="ui-designer-variable-delete"
          onClick={onDelete}
        >
          Delete
        </button>
      </div>
    </div>
  );
};

export const VariablesPanel = React.memo(VariablesPanelComponent);
export default VariablesPanel;
