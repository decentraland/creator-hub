import { Box, OperativeSystem, Typography } from 'decentraland-ui2';
import {
  DownloadButtonAppleIcon,
  DownloadButtonWindowsIcon,
} from 'decentraland-ui2/dist/components/DownloadButton/DownloadButton.styled';
import { CDNSource, getCDNRelease } from 'decentraland-ui2/dist/modules/cdnReleases';
import { useAdvancedUserAgentData } from '@dcl/hooks';
import { actions } from '/@/modules/store/editor';
import { Modal } from '..';
import { Button } from '../../Button';
import LogoDCLSVG from '/assets/images/logo-dcl.svg';
import type { Props } from './types';

import './styles.css';
import { useCallback, useMemo } from 'react';
import { useDispatch } from '#store';

export function InstallClient({ open, onClose }: Props) {
  const [_, agent] = useAdvancedUserAgentData();
  const dispatch = useDispatch();

  const handleDownload = useCallback(async () => {
    if (!agent) return;
    const cdn = getCDNRelease(CDNSource.LAUNCHER);
    const os: OperativeSystem = agent.os.name as OperativeSystem;
    const downloadLink: string = (cdn![os] as any)[agent.cpu.architecture];
    dispatch(actions.openExternalURL(downloadLink));
    onClose();
  }, [agent, onClose]);
  const { icon, text } = useMemo(() => {
    if (!agent) {
      return { text: 'Download', icon: <div /> };
    }
    if (agent.os.name === OperativeSystem.MACOS) {
      return { icon: <DownloadButtonAppleIcon />, text: 'DOWNLOAD FOR MAC' };
    }
    return { icon: <DownloadButtonWindowsIcon />, text: 'DOWNLOAD FOR WINDOWS' };
  }, [agent]);

  return (
    <Modal
      className="InstallClientModal"
      open={open}
      size="tiny"
    >
      <Box className="InstallClientBox">
        <Box className="LogoContainer">
          <img
            src={LogoDCLSVG}
            alt="Decentraland Logo"
            className="Logo"
          />
        </Box>
        <Typography
          variant="h5"
          className="Title"
        >
          To jump in, you'll need to install Decentraland first
        </Typography>
        <Box className="Actions">
          <Button
            variant="contained"
            color="primary"
            onClick={handleDownload}
            startIcon={icon}
          >
            {text}
          </Button>
          <Button
            variant="outlined"
            color="secondary"
            fullWidth
            onClick={onClose}
          >
            NOT NOW
          </Button>
        </Box>
      </Box>
    </Modal>
  );
}
