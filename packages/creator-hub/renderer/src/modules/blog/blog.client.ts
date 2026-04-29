/**
 * Standalone blog client: fetches latest posts from Decentraland CMS,
 * resolves Contentful references (image, category, author), and returns typed models.
 */

import type { BlogAuthor, BlogCategory, BlogPost, ContentfulAsset } from './blog.types';

const DEFAULT_CMS_BASE = 'https://cms.decentraland.org/spaces/ea2ybdmmn1kv/environments/master';

// --- CMS response types ---
interface CMSLink {
  sys: { type: string; linkType: string; id: string };
}
interface CMSEntry {
  sys: { id: string; type?: string };
  fields?: Record<string, unknown>;
}
interface CMSListResponse {
  items: CMSEntry[];
  total: number;
}
interface ContentfulAssetEntry {
  sys: { id: string };
  fields?: {
    file?: {
      url?: string;
      contentType?: string;
      details?: { image?: { width?: number; height?: number } };
    };
  };
}

// --- In-memory caches (entry/asset by id) ---
const assetCache = new Map<string, CMSEntry>();
const assetPromises = new Map<string, Promise<CMSEntry | null>>();
const entryCache = new Map<string, CMSEntry>();
const entryPromises = new Map<string, Promise<CMSEntry | null>>();

function isAssetLink(value: unknown): value is CMSLink {
  const v = value as CMSLink;
  return v?.sys?.type === 'Link' && v.sys.linkType === 'Asset' && !!v.sys.id;
}

function isEntryLink(value: unknown): value is CMSLink {
  const v = value as CMSLink;
  return v?.sys?.type === 'Link' && v.sys.linkType === 'Entry' && !!v.sys.id;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

function formatUtcDate(iso?: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

function blogUrl(categorySlug: string, postSlug: string): string {
  return `https://decentraland.org/blog/${categorySlug}/${postSlug}`;
}

function authorUrl(slug: string): string {
  return `https://decentraland.org/blog/author/${slug}`;
}

// --- Fetch from CMS ---
function buildCmsUrl(
  baseUrl: string,
  endpoint: string,
  params?: Record<string, string | number>,
): string {
  const path = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  const base = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
  const url = new URL(path, base);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    });
  }
  return url.toString();
}

