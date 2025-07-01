import { vi, describe, it, expect, beforeEach } from 'vitest';
import { debounce, debounceByKey } from '../utils';

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('should execute immediately on first call and debounce subsequent calls', async () => {
    const mockFn = vi.fn().mockResolvedValue('result');
    const debouncedFn = debounce(mockFn, 300, { leading: true });

    // First call should execute immediately
    const promise1 = debouncedFn('test1');
    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn).toHaveBeenLastCalledWith('test1');

    // Subsequent calls within delay should be debounced
    const promise2 = debouncedFn('test2');
    const promise3 = debouncedFn('test3');
    expect(mockFn).toHaveBeenCalledTimes(1); // Still only one call

    // Advance time
    await vi.advanceTimersByTimeAsync(300);

    // Should have executed the last call
    expect(mockFn).toHaveBeenCalledTimes(2);
    expect(mockFn).toHaveBeenLastCalledWith('test3');

    // All promises should resolve
    expect(await promise1).toBe('result');
    expect(await promise2).toBe('result');
    expect(await promise3).toBe('result');
  });

  it('should wait for the full delay after non-first calls', async () => {
    const mockFn = vi.fn().mockResolvedValue('result');
    const debouncedFn = debounce(mockFn, 300, { leading: true });

    // First call executes immediately
    debouncedFn('test1');
    expect(mockFn).toHaveBeenCalledTimes(1);

    // Second call starts the timer
    debouncedFn('test2');

    // Advance halfway
    await vi.advanceTimersByTimeAsync(150);
    expect(mockFn).toHaveBeenCalledTimes(1);

    // Call again
    debouncedFn('test3');

    // Advance to original timeout (should not trigger)
    await vi.advanceTimersByTimeAsync(150);
    expect(mockFn).toHaveBeenCalledTimes(1);

    // Advance to new timeout
    await vi.advanceTimersByTimeAsync(150);
    expect(mockFn).toHaveBeenCalledTimes(2);
    expect(mockFn).toHaveBeenLastCalledWith('test3');
  });
});

describe('debounceByKey', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('should maintain separate debounce timers for different keys and execute first calls immediately', async () => {
    const mockFn = vi.fn().mockResolvedValue('result');
    const debouncedFn = debounceByKey(mockFn, 300, (key: string) => key, { leading: true });

    // First calls for each key should execute immediately
    const promiseA1 = debouncedFn('a');
    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn).toHaveBeenLastCalledWith('a');

    const promiseB = debouncedFn('b');
    expect(mockFn).toHaveBeenCalledTimes(2);
    expect(mockFn).toHaveBeenLastCalledWith('b');

    // Subsequent call should be debounced
    const promiseA2 = debouncedFn('a');
    expect(mockFn).toHaveBeenCalledTimes(2);

    // Advance time
    await vi.advanceTimersByTimeAsync(300);

    // Should have executed the debounced call
    expect(mockFn).toHaveBeenCalledTimes(3);
    expect(mockFn).toHaveBeenLastCalledWith('a');

    // All promises should resolve
    expect(await promiseA1).toBe('result');
    expect(await promiseA2).toBe('result');
    expect(await promiseB).toBe('result');
  });
});
