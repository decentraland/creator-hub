import React, { useEffect, useState } from 'react';
import { withSdk } from '../../../hoc/withSdk';
import { useAppDispatch, useAppSelector } from '../../../redux/hooks';
import { isFeatureFlagEnabled, toggleFeatureFlag } from '../../../redux/feature-flags';
import { InspectorFeatureFlags } from '../../../redux/feature-flags/types';
import type { SkyboxSetup } from '../../../lib/babylon/setup/skybox';
import './DebugPanel.css';

// SDK-dependent controls — only mount once the scene is ready, but the
// useEffects here are what actually apply the Redux flag values to Babylon.
const SkyboxControls = withSdk(({ sdk }) => {
  const dispatch = useAppDispatch();
  const realSky = useAppSelector(state =>
    isFeatureFlagEnabled(state, InspectorFeatureFlags.RealSkybox),
  );
  const realGround = useAppSelector(state =>
    isFeatureFlagEnabled(state, InspectorFeatureFlags.RealGround),
  );
  const floorGrid = useAppSelector(state =>
    isFeatureFlagEnabled(state, InspectorFeatureFlags.FloorGrid),
  );

  useEffect(() => {
    (sdk.scene.metadata as SkyboxSetup | null)?.setRealSky?.(realSky);
  }, [sdk, realSky]);

  useEffect(() => {
    (sdk.scene.metadata as SkyboxSetup | null)?.setRealGround?.(realGround);
  }, [sdk, realGround]);

  useEffect(() => {
    (sdk.scene.metadata as SkyboxSetup | null)?.setFloorGrid?.(floorGrid);
  }, [sdk, floorGrid]);

  return (
    <>
      <div className="DebugPanel__group-label">Skybox</div>
      <label className="DebugPanel__row">
        <input
          type="checkbox"
          checked={realSky}
          onChange={() => dispatch(toggleFeatureFlag(InspectorFeatureFlags.RealSkybox))}
        />
        Real Sky
      </label>
      <label className="DebugPanel__row">
        <input
          type="checkbox"
          checked={realGround}
          onChange={() => dispatch(toggleFeatureFlag(InspectorFeatureFlags.RealGround))}
        />
        Real Ground
      </label>
      <label className="DebugPanel__row">
        <input
          type="checkbox"
          checked={floorGrid}
          onChange={() => dispatch(toggleFeatureFlag(InspectorFeatureFlags.FloorGrid))}
        />
        Floor Grid
      </label>
    </>
  );
});

// The outer shell has no SDK dependency — the DEV button always renders.
const DebugPanel: React.FC = () => {
  const [open, setOpen] = useState(false);

  return (
    <div className="DebugPanel">
      {open && (
        <div className="DebugPanel__panel">
          <div className="DebugPanel__title">Debug</div>
          <SkyboxControls />
        </div>
      )}
      <button
        className="DebugPanel__toggle"
        onClick={() => setOpen(o => !o)}
      >
        DEV
      </button>
    </div>
  );
};

export default DebugPanel;
