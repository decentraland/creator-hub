type RetryOptions = {
  retries?: number;
  delay?: number;
};

export async function retry<T>(
  fn: (...args: any[]) => Promise<T>,
  args: any[],
  { retries = 5, delay = 100 }: RetryOptions = {},
): Promise<T> {
  let lastError: Error = new Error(
    `Failed to execute function ${fn.name} after ${retries} retries`,
  );
  let attempt = 0;

  while (attempt < retries) {
    try {
      return await fn(...args);
    } catch (error) {
      lastError = error as Error;
      attempt++;

      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}
