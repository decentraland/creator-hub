import React from 'react';
import { Address, AvatarFace, Skeleton, Typography } from 'decentraland-ui2';
import { useProfile } from '/@/hooks/useProfile';
import { Row } from '/@/components/Row';
import { CopyToClipboard } from '/@/components/CopyToClipboard';
import './styles.css';

export type Props = {
  isLoading?: boolean;
  walletAddress: string;
};

export const WorldPermissionsAvatarWithInfo: React.FC<Props> = React.memo(
  ({ walletAddress, isLoading: externalIsLoading }) => {
    const { avatar, isLoading: isFetchingProfile } = useProfile(walletAddress);
    const isLoading = !walletAddress || externalIsLoading || isFetchingProfile;

    if (isLoading) {
      return (
        <Row className="Avatar">
          <AvatarFace
            size="small"
            inline
          />
          <Skeleton width="300px" />
        </Row>
      );
    }

    return (
      <Row className="Avatar">
        <AvatarFace
          avatar={avatar}
          size="small"
          inline
        />
        <CopyToClipboard
          text={walletAddress}
          showPopup
        >
          <Typography className="Paragraph">
            {avatar?.name && <span className="Name">{avatar.name}</span>}
            <Address
              value={walletAddress}
              shorten
            />
          </Typography>
        </CopyToClipboard>
      </Row>
    );
  },
);
