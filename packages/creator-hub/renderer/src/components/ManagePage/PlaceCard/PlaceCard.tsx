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

type PlaceCardStatus = 'published' | 'unpublished';

type Props = {
  name: string;
  place: LandPlace;
  role?: RoleTagVariant;
  status: PlaceCardStatus;
  thumbnail?: string;
  scenesCount: number;
  menuOptions: Option[];
  onViewScenes: () => void;
  to?: string;
};

function placeText(place: LandPlace) {
  return place.kind === 'parcel'
    ? coordsToId(place.x, place.y)
    : t('manage.cards.land.lands_count', { count: place.size });
}

/** A LAND card on Manage (Figma `Place Entry`, Type = LAND). */
export function PlaceCard(props: Props) {
  const nameId = useId();

  return (
    <Card aria-labelledby={nameId}>
      <TextBlock>
        <PlaceRow>
          <MapPinIcon />
          <span>{placeText(props.place)}</span>
          {props.role && <RoleTag variant={props.role} />}
        </PlaceRow>
        <Name id={nameId}>{props.to ? <Link to={props.to}>{props.name}</Link> : props.name}</Name>
      </TextBlock>
      <Kebab>
        <Dropdown
          label={t('menu.options_for', { name: props.name })}
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
