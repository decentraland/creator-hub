import type { ScriptParamObject, ScriptParamUnion } from '../types';
import { Container } from '../../../Container';
import { formatLabel } from './labels';
import { ScriptParamField } from './ScriptParamField';

type Props = {
  name: string;
  param: ScriptParamObject;
  onUpdate: (value: Record<string, unknown>) => void;
};

// Renders a nested object param as a collapsible group of sub-fields. Each sub-field edits
// one key and bubbles the whole new object up, so the param's `value` stays a plain object
// the runtime spreads verbatim. `fields` is the schema (fresh from the parse); `value` holds
// the data, with the field's own default as a fallback when a key is absent.
export function ObjectField({ name, param, onUpdate }: Props) {
  const { value, fields } = param;
  return (
    <Container
      label={formatLabel(name)}
      initialOpen={false}
      variant="minimal"
      border
    >
      {Object.entries(fields).map(([key, fieldParam]) => (
        <ScriptParamField
          key={key}
          name={key}
          param={{ ...fieldParam, value: value?.[key] ?? fieldParam.value } as ScriptParamUnion}
          onUpdate={fieldValue => onUpdate({ ...value, [key]: fieldValue })}
        />
      ))}
    </Container>
  );
}
