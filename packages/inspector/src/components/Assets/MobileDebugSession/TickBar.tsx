import React, { useCallback, useState } from 'react';

interface TickBarProps {
  maxTick: number;
  selectedTick: number | null;
  onSelectTick: (tick: number | null) => void;
  onReconstruct: () => void;
  isReconstructed: boolean;
}

function TickBar({
  maxTick,
  selectedTick,
  onSelectTick,
  onReconstruct,
  isReconstructed,
}: TickBarProps) {
  const [inputValue, setInputValue] = useState('');

  const handleClear = useCallback(() => {
    onSelectTick(null);
    setInputValue('');
  }, [onSelectTick]);

  return (
    <div className="TickBar">
      <span className="TickBar-label">Tick:</span>
      <input
        className="TickBar-input"
        type="number"
        min={0}
        max={maxTick}
        placeholder={`max ${maxTick}`}
        value={selectedTick != null ? selectedTick : inputValue}
        onChange={e => {
          setInputValue(e.target.value);
          const n = parseInt(e.target.value, 10);
          if (!isNaN(n) && n >= 0) onSelectTick(n);
        }}
      />
      {selectedTick != null && (
        <>
          <button
            className="TickBar-btn"
            onClick={onReconstruct}
            title="Reconstruct entity state at this tick"
          >
            {isReconstructed ? 'Viewing tick ' + selectedTick : 'Reconstruct'}
          </button>
          <button
            className="TickBar-btn TickBar-clear"
            onClick={handleClear}
            title="Back to live"
          >
            Live
          </button>
        </>
      )}
    </div>
  );
}

export default TickBar;
