import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Grid, Typography } from 'decentraland-ui2';
import { ChevronLeftOutlined } from '@mui/icons-material';
import { t } from '/@/modules/store/translation/utils';
import { useAuth } from '/@/hooks/useAuth';

import './styles.css';

export function SignInPage() {
  const navigate = useNavigate();
  const { cancelSignIn } = useAuth();

  const handleBack = useCallback(() => {
    cancelSignIn();
    navigate(-1);
  }, [cancelSignIn, navigate]);

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
        xs={4}
        item
      >
        <Button
          className="back"
          variant="contained"
          onClick={handleBack}
        >
          <ChevronLeftOutlined /> {t('sign_in.back')}
        </Button>
        <Typography
          variant="h4"
          gutterBottom
        >
          {t('sign_in.content.title')}
        </Typography>
        <Typography variant="body1">{t('sign_in.content.body', { br: () => <br /> })}</Typography>
      </Grid>
    </Grid>
  );
}
