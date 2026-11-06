import type { ScriptParamObject, ScriptParamUnion } from '../types';
import { Container } from '../../../Container';
import InfoTooltip from '../../../ui/InfoTooltip/InfoTooltip';
import { formatLabel } from './labels';
import { ScriptParamField } from './ScriptParamField';
import { resolveParamUpdate, type ParamUpdate } from './update';

type Props = {
  name: string;
  param: ScriptParamObject;
  getError?: (param: ScriptParamUnion) => string | undefined;
  onUpdate: (update: ParamUpdate) => void;
};

// The sibling fields that name an action of the entity held in `key`; a picked action belongs
// to the old entity, so they are cleared when it changes.
function actionFieldsOf(fields: Record<string, ScriptParamUnion>, key: string): string[] {
  return Object.entries(fields)
    .filter(([, field]) => field.type === 'string' && field.actionsOf === key)
    .map(([name]) => name);
}

// Renders a nested object param as a collapsible group of sub-fields. Each sub-field edits one
// key and bubbles a FUNCTIONAL update up, merging into the freshest object rather than a stale
// render-closure snapshot (see update.ts). `fields` is the schema (fresh from the parse); `value`
// holds the data, with the field's own default as a fallback when a key is absent.
export function ObjectField({ name, param, getError, onUpdate }: Props) {
  const { value, fields } = param;
  return (
    <Container
      label={formatLabel(name)}
      initialOpen={false}
      variant="minimal"
      border
      rightContent={param.tooltip ? <InfoTooltip text={param.tooltip} /> : undefined}
    >
      {Object.entries(fields).map(([key, fieldParam]) => (
        <ScriptParamField
          key={key}
          name={key}
          param={{ ...fieldParam, value: value?.[key] ?? fieldParam.value } as ScriptParamUnion}
          siblings={value}
          getError={getError}
          onUpdate={childUpdate =>
            onUpdate((prev: unknown) => {
              const base =
                prev && typeof prev === 'object' && !Array.isArray(prev)
                  ? (prev as Record<string, unknown>)
                  : {};
              const next = { ...base, [key]: resolveParamUpdate(childUpdate, base[key]) };
              if (next[key] !== base[key]) {
                for (const dependent of actionFieldsOf(fields, key)) next[dependent] = '';
              }
              return next;
            })
          }
        />
      ))}
    </Container>
  );
}
