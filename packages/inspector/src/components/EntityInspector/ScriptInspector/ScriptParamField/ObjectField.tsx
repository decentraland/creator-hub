import type { ScriptParamObject, ScriptParamUnion } from '../types';
import { Container } from '../../../Container';
import InfoTooltip from '../../../ui/InfoTooltip/InfoTooltip';
import { formatLabel } from './labels';
import { ScriptParamField } from './ScriptParamField';
import { resolveParamUpdate, type ParamUpdate } from './update';

type Props = {
  name: string;
  param: ScriptParamObject;
  onUpdate: (update: ParamUpdate) => void;
};

// Renders a nested object param as a collapsible group of sub-fields. Each sub-field edits one
// key and bubbles a FUNCTIONAL update up, merging into the freshest object rather than a stale
// render-closure snapshot (see update.ts). `fields` is the schema (fresh from the parse); `value`
// holds the data, with the field's own default as a fallback when a key is absent.
export function ObjectField({ name, param, onUpdate }: Props) {
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
          onUpdate={childUpdate =>
            onUpdate((prev: unknown) => {
              const base =
                prev && typeof prev === 'object' && !Array.isArray(prev)
                  ? (prev as Record<string, unknown>)
                  : {};
              return { ...base, [key]: resolveParamUpdate(childUpdate, base[key]) };
            })
          }
        />
      ))}
    </Container>
  );
}
