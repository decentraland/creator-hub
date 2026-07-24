// eslint-disable-next-line @typescript-eslint/no-unused-vars -- ReactEcs is required for JSX factory
import ReactEcs, { Input, Label, UiEntity } from '@dcl/react-ecs';
import { Modal } from '../../Modal';
import { Button } from '../../Button';
import { getPresentationBotToken, startPresentation } from '../api';
import { COLORS, RADIUS, TYPE } from '../../theme';
import { getDclCastColors } from './styles';

const SharePresentationModal = ({
  onClose,
  streamingKey,
}: {
  onClose: () => void;
  streamingKey: string;
}) => {
  const colors = getDclCastColors();
  const [url, setUrl] = ReactEcs.useState('');
  const [isLoading, setIsLoading] = ReactEcs.useState(false);
  const [error, setError] = ReactEcs.useState('');

  const handleShare = async () => {
    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }

    setIsLoading(true);
    setError('');

    const [tokenError, tokenData] = await getPresentationBotToken(streamingKey);
    if (tokenError || !tokenData) {
      setError(tokenError ?? 'Failed to get presentation token');
      setIsLoading(false);
      return;
    }

    const [presentationError] = await startPresentation(url.trim(), tokenData.token, tokenData.url);
    if (presentationError) {
      setError(presentationError);
      setIsLoading(false);
      return;
    }

    setIsLoading(false);
    onClose();
  };

  return (
    <Modal
      id="share-presentation"
      title="Share Presentation"
      onClose={onClose}
      width={480}
    >
      <UiEntity
        uiTransform={{
          flexDirection: 'column',
          width: '100%',
          margin: { top: 16 },
        }}
      >
        <Label
          value="Paste a URL to a PDF or PPTX file"
          fontSize={TYPE.body}
          color={colors.lightGray}
          uiTransform={{ margin: { bottom: 8 } }}
        />
        <UiEntity
          uiTransform={{
            flexDirection: 'row',
            width: '100%',
            alignItems: 'center',
          }}
        >
          <Input
            onChange={value => {
              setError('');
              setUrl(value);
            }}
            value={url}
            fontSize={TYPE.body}
            placeholder="https://example.com/slides.pdf"
            placeholderColor={COLORS.inputPlaceholder}
            color={COLORS.inputText}
            uiBackground={{ color: COLORS.inputBackground }}
            uiTransform={{
              width: '100%',
              borderWidth: 1,
              borderRadius: RADIUS.sm,
              borderColor: error ? colors.danger : COLORS.inputBorder,
              height: 48,
            }}
          />
        </UiEntity>
        {!!error && (
          <Label
            value={error}
            fontSize={TYPE.caption}
            color={colors.danger}
            uiTransform={{ margin: { top: 8 } }}
          />
        )}
        <UiEntity
          uiTransform={{
            flexDirection: 'row',
            justifyContent: 'flex-end',
            width: '100%',
            margin: { top: 16 },
          }}
        >
          <Button
            id="share_presentation_cancel"
            value="<b>Cancel</b>"
            variant="secondary"
            fontSize={TYPE.button}
            color={colors.white}
            uiTransform={{
              height: 42,
              padding: { left: 16, right: 16 },
              margin: { right: 8 },
            }}
            onMouseDown={onClose}
          />
          <Button
            id="share_presentation_submit"
            value={isLoading ? '<b>Sharing...</b>' : '<b>Share</b>'}
            fontSize={TYPE.button}
            disabled={isLoading}
            uiTransform={{
              height: 42,
              padding: { left: 16, right: 16 },
            }}
            onMouseDown={handleShare}
          />
        </UiEntity>
      </UiEntity>
    </Modal>
  );
};

export default SharePresentationModal;
