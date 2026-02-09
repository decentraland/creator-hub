import { Env, createConfig } from '@dcl/ui-env';
import { misc } from '#preload';
import dev from './env/dev.json';
import prod from './env/prd.json';

export const config = createConfig(
  {
    [Env.DEVELOPMENT as string]: dev,
    [Env.PRODUCTION as string]: prod,
  },
  {
    systemEnvVariables: {
      REACT_APP_DCL_DEFAULT_ENV: misc.getEnv(),
    },
  },
);
