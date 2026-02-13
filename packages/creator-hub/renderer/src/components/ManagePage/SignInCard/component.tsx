import React from 'react';
import { Button, Card, CardContent, Typography } from 'decentraland-ui2';
import { t } from '/@/modules/store/translation/utils';
import './styles.css';

type Props = {
  onClickSignIn: () => void;
};

const SignInCard: React.FC<Props> = ({ onClickSignIn }) => {
  return (
    <Card className="Card SignInCard">
      <CardContent className="CardContent CenteredContent">
        <Typography
          className="CardTitle"
          variant="h6"
        >
          {t('manage.sign_in.title')}
        </Typography>
        <Button
          className="SignInButton"
          variant="contained"
          onClick={onClickSignIn}
        >
          {t('manage.sign_in.action')}
        </Button>
      </CardContent>
    </Card>
  );
};

export { SignInCard };
