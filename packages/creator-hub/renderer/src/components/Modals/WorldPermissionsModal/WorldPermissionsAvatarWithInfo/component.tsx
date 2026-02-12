import React from 'react';
import { Address, AvatarFace, type AvatarFaceProps, Skeleton, Typography } from 'decentraland-ui2';
import { useProfile } from '/@/hooks/useProfile';
import { Row } from '/@/components/Row';
import { CopyToClipboard } from '/@/components/CopyToClipboard';
import './styles.css';

export type Props = {
  isLoading?: boolean;
  value: string;
  size?: AvatarFaceProps['size'];
  icon?: React.ReactNode;
  name?: string;
  subtitle?: string;
};

export const WorldPermissionsAvatarWithInfo: React.FC<Props> = React.memo(
  ({ value, isLoading: externalIsLoading, size = 'small', icon, name, subtitle }) => {
    const skipProfile = !!icon;
    const { avatar, isLoading: isFetchingProfile } = useProfile(skipProfile ? '' : value);
    const isLoading = !skipProfile && (!value || externalIsLoading || isFetchingProfile);

    if (isLoading) {
      return (
        <Row className="Avatar">
          <AvatarFace
            size={size}
            inline
          />
          <Skeleton width="300px" />
        </Row>
      );
    }

    if (icon) {
      return (
        <Row className="Avatar">
          {icon}
          <Typography className="Paragraph">
            {name && <span className="Name">{name}</span>}
            {subtitle && <span>{subtitle}</span>}
          </Typography>
        </Row>
      );
    }

    return (
      <Row className="Avatar">
        <AvatarFace
          avatar={avatar}
          size={size}
          inline
        />
        <CopyToClipboard
          text={value}
          showPopup
        >
          <Typography className="Paragraph">
            {(name ?? avatar?.name) && <span className="Name">{name ?? avatar?.name}</span>}
            <Address
              value={value}
              shorten
            />
          </Typography>
        </CopyToClipboard>
      </Row>
    );
  },
);
