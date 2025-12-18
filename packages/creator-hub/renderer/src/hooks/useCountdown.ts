import { useCallback, useEffect, useState } from 'react';

type Opts = {
  interval?: number;
  onComplete?: () => void;
};

export const useCountdown = (initialValue: number = 0, options: Opts = {}) => {
  const { interval = 1000, onComplete } = options;
  const [countdown, setCountdown] = useState(initialValue);
  const [isActive, setIsActive] = useState(false);

  const start = useCallback((value?: number) => {
    if (value !== undefined) {
      setCountdown(value);
    }
    setIsActive(true);
  }, []);

  const stop = useCallback(() => {
    setIsActive(false);
  }, []);

  const reset = useCallback(
    (value: number = initialValue) => {
      setCountdown(value);
      setIsActive(false);
    },
    [initialValue],
  );

  useEffect(() => {
    if (!isActive) return;

    if (countdown <= 0) {
      setIsActive(false);
      onComplete?.();
      return;
    }

    const intervalId = setInterval(() => {
      setCountdown(value => {
        const newValue = value - 1;
        if (newValue <= 0) {
          setIsActive(false);
          onComplete?.();
        }
        return newValue;
      });
    }, interval);

    return () => {
      clearInterval(intervalId);
    };
  }, [isActive, countdown, interval, onComplete]);

  return {
    countdown,
    start,
    stop,
    reset,
    isActive,
  };
};
