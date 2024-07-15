import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import ArrowBackIosIcon from '@mui/icons-material/ArrowBackIos';
import { useEditor } from '/@/modules/store/reducers/editor/hooks';
import './styles.css';
import { Button } from '../Button';

export function Editor() {
  const navigate = useNavigate();
  const { project } = useEditor();

  const handleBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  return (
    <div className="Editor">
      <div className="header">
        <div className="left">
          <div
            className="back"
            onClick={handleBack}
          >
            <ArrowBackIosIcon />
          </div>
          <div className="title">{project?.title}</div>
        </div>
        <div className="right">
          <div className="actions">
            <Button color="secondary">Code</Button>
            <Button color="secondary">Preview</Button>
            <Button color="primary">Publish</Button>
          </div>
        </div>
      </div>
      <iframe
        className="inspector"
        src="http://localhost:8734"
      ></iframe>
    </div>
  );
}
