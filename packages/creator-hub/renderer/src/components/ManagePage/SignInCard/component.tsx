import React from 'react';
import { Button, Card, CardContent, Typography } from 'decentraland-ui2';
import { t } from '/@/modules/store/translation/utils';
import './styles.css';

type Props = {
  title?: string;
  onClickSignIn: () => void;
};

const SignInCard: React.FC<Props> = ({ title, onClickSignIn }) => {
  return (
    <Card className="Card SignInCard">
      <CardContent className="CardContent CenteredContent">
        <Typography
          className="CardTitle"
          variant="h6"
        >
          {title ?? t('manage.sign_in.title')}
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
