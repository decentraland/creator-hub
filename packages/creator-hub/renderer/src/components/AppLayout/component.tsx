import { useCallback, useState } from 'react';
import { Outlet } from 'react-router-dom';
import SettingsIcon from '@mui/icons-material/Settings';
import { Box, IconButton } from 'decentraland-ui2';

import { useDispatch, useSelector } from '#store';
import type { AppState } from '#store';
import { actions } from '/@/modules/store/settings';
import { useAuth } from '/@/hooks/useAuth';
import { ConnectionStatusIndicator } from '../ConnectionStatusIndicator';
import { UserMenu } from '../Header/UserMenu';
import { AppSettings } from '../Modals/AppSettings';
import { HelpCenter } from '../Modals/HelpCenter';
import { PromoBanner, type PromoBannerConfig } from '../PromoBanner';
import { Sidebar } from '../Sidebar';

import heroVideo from '/assets/videos/Builder_Hero.mp4';
import promoImage from '/assets/images/promo-fright-night.png';

import './styles.css';

/**
 * Set to a config object to show a promotional banner, or null to hide it.
 * This can be driven by a remote config, feature flag, or env variable.
 */
// TODO: remove preview config — set back to null when done previewing
const PROMO_BANNER_CONFIG: PromoBannerConfig | null = {
  backgroundVideo: heroVideo,
  promoImage: promoImage,
  href: 'https://decentraland.org/blog/',
  ctaLabel: 'Learn More',
  videoDuration: 8,
  promoDuration: 6,
};

export function AppLayout() {
  const auth = useAuth();
  const openAppSettings = useSelector((state: AppState) => state.settings.openAppSettingsModal);
  const dispatch = useDispatch();
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const showBanner = PROMO_BANNER_CONFIG !== null && !bannerDismissed;

  const handleClickHelp = useCallback(() => setHelpOpen(true), []);
  const handleClickSettings = useCallback(() => {
    dispatch(actions.setOpenAppSettingsModal(true));
  }, []);
  const handleDismissBanner = useCallback(() => setBannerDismissed(true), []);

  return (
    <div className="AppLayout">
      <header className="AppTopBar">
        <Box className="AppTopBarActions">
          <ConnectionStatusIndicator />
          <IconButton
            sx={{ p: 0.75 }}
            aria-label="help"
            onClick={handleClickHelp}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path
                stroke="none"
                d="M0 0h24v24H0z"
                fill="none"
              />
              <path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
              <path d="M12 17l0 .01" />
              <path d="M12 13.5a1.5 1.5 0 0 1 1 -1.5a2.6 2.6 0 1 0 -3 -4" />
            </svg>
          </IconButton>
          <IconButton
            sx={{ p: 0.75 }}
            aria-label="settings"
            onClick={handleClickSettings}
          >
            <SettingsIcon sx={{ fontSize: 22 }} />
          </IconButton>
          <UserMenu
            address={auth.wallet}
            avatar={auth.avatar}
            isSignedIn={auth.isSignedIn}
            isSigningIn={auth.isSigningIn}
            onClickSignIn={auth.signIn}
            onClickSignOut={auth.signOut}
          />
        </Box>
      </header>
      {showBanner && (
        <PromoBanner
          config={PROMO_BANNER_CONFIG}
          onDismiss={handleDismissBanner}
        />
      )}
      <div className="AppBody">
        <Sidebar />
        <div className="AppContent">
          <main className="AppMain">
            <div className="AppPage">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
      <AppSettings
        open={openAppSettings}
        onClose={() => dispatch(actions.setOpenAppSettingsModal(false))}
      />
      <HelpCenter
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
      />
    </div>
  );
}
