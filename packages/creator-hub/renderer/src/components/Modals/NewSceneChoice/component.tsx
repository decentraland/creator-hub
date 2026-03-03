import { useCallback, useRef } from 'react';
import { Box, Typography } from 'decentraland-ui2';

import { t } from '/@/modules/store/translation/utils';

import { Modal } from '..';

import type { Props } from './types';

import scratchPreviewUrl from '/assets/videos/scratch-preview.mov';
import templatePreviewUrl from '/assets/videos/template-preview.mp4';

import './styles.css';

export function NewSceneChoice({ open, onClose, onStartFromScratch, onUseTemplates }: Props) {
  const handleScratch = useCallback(() => {
    onClose();
    onStartFromScratch();
  }, [onClose, onStartFromScratch]);

  const handleTemplates = useCallback(() => {
    onClose();
    onUseTemplates();
  }, [onClose, onUseTemplates]);

  const scratchVideoRef = useRef<HTMLVideoElement>(null);
  const templateVideoRef = useRef<HTMLVideoElement>(null);

  const handleScratchMouseEnter = useCallback(() => {
    scratchVideoRef.current?.play().catch(() => {});
  }, []);
  const handleScratchMouseLeave = useCallback(() => {
    scratchVideoRef.current?.pause();
  }, []);
  const handleTemplatesMouseEnter = useCallback(() => {
    templateVideoRef.current?.play().catch(() => {});
  }, []);
  const handleTemplatesMouseLeave = useCallback(() => {
    templateVideoRef.current?.pause();
  }, []);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('modal.new_scene_choice.title')}
      size="medium"
      className="NewSceneChoiceModal"
    >
      <Box className="NewSceneChoiceOptions">
        <button
          type="button"
          className="NewSceneChoiceOption"
          onClick={handleScratch}
          onMouseEnter={handleScratchMouseEnter}
          onMouseLeave={handleScratchMouseLeave}
        >
          <div className="NewSceneChoiceOptionPreview">
            <video
              ref={scratchVideoRef}
              src={scratchPreviewUrl}
              muted
              loop
              playsInline
              preload="metadata"
              aria-hidden
            />
          </div>
          <Typography
            variant="subtitle1"
            className="NewSceneChoiceOptionLabel"
          >
            {t('modal.new_scene_choice.start_from_scratch')}
          </Typography>
          <Typography
            variant="body2"
            className="NewSceneChoiceOptionDescription"
          >
            {t('modal.new_scene_choice.start_from_scratch_description')}
          </Typography>
        </button>

        <button
          type="button"
          className="NewSceneChoiceOption"
          onClick={handleTemplates}
          onMouseEnter={handleTemplatesMouseEnter}
          onMouseLeave={handleTemplatesMouseLeave}
        >
          <div className="NewSceneChoiceOptionPreview">
            <video
              ref={templateVideoRef}
              src={templatePreviewUrl}
              muted
              loop
              playsInline
              preload="metadata"
              aria-hidden
            />
          </div>
          <Typography
            variant="subtitle1"
            className="NewSceneChoiceOptionLabel"
          >
            {t('modal.new_scene_choice.use_templates')}
          </Typography>
          <Typography
            variant="body2"
            className="NewSceneChoiceOptionDescription"
          >
            {t('modal.new_scene_choice.use_templates_description')}
          </Typography>
        </button>
      </Box>
    </Modal>
  );
}
