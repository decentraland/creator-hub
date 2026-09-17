import { useCallback, useRef, useState } from 'react';
import ArrowRightIcon from '@mui/icons-material/ArrowRight';
import { Menu, MenuItem, Tooltip } from 'decentraland-ui2';

import { misc } from '#preload';
import logo from '/assets/images/logo-editor.png';
import { t } from '/@/modules/store/translation/utils';
import {
  CONTACT_SUPPORT_URL,
  DISCORD_URL,
  HELP_FAQ_URL,
  REPORT_ISSUES_URL,
} from '/@/modules/utils';

import type { Props } from './types';

import './styles.css';

export function LogoMenu({ onClickAbout, onClickSettings, onClickCheckForUpdates }: Props) {
  const logoRef = useRef<HTMLButtonElement>(null);
  const helpRef = useRef<HTMLLIElement>(null);
  const [open, setOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const close = useCallback(() => {
    setHelpOpen(false);
    setOpen(false);
  }, []);

  const handleClickAbout = useCallback(() => {
    close();
    onClickAbout();
  }, [close, onClickAbout]);

  const handleClickCheckForUpdates = useCallback(() => {
    close();
    onClickCheckForUpdates();
  }, [close, onClickCheckForUpdates]);

  const handleClickSettings = useCallback(() => {
    close();
    onClickSettings();
  }, [close, onClickSettings]);

  const handleClickExternal = useCallback(
    (url: string) => () => {
      close();
      misc.openExternal(url);
    },
    [close],
  );

  return (
    <>
      <Tooltip
        title={t('navbar.logo_menu.main_menu_tooltip')}
        placement="bottom"
        classes={{ tooltip: 'MainMenuTooltip' }}
      >
        <button
          className="LogoButton"
          ref={logoRef}
          data-testid="logo-menu-button"
          aria-haspopup="menu"
          aria-expanded={open ? 'true' : undefined}
          onClick={() => setOpen(true)}
        >
          <img
            src={logo}
            alt="Decentraland Creator Hub"
          />
        </button>
      </Tooltip>
      <Menu
        className="LogoMenu"
        anchorEl={logoRef.current}
        open={open}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      >
        <MenuItem
          data-testid="logo-menu-about"
          onClick={handleClickAbout}
        >
          {t('navbar.logo_menu.about')}
        </MenuItem>
        <MenuItem
          data-testid="logo-menu-check-updates"
          onClick={handleClickCheckForUpdates}
        >
          {t('navbar.logo_menu.check_for_updates')}
        </MenuItem>
        <MenuItem
          data-testid="logo-menu-settings"
          onClick={handleClickSettings}
        >
          {t('navbar.logo_menu.settings')}
        </MenuItem>
        <MenuItem
          data-testid="logo-menu-report-bug"
          onClick={handleClickExternal(REPORT_ISSUES_URL)}
        >
          {t('navbar.logo_menu.report_bug')}
        </MenuItem>
        <MenuItem
          className="LogoMenuSubmenuItem"
          ref={helpRef}
          data-testid="logo-menu-help"
          onClick={() => setHelpOpen(true)}
          onMouseEnter={() => setHelpOpen(true)}
        >
          {t('navbar.logo_menu.help.label')}
          <ArrowRightIcon fontSize="small" />
        </MenuItem>
      </Menu>
      <Menu
        className="LogoMenu LogoSubmenu"
        anchorEl={helpRef.current}
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      >
        <MenuItem onClick={handleClickExternal(HELP_FAQ_URL)}>
          {t('navbar.logo_menu.help.faq')}
        </MenuItem>
        <MenuItem onClick={handleClickExternal(CONTACT_SUPPORT_URL)}>
          {t('navbar.logo_menu.help.contact_support')}
        </MenuItem>
        <MenuItem onClick={handleClickExternal(DISCORD_URL)}>
          {t('navbar.logo_menu.help.discord')}
        </MenuItem>
      </Menu>
    </>
  );
}
