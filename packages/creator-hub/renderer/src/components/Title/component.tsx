import BackChevronIcon from '@mui/icons-material/ArrowBackIosNewRounded';

import { t } from '/@/modules/store/translation/utils';

import type { Props } from './types';
import { BackButton, Heading, Root } from './component.styled';

export function Title({ id, value, onBack }: Props) {
  return (
    <Root className="Title">
      {onBack && (
        <BackButton
          aria-label={t('title.back')}
          onClick={onBack}
        >
          <BackChevronIcon />
        </BackButton>
      )}
      <Heading
        id={id}
        variant="h3"
        component="h1"
      >
        {value}
      </Heading>
    </Root>
  );
}
