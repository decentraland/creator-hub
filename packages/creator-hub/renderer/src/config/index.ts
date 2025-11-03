import { Env, createConfig } from '@dcl/ui-env';
import dev from './env/dev.json';
import prod from './env/prd.json';

export const config = createConfig(
  {
    [Env.DEVELOPMENT as string]: dev,
    [Env.PRODUCTION as string]: prod,
  },
  {
    systemEnvVariables: {
      REACT_APP_DCL_DEFAULT_ENV: import.meta.env.DEV ? 'dev' : 'prod',
    },
  },
);
