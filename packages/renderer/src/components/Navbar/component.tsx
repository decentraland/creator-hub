import cx from 'classnames';
import { useCallback } from 'react';
import { misc } from '#preload';
import { t } from '/@/modules/store/translation/utils';
import { Header } from '../Header';
import logo from '/assets/images/logo-editor.png';
import './styles.css';
import { Link } from 'react-router-dom';

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
  const handleClickFeedback = useCallback(
    () => misc.openExternal('https://decentraland.canny.io'),
    [],
  );

  return (
    <Header classNames={cx('Navbar')}>
      <>
        <div className="logo">
          <img
            src={logo}
            alt="Creators Hub"
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
        <div
          className="feedback"
          onClick={handleClickFeedback}
        >
          {t('navbar.feedback')}
        </div>
      </>
    </Header>
  );
}
