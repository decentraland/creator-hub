import gte from 'semver/functions/gte';

// @dcl/sdk bundles @dcl/sdk-commands, so they always share the same version number.
const MIN_MULTI_INSTANCE_SDK_COMMANDS_VERSION = '7.20.4';
const MIN_MCP_SDK_COMMANDS_VERSION = '7.25.0';

export function supportsMultiInstance(version: string | null | undefined): boolean {
  return !!version && gte(version, MIN_MULTI_INSTANCE_SDK_COMMANDS_VERSION);
}

export function supportsMcp(version: string | null | undefined): boolean {
  return !!version && gte(version, MIN_MCP_SDK_COMMANDS_VERSION);
}
