import { useCallback } from 'react';
import { Typography } from 'decentraland-ui2';
import { useDispatch } from '#store';
import { t } from '/@/modules/store/translation/utils';
import { actions } from '/@/modules/store/editor';
// tutorials is the single shared list rendered here and on the Learn page — update it there and both surfaces update
import { tutorials } from '/@/modules/tutorials';
import { Image } from '../Image';
import './styles.css';

export function Tutorial(props: { title: string; id: string; list?: string }) {
  const dispatch = useDispatch();
  const handleClick = useCallback(
    () => dispatch(actions.openTutorial(props)),
    [dispatch, props.id, props.list],
  );
  return (
    <div
      className="Tutorial"
      onClick={handleClick}
    >
      <div className="thumbnail-wrapper">
        <Image
          className="thumbnail"
          src={`https://img.youtube.com/vi/${props.id}/0.jpg`}
          alt={props.title}
        />
      </div>
      <div className="title">{props.title}</div>
    </div>
  );
}

export function Tutorials() {
  return (
    <div className="Tutorials">
      <Typography
        variant="h6"
        className="title"
      >
        <i className="icon"></i>
        {t('tutorials.title')}
      </Typography>
      <div className="list">
        {tutorials.map(video => (
          <Tutorial
            key={video.id}
            title={video.title}
            id={video.id}
            list={video.list}
          />
        ))}
      </div>
    </div>
  );
}

export function TutorialsWrapper(props: React.PropsWithChildren) {
  return (
    <div className="TutorialsWrapper">
      <div className="content">{props.children}</div>
      <Tutorials />
    </div>
  );
}
