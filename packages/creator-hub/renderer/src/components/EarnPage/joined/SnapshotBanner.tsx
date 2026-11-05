import { t } from '/@/modules/store/translation/utils';

import MarkdownRenderer from '../../Modals/AppSettings/MarkdownRenderer/MarkdownRenderer';
import { openMarkdownLink } from '../markdownLinks';

import { Banner, BannerText } from './SnapshotBanner.styled';

/** Whether the leaderboard fetches and shows the banner; off for v0, whose API has no banner. */
export const SNAPSHOT_BANNER_ENABLED = false;

/** The global Creator Fund announcement: light markdown, links opened in the system browser. */
export function SnapshotBanner({ markdown }: { markdown: string }) {
  return (
    <Banner>
      <BannerText
        role="region"
        aria-label={t('earn.joined.banner.region')}
        onClick={openMarkdownLink}
      >
        <MarkdownRenderer content={markdown} />
      </BannerText>
    </Banner>
  );
}
