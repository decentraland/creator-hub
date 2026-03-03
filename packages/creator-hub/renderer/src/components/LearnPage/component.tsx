import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Typography, Button } from 'decentraland-ui2';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RocketLaunchOutlinedIcon from '@mui/icons-material/RocketLaunchOutlined';
import CodeOutlinedIcon from '@mui/icons-material/CodeOutlined';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import ViewInArOutlinedIcon from '@mui/icons-material/ViewInArOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import ExtensionOutlinedIcon from '@mui/icons-material/ExtensionOutlined';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined';
import AnimationOutlinedIcon from '@mui/icons-material/Animation';
import CheckroomOutlinedIcon from '@mui/icons-material/CheckroomOutlined';
import DesignServicesOutlinedIcon from '@mui/icons-material/DesignServicesOutlined';
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined';
import EmojiEmotionsOutlinedIcon from '@mui/icons-material/EmojiEmotionsOutlined';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import CollectionsBookmarkOutlinedIcon from '@mui/icons-material/CollectionsBookmarkOutlined';
import { t } from '/@/modules/store/translation/utils';
import type { TranslationPath } from '/@/modules/store/translation/types';
import { misc } from '#preload';
import { getLatestBlogPosts } from '/@/modules/blog';
import type { BlogPost as ApiBlogPost } from '/@/modules/blog';
import { getPlaylistSection } from '/@/modules/youtube';
import type { PlaylistSection } from '/@/modules/youtube';
import { Image } from '../Image';
import { PageSearchField } from '../PageSearchField';
import { PaginationBar } from '../Pagination/component';

import './styles.css';

// ─── Tabs ────────────────────────────────────────────────────────────────────

type TabId = 'creator_hub' | 'creator_academy' | 'community_all_hands' | 'docs' | 'news';

const TABS: { id: TabId; labelKey: string }[] = [
  { id: 'creator_hub', labelKey: 'learn.tabs.creator_hub' },
  { id: 'creator_academy', labelKey: 'learn.tabs.creator_academy' },
  { id: 'community_all_hands', labelKey: 'learn.tabs.community_all_hands' },
  { id: 'docs', labelKey: 'learn.tabs.docs' },
  { id: 'news', labelKey: 'learn.tabs.news' },
];

// ─── Video types & helpers ───────────────────────────────────────────────────

type VideoItem = {
  id: string;
  list: string;
  title: string;
  description?: string;
};

type FeaturedVideoItem = VideoItem & {
  readMoreUrl?: string;
};

const TITLE_PREFIXES_TO_STRIP = ['DCL Creator Hub: ', 'DCL Creator Hub:'];

function cleanTitle(title: string): string {
  for (const prefix of TITLE_PREFIXES_TO_STRIP) {
    if (title.startsWith(prefix)) return title.slice(prefix.length);
  }
  return title;
}

function sectionToVideos(section: PlaylistSection | null): VideoItem[] {
  if (!section?.videos?.length) return [];
  return section.videos.map(v => ({
    id: v.id,
    list: section.playlistId,
    title: v.title,
    ...(v.description ? { description: v.description } : {}),
  }));
}

// ─── Static playlist data (embedded at build time) ──────────────────────────

const creatorHubSection = getPlaylistSection('creatorHub');
const academyBeginnersSection = getPlaylistSection('academyBeginners');
const academyBlenderSection = getPlaylistSection('academyBlender');
const communityAllHandsSection = getPlaylistSection('communityAllHands');

const CREATOR_HUB_VIDEOS: VideoItem[] = sectionToVideos(creatorHubSection).map(v => ({
  ...v,
  title: cleanTitle(v.title),
}));

const ACADEMY_VIDEOS: VideoItem[] = [
  ...sectionToVideos(academyBeginnersSection),
  ...sectionToVideos(academyBlenderSection),
];

const ALL_HANDS_VIDEOS: VideoItem[] = sectionToVideos(communityAllHandsSection);

// ─── Featured items ─────────────────────────────────────────────────────────

