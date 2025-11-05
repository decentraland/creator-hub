import React, { useEffect, useRef } from 'react';
import { withSdk } from '../../../hoc/withSdk';
import { setupAxisHelper } from '../../../lib/babylon/setup/axisHelper';
import './AxisHelper.css';

const AxisHelper = withSdk(({ sdk }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;

    // Get main camera for synchronization
    const getMainCamera = () => {
      if (sdk.editorCamera) {
        const mainCamera = sdk.editorCamera.getCamera();
        // Check if it's an ArcRotateCamera (has alpha/beta properties)
        if ('alpha' in mainCamera && 'beta' in mainCamera) {
          return {
            alpha: mainCamera.alpha,
            beta: mainCamera.beta,
          };
        }
      }
      return null;
    };

    // Setup axis helper scene
    const axisHelper = setupAxisHelper(canvas, getMainCamera);

    // Cleanup on unmount
    return () => {
      axisHelper.dispose();
    };
  }, [sdk]);

  return (
    <div
      ref={containerRef}
      className="AxisHelper"
    >
      <canvas
        ref={canvasRef}
        className="AxisHelperCanvas"
      />
    </div>
  );
});

export default React.memo(AxisHelper);
