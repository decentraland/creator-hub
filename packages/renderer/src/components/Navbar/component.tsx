import cx from 'classnames';
import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { Box, Button, IconButton } from 'decentraland-ui2';
import QuestionMarkIcon from '@mui/icons-material/QuestionMark';
import SettingsIcon from '@mui/icons-material/Settings';
import { misc } from '#preload';
import logo from '/assets/images/logo-editor.png';
import { REPORT_ISSUES_URL } from '/@/modules/utils';
import { t } from '/@/modules/store/translation/utils';
import { Header } from '../Header';

import './styles.css';
import { AppSettings } from '../Modals/AppSettings';

export enum NavbarItem {
  HOME = 'home',
  SCENES = 'scenes',
  COLLECTIONS = 'collections',
  LEARN = 'learn',
  MANAGE = 'manage',
  MORE = 'more',
}

function MenuItem(props: { item: NavbarItem; active: NavbarItem; disable?: boolean }) {
  return !props.disable ? (
    <Link
      to={`/${props.item}`}
      className={cx('menu-item', { active: props.active === props.item })}
    >
      {t(`navbar.menu.${props.item}`)}
    </Link>
  ) : null;
}

export function Navbar(props: { active: NavbarItem }) {
  const [openAppSettings, setOpenAppSettings] = useState(false);

  const handleClickReportIssue = useCallback(() => misc.openExternal(REPORT_ISSUES_URL), []);

  const handleClickHelp = useCallback(
    () => misc.openExternal('https://decentraland.org/help/'),
    [],
  );

  const handleClickSettings = useCallback(() => {
    setOpenAppSettings(true);
  }, []);

  return (
    <Header classNames={cx('Navbar')}>
      <>
        <div className="logo">
          <img
            src={logo}
            alt="Decentraland Creator Hub"
          />
        </div>
        <div className="menu">
          <MenuItem
            item={NavbarItem.HOME}
            active={props.active}
          />
          <MenuItem
            item={NavbarItem.SCENES}
            active={props.active}
          />
          {/* This page will be added in a future shape */}
          <MenuItem
            item={NavbarItem.COLLECTIONS}
            active={props.active}
            disable={true}
          />
          <MenuItem
            item={NavbarItem.LEARN}
            active={props.active}
          />
          {/* This page will be added in a future shape */}
          <MenuItem
            item={NavbarItem.MANAGE}
            active={props.active}
            disable={true}
          />
          <MenuItem
            item={NavbarItem.MORE}
            active={props.active}
          />
        </div>
      </>
      <>
        <Box className="actions">
          <Button
            variant="outlined"
            color="secondary"
            size="small"
            onClick={handleClickReportIssue}
          >
            {t('navbar.report_an_issue')}
          </Button>
          <IconButton
            aria-label="help"
            onClick={handleClickHelp}
          >
            <QuestionMarkIcon />
          </IconButton>
          <IconButton
            aria-label="settings"
            onClick={handleClickSettings}
          >
            <SettingsIcon />
          </IconButton>
        </Box>
        <AppSettings
          open={openAppSettings}
          onClose={() => setOpenAppSettings(false)}
        />
      </>
    </Header>
  );
}
