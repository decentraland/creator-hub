import React, { useEffect, useRef } from 'react';
import { withSdk } from '../../../hoc/withSdk';
import { setupAxisHelper } from '../../../lib/babylon/setup/axisHelper';

import './AxisHelper.css';

const AxisHelper = withSdk(({ sdk }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;

    const getMainCamera = () => {
      if (sdk.editorCamera) {
        const mainCamera = sdk.editorCamera.getCamera();

        // FreeCamera uses position and target, not alpha/beta
        // Calculate the direction the camera is looking
        const direction = mainCamera.target.subtract(mainCamera.position).normalize();

        // Convert direction to spherical coordinates (alpha and beta)
        // alpha = horizontal angle around Y axis
        // beta = vertical angle from Y axis
        const alpha = Math.atan2(direction.x, direction.z);
        const beta = Math.acos(direction.y);

        return { alpha, beta };
      }

      return null;
    };

    const axisHelper = setupAxisHelper(canvas, getMainCamera);

    return () => {
      axisHelper.dispose();
    };
  }, [sdk]);

  return (
    <div className="AxisHelper">
      <canvas
        ref={canvasRef}
        className="AxisHelperCanvas"
      />
    </div>
  );
});

export default React.memo(AxisHelper);
