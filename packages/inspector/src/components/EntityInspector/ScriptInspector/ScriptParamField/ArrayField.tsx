import { VscTrash as RemoveIcon } from 'react-icons/vsc';

import type { ScriptParamArray, ScriptParamUnion } from '../types';
import { Container } from '../../../Container';
import { Button } from '../../../Button';
import { AddButton } from '../../AddButton';
import { formatLabel } from './labels';
import { ScriptParamField } from './ScriptParamField';

import './ArrayField.css';

type Props = {
  name: string;
  param: ScriptParamArray;
  onUpdate: (value: unknown[]) => void;
};

// Renders a list param as add/remove rows. Each row reuses ScriptParamField with the array's
// `item` shape, so a list of strings, entities, actions, or nested objects all work. `value`
// stays a plain array the runtime spreads verbatim; a new row seeds from a deep clone of the
// item's default value.
export function ArrayField({ name, param, onUpdate }: Props) {
  const { value, item } = param;
  const rows = Array.isArray(value) ? value : [];

  const updateAt = (index: number, next: unknown) =>
    onUpdate(rows.map((element, i) => (i === index ? next : element)));
  const removeAt = (index: number) => onUpdate(rows.filter((_, i) => i !== index));
  const add = () => onUpdate([...rows, structuredClone(item.value)]);

  return (
    <Container
      label={formatLabel(name)}
      initialOpen={false}
      variant="minimal"
      border
    >
      {rows.map((element, index) => (
        <div
          className="ArrayFieldRow"
          key={index}
        >
          <ScriptParamField
            name={`${index + 1}`}
            param={{ ...item, value: element } as ScriptParamUnion}
            onUpdate={next => updateAt(index, next)}
          />
          <Button
            className="ArrayFieldRemove"
            onClick={() => removeAt(index)}
          >
            <RemoveIcon />
          </Button>
        </div>
      ))}
      <AddButton onClick={add}>Add</AddButton>
    </Container>
  );
}
