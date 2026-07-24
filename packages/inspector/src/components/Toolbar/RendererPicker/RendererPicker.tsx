import { useCallback } from 'react';
import { TbBox } from 'react-icons/tb';

import { useAppSelector } from '../../../redux/hooks';
import { selectCanSave } from '../../../redux/app';
import {
  getAvailableRenderers,
  getSelectedRenderer,
  setSelectedRenderer,
} from '../../../lib/renderer/controller';
import type { RendererId } from '../../../lib/renderer/controller';

import './RendererPicker.css';

/**
 * Toolbar control to choose the active 3D renderer from the registered plugins
 * (see {@link registerRenderer}). With only the built-in Babylon renderer
 * registered the picker lists a single option; it lights up automatically as
 * renderers are registered.
 *
 * Selecting a renderer persists the choice and reloads the inspector so it
 * initializes with that engine — the editor UI is wired to the scene in places,
 * so a clean reload is simpler and safer than a live swap.
 */
const RendererPicker = () => {
  const current = getSelectedRenderer();
  const available = getAvailableRenderers();
  const hasUnsavedChanges = useAppSelector(selectCanSave);

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const id = event.target.value as RendererId;
      if (id === current) return;
      // Switching renderer reloads the inspector, discarding in-memory state
      // (undo stack, selection, panels). Confirm first if there are unsaved edits.
      if (
        hasUnsavedChanges &&
        !globalThis.confirm?.('You have unsaved changes that will be lost. Switch renderer anyway?')
      ) {
        // Revert the <select> to the current value (the change didn't take).
        event.target.value = current;
        return;
      }
      setSelectedRenderer(id);
      globalThis.location?.reload();
    },
    [current, hasUnsavedChanges],
  );

  return (
    <div
      className="RendererPicker"
      title="Renderer (reloads the inspector)"
    >
      <TbBox className="icon" />
      <select
        value={current}
        onChange={handleChange}
      >
        {available.map(({ id, label }) => (
          <option
            key={id}
            value={id}
          >
            {label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default RendererPicker;
