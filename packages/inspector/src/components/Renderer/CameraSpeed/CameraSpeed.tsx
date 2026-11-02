import React, { useState, useEffect } from 'react';
import './CameraSpeed.css';
import classNames from 'classnames';
import { withSdk } from '../../../hoc/withSdk';

const CameraSpeed = withSdk(({ sdk }) => {
  const [speed, setSpeed] = useState<number>(sdk.renderer.camera.getSpeed());
  const [visible, setVisible] = useState<boolean>(false);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;

    const onSpeedChange = ({ speed: newSpeed }: { speed: number }) => {
      setSpeed(newSpeed);
      setVisible(true);
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      timeoutId = setTimeout(() => setVisible(false), 1000);
    };
    sdk.renderer.events.on('cameraSpeedChange', onSpeedChange);

    return () => {
      sdk.renderer.events.off('cameraSpeedChange', onSpeedChange);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [sdk]);

  return (
    <div className={classNames('CameraSpeed', { visible: visible, invisible: !visible })}>
      Camera speed: {speed.toFixed(1)} m/s
    </div>
  );
});

export default CameraSpeed;
