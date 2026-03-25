import { useEffect, useRef, useState } from 'react';
import { withSdk } from '../../../hoc/withSdk';
import { setupAxisHelper } from '../../../lib/babylon/setup/axisHelper';

import './AxisHelper.css';

interface Props {
  onResetCamera: () => void;
}

const AxisHelper = withSdk<Props>(({ sdk, onResetCamera }) => {
  const axisHelperRef = useRef<ReturnType<typeof setupAxisHelper>>();
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const getMainCamera = () => {
      if (sdk.editorCamera) {
        const mainCamera = sdk.editorCamera.getCamera();

        const direction = mainCamera.target.subtract(mainCamera.position).normalize();

        const alpha = Math.atan2(direction.x, direction.z);
        const beta = Math.acos(direction.y);

        return { alpha, beta };
      }

      return null;
    };

    const axisHelper = setupAxisHelper(sdk.scene, getMainCamera);
    axisHelperRef.current = axisHelper;

    return () => {
      axisHelper.dispose();
      axisHelperRef.current = undefined;
    };
  }, [sdk]);

  useEffect(() => {
    axisHelperRef.current?.setHovered(isHovered);
  }, [isHovered]);

  return (
    <button
      className="AxisHelperOverlay"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onResetCamera}
      title="Reset Camera"
    />
  );
});

export default AxisHelper;