const CREATOR_HUB_FEATURED: FeaturedVideoItem = {
  id: '52LiG-4VI9c',
  list: creatorHubSection?.playlistId ?? 'PLAcRraQmr_GPrMmQekqbMWhyBxo3lXs8p',
  title: 'Introducing Templates',
  description:
    'Prebuilt templates are now available in the builder.\n\nCreating your own space has never been easier!\nPick out a template.\nCustomize it to your style.',
  readMoreUrl: 'https://docs.decentraland.org/creator/scene-editor/get-started/about-editor',
};

function getLatestVideo(videos: VideoItem[]): VideoItem | null {
  return videos.length > 0 ? videos[videos.length - 1]! : null;
}

// ─── Docs (merged with Wearables & Emotes) ──────────────────────────────────

type DocLink = {
  title: string;
  description: string;
  url: string;
  category: string;
  icon: React.ReactNode;
};

const DOCS: DocLink[] = [
  {
    category: 'Getting Started',
    title: 'Build the Metaverse',
    description: 'Start creating in Decentraland',
    icon: <RocketLaunchOutlinedIcon />,
    url: 'https://docs.decentraland.org/creator/',
  },
  {
    category: 'Getting Started',
    title: 'About SDK',
    description: 'Learn SDK fundamentals',
    icon: <CodeOutlinedIcon />,
    url: 'https://docs.decentraland.org/creator/scenes-sdk7/getting-started/sdk-101',
  },
  {
    category: 'Getting Started',
    title: 'Dev Workflow',
    description: 'Development best practices',
    icon: <AccountTreeOutlinedIcon />,
    url: 'https://docs.decentraland.org/creator/scenes-sdk7/getting-started/dev-workflow',
  },
  {
    category: 'SDK',
    title: 'Entities & Components',
    description: 'Core building blocks',
    icon: <ViewInArOutlinedIcon />,
    url: 'https://docs.decentraland.org/creator/scenes-sdk7/architecture/entities-components',
  },
  {
    category: 'SDK',
    title: 'Systems',
    description: 'Game logic architecture',
    icon: <SettingsOutlinedIcon />,
    url: 'https://docs.decentraland.org/creator/scenes-sdk7/architecture/systems',
  },
  {
    category: 'SDK',
    title: 'Custom Components',
    description: 'Extend with your own code',
    icon: <ExtensionOutlinedIcon />,
    url: 'https://docs.decentraland.org/creator/scenes-sdk7/architecture/custom-components',
  },
  {
    category: '3D Modeling',
    title: '3D Model Essentials',
    description: 'Prepare models for import',
    icon: <CategoryOutlinedIcon />,
    url: 'https://docs.decentraland.org/creator/3d-modeling/3d-models/',
  },
  {
    category: '3D Modeling',
    title: 'Materials',
    description: 'Textures and shading',
    icon: <PaletteOutlinedIcon />,
    url: 'https://docs.decentraland.org/creator/3d-modeling/materials/',
  },
  {
    category: '3D Modeling',
    title: 'Animations',
    description: 'Bring models to life',
    icon: <AnimationOutlinedIcon />,
    url: 'https://docs.decentraland.org/creator/3d-modeling/animations/',
  },
  {
    category: 'Wearables',
    title: 'Wearable Overview',
    description: 'Introduction to wearables',
    icon: <CheckroomOutlinedIcon />,
    url: 'https://docs.decentraland.org/creator/wearables/wearables-overview/',
  },
  {
    category: 'Wearables',
    title: 'Creating Wearables',
    description: 'Design and export wearables',
    icon: <DesignServicesOutlinedIcon />,
    url: 'https://docs.decentraland.org/creator/wearables/creating-wearables/',
  },
  {
    category: 'Wearables',
    title: 'Linked Wearables',
    description: 'Connect NFTs to wearables',
    icon: <LinkOutlinedIcon />,
    url: 'https://docs.decentraland.org/creator/wearables/linked-wearables/',
  },
  {
    category: 'Emotes',
    title: 'Emotes Overview',
    description: 'Introduction to emotes',
    icon: <EmojiEmotionsOutlinedIcon />,
    url: 'https://docs.decentraland.org/creator/emotes/emotes-overview/',
  },
  {
    category: 'Emotes',
    title: 'Creating Emotes',
    description: 'Animate and export emotes',
    icon: <AnimationOutlinedIcon />,
    url: 'https://docs.decentraland.org/creator/emotes/creating-and-exporting-emotes/',
  },
  {
    category: 'Emotes',
    title: 'Avatar Rig',
    description: 'Avatar skeleton reference',
    icon: <PersonOutlinedIcon />,
    url: 'https://docs.decentraland.org/creator/emotes/avatar-rig/',
  },
  {
    category: 'Collections',
    title: 'Creating a Collection',
    description: 'Publish to the marketplace',
    icon: <CollectionsBookmarkOutlinedIcon />,
    url: 'https://docs.decentraland.org/creator/wearables-and-emotes/manage-collections/creating-collection/',
  },
];

