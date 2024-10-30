import { Loader } from '/@/components/Loader';
import { useEditor } from '/@/hooks/useEditor';
import './styles.css';

export function Deploy() {
  const { loadingPublish } = useEditor();
  return <div className="Deploy">{loadingPublish ? <Loader /> : 'Deploy'}</div>;
}
