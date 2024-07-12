import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEditor } from '/@/modules/store/reducers/editor/hooks';
import './styles.css';

export function Editor() {
  const navigate = useNavigate();
  const { project } = useEditor();

  const handleBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  return (
    <div className="Editor">
      <div className="header">
        <div
          className="back"
          onClick={handleBack}
        />
        <div className="title">{project?.title}</div>
      </div>
      <iframe
        className="inspector"
        src="http://localhost:8734"
      ></iframe>
    </div>
  );
}
