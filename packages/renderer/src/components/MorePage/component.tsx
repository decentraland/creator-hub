import React from 'react';
import { Box, Button, Card, CardContent, Container, Grid, Typography } from 'decentraland-ui2';
import { misc } from '#preload';
import { t } from '/@/modules/store/translation/utils';
import { Navbar, NavbarItem } from '../Navbar';

import './styles.css';

const BUILDER_URL = 'https://decentraland.org/builder';

const HorizontalCardWithImage: React.FC<{
  title: string;
  description: string;
  image: string;
  action: () => void;
}> = React.memo(({ title, description, image, action }) => (
  <Card className="HorizontalCardWithImage">
    <Box className="CardImage">
      <img src={image} />
    </Box>
    <CardContent className="CardContent">
      <Box p={0}>
        <Typography variant="h6">{title}</Typography>
        <Typography variant="body2">{description}</Typography>
      </Box>
      <Box className="CardActions">
        <Button onClick={action}>{t('more.cards.open_in_browser')}</Button>
      </Box>
    </CardContent>
  </Card>
));

export function MorePage() {
  return (
    <main className="MorePage">
      <Navbar active={NavbarItem.MORE} />
      <Container>
        <Typography
          variant="h4"
          mb="48px"
        >
          {t('more.header.title')}
        </Typography>
        <Typography
          className="CardsSection"
          variant="h6"
          mb="16px"
        >
          {t('more.cards.create.title')}
        </Typography>
        <Grid
          container
          spacing={3}
          mb="48px"
        >
          <Grid
            item
            xs={12}
            sm={6}
            md={6}
            lg={4}
          >
            <HorizontalCardWithImage
              title={t('more.cards.create.legacy_web_editor.title')}
              description={t('more.cards.create.legacy_web_editor.description')}
              action={() => misc.openExternal(`${BUILDER_URL}/scenes`)}
              image="/assets/images/editor.png"
            />
          </Grid>
          <Grid
            item
            xs={12}
            sm={6}
            md={6}
            lg={4}
          >
            <HorizontalCardWithImage
              title={t('more.cards.create.collections.title')}
              description={t('more.cards.create.collections.description')}
              action={() => misc.openExternal(`${BUILDER_URL}/collections`)}
              image="/assets/images/collections.png"
            />
          </Grid>
        </Grid>
        <Typography
          className="CardsSection"
          variant="h6"
          mb="16px"
        >
          {t('more.cards.manage.title')}
        </Typography>
        <Grid
          container
          spacing={3}
        >
          <Grid
            item
            xs={12}
            sm={6}
            md={6}
            lg={4}
          >
            <HorizontalCardWithImage
              title={t('more.cards.manage.names.title')}
              description={t('more.cards.manage.names.description')}
              action={() => misc.openExternal(`${BUILDER_URL}/names`)}
              image="/assets/images/names.png"
            />
          </Grid>
          <Grid
            item
            xs={12}
            sm={6}
            md={6}
            lg={4}
          >
            <HorizontalCardWithImage
              title={t('more.cards.manage.worlds.title')}
              description={t('more.cards.manage.worlds.description')}
              action={() => misc.openExternal(`${BUILDER_URL}/worlds?tab=dcl`)}
              image="/assets/images/worlds.png"
            />
          </Grid>
          <Grid
            item
            xs={12}
            sm={6}
            md={6}
            lg={4}
          >
            <HorizontalCardWithImage
              title={t('more.cards.manage.land.title')}
              description={t('more.cards.manage.land.description')}
              action={() => misc.openExternal(`${BUILDER_URL}/land`)}
              image="/assets/images/land.png"
            />
          </Grid>
        </Grid>
      </Container>
    </main>
  );
}
