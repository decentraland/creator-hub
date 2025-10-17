import { Loader } from 'decentraland-ui/dist/components/Loader/Loader';
import { Dimmer } from 'decentraland-ui/dist/components/Dimmer/Dimmer';

import type { Props } from './types';

export function Loading({ dimmer = true, size }: Props) {
  return (
    <div className="loading">
      <Loader
        active
        size={size}
      />
      <Dimmer active={dimmer} />
    </div>
  );
}
