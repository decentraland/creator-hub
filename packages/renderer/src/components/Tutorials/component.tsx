import { t } from '/@/modules/store/translation/utils';
import './styles.css';
import { useDispatch } from '#store';
import { useCallback } from 'react';
import { actions } from '/@/modules/store/editor';

/* TODO: if we wanted to fetch this playlist from YouTube, we could use the their API:

https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId={PLAYLIST_ID}&key={API_KEY}

It would require creating a project in the Google Developer Console and enabling the YouTube Data API v3.
*/

const PLAYLIST_ID = 'PLAcRraQmr_GP_K8WN7csnKnImK4R2TgMA';

const playlist = [
  {
    title: 'Smart Items - Basics',
    id: 'fblj_FxUvM4',
  },
  {
    title: 'Smart Items - Interactions between items',
    id: 'Nbdo_oE80QU',
  },
  {
    title: 'Smart Items - Making any item smart',
    id: 'qXjQxMC97H0',
  },
  {
    title: 'Decentraland scenes in SDK7 with only drag and drop',
    id: '7wEJyAi0Qx0',
  },
  {
    title: 'Combine drag & drop + Code to create Decentraland scenes in SDK 7',
    id: 'J_EO1LZkaiA',
  },
  {
    title: 'Decentraland SDK 7 scene with drag & drop + Utils library',
    id: 'bhfMU-Ydpvg',
  },
];

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
        <img
          className="thumbnail"
          src={`https://img.youtube.com/vi/${props.id}/0.jpg`}
        />
      </div>
      <div className="title">{props.title}</div>
    </div>
  );
}

export function Tutorials() {
  return (
    <div className="Tutorials">
      <div className="title">
        <i className="icon"></i>
        {t('tutorials.title')}
      </div>
      <div className="list">
        {playlist.map(video => (
          <Tutorial
            key={video.id}
            title={video.title}
            id={video.id}
            list={PLAYLIST_ID}
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
