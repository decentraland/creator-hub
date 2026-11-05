import { Env, createConfig } from '@dcl/ui-env';
import { env } from '#preload';
import dev from './env/dev.json';
import prod from './env/prd.json';

const overrides = env.getApiUrlOverrides();

export const config = createConfig(
  {
    [Env.DEVELOPMENT as string]: { ...dev, ...overrides },
    [Env.PRODUCTION as string]: { ...prod, ...overrides },
  },
  {
    systemEnvVariables: {
      REACT_APP_DCL_DEFAULT_ENV: env.getEnv(),
    },
  },
);
