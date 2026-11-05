import { Address, AvatarFace, type AvatarFaceProps } from 'decentraland-ui2';

import { useProfile } from '/@/hooks/useProfile';

import { Deployer, Meta } from './ScenesTab.styled';

/** The account that deployed a scene: avatar and profile name or shortened address, or a dash while unknown. */
export function DeployerCell({ address }: { address?: string }) {
  const { avatar } = useProfile(address ?? '');
  if (!address) return <Meta>—</Meta>;
  return (
    <Deployer title={avatar?.name ?? address}>
      <AvatarFace
        avatar={avatar as AvatarFaceProps['avatar']}
        size="tiny"
        inline
      />
      {avatar?.name ? (
        <span>{avatar.name}</span>
      ) : (
        <Address
          value={address}
          shorten
        />
      )}
    </Deployer>
  );
}
