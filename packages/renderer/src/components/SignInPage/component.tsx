import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Grid, Tooltip, Typography } from 'decentraland-ui2';
import { InfoOutlined, ChevronLeftOutlined } from '@mui/icons-material';
import { useAuth } from '/@/hooks/useAuth';

import './styles.css';

export function SignInPage() {
  const navigate = useNavigate();
  const { expirationTime, verificationCode } = useAuth();
  const updateExpirationIntervalRef = useRef<NodeJS.Timeout>();
  const [expirationCountdown, setExpirationCountdown] = useState({ minutes: '0', seconds: '00' });

  const handleBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  const calculateAndSetExpirationCountdown = useCallback(() => {
    const diff = new Date(expirationTime ?? 0).getTime() - Date.now();

    setExpirationCountdown({
      minutes: Math.floor(diff / 1000 / 60).toString(),
      seconds: Math.floor((diff / 1000) % 60)
        .toString()
        .padStart(2, '0'),
    });
  }, [expirationTime]);

  useEffect(() => {
    calculateAndSetExpirationCountdown();
    updateExpirationIntervalRef.current = setInterval(calculateAndSetExpirationCountdown, 1000);

    return () => {
      if (updateExpirationIntervalRef.current) {
        clearInterval(updateExpirationIntervalRef.current);
      }
    };
  }, [calculateAndSetExpirationCountdown]);

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
          <ChevronLeftOutlined /> BACK
        </Button>
        <Typography
          variant="h4"
          gutterBottom
        >
          Secure sign-in step
        </Typography>
        <Typography variant="body1">
          Remember the verification number below.
          <br />
          You'll be prompted to confirm it in your web browser to securely link your sign in.
        </Typography>
        <Box className="code">
          <Typography className="verificationCode">{verificationCode}</Typography>
          <div className="tooltip">
            <Tooltip
              placement="right"
              title="Keep this number private. It ensures that your sign-in is secure and unique to you."
            >
              <InfoOutlined />
            </Tooltip>
          </div>
        </Box>
        <Typography variant="body2">
          Verification number will expire in {expirationCountdown.minutes}:
          {expirationCountdown.seconds} minutes
        </Typography>
      </Grid>
    </Grid>
  );
}
