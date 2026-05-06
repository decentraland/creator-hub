/**
 * Domain types for Decentraland blog (aligned with Contentful CMS).
 */

export interface ContentfulAsset {
  id: string;
  url: string;
  width: number;
  height: number;
  mimeType: string;
}

export interface BlogCategory {
  id: string;
  slug: string;
  title: string;
  description: string;
  image: ContentfulAsset;
  isShownInMenu: boolean;
  url: string;
}

export interface BlogAuthor {
  id: string;
  slug: string;
  title: string;
  description: string;
  image: ContentfulAsset;
  url: string;
}

/** Rich text body is opaque for list views; full Document type if needed later. */
export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  description: string;
  publishedDate: string;
  body: unknown;
  bodyAssets: Record<string, ContentfulAsset>;
  image: ContentfulAsset;
  category: BlogCategory;
  author: BlogAuthor;
  url: string;
}
