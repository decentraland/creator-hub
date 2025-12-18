import { useCallback, useEffect, useRef, useState } from 'react';

type UseCounterOptions = {
  /** Interval in milliseconds between each tick. Default: 1000 */
  interval?: number;
  /** Target value to count towards. Default: 0 */
  target?: number;
  /** Callback when counter reaches target. Default: undefined */
  onComplete?: () => void;
};

/**
 * Counter hook that counts up or down towards a target value.
 * Direction is automatically determined by comparing initial value to target.
 *
 * @param initialValue - Starting value for the counter
 * @param options - Configuration options for the counter
 * @param options.interval - Interval in milliseconds between each tick. Default: 1000
 * @param options.target - Target value to count towards. Default: 0
 * @param options.onComplete - Callback when counter reaches target
 *
 * @example
 * // Count down from 10 to 0
 * const { count, start } = useCounter(10);
 *
 * @example
 * // Count up from 50 to 100
 * const { count, start } = useCounter(50, { target: 100 });
 */
export const useCounter = (initialValue: number = 0, options: UseCounterOptions = {}) => {
  const { interval = 1000, onComplete, target = 0 } = options;
  const [count, setCount] = useState(initialValue);
  const [isActive, setIsActive] = useState(false);
  const onCompleteRef = useRef(onComplete);

  const isCountingUp = initialValue < target;
  const step = isCountingUp ? 1 : -1;

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const start = useCallback((value?: number) => {
    if (value !== undefined) {
      setCount(value);
    }
    setIsActive(true);
  }, []);

  const stop = useCallback(() => {
    setIsActive(false);
  }, []);

  const reset = useCallback(
    (value: number = initialValue) => {
      setCount(value);
      setIsActive(false);
    },
    [initialValue],
  );

  useEffect(() => {
    if (!isActive) return;

    const intervalId = setInterval(() => {
      setCount(value => {
        const alreadyAtTarget = isCountingUp ? value >= target : value <= target;
        if (alreadyAtTarget) {
          setIsActive(false);
          onCompleteRef.current?.();
          return target;
        }

        const newValue = value + step;
        const reachedTarget = isCountingUp ? newValue >= target : newValue <= target;

        if (reachedTarget) {
          setIsActive(false);
          onCompleteRef.current?.();
          return target;
        }

        return newValue;
      });
    }, interval);

    return () => {
      clearInterval(intervalId);
    };
  }, [isActive, interval, step, target, isCountingUp]);

  return {
    count,
    start,
    stop,
    reset,
    isActive,
  };
};
