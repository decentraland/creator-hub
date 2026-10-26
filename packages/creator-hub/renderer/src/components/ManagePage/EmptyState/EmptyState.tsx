import type { ReactNode } from 'react';
import EmptyLands from '/assets/images/empty-lands.svg';
import EmptySignedOut from '/assets/images/empty-signed-out.svg';
import EmptyWorlds from '/assets/images/empty-worlds.svg';

import { t } from '/@/modules/store/translation/utils';

import { Button } from '../../Button';
import { InfoTip } from '../InfoTip';
import { Body, Illustration, ReadMore, Root, Title, TitleRow } from './EmptyState.styled';

export type EmptyStateIcon = 'wave' | 'world' | 'land';

export type EmptyStateAction = {
  label: string;
  variant: 'primary' | 'secondary' | 'tertiary';
  onClick: () => void;
};

export type EmptyStateInfo = { label: string; text: string; readMoreUrl: string };

const EMPTY_STATE_ICONS = { wave: EmptySignedOut, world: EmptyWorlds, land: EmptyLands };

const BUTTON_BY_VARIANT = {
  primary: { variant: 'contained', color: 'primary' },
  secondary: { variant: 'contained', color: 'secondary' },
  tertiary: { variant: 'outlined', color: 'secondary' },
} as const;

type Props = {
  icon?: EmptyStateIcon;
  title: string;
  info?: EmptyStateInfo;
  description?: ReactNode;
  action?: EmptyStateAction;
};

/** The Manage page's empty, signed-out and error views. */
export function EmptyState({ icon, title, info, description, action }: Props) {
  return (
    <Root>
      {icon && (
        <Illustration
          src={EMPTY_STATE_ICONS[icon]}
          alt=""
        />
      )}
      <TitleRow>
        <Title>{title}</Title>
        {info && (
          <InfoTip label={info.label}>
            {info.text} <ReadMore href={info.readMoreUrl}>{t('manage.read_more')}</ReadMore>
          </InfoTip>
        )}
      </TitleRow>
      {description && <Body>{description}</Body>}
      {action && (
        <Button
          size="large"
          {...BUTTON_BY_VARIANT[action.variant]}
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      )}
    </Root>
  );
}
