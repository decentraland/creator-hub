import { AvatarFace, type AvatarFaceProps } from 'decentraland-ui2';

import { useProfile } from '/@/hooks/useProfile';

import { useDisplayName } from '../access/useDisplayName';
import { Deployer, Meta } from './ScenesTab.styled';

/** The account that deployed a scene: avatar and display name, or a dash while unknown. */
export function DeployerCell({ address }: { address?: string }) {
  const displayName = useDisplayName();
  const { avatar } = useProfile(address ?? '');
  if (!address) return <Meta>—</Meta>;
  const name = displayName(address);
  return (
    <Deployer title={name}>
      <AvatarFace
        avatar={avatar as AvatarFaceProps['avatar']}
        size="tiny"
        inline
      />
      <span>{name}</span>
    </Deployer>
  );
}
