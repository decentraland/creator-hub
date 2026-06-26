import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Grid, Typography } from 'decentraland-ui2';
import { ChevronLeftOutlined } from '@mui/icons-material';
import { t } from '/@/modules/store/translation/utils';
import { useAuth } from '/@/hooks/useAuth';
import { Row } from '../Row';
import { Column } from '../Column';

import EditorImage from '/assets/images/editor.png';

import './styles.css';

export function SignInPage() {
  const navigate = useNavigate();
  const { cancelSignIn, reopenSignInDapp, copySignInUrl } = useAuth();

  const handleBack = useCallback(() => {
    cancelSignIn();
    navigate(-1);
  }, [cancelSignIn, navigate]);

  const reopenAnchor = useCallback(
    (content: string) => (
      <a
        className="action-link"
        role="button"
        tabIndex={0}
        onClick={reopenSignInDapp}
      >
        {content}
      </a>
    ),
    [reopenSignInDapp],
  );

  const copyAnchor = useCallback(
    (content: string) => (
      <a
        className="action-link"
        role="button"
        tabIndex={0}
        onClick={copySignInUrl}
      >
        {content}
      </a>
    ),
    [copySignInUrl],
  );

  return (
    <Grid
      className="SignIn"
      container
      direction="row"
      alignItems="center"
      height={'100hv'}
    >
      <div className="background"></div>
      <Grid
        className="content"
        xs={9}
        item
      >
        <Button
          className="back"
          variant="contained"
          onClick={handleBack}
        >
          <ChevronLeftOutlined /> {t('sign_in.back')}
        </Button>
        <Row className="content-row">
          <Column className="text-column">
            <Typography
              variant="h3"
              gutterBottom
            >
              {t('sign_in.content.title')}
            </Typography>
            <Typography variant="h6">{t('sign_in.content.body', { br: () => <br /> })}</Typography>
            <Typography
              className="reopen"
              variant="body1"
            >
              {t('sign_in.content.reopen', { a: reopenAnchor, b: copyAnchor })}
            </Typography>
          </Column>
          <img
            className="illustration"
            src={EditorImage}
            alt="Decentraland Creator Hub illustration"
          />
        </Row>
      </Grid>
    </Grid>
  );
}
