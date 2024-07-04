import { useCallback } from 'react';

import { t } from '../../dapps-v2/translation/utils';
import { SceneCard } from '../SceneCard';

import type { Props } from './types';

import './styles.css';

import videoSrc from '../../../assets/videos/scratch-preview.mov';
import imgSrc from '../../../assets/images/scratch-preview-img.webp';

export function SceneCreationSelector({ onOpenModal }: Props) {
  const handleOpenCreateFromScratchModal = useCallback(() => {
    onOpenModal('CustomLayoutModal');
  }, [onOpenModal]);

  return (
    <div className="SceneCreationSelector container">
      <SceneCard
        onClick={handleOpenCreateFromScratchModal}
        title={t('scenes_page.no_scenes.from_scratch.title')}
        videoSrc={videoSrc}
        imgSrc={imgSrc}
        description={t('scenes_page.no_scenes.from_scratch.description')}
      />
    </div>
  );
}
