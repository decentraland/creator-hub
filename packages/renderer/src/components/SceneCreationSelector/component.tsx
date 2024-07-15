import { useCallback } from 'react';

import { t } from '/@/modules/store/reducers/translation/utils';
import { SceneCard } from '/@/components/SceneCard';

import type { Props } from './types';

import videoSrc from '../../../assets/videos/scratch-preview.mov';
import imgSrc from '../../../assets/images/scratch-preview-img.webp';

import './styles.css';

export function SceneCreationSelector({ onOpenModal }: Props) {
  const handleOpenCreateFromScratchModal = useCallback(() => {
    onOpenModal('CustomLayoutModal');
  }, [onOpenModal]);

  return (
    <div className="SceneCreationSelector container">
      <SceneCard
        onClick={handleOpenCreateFromScratchModal}
        title={t('scene_list.no_scenes.from_scratch.title')}
        videoSrc={videoSrc}
        imgSrc={imgSrc}
        description={t('scene_list.no_scenes.from_scratch.description')}
      />
    </div>
  );
}
