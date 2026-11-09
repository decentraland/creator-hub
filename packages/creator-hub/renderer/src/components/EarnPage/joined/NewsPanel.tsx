import { useId } from 'react';

import type { NewsItem } from '/shared/types/creator-fund';

import { useSelector } from '#store';
import { t } from '/@/modules/store/translation/utils';

import { formatDate } from './format';
import { Entry, EntryBody, EntryDate, EntryTitle, Heading, Panel } from './NewsPanel.styled';

/** The latest Creator Fund news, plain text. */
export function NewsPanel({ items, className }: { items: NewsItem[]; className?: string }) {
  const headingId = useId();
  const locale = useSelector(state => state.translation.locale);
  return (
    <Panel
      aria-labelledby={headingId}
      className={className}
    >
      <Heading id={headingId}>{t('earn.joined.news.title')}</Heading>
      {items.map(item => (
        <Entry key={item.id}>
          <EntryDate dateTime={item.published_at}>
            {formatDate(item.published_at, locale)}
          </EntryDate>
          <EntryTitle>{item.title}</EntryTitle>
          <EntryBody>{item.body}</EntryBody>
        </Entry>
      ))}
    </Panel>
  );
}
