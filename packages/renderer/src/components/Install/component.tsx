import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircularProgress as Loader } from 'decentraland-ui2';
import { useEditor } from '/@/hooks/useEditor';
import { t } from '/@/modules/store/translation/utils';
import './styles.css';

export function Install() {
  const { version, isInstalled, isInstalling } = useEditor();
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
        <div className="message">{t('install.message', { version })}</div>
      </div>
    </div>
  );
}
