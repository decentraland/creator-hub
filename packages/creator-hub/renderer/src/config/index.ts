import { Env, createConfig } from '@dcl/ui-env';
import dev from './env/dev.json';
import prod from './env/prd.json';

const envConfig = {
  [Env.DEVELOPMENT as string]: dev,
  [Env.PRODUCTION as string]: prod,
};

const envOverride = typeof window !== 'undefined' ? localStorage.getItem('DCL_ENV_OVERRIDE') : null;

const dclDefaultEnv =
  envOverride && Object.keys(envConfig).includes(envOverride)
    ? envOverride
    : import.meta.env.DEV
      ? 'dev'
      : 'prod';

export const config = createConfig(envConfig, {
  systemEnvVariables: {
    REACT_APP_DCL_DEFAULT_ENV: dclDefaultEnv,
  },
});
