import { useMemo } from 'react';
import { WearablePreview } from 'decentraland-ui';
import { toEmoteWithBlobs } from '../AssetPreview/utils';

type Props = {
  file: File;
};

/** Plays an emote animation on the default Decentraland avatar. */
export function EmoteViewer({ file }: Props) {
  const blob = useMemo(() => toEmoteWithBlobs(file), [file]);
  return (
    <div className="ModelViewer EmoteViewer">
      <WearablePreview
        id={`emote-${file.name}`}
        blob={blob}
        profile="default"
        disableBackground
        disableFace
        disableDefaultWearables
        skin="000000"
        wheelZoom={2}
      />
      <span className="EmoteViewer-badge">Emote · previewed on avatar</span>
    </div>
  );
}
