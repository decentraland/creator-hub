import { useNavigate } from 'react-router-dom';
import { Grid, Typography } from 'decentraland-ui2';
import { t } from '/@/modules/store/translation/utils';
import { misc } from '#preload';

import { Container } from '../Container';
import { Navbar, NavbarItem } from '../Navbar';
import './styles.css';

function Link(props: { url: string; title: string }) {
  return (
    <div
      className="link"
      onClick={() => misc.openExternal(props.url)}
    >
      <i className="icon" />
      <span className="title">{props.title}</span>
    </div>
  );
}

export function DocsPage() {
  const navigate = useNavigate();

  return (
    <main className="DocsPage">
      <Navbar active={NavbarItem.LEARN} />
      <Container>
        <Typography
          variant="h4"
          mb="48px"
          className="top-bar"
        >
          <div
            className="header"
            onClick={() => navigate('/learn')}
          >
            <i className="back" /> <span className="title">{t('learn.docs.title')}</span>
          </div>
        </Typography>
        <div className="docs">
          <div className="start"></div>
          <Grid
            container
            spacing={4}
            className="sections"
          >
            <Grid
              item
              xs
              className="section"
            >
              <h1>Wearables & Emotes</h1>
              <h3>Wearables</h3>
              <Link
                title="Wearable Overview"
                url="https://docs.decentraland.org"
              />
            </Grid>
          </Grid>
        </div>
      </Container>
    </main>
  );
}
