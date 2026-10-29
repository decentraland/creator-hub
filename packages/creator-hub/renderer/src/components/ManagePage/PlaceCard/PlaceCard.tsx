import { useId } from 'react';
import { Link } from 'react-router-dom';

import { coordsToId } from '/@/lib/land';
import { t } from '/@/modules/store/translation/utils';
import FallbackThumbnail from '/assets/images/scene-thumbnail-fallback.png';
import type { LandPlace } from '/shared/types/manage';

import { Button } from '../../Button';
import { Dropdown } from '../../Dropdown';
import type { Option } from '../../Dropdown';
import { MapPinIcon, ScenesIcon } from '../../Icons';
import { Image } from '../../Image';
import { PlaceGlyph } from '../cardMenuGlyphs.styled';
import { RoleTag } from '../RoleTag';
import type { RoleTagVariant } from '../RoleTag';
import {
  Card,
  EmptyThumbnail,
  Kebab,
  Name,
  PlaceRow,
  Stats,
  TextBlock,
  Thumbnail,
} from './PlaceCard.styled';

export type PlaceCardStatus = 'published' | 'unpublished';

export type CardPlace = LandPlace | { kind: 'world'; domain: string };

type Props = {
  name: string;
  place: CardPlace;
  role?: RoleTagVariant;
  status: PlaceCardStatus;
  thumbnail?: string;
  scenesCount: number;
  menuOptions: Option[];
  onViewScenes: () => void;
  to?: string;
};

function placeText(place: CardPlace) {
  if (place.kind === 'world') return place.domain;
  return place.kind === 'parcel'
    ? coordsToId(place.x, place.y)
    : t('manage.cards.land.lands_count', { count: place.size });
}

/** A LAND or World card on Manage (Figma `Place Entry`). */
export function PlaceCard(props: Props) {
  const nameId = useId();
  const domain = props.place.kind === 'world' ? props.place.domain : undefined;
  const isNameHidden = !!domain && props.status === 'unpublished';
  const linkTo = (label: string) => (props.to ? <Link to={props.to}>{label}</Link> : label);

  return (
    <Card {...(isNameHidden ? { 'aria-label': domain } : { 'aria-labelledby': nameId })}>
      <TextBlock>
        <PlaceRow>
          {domain ? <PlaceGlyph /> : <MapPinIcon />}
          <span>{isNameHidden ? linkTo(placeText(props.place)) : placeText(props.place)}</span>
          {props.role && <RoleTag variant={props.role} />}
        </PlaceRow>
        <Name
          id={nameId}
          aria-hidden={isNameHidden || undefined}
        >
          {isNameHidden ? props.name : linkTo(props.name)}
        </Name>
      </TextBlock>
      <Kebab>
        <Dropdown
          label={t('menu.options_for', { name: domain ?? props.name })}
          options={props.menuOptions}
        />
      </Kebab>
      <Thumbnail>
        {props.status === 'published' ? (
          <>
            <Image
              src={props.thumbnail ?? ''}
              alt=""
              fallbackSrc={FallbackThumbnail}
            />
            <Stats>
              <ScenesIcon />
              {t('manage.cards.scenes_count', { count: props.scenesCount })}
            </Stats>
          </>
        ) : (
          <EmptyThumbnail>
            {t('manage.cards.no_scene.title')}
            <Button
              variant="contained"
              color="secondary"
              size="large"
              onClick={props.onViewScenes}
            >
              {t('manage.cards.no_scene.view_scenes')}
            </Button>
          </EmptyThumbnail>
        )}
      </Thumbnail>
    </Card>
  );
}
