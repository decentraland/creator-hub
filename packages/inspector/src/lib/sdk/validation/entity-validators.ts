import type { Entity } from '@dcl/ecs';

import type { AssetCatalogResponse } from '../../../tooling-entrypoint';
import type { SdkContextValue } from '../context';
import { isValidInput as isValidGltfInput } from '../../../components/EntityInspector/GltfInspector/utils';
import { isValidInput as isValidAudioSourceInput } from '../../../components/EntityInspector/AudioSourceInspector/utils';
import { isValidInput as isValidAudioStreamInput } from '../../../components/EntityInspector/AudioStreamInspector/utils';
import { isValidInput as isValidVideoPlayerInput } from '../../../components/EntityInspector/VideoPlayerInspector/utils';
import { isValidInput as isValidNftShapeInput } from '../../../components/EntityInspector/NftShapeInspector/utils';
import { isValidInput as isValidPlaceholderInput } from '../../../components/EntityInspector/PlaceholderInspector/utils';
import { ROOT } from '../tree';

export function validateAllEntities(
  sdk: SdkContextValue,
  assetCatalog: AssetCatalogResponse | undefined,
): number[] {
  const nodes =
    sdk.components.Nodes.getOrNull(ROOT as Entity)?.value.filter(
      node =>
        ![sdk.engine.RootEntity, sdk.engine.PlayerEntity, sdk.engine.CameraEntity].includes(
          node.entity,
        ),
    ) ?? [];

  const entitiesWithErrors: number[] = [];

  for (const node of nodes) {
    if (hasValidationErrors(sdk, node.entity, assetCatalog)) {
      entitiesWithErrors.push(node.entity);
    }
  }

  return entitiesWithErrors;
}

function hasValidationErrors(
  sdk: SdkContextValue,
  entity: Entity,
  assetCatalog: AssetCatalogResponse | undefined,
): boolean {
  const { GltfContainer, AudioSource, AudioStream, VideoPlayer, NftShape, Placeholder } =
    sdk.components;

  // GltfContainer: validate src exists in asset catalog
  const gltf = GltfContainer.getOrNull(entity);
  if (gltf && assetCatalog && !isValidGltfInput(assetCatalog, gltf.src)) {
    return true;
  }

  // AudioSource: validate audioClipUrl exists in asset catalog
  const audioSource = AudioSource.getOrNull(entity);
  if (
    audioSource &&
    assetCatalog &&
    !isValidAudioSourceInput(assetCatalog, audioSource.audioClipUrl)
  ) {
    return true;
  }

  // AudioStream: validate url is valid HTTPS
  const audioStream = AudioStream.getOrNull(entity);
  if (audioStream && !isValidAudioStreamInput(audioStream.url)) {
    return true;
  }

  // VideoPlayer: validate src is valid URL or file in catalog
  const videoPlayer = VideoPlayer.getOrNull(entity);
  if (videoPlayer && assetCatalog && !isValidVideoPlayerInput(assetCatalog, videoPlayer.src)) {
    return true;
  }

  // NftShape: validate URN format
  const nftShape = NftShape.getOrNull(entity);
  if (nftShape && !isValidNftShapeInput(nftShape.urn)) {
    return true;
  }

  // Placeholder: validate src exists in asset catalog
  const placeholder = Placeholder.getOrNull(entity);
  if (placeholder && assetCatalog && !isValidPlaceholderInput(assetCatalog, placeholder.src)) {
    return true;
  }

  return false;
}
