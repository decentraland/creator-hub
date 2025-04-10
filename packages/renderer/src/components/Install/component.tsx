import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircularProgress as Loader, Typography } from 'decentraland-ui2';

import { t } from '/@/modules/store/translation/utils';

import { useEditor } from '/@/hooks/useEditor';

import MoveAppPng from '/assets/images/move-app.png';

import './styles.css';

export function Install() {
  const { version, isInstalled, isInstalling, error } = useEditor();
  const navigate = useNavigate();

  useEffect(() => {
    if (isInstalled && !isInstalling) {
      navigate('/home');
    }
  }, [isInstalled, isInstalling]);

  return (
    <div className="Install">
      {error ? (
        <Error error={error} />
      ) : (
        <div className="loading">
          <Loader />
          <div className="message">{t('install.message', { version })}</div>
        </div>
      )}
    </div>
  );
}

function Error({ error }: { error: Error | string }) {
  const errorNode = useMemo(() => {
    if (error instanceof Error) return error.message;
    if (error === 'MOVE_APP_FAILED') return <MoveAppFailed />;
    return t('install.errors.unknown');
  }, [error]);

  return <div className="error">{errorNode}</div>;
}

function MoveAppFailed() {
  return (
    <>
      <Typography variant="h5">{t('install.errors.moveAppFailed')}</Typography>
      <img src={MoveAppPng} />
    </>
  );
}
