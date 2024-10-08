import { useNavigate } from 'react-router-dom';
import { t } from '/@/modules/store/translation/utils';
import { misc } from '#preload';

import { Container } from '../Container';
import { Navbar, NavbarItem } from '../Navbar';
import './styles.css';
import { Title } from '../Title';

function Playlist(props: { list: string; videos: { id: string; title: string }[]; title: string }) {
  return (
    <div className="playlist">
      <div className="header">
        <i className="icon"></i>
        <span className="title">{props.title}</span>
      </div>
      <div className="content">
        {props.videos.map((video, index) => (
          <Video
            key={index}
            list={props.list}
            id={video.id}
            title={video.title}
          />
        ))}
      </div>
    </div>
  );
}

function Video(props: { id: string; list: string; title: string }) {
  const url = `https://youtu.be/${props.id}?list=${props.list}`;
  return (
    <div
      className="video"
      onClick={() => misc.openExternal(url)}
      title={props.title}
    >
      <img
        className="thumbnail"
        src={`https://img.youtube.com/vi/${props.id}/0.jpg`}
      />
      <span className="title">{props.title}</span>
    </div>
  );
}

export function VideosPage() {
  const navigate = useNavigate();

  return (
    <main className="VideosPage">
      <Navbar active={NavbarItem.LEARN} />
      <Container>
        <Title
          value={t('learn.videos.title')}
          onBack={() => navigate('/learn')}
        />
        <div className="playlists">
          <Playlist
            title="Product Updates"
            list="PLAcRraQmr_GMJw77zKvN84LX_OLyn-lVz"
            videos={[
              { id: 'nWiyoX70vtc', title: 'New Decentralans Builder Templates' },
              { id: 'biJ6UDo7D6Q', title: 'Update: Saved Outfits' },
              { id: 'qdS2KuXH0-k', title: 'Decentraland Profile Updates' },
              { id: 'l0D1LTo-0_o', title: 'Introducing DCL Camera' },
              { id: '08Q0qcWmAwM', title: 'Decentraland Emotes 2.0' },
            ]}
          />
          <Playlist
            title="SDK7 Tutorials"
            list="PLAcRraQmr_GP_K8WN7csnKnImK4R2TgMA"
            videos={[
              { id: 'fblj_FxUvM4', title: 'Smart Items - Basics' },
              { id: 'Nbdo_oE80QU', title: 'Smart Items - Interactions' },
              { id: 'hXSiPO81KJA', title: 'Smart Items - State and Conditions' },
              { id: 'qXjQxMC97H0', title: 'Smart Items - Making any item smart' },
              { id: '7wEJyAi0Qx0', title: 'Decentraland scenes in SDK7 with only drag & drop' },
              {
                id: 'J_EO1LZkaiA',
                title: 'Combine drag & drop + Code to create Decentraland scenes',
              },
              {
                id: 'bhfMU-Ydpvg',
                title: 'Decentraland SDK 7 scene with drag & drop + Utils library',
              },
            ]}
          />
          <Playlist
            title="Emote Tutorials"
            list="PLAcRraQmr_GN8LcnnQk2BByo9L2Orvp9c"
            videos={[
              { id: '-iWslh4uQIk', title: 'Decentraland Tutorial - Animation tips for emotes' },
              { id: 'B3Oqgg25kBY', title: 'Decentraland Tutorial - Creating an emote' },
              { id: 'EJ_z0Hs-QC8', title: 'Decentraland Tutorial - Rig Overview' },
              { id: '5PEF2pwZxtY', title: 'Emote Workshop by Isa' },
            ]}
          />
          <Playlist
            title="Editor (No Code) Tutorials"
            list="PLAcRraQmr_GOJiVO5ZtZ86hef4unLsEkf"
            videos={[
              { id: 'PF7smSBxVOc', title: 'Creating a Simple Scene in Decentraland' },
              { id: '510kDzz1mjo', title: 'Add Simple Interactions to a Scene' },
              { id: '4wiYYX-_Hek', title: 'Add Advanced Interactions to a Scene' },
            ]}
          />
        </div>
      </Container>
    </main>
  );
}
