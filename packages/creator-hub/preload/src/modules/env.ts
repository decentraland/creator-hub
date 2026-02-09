import path from 'node:path';

/**
 * Returns environment override from --env CLI argument.
 * @returns 'dev', 'prod', or null if no valid override specified
 */
export function getEnv(): 'dev' | 'prod' {
  const isDev = process.defaultApp || /electron(\.exe)?$/i.test(path.basename(process.execPath));
  const args = isDev ? process.argv.slice(2) : process.argv.slice(1);

  for (const arg of args) {
    if (arg.startsWith('--env=')) {
      const envValue = arg.split('=')[1];
      if (envValue === 'dev' || envValue === 'prod') {
        return envValue;
      }
    }
  }

  // No valid override found
  return import.meta.env.DEV ? 'dev' : 'prod';
}