// ─── Blog types ──────────────────────────────────────────────────────────────

type BlogPost = {
  title: string;
  description: string;
  badge: string;
  date: string;
  url: string;
  image: string;
};

const FALLBACK_BLOG_POSTS: BlogPost[] = [
  {
    title: 'What Virtual Spaces Can Learn From The Uncanny Valley',
    description: 'Exploring the balance between realism and stylization in virtual worlds.',
    badge: 'About Decentraland',
    date: 'Feb 17, 2026',
    url: 'https://decentraland.org/blog/about-decentraland/what-virtual-spaces-can-learn-from-the-uncanny-valley',
    image: 'https://decentraland.org/images/decentraland-og.png',
  },
  {
    title: 'Live, Fast, and Social — A Weekly Quiz Game With Friends',
    description: 'Trivia Thursdays brings a weekly quiz game to Decentraland.',
    badge: 'Announcements',
    date: 'Feb 12, 2026',
    url: 'https://decentraland.org/blog/announcements/trivia-thursdays-quiz-game',
    image: 'https://decentraland.org/images/decentraland-og.png',
  },
  {
    title: 'Introducing the Decentraland Store',
    description: 'Offline gear for online people — official merch is here.',
    badge: 'Announcements',
    date: 'Feb 04, 2026',
    url: 'https://decentraland.org/blog/announcements/introducing-the-decentraland-store',
    image: 'https://decentraland.org/images/decentraland-og.png',
  },
  {
    title: '2025 Manifesto: Igniting the Community-Driven Flywheel',
    description: "Decentraland's vision and direction for the future of the platform.",
    badge: 'Announcements',
    date: 'Jan 15, 2026',
    url: 'https://decentraland.org/blog/announcements/decentraland-2025-manifesto-igniting-the-community-driven-flywheel',
    image: 'https://decentraland.org/images/decentraland-og.png',
  },
  {
    title: 'Introducing Communities in Decentraland',
    description: 'Expanding social and organizational capabilities within the platform.',
    badge: 'Announcements',
    date: 'Jan 08, 2026',
    url: 'https://decentraland.org/blog/announcements/introducing-communities-in-decentraland',
    image: 'https://decentraland.org/images/decentraland-og.png',
  },
  {
    title: 'Smart Wearables and Portable Experiences',
    description: 'Create more interactive and transferable digital items in Decentraland.',
    badge: 'Announcements',
    date: 'Dec 20, 2025',
    url: 'https://decentraland.org/blog/announcements/smart-wearables-and-portable-experiences',
    image: 'https://decentraland.org/images/decentraland-og.png',
  },
];

const FEATURED_POST: BlogPost = {
  title: 'Mobile: The Next Chapter for Decentraland',
  description:
    'Decentraland is going mobile in 2026 with a social-first app, improved performance, and a roadmap toward feature-complete iOS and Android releases.',
  badge: 'Announcements',
  date: 'Feb 17, 2026',
  url: 'https://decentraland.org/blog/announcements/mobile-the-next-chapter-for-decentraland',
  image: 'https://decentraland.org/images/decentraland-og.png',
};

// ─── Shared components ───────────────────────────────────────────────────────

