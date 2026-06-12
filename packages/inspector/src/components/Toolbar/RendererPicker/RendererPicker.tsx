import { useCallback } from 'react';
import { TbBox } from 'react-icons/tb';

import { withSdk } from '../../../hoc/withSdk';
import {
  getAvailableRenderers,
  getSelectedRenderer,
  setSelectedRenderer,
} from '../../../lib/renderer/controller';
import type { RendererId } from '../../../lib/renderer/controller';

import './RendererPicker.css';

/**
 * Toolbar control to choose the active 3D renderer (Babylon.js / Three.js).
 *
 * A test tool for the pluggable-renderer boundary. Selecting a renderer persists
 * the choice and reloads the inspector so it initializes with that engine — the
 * editor UI is wired to the Babylon scene in places, so a clean reload is
 * simpler and safer than a live swap. Three.js is the minimal-proof renderer
 * (entities + camera + pick); editor extras won't appear there.
 */
const RendererPicker = withSdk(() => {
  const current = getSelectedRenderer();
  const available = getAvailableRenderers();

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const id = event.target.value as RendererId;
      if (id === current) return;
      setSelectedRenderer(id);
      globalThis.location?.reload();
    },
    [current],
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
});

export default RendererPicker;
