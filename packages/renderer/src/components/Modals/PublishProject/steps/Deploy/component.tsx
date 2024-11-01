import { Loader } from '/@/components/Loader';
import { useEditor } from '/@/hooks/useEditor';
import { type Props } from '../../types';
import './styles.css';
import { PublishModal } from '../../PublishModal';

export function Deploy(props: Props) {
  const { loadingPublish } = useEditor();
  return (
    <PublishModal {...props}>
      <div className="Deploy">{loadingPublish ? <Loader /> : 'Deploy'}</div>
    </PublishModal>
  );
}