async function fetchFromCMS(
  baseUrl: string,
  endpoint: string,
  params?: Record<string, string | number>,
): Promise<unknown> {
  const url = buildCmsUrl(baseUrl, endpoint, params);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`CMS API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// --- Resolve asset by id (cached, with retry) ---
async function fetchAssetOnce(
  baseUrl: string,
  assetId: string,
  debug?: boolean,
): Promise<CMSEntry | null> {
  const url = buildCmsUrl(baseUrl, `assets/${assetId}`);
  try {
    const res = await fetch(url);
    if (debug) {
      console.warn('[Blog] Asset fetch', {
        assetId,
        url,
        status: res.status,
        statusText: res.statusText,
        ok: res.ok,
      });
      if (!res.ok) {
        const text = await res.text();
        console.warn('[Blog] Asset fetch error body (first 400 chars)', text.slice(0, 400));
      }
    }
    if (!res.ok) return null;
    const asset = (await res.json()) as CMSEntry;
    const fileUrl = getAssetFileUrl(asset);
    if (asset?.sys?.id && fileUrl) return asset;
    if (debug)
      console.warn('[Blog] Asset missing sys.id or file URL', {
        assetId,
        hasFields: !!asset?.fields,
        fileKeys: asset?.fields ? Object.keys((asset.fields as object) || {}) : [],
      });
  } catch (err) {
    if (debug) {
      console.warn('[Blog] Asset fetch exception', {
        assetId,
        url,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return null;
}

async function resolveAsset(
  baseUrl: string,
  assetId: string,
  debug?: boolean,
): Promise<CMSEntry | null> {
  if (assetCache.has(assetId)) return assetCache.get(assetId)!;
  if (assetPromises.has(assetId)) return assetPromises.get(assetId)!;

  const p = fetchAssetOnce(baseUrl, assetId, debug).then(async asset => {
    if (asset) {
      assetCache.set(assetId, asset);
      assetPromises.delete(assetId);
      return asset;
    }
    // Retry once after a short delay (helps with flaky or rate-limited requests)
    await new Promise(r => setTimeout(r, 150));
    const retried = await fetchAssetOnce(baseUrl, assetId, debug);
    if (retried) {
      assetCache.set(assetId, retried);
      assetPromises.delete(assetId);
      return retried;
    }
    assetPromises.delete(assetId);
    return null;
  });
  assetPromises.set(assetId, p);
  return p;
}

// --- Resolve entry by id (cached); resolves image if present ---
async function resolveEntry(
  baseUrl: string,
  entryId: string,
  debug?: boolean,
): Promise<CMSEntry | null> {
  if (entryCache.has(entryId)) return entryCache.get(entryId)!;
  if (entryPromises.has(entryId)) return entryPromises.get(entryId)!;

  const p = (fetchFromCMS(baseUrl, `entries/${entryId}`) as Promise<CMSEntry>)
    .then(async entry => {
      const fields = entry?.fields ?? {};
      if (fields.image && isAssetLink(fields.image)) {
        const resolved = await resolveAsset(baseUrl, (fields.image as CMSLink).sys.id, debug);
        if (resolved) fields.image = resolved;
      }
      entryCache.set(entryId, entry);
      entryPromises.delete(entryId);
      return entry;
    })
    .catch(err => {
      if (debug) console.warn('[Blog] Entry fetch failed', { entryId, error: String(err) });
      entryPromises.delete(entryId);
      return null;
    });
  entryPromises.set(entryId, p);
  return p;
}

// --- Extract file URL from asset (handles flat and locale-wrapped Contentful responses) ---
function getAssetFileUrl(asset: CMSEntry | null | undefined): string | null {
  if (!asset?.fields) return null;
  const fields = asset.fields as Record<string, unknown>;
  const file = fields.file as Record<string, unknown> | undefined;
  if (!file || typeof file !== 'object') return null;
  // Flat: file.url
  if (typeof file.url === 'string' && file.url) return file.url;
  // Locale-wrapped: file['en-US'].url or first locale with url
  const locale = (file['en-US'] ?? file['en']) as Record<string, unknown> | undefined;
  if (locale && typeof locale.url === 'string' && locale.url) return locale.url;
  for (const v of Object.values(file)) {
    if (v && typeof v === 'object' && typeof (v as Record<string, unknown>).url === 'string') {
      const u = (v as Record<string, unknown>).url as string;
      if (u) return u;
    }
  }
  return null;
}

// --- Mappers ---
function mapContentfulAsset(
  asset: ContentfulAssetEntry | null | undefined,
): ContentfulAsset | null {
  if (!asset?.sys?.id) return null;
  const url = getAssetFileUrl(asset as CMSEntry);
  if (!url) return null;
  const file = (
    asset.fields as {
      file?: { details?: { image?: { width?: number; height?: number } }; contentType?: string };
    }
  )?.file;
  return {
    id: asset.sys.id,
    url: url.startsWith('//') ? `https:${url}` : url,
    width: file?.details?.image?.width ?? 0,
    height: file?.details?.image?.height ?? 0,
    mimeType: file?.contentType ?? 'image/jpeg',
  };
}

const DEFAULT_IMAGE: ContentfulAsset = {
  id: 'default',
  url: 'https://decentraland.org/logos/png/color.png',
  width: 1200,
  height: 630,
  mimeType: 'image/png',
};

function mapBlogCategory(entry: CMSEntry | null | undefined): BlogCategory | null {
  if (!entry?.sys?.id || !entry?.fields) return null;
  const title = (entry.fields.title as string) ?? '';
  const slug = (entry.fields.id as string) ?? slugify(title) ?? entry.sys.id;
  const image = mapContentfulAsset(entry.fields.image as ContentfulAssetEntry);
  if (!image) return null;
  return {
    id: entry.sys.id,
    slug,
    title,
    description: (entry.fields.description as string) ?? '',
    image,
    isShownInMenu: (entry.fields.isShownInMenu as boolean) ?? true,
    url: '',
  };
}

function createDefaultCategory(id?: string): BlogCategory {
  return {
    id: id ?? 'uncategorized',
    slug: 'uncategorized',
    title: 'Uncategorized',
    description: '',
    image: DEFAULT_IMAGE,
    isShownInMenu: false,
    url: '',
  };
}

function mapBlogAuthor(entry: CMSEntry | null | undefined): BlogAuthor {
  if (!entry?.sys?.id || !entry?.fields) {
    return {
      id: 'unknown',
      slug: 'decentraland',
      title: 'Decentraland',
      description: '',
      image: DEFAULT_IMAGE,
      url: authorUrl('decentraland'),
    };
  }
  const title = (entry.fields.title as string) ?? 'Decentraland';
  const slug = (entry.fields.id as string) ?? slugify(title) ?? entry.sys.id;
  const image = mapContentfulAsset(entry.fields.image as ContentfulAssetEntry) ?? DEFAULT_IMAGE;
  return {
    id: entry.sys.id,
    slug,
    title,
    description: (entry.fields.description as string) ?? '',
    image,
    url: authorUrl(slug),
  };
}

function mapBlogPost(
  entry: CMSEntry,
  category: BlogCategory,
  author: BlogAuthor,
  image: ContentfulAsset,
): BlogPost | null {
  const fields = entry?.fields ?? {};
  const title = (fields.title as string) ?? '';
  const slug = (fields.id as string) ?? (fields.slug as string) ?? slugify(title);
  if (!slug) return null;
  return {
    id: entry.sys.id,
    slug,
    title,
    description: (fields.description as string) ?? '',
    publishedDate: formatUtcDate(fields.publishedDate as string),
    body: fields.body ?? {},
    bodyAssets: {},
    image,
    category,
    author,
    url: blogUrl(category.slug, slug),
  };
}

// --- Resolve post entry: category, author, image ---
async function resolvePostReferences(
  baseUrl: string,
  item: CMSEntry,
  debug?: boolean,
): Promise<{
  category: BlogCategory;
  author: BlogAuthor;
  image: ContentfulAsset;
}> {
  const fields = item.fields ?? {};
  const [categoryEntry, authorEntry, imageAsset] = await Promise.all([
    fields.category && isEntryLink(fields.category)
      ? resolveEntry(baseUrl, (fields.category as CMSLink).sys.id, debug)
      : Promise.resolve(null),
    fields.author && isEntryLink(fields.author)
      ? resolveEntry(baseUrl, (fields.author as CMSLink).sys.id, debug)
      : Promise.resolve(null),
    fields.image && isAssetLink(fields.image)
      ? resolveAsset(baseUrl, (fields.image as CMSLink).sys.id, debug)
      : Promise.resolve(null),
  ]);

  const category = mapBlogCategory(categoryEntry) ?? createDefaultCategory(item.sys.id);
  const author = mapBlogAuthor(authorEntry);
  const image = mapContentfulAsset(imageAsset as ContentfulAssetEntry) ?? DEFAULT_IMAGE;
  const title = (item.fields?.title as string) ?? '';
  if (debug) {
    console.warn('[Blog] Post image resolved', {
      title: title.slice(0, 50),
      imageUrl: image.url.slice(0, 80) + (image.url.length > 80 ? '…' : ''),
      isDefault: image.id === DEFAULT_IMAGE.id,
    });
  }
  return { category, author, image };
}

export interface BlogClientConfig {
  baseUrl?: string;
  /** When true, logs asset/entry fetch status (status code, URL, error body) to console for debugging. */
  debug?: boolean;
  /** Max number of posts to return (default 7). */
  limit?: number;
  /** Number of posts to skip for pagination (default 0). */
  skip?: number;
}

export interface BlogPostsResult {
  posts: BlogPost[];
  total: number;
}

const DEFAULT_PAGE_SIZE = 7;

/**
 * Fetches blog posts with resolved category, author, and image.
 * Supports pagination via limit/skip. Resolves all post image assets first (in parallel with retry),
 * then category/author, to avoid request contention.
 */
export async function getLatestBlogPosts(config: BlogClientConfig = {}): Promise<BlogPostsResult> {
  const baseUrl = (config.baseUrl ?? DEFAULT_CMS_BASE).replace(/\/$/, '');
  const debug = config.debug === true;
  const limit = config.limit ?? DEFAULT_PAGE_SIZE;
  const skip = config.skip ?? 0;

  let listResponse: CMSListResponse;
  try {
    const data = await fetchFromCMS(baseUrl, 'blog/posts', { limit, skip });
    listResponse = data as CMSListResponse;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to fetch blog posts: ${msg}`);
  }

  const total = typeof listResponse?.total === 'number' ? listResponse.total : 0;
  if (!listResponse?.items?.length) return { posts: [], total };

  const items = listResponse.items;

  // Resolve all post image assets first (parallel, no competition with entry fetches)
  const imageAssetIds = items.map(item => {
    const img = item.fields?.image;
    return isAssetLink(img) ? (img as CMSLink).sys.id : null;
  });
  if (debug) console.warn('[Blog] Resolving post image assets', imageAssetIds.filter(Boolean));

  await Promise.all(
    imageAssetIds
      .filter((id): id is string => id != null)
      .map(id => resolveAsset(baseUrl, id, debug)),
  );

  const posts: BlogPost[] = [];
  for (const item of items) {
    try {
      const { category, author, image } = await resolvePostReferences(baseUrl, item, debug);
      const post = mapBlogPost(item, category, author, image);
      if (post) posts.push(post);
    } catch (e) {
      if (debug) console.warn('[Blog] Post resolve/map failed', item?.fields?.title, e);
      // Skip post on resolve/map failure
    }
  }

  return { posts, total };
}
