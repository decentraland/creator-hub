import { VscTrash as RemoveIcon } from 'react-icons/vsc';

import type { ScriptParamArray, ScriptParamUnion } from '../types';
import { Container } from '../../../Container';
import { Button } from '../../../Button';
import { AddButton } from '../../AddButton';
import InfoTooltip from '../../../ui/InfoTooltip/InfoTooltip';
import { formatLabel } from './labels';
import { ScriptParamField } from './ScriptParamField';
import { resolveParamUpdate, type ParamUpdate } from './update';

type Props = {
  name: string;
  param: ScriptParamArray;
  onUpdate: (update: ParamUpdate) => void;
};

const asArray = (prev: unknown): unknown[] => (Array.isArray(prev) ? prev : []);

// Renders a list param as add/remove rows. Each row reuses ScriptParamField with the array's
// `item` shape, so a list of strings, entities, actions, or nested objects all work. Every edit
// bubbles a FUNCTIONAL update that recomputes from the freshest array (see update.ts), so a row
// edit, an add, and a remove don't clobber one another. A new row seeds from a deep clone of the
// item's default value.
export function ArrayField({ name, param, onUpdate }: Props) {
  const { value, item } = param;
  const rows = asArray(value);

  return (
    <Container
      label={formatLabel(name)}
      initialOpen={false}
      variant="minimal"
      border
      rightContent={param.tooltip ? <InfoTooltip text={param.tooltip} /> : undefined}
    >
      {rows.map((element, index) => (
        <div
          className="ArrayFieldRow"
          key={index}
        >
          <ScriptParamField
            name={`${index + 1}`}
            param={{ ...item, value: element } as ScriptParamUnion}
            onUpdate={childUpdate =>
              onUpdate((prev: unknown) => {
                const next = asArray(prev).slice();
                next[index] = resolveParamUpdate(childUpdate, next[index]);
                return next;
              })
            }
          />
          <Button
            className="ArrayFieldRemove"
            onClick={() => onUpdate((prev: unknown) => asArray(prev).filter((_, i) => i !== index))}
          >
            <RemoveIcon />
          </Button>
        </div>
      ))}
      <AddButton
        onClick={() => onUpdate((prev: unknown) => [...asArray(prev), structuredClone(item.value)])}
      >
        Add
      </AddButton>
    </Container>
  );
}