function VideoCard({ video }: { video: VideoItem }) {
  const handleClick = useCallback(() => {
    misc.openExternal(`https://youtu.be/${video.id}?list=${video.list}`);
  }, [video.id, video.list]);

  return (
    <div
      className="LearnVideoCard"
      onClick={handleClick}
    >
      <div className="LearnVideoThumb">
        <Image
          src={`https://img.youtube.com/vi/${video.id}/hqdefault.jpg`}
          alt={video.title}
        />
      </div>
      <div className="LearnVideoBody">
        <Typography
          variant="body2"
          className="LearnVideoTitle"
        >
          {video.title}
        </Typography>
        {video.description && (
          <Typography
            variant="caption"
            className="LearnVideoDesc"
          >
            {video.description}
          </Typography>
        )}
      </div>
    </div>
  );
}

function FeaturedVideo({
  video,
  description,
  readMoreUrl,
}: {
  video: FeaturedVideoItem;
  description?: string;
  readMoreUrl?: string;
}) {
  const handlePlay = useCallback(() => {
    misc.openExternal(`https://youtu.be/${video.id}?list=${video.list}`);
  }, [video.id, video.list]);

  const handleReadMore = useCallback(() => {
    if (readMoreUrl) misc.openExternal(readMoreUrl);
  }, [readMoreUrl]);

  return (
    <div className="LearnFeatured">
      <div
        className="LearnFeaturedMedia"
        onClick={handlePlay}
      >
        <Image
          src={`https://img.youtube.com/vi/${video.id}/maxresdefault.jpg`}
          alt={video.title}
        />
      </div>
      <div className="LearnFeaturedInfo">
        <Typography
          variant="h5"
          fontWeight={700}
        >
          {video.title}
        </Typography>
        {description && (
          <Typography
            variant="body2"
            className="LearnFeaturedDesc"
          >
            {description.split('\n').map((line, i) => (
              <span key={i}>
                {line}
                <br />
              </span>
            ))}
          </Typography>
        )}
        {readMoreUrl && (
          <button
            className="LearnReadMore"
            onClick={handleReadMore}
          >
            Read More
          </button>
        )}
      </div>
    </div>
  );
}

function DocCard({ doc }: { doc: DocLink }) {
  const handleClick = useCallback(() => misc.openExternal(doc.url), [doc.url]);

  return (
    <div
      className="LearnDocCard"
      onClick={handleClick}
    >
      <span className="LearnDocCardIcon">{doc.icon}</span>
      <Typography
        variant="body1"
        className="LearnDocCardTitle"
      >
        {doc.title}
      </Typography>
      <Typography
        variant="body2"
        className="LearnDocCardDesc"
      >
        {doc.description}
      </Typography>
    </div>
  );
}

function FeaturedBlogPost({ post }: { post: BlogPost }) {
  const handleClick = useCallback(() => misc.openExternal(post.url), [post.url]);

  return (
    <div
      className="LearnFeatured LearnFeatured--blog"
      onClick={handleClick}
      style={{ cursor: 'pointer' }}
    >
      <div className="LearnFeaturedMedia">
        <BlogThumbnail
          src={post.image}
          alt={post.title}
        />
      </div>
      <div className="LearnFeaturedInfo">
        <Typography
          variant="caption"
          className="LearnFeaturedMeta"
        >
          {post.date} &nbsp;&middot;&nbsp; {post.badge}
        </Typography>
        <Typography
          variant="h5"
          fontWeight={700}
        >
          {post.title}
        </Typography>
        <Typography
          variant="body2"
          className="LearnFeaturedDesc"
        >
          {post.description}
        </Typography>
        <button
          className="LearnReadMore"
          onClick={handleClick}
        >
          Read More
        </button>
      </div>
    </div>
  );
}

function BlogCard({ post }: { post: BlogPost }) {
  const handleClick = useCallback(() => misc.openExternal(post.url), [post.url]);

  return (
    <div
      className="LearnVideoCard LearnVideoCard--blog"
      onClick={handleClick}
    >
      <div className="LearnVideoThumb">
        <BlogThumbnail
          src={post.image}
          alt={post.title}
        />
      </div>
      <div className="LearnVideoBody">
        <Typography
          variant="body2"
          className="LearnVideoTitle"
        >
          {post.title}
        </Typography>
        <Typography
          variant="caption"
          className="LearnVideoBadge"
        >
          {post.date} &nbsp;&middot;&nbsp; {post.badge}
        </Typography>
      </div>
    </div>
  );
}

