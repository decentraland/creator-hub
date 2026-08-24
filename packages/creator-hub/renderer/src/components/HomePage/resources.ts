export enum LearnTab {
  VIDEOS = 'videos',
  DOCS = 'docs',
}

export type LearnVideo = {
  id: string;
  list?: string;
  title: string;
  description?: string;
};

export type LearnDoc = {
  url: string;
  title: string;
  description?: string;
};

export const VIDEOS: LearnVideo[] = [
  {
    id: 'nWiyoX70vtc',
    list: 'PLAcRraQmr_GMJw77zKvN84LX_OLyn-lVz',
    title: 'Making a Scene with the Creator Hub',
    description: 'Introducing the Decentraland Creator Hub, the go to place for creating scenes.',
  },
  {
    id: 'tK5-fyBVnK0',
    list: 'PLZnx2g41Pk_s',
    title: 'Buildathon Workshop: Creator Hub',
    description: 'Friendzone Buildathon Workshop #1: building scenes with the Creator Hub.',
  },
  {
    id: 'FBr2gye3qh8',
    list: 'PLZnx2g41Pk_s',
    title: 'Buildathon Workshop: Building for Mobile',
    description: 'Friendzone Buildathon Workshop #2: making your scenes shine on mobile.',
  },
  {
    id: 'J_EO1LZkaiA',
    list: 'PLAcRraQmr_GP_K8WN7csnKnImK4R2TgMA',
    title: 'Using Custom 3D Art',
    description: "Today let's learn about using your own 3D assets in Decentraland.",
  },
];

export const DOCS: LearnDoc[] = [
  {
    url: 'https://docs.decentraland.org/creator/',
    title: "Let's build the Decentraland together",
    description: 'Start creating in Decentraland.',
  },
  {
    url: 'https://docs.decentraland.org/creator/scenes-sdk7/getting-started/sdk-101',
    title: 'SDK Quickstart',
    description: 'Learn the fundamentals.',
  },
  {
    url: 'https://docs.decentraland.org/creator/scenes-sdk7/getting-started/dev-workflow',
    title: 'Development Workflow',
    description: 'Development best practices.',
  },
  {
    url: 'https://docs.decentraland.org/creator/scene-editor/get-started/about-editor',
    title: 'Scene Editor',
    description: 'Build scenes without code.',
  },
];
