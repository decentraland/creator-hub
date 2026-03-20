import gte from 'semver/functions/gte';

// @dcl/sdk bundles @dcl/sdk-commands, so they always share the same version number.
const MIN_MULTI_INSTANCE_SDK_COMMANDS_VERSION = '7.20.4';

export function supportsMultiInstance(version: string | null | undefined): boolean {
  return !!version && gte(version, MIN_MULTI_INSTANCE_SDK_COMMANDS_VERSION);
}
