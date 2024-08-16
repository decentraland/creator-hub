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
}

function MenuItem(props: { item: NavbarItem; active: NavbarItem }) {
  return (
    <Link
      to={`/${props.item}`}
      className={cx('menu-item', { active: props.active === props.item })}
    >
      {t(`navbar.menu.${props.item}`)}
    </Link>
  );
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
          <MenuItem
            item={NavbarItem.COLLECTIONS}
            active={props.active}
          />
          <MenuItem
            item={NavbarItem.LEARN}
            active={props.active}
          />
          <MenuItem
            item={NavbarItem.MANAGE}
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