function BlogThumbnail({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setError(false);
  }, [src]);

  const handleLoad = useCallback(() => setLoaded(true), []);
  const handleError = useCallback(() => setError(true), []);

  return (
    <div className="LearnBlogThumb">
      <div
        className="LearnSkeletonThumb"
        aria-hidden
      />
      {!error && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onLoad={handleLoad}
          onError={handleError}
          className={`LearnBlogThumb-img ${loaded ? 'LearnBlogThumb-img--loaded' : ''}`}
        />
      )}
    </div>
  );
}

function FeaturedBlogSkeleton() {
  return (
    <div
      className="LearnFeatured LearnFeatured--blog LearnFeatured--skeleton"
      aria-hidden
    >
      <div className="LearnFeaturedMedia LearnSkeletonThumb" />
      <div className="LearnFeaturedInfo">
        <div className="LearnSkeletonLine LearnSkeletonMeta" />
        <div className="LearnSkeletonLine LearnSkeletonTitle" />
        <div className="LearnSkeletonLine LearnSkeletonDesc" />
        <div className="LearnSkeletonLine LearnSkeletonCta" />
      </div>
    </div>
  );
}

function BlogCardSkeleton() {
  return (
    <div
      className="LearnVideoCard LearnVideoCard--blog LearnVideoCard--skeleton"
      aria-hidden
    >
      <div className="LearnVideoThumb LearnSkeletonThumb" />
      <div className="LearnVideoBody">
        <div className="LearnSkeletonLine LearnSkeletonCardTitle" />
        <div className="LearnSkeletonLine LearnSkeletonCardBadge" />
      </div>
    </div>
  );
}

// ─── Tab content ─────────────────────────────────────────────────────────────

const VIDEOS_PER_PAGE = 6;

function PaginatedVideoGrid({ videos }: { videos: VideoItem[] }) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(videos.length / VIDEOS_PER_PAGE));
  const visible = videos.slice(page * VIDEOS_PER_PAGE, (page + 1) * VIDEOS_PER_PAGE);

  return (
    <>
      <div className="LearnVideoGrid">
        {visible.map(video => (
          <VideoCard
            key={video.id}
            video={video}
          />
        ))}
      </div>
      <PaginationBar
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        className="LearnPaginationBar"
      />
    </>
  );
}

function CreatorHubTab() {
  return (
    <div className="LearnTabContent">
      <FeaturedVideo
        video={CREATOR_HUB_FEATURED}
        description={CREATOR_HUB_FEATURED.description}
        readMoreUrl={CREATOR_HUB_FEATURED.readMoreUrl}
      />
      <PaginatedVideoGrid videos={CREATOR_HUB_VIDEOS} />
    </div>
  );
}

function CreatorAcademyTab() {
  return (
    <div className="LearnTabContent">
      <PaginatedVideoGrid videos={ACADEMY_VIDEOS} />
    </div>
  );
}

function CommunityAllHandsTab() {
  const latest = getLatestVideo(ALL_HANDS_VIDEOS);
  const rest = ALL_HANDS_VIDEOS.slice(0, -1).reverse();

  return (
    <div className="LearnTabContent">
      {latest && (
        <FeaturedVideo
          video={latest}
          description={latest.description}
        />
      )}
      <PaginatedVideoGrid videos={rest} />
    </div>
  );
}

function DocsTab() {
  return (
    <div className="LearnTabContent">
      <div className="LearnDocGrid">
        {DOCS.map((doc, i) => (
          <DocCard
            key={i}
            doc={doc}
          />
        ))}
      </div>
    </div>
  );
}

function mapApiPostToCard(p: ApiBlogPost): BlogPost {
  return {
    title: p.title,
    description: p.description,
    badge: p.category.title,
    date: p.publishedDate,
    url: p.url,
    image: p.image.url,
  };
}

