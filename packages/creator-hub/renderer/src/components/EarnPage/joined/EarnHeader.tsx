import { useState } from 'react';
import { MenuItem } from 'decentraland-ui2';

import { misc } from '#preload';
import { useSelector } from '#store';
import { CONTACT_SUPPORT_URL } from '/@/modules/utils';
import { t } from '/@/modules/store/translation/utils';

import { KebabIcon, SupportIcon, TermsIcon } from '../icons';
import { TermsModal } from '../TermsModal';

import { formatDate } from './format';
import {
  Beta,
  Header,
  JoinedLine,
  Kebab,
  KebabMenu,
  Title,
  TitleColumn,
  TitleDot,
  TitleRow,
} from './EarnHeader.styled';

/** The More options (⋮) button and menu: the terms, read-only, and Contact Support. */
export function EarnMenu() {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [readingTerms, setReadingTerms] = useState(false);

  return (
    <>
      <Kebab
        aria-label={t('earn.joined.more_options')}
        aria-haspopup="menu"
        aria-expanded={anchor ? 'true' : 'false'}
        onClick={event => setAnchor(event.currentTarget)}
      >
        <KebabIcon />
      </Kebab>
      <KebabMenu
        anchorEl={anchor}
        open={!!anchor}
        onClose={() => setAnchor(null)}
        disableScrollLock
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem
          onClick={() => {
            setAnchor(null);
            setReadingTerms(true);
          }}
        >
          <TermsIcon />
          {t('earn.joined.read_terms')}
        </MenuItem>
        <MenuItem
          onClick={() => {
            setAnchor(null);
            void misc.openExternal(CONTACT_SUPPORT_URL);
          }}
        >
          <SupportIcon />
          {t('earn.joined.contact_support')}
        </MenuItem>
      </KebabMenu>
      {readingTerms && (
        <TermsModal
          variant="read"
          onClose={() => setReadingTerms(false)}
        />
      )}
    </>
  );
}

/** The joined page's title, BETA tag, joined date and More options menu. */
export function EarnHeader() {
  const locale = useSelector(state => state.translation.locale);
  const enrollment = useSelector(state => state.creatorFund.enrollment.data);

  return (
    <Header>
      <TitleColumn>
        <TitleRow>
          <Title>
            {t('earn.joined.title_prefix')}
            <TitleDot> · </TitleDot>
            {t('earn.joined.title')}
          </Title>
          <Beta
            size="small"
            label={t('earn.joined.beta')}
          />
        </TitleRow>
        {enrollment && (
          <JoinedLine>
            {t('earn.joined.joined_on', { date: formatDate(enrollment.enrolled_at, locale) })}
          </JoinedLine>
        )}
      </TitleColumn>
      <EarnMenu />
    </Header>
  );
}
