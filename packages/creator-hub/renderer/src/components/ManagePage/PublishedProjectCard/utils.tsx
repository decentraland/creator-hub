import LandCoordsIcon from '@mui/icons-material/Place';
import LogoDCLSVG from '/assets/images/logo-dcl.svg';
import LogoENSSVG from '/assets/images/logo-ens-transparent.svg';
import { type ManagedProject, ManagedProjectType, WorldSettingsTab } from '/shared/types/manage';
import { config } from '/@/config';
import { WorldRoleType } from '/@/lib/worlds';

const WORLDS_STORAGE_SERVICE_URL = config.get('WORLDS_STORAGE_SERVICE_URL');

/**
 * The tab the world card's settings button opens. Owners and world-wide collaborators get the
 * full modal from Details; parcel-only collaborators only ever see the Layout tab.
 */
export const getWorldSettingsEntryTab = (
  project: Pick<ManagedProject, 'role' | 'worldWideDeployment'>,
): WorldSettingsTab =>
  project.role === WorldRoleType.OWNER || project.worldWideDeployment
    ? WorldSettingsTab.DETAILS
    : WorldSettingsTab.LAYOUT;

export const isENSDomain = (name: string) => {
  return name.endsWith('.eth') && !name.endsWith('.dcl.eth');
};

export const getLogo = (type: ManagedProjectType, subdomain: string) => {
  if (type === ManagedProjectType.LAND) return <LandCoordsIcon />;
  return (
    <img
      src={isENSDomain(subdomain) ? LogoENSSVG : LogoDCLSVG}
      alt="Logo"
    />
  );
};

export const formatName = (name: string) => {
  // Separate base name and extension (.eth or .dcl.eth) with regex
  const match = name.match(/^(.+?)(\.dcl\.eth|\.eth)$/);
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

/**
 * Build a link to the storage service UI. Worlds pass the realm name; the page
 * lets the user pick a scene from there. Lands pass the parcel coords directly.
 */
export const getStorageUrl = (type: ManagedProjectType, id: string) => {
  if (type === ManagedProjectType.WORLD) {
    return `${WORLDS_STORAGE_SERVICE_URL}/env?realm=${encodeURIComponent(id)}`;
  }
  return `${WORLDS_STORAGE_SERVICE_URL}/env?position=${encodeURIComponent(id)}`;
};
