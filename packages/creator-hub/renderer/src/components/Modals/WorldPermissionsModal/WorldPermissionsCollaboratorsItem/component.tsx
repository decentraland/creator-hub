import React from 'react';
import { Checkbox, Table } from 'decentraland-ui';
import { Button } from 'decentraland-ui/dist/components/Button/Button';
import LoadingText from 'decentraland-ui/dist/components/Loader/LoadingText';
import { WorldPermissionNames } from '/@/lib/worlds';
import { WorldPermissionsAvatarWithInfo } from '../WorldPermissionsAvatarWithInfo';

type Props = {
  walletAddress?: string;
  hasWorldDeploymentPermission?: boolean;
  hasWorldStreamingPermission?: boolean;
  loading?: boolean;
  onRemoveCollaborator?: (address: string) => void;
  onUserPermissionListChange?: (address: string, worldPermissionName: WorldPermissionNames) => void;
};

export const WorldPermissionsCollaboratorsItem = React.memo((props: Props) => {
  const {
    walletAddress,
    hasWorldDeploymentPermission,
    hasWorldStreamingPermission,
    onUserPermissionListChange,
    onRemoveCollaborator,
    loading,
  } = props;

  if (loading || !walletAddress || !onUserPermissionListChange) {
    return (
      <Table.Row>
        <Table.Cell>
          <WorldPermissionsAvatarWithInfo
            isLoading
            walletAddress=""
          />
        </Table.Cell>
        <Table.Cell>
          <LoadingText
            type="span"
            size="small"
          ></LoadingText>
        </Table.Cell>
        <Table.Cell>
          <LoadingText
            type="span"
            size="small"
          ></LoadingText>
        </Table.Cell>
        <Table.Cell>
          <Button
            basic
            loading
            disabled
          />
        </Table.Cell>
      </Table.Row>
    );
  }

  return (
    <Table.Row>
      <Table.Cell>
        <WorldPermissionsAvatarWithInfo walletAddress={walletAddress} />
      </Table.Cell>
      <Table.Cell>
        <Checkbox
          onChange={e =>
            onUserPermissionListChange(e as React.MouseEvent<HTMLInputElement, MouseEvent>, {
              walletAddress,
              worldPermissionName: WorldPermissionNames.Deployment,
            })
          }
          checked={hasWorldDeploymentPermission}
        />
      </Table.Cell>
      <Table.Cell>
        <Checkbox
          onChange={e =>
            onUserPermissionListChange(e as React.MouseEvent<HTMLInputElement, MouseEvent>, {
              walletAddress,
              worldPermissionName: WorldPermissionNames.Streaming,
            })
          }
          checked={hasWorldStreamingPermission}
        />
      </Table.Cell>
      <Table.Cell>
        <Button
          basic
          onClick={e => onRemoveCollaborator && onRemoveCollaborator(e, { walletAddress })}
        >
          <Icon name="close" />
        </Button>
      </Table.Cell>
    </Table.Row>
  );
});
