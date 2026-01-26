import React from 'react';
import { Atlas } from 'decentraland-ui2/dist/components/Atlas/Atlas';
import type { AtlasProps } from 'decentraland-ui2/dist/components/Atlas/Atlas.types';
import type { WorldScene } from '/@/lib/worlds';
import './styles.css';

type Props = Partial<AtlasProps> & {
  worldScenes: WorldScene[];
};

const WorldAtlas: React.FC<Props> = React.memo(({ ...props }) => {
  /// TODO: Implement the world atlas
  return (
    /* @ts-expect-error TODO: Update properties in UI2, making the not required `optional` */
    <Atlas
      {...props}
      tiles={{}}
      layers={[]}
      onHover={() => {}}
      onClick={() => {}}
      withZoomControls
      height={props.height ?? 350}
      x={0}
      y={0}
    />
  );
});

export { WorldAtlas };