const BLOG_PAGE_SIZE = 7;

function NewsTab({
  blogPosts,
  blogTotal,
  blogPage,
  isLoading,
  onPageChange,
}: {
  blogPosts: BlogPost[];
  blogTotal: number;
  blogPage: number;
  isLoading: boolean;
  onPageChange: (page: number) => void;
}) {
  const featured = blogPosts.length > 0 ? blogPosts[0]! : FEATURED_POST;
  const list = blogPosts.length > 1 ? blogPosts.slice(1) : [];
  const totalPages = Math.max(1, Math.ceil(blogTotal / BLOG_PAGE_SIZE));
  const showSkeleton = isLoading && blogPosts.length === 0;

  if (showSkeleton) {
    return (
      <div className="LearnTabContent">
        <FeaturedBlogSkeleton />
        <div className="LearnVideoGrid">
          {Array.from({ length: 6 }, (_, i) => (
            <BlogCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="LearnTabContent">
      <FeaturedBlogPost post={featured} />
      <div className="LearnVideoGrid">
        {list.map((post, i) => (
          <BlogCard
            key={post.url || i}
            post={post}
          />
        ))}
      </div>
      <PaginationBar
        page={blogPage}
        totalPages={totalPages}
        onPageChange={onPageChange}
        className="LearnPaginationBar"
      />
    </div>
  );
}

// ─── Search ──────────────────────────────────────────────────────────────────

type SearchableItem =
  | { type: 'video'; data: VideoItem }
  | { type: 'doc'; data: DocLink }
  | { type: 'news'; data: BlogPost };

const TYPE_LABELS: Record<SearchableItem['type'], string> = {
  video: 'Videos',
  doc: 'Creator Docs',
  news: 'News',
};

function SearchResults({ query, blogPosts }: { query: string; blogPosts: BlogPost[] }) {
  const allItems: SearchableItem[] = useMemo(
    () => [
      ...[...CREATOR_HUB_VIDEOS, ...ACADEMY_VIDEOS, ...ALL_HANDS_VIDEOS].map(v => ({
        type: 'video' as const,
        data: v,
      })),
      ...DOCS.map(d => ({ type: 'doc' as const, data: d })),
      ...blogPosts.map(p => ({ type: 'news' as const, data: p })),
    ],
    [blogPosts],
  );

  const results = useMemo(() => {
    const q = query.toLowerCase();
    return allItems.filter(item => {
      const d = item.data;
      const searchable = [
        d.title,
        'description' in d ? d.description : '',
        'category' in d ? d.category : '',
      ]
        .join(' ')
        .toLowerCase();
      return searchable.includes(q);
    });
  }, [query, allItems]);

  const grouped = useMemo(() => {
    const groups: Partial<Record<SearchableItem['type'], SearchableItem[]>> = {};
    for (const item of results) {
      (groups[item.type] ??= []).push(item);
    }
    return groups;
  }, [results]);

  if (results.length === 0) {
    return (
      <div className="LearnSearchEmpty">
        <Typography
          variant="h6"
          sx={{ color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}
        >
          No results found for &ldquo;{query}&rdquo;
        </Typography>
        <Typography
          variant="body2"
          sx={{ color: 'rgba(255,255,255,0.3)', mt: 1 }}
        >
          Try different keywords or browse the tabs above
        </Typography>
      </div>
    );
  }

  return (
    <div className="LearnSearchResults">
      {(Object.entries(grouped) as [SearchableItem['type'], SearchableItem[]][]).map(
        ([type, items]) => (
          <div
            key={type}
            className="LearnSearchGroup"
          >
            <Typography
              variant="overline"
              className="LearnSearchGroupLabel"
            >
              {TYPE_LABELS[type]} ({items.length})
            </Typography>
            <div className={type === 'doc' ? 'LearnDocGrid' : 'LearnVideoGrid'}>
              {items.map((item, i) => {
                if (item.type === 'video')
                  return (
                    <VideoCard
                      key={i}
                      video={item.data}
                    />
                  );
                if (item.type === 'doc')
                  return (
                    <DocCard
                      key={i}
                      doc={item.data}
                    />
                  );
                if (item.type === 'news')
                  return (
                    <BlogCard
                      key={i}
                      post={item.data}
                    />
                  );
                return null;
              })}
            </div>
          </div>
        ),
      )}
    </div>
  );
}

// ─── Tabs bar with sliding indicator ─────────────────────────────────────────

function LearnTabsBar({
  activeTab,
  onTabChange,
}: {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [slider, setSlider] = useState<{ left: number; width: number } | null>(null);
  const isFirst = useRef(true);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const el = tabRefs.current[activeTab];
    if (!container || !el) {
      setSlider(null);
      return;
    }
    const cRect = container.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    setSlider({ left: eRect.left - cRect.left, width: eRect.width });
    isFirst.current = false;
  }, [activeTab]);

  return (
    <div
      className="LearnTabs"
      ref={containerRef}
    >
      {slider && (
        <span
          className="LearnTabSlider"
          style={{
            left: slider.left,
            width: slider.width,
            transition: isFirst.current ? 'none' : undefined,
          }}
        />
      )}
      {TABS.map(tab => (
        <button
          key={tab.id}
          ref={el => {
            tabRefs.current[tab.id] = el;
          }}
          className={`LearnTab ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onTabChange(tab.id)}
        >
          {t(tab.labelKey as TranslationPath)}
        </button>
      ))}
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export function LearnPage() {
  const [activeTab, setActiveTab] = useState<TabId>('creator_hub');
  const [searchQuery, setSearchQuery] = useState('');
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [blogTotal, setBlogTotal] = useState(0);
  const [blogPage, setBlogPage] = useState(0);
  const [blogLoading, setBlogLoading] = useState(false);

  useEffect(() => {
    if (activeTab !== 'news') return;
    let cancelled = false;
    setBlogLoading(true);
    getLatestBlogPosts({ skip: blogPage * BLOG_PAGE_SIZE, limit: BLOG_PAGE_SIZE })
      .then(({ posts, total }) => {
        if (!cancelled) {
          setBlogPosts(posts.map(mapApiPostToCard));
          setBlogTotal(total);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBlogPosts(blogPage === 0 ? FALLBACK_BLOG_POSTS : []);
          setBlogTotal(blogPage === 0 ? FALLBACK_BLOG_POSTS.length : 0);
        }
      })
      .finally(() => {
        if (!cancelled) setBlogLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, blogPage]);

  const isSearching = searchQuery.trim().length > 0;

  const displayBlogPosts = blogPosts.length > 0 ? blogPosts : FALLBACK_BLOG_POSTS;

  const handleVisitDocs = useCallback(() => {
    misc.openExternal('https://docs.decentraland.org/creator/');
  }, []);

  return (
    <div className="LearnPage">
      <div className="LearnHeader">
        <Typography variant="h3">{t('learn.header.title')}</Typography>
        <div className="LearnHeaderActions">
          <PageSearchField
            placeholder={t('learn.search_placeholder')}
            value={searchQuery}
            onChange={setSearchQuery}
          />
          <Button
            className="LearnDocsButton"
            variant="outlined"
            color="secondary"
            size="small"
            endIcon={<OpenInNewIcon fontSize="small" />}
            onClick={handleVisitDocs}
          >
            {t('learn.visit_docs')}
          </Button>
        </div>
      </div>

      {isSearching ? (
        <SearchResults
          query={searchQuery.trim()}
          blogPosts={displayBlogPosts}
        />
      ) : (
        <>
          <LearnTabsBar
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />

          {activeTab === 'creator_hub' && <CreatorHubTab />}
          {activeTab === 'creator_academy' && <CreatorAcademyTab />}
          {activeTab === 'community_all_hands' && <CommunityAllHandsTab />}
          {activeTab === 'docs' && <DocsTab />}
          {activeTab === 'news' && (
            <NewsTab
              blogPosts={displayBlogPosts}
              blogTotal={blogTotal}
              blogPage={blogPage}
              isLoading={blogLoading}
              onPageChange={setBlogPage}
            />
          )}
        </>
      )}
    </div>
  );
}
