import { useMemo, useState } from 'react';
import { WearablePreview } from 'decentraland-ui';
import { toEmoteWithBlobs } from '../AssetPreview/utils';

type Props = {
  file: File;
};

/**
 * Plays an emote animation on the default Decentraland avatar, fully dressed so the pose reads
 * clearly (the import dialog's black, faceless silhouette is only meant for thumbnails).
 */
export function EmoteViewer({ file }: Props) {
  const blob = useMemo(() => toEmoteWithBlobs(file), [file]);
  // The avatar comes from an external service and can take a while to appear.
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="ModelViewer EmoteViewer">
      <WearablePreview
        id={`emote-${file.name}`}
        blob={blob}
        profile="default"
        disableBackground
        wheelZoom={2}
        onLoad={() => setLoaded(true)}
      />
      {!loaded && <div className="PreviewPane-spinner" />}
      <span className="EmoteViewer-badge">Emote · previewed on avatar</span>
    </div>
  );
}
