import type {Project} from '/shared/types/projects';

import type {Media} from './media';
import type {Scene} from './scene';

export function getThumbnailUrl(project: Project, scene?: Scene | null, media?: Media | null) {
  const thumbnailUrl = media ? media.preview : project.thumbnail;
  if (scene && scene.metadata?.display?.navmapThumbnail) {
    const hash = scene.mappings[scene.metadata?.display?.navmapThumbnail];
    if (hash) {
      // thumbnailUrl = getContentsStorageUrl(hash);
    }
  }
  return thumbnailUrl;
}
