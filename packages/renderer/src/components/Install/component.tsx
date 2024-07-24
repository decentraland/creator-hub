import { useEffect } from 'react';
import { CircularProgress as Loader } from 'decentraland-ui2';
import { useEditor } from '/@/hooks/useEditor';
import './styles.css';
import { useNavigate } from 'react-router-dom';
import { t } from '/@/modules/store/translation/utils';

export function Install() {
  const { isInstalled, isInstalling } = useEditor();
  const navigate = useNavigate();

  useEffect(() => {
    if (isInstalled && !isInstalling) {
      navigate('/home');
    }
  }, [isInstalled, isInstalling]);

  return (
    <div className="Install">
      <div className="loading">
        <Loader />
        <div className="message">
          {t('install.message', { version: import.meta.env.VITE_APP_VERSION })}
        </div>
      </div>
    </div>
  );
}
