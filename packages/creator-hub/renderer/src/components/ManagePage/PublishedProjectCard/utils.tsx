import LandCoordsIcon from '@mui/icons-material/Place';
import LogoDCLSVG from '/assets/images/logo-dcl.svg';
import LogoENSSVG from '/assets/images/logo-ens-transparent.svg';
import { ManagedProjectType } from '/shared/types/manage';
import { config } from '/@/config';

const IS_DEV = import.meta.env.DEV;
const EXPLORER_URL = config.get('EXPLORER_URL');
const WORLDS_CONTENT_SERVER_URL = config.get('WORLDS_CONTENT_SERVER_URL');

export const getLogo = (type: ManagedProjectType, id: string) => {
  if (type === ManagedProjectType.LAND) return <LandCoordsIcon />;
  return (
    <img
      src={id.endsWith('.dcl.eth') ? LogoDCLSVG : LogoENSSVG}
      alt="Icon"
    />
  );
};

export const formatName = (name: string) => {
  // Separate base name and extension (.eth or .dcl.eth) with regex
  const match = name.match(/^(.*?)(\.dcl\.eth|\.eth)?$/);
  if (match && match.length > 1) {
    const baseName = match[1];
    const extension = match[2] || '.dcl.eth';
    return (
      <>
        {baseName}
        <span className="ENS">{extension}</span>
      </>
    );
  }
  return name;
};

export const isENSDomain = (name: string) => {
  return name.endsWith('.eth') && !name.endsWith('.dcl.eth');
};

export const getJumpInUrl = (world: string) => {
  return IS_DEV
    ? `${EXPLORER_URL}/?realm=${WORLDS_CONTENT_SERVER_URL}/world/${world}&NETWORK=sepolia`
    : `${EXPLORER_URL}/world/${world}`;
};
