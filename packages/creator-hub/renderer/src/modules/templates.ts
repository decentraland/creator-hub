import artGalleryImage from '/assets/templates/art-gallery.webp';
import artGalleryVideo from '/assets/templates/art-gallery.mp4';
import cozyHouseImage from '/assets/templates/cozy-house.webp';
import cozyHouseVideo from '/assets/templates/cozy-house.mp4';
import mansionImage from '/assets/templates/mansion.webp';
import nightclubImage from '/assets/templates/nightclub.webp';
import partyPadImage from '/assets/templates/party-pad.webp';
import partyPadVideo from '/assets/templates/party-pad.mp4';
import spookyHouseImage from '/assets/templates/spooky-house.webp';
import storeVideo from '/assets/templates/store.mp4';
import streamStudioImage from '/assets/templates/stream-studio.webp';
import streamStudioVideo from '/assets/templates/stream-studio.mp4';
import streamingTheatreImage from '/assets/templates/streaming-theatre.webp';
import teamHubImage from '/assets/templates/team-hub.webp';
import teamHubVideo from '/assets/templates/team-hub.mp4';
import videoStreamingImage from '/assets/templates/video-streaming.webp';

export enum Difficulty {
  HARD = 'Hard',
  INTERMEDIATE = 'Intermediate',
  EASY = 'Easy',
}

export type Template = {
  id: string;
  title: string;
  description: string;
  tags: string[];
  difficulty: Difficulty;
  repo: string;
  /** Deep link into the explorer; shown as a "Preview" action when present. */
  playUrl?: string;
  imageUrl?: string;
  /** Takes precedence over `imageUrl` on cards: it is the hover preview, muted and looped. */
  videoUrl?: string;
  /** ISO date; drives the "Newest" sort. */
  createdAt: string;
};

/**
 * The scene templates offered on the Templates page and the Home row.
 *
 * This list used to come from the Decentraland Studios resources API, which is being retired.
 * The template code still lives in the linked GitHub repos; only the catalog (names, blurbs,
 * tags, artwork) is bundled here. To add a template: drop its artwork in `assets/templates/`
 * and append an entry.
 */
export const TEMPLATES: Template[] = [
  {
    id: 'video-streaming',
    title: 'Video Streaming',
    description:
      'A video streamed from an external URL. The repo includes instructions for various alternatives for uploading the video content.',
    tags: ['Event hosting', 'Video', 'Streaming', 'Community'],
    difficulty: Difficulty.EASY,
    repo: 'https://github.com/decentraland-scenes/Video-Streaming-Template',
    playUrl:
      'decentraland://?realm=https://sdk-team-cdn.decentraland.org/ipfs/goerli-plaza-main-latest&position=78,-3',
    imageUrl: videoStreamingImage,
    createdAt: '2023-04-19T20:54:05.256Z',
  },
  {
    id: 'mansion',
    title: 'Mansion template',
    description:
      "A large template scene with default art, meant for using in Worlds, 10 x 10 parcels. The scene doesn't include anything interactive.",
    tags: ['Template', 'Event hosting'],
    difficulty: Difficulty.EASY,
    repo: 'https://github.com/decentraland-scenes/mansion-template-scene',
    imageUrl: mansionImage,
    createdAt: '2023-06-20T19:26:49.964Z',
  },
  {
    id: 'streaming-theatre',
    title: 'Streaming Theatre Template',
    description: 'A large scene for worlds, with a screen ready for streaming video.',
    tags: ['Event hosting', 'Template'],
    difficulty: Difficulty.EASY,
    repo: 'https://github.com/decentraland-scenes/Streaming-Theatre',
    imageUrl: streamingTheatreImage,
    createdAt: '2023-06-20T20:12:37.072Z',
  },
  {
    id: 'nightclub',
    title: 'Nightclub template',
    description:
      "A large scene with default art for a nightclub. Contains default art, several animated models with effects, that aren't playing by default. It includes a large screen with a video stream.",
    tags: ['Template', 'Event hosting'],
    difficulty: Difficulty.EASY,
    repo: 'https://github.com/decentraland-scenes/Nightclub-template',
    imageUrl: nightclubImage,
    createdAt: '2023-06-27T21:01:07.258Z',
  },
  {
    id: 'store',
    title: 'Store template scene',
    description:
      "A large template scene with default art, meant for using in Worlds, 10 x 10 parcels. The scene doesn't include anything interactive.",
    tags: ['Template'],
    difficulty: Difficulty.EASY,
    repo: 'https://github.com/decentraland-scenes/store-template-scene',
    videoUrl: storeVideo,
    createdAt: '2023-07-05T14:22:23.995Z',
  },
  {
    id: 'art-gallery',
    title: 'Art Gallery Template',
    description:
      'A modern contemporary art gallery, ready to fill with paintings and sculptures. Comes with placeholder images, links to social media, ambient music, and an elevator.',
    tags: ['Art', 'Gallery', 'Modern', 'NFTs', 'Contemporary', 'Exhibition'],
    difficulty: Difficulty.EASY,
    repo: 'https://github.com/decentraland-scenes/art-gallery-template',
    imageUrl: artGalleryImage,
    videoUrl: artGalleryVideo,
    createdAt: '2025-08-29T16:53:10.342Z',
  },
  {
    id: 'cozy-house',
    title: 'Cozy House Template',
    description:
      'A modest little house, ready to fill with whatever you want. Comes with placeholder images, links to social media, ambient cricket sounds, and a rug elevator.',
    tags: ['House', 'Template'],
    difficulty: Difficulty.EASY,
    repo: 'https://github.com/decentraland-scenes/cozy-house-template',
    imageUrl: cozyHouseImage,
    videoUrl: cozyHouseVideo,
    createdAt: '2025-10-17T17:41:55.500Z',
  },
  {
    id: 'spooky-house',
    title: 'Spooky House Template',
    description:
      'A creepy little house, ready to fill with whatever you want. Comes with placeholder images, links to social media, some eerie background sounds, and a chandelier that serves as a secret elevator.',
    tags: ['Spooky', 'Horror', 'Halloween', 'House', 'Fright', 'Creepy'],
    difficulty: Difficulty.EASY,
    repo: 'https://github.com/decentraland-scenes/Spooky-House-Template',
    imageUrl: spookyHouseImage,
    createdAt: '2025-10-20T21:23:52.923Z',
  },
  {
    id: 'party-pad',
    title: 'Party Pad Template',
    description:
      'A fun place made for live streaming parties. Comes with a video screen, seats, two floors, links to social media, NFT and image placeholders to customize.',
    tags: ['Event hosting', 'Community', 'Streaming', 'Live', 'Party'],
    difficulty: Difficulty.EASY,
    repo: 'https://github.com/decentraland-scenes/Party-Pad-Template',
    imageUrl: partyPadImage,
    videoUrl: partyPadVideo,
    createdAt: '2025-11-10T17:39:25.863Z',
  },
  {
    id: 'stream-studio',
    title: 'Stream Studio Template',
    description:
      'A space made for experiencing live streaming events, with a large screen for projecting, photo-op spot, some chairs for speakers to sit on, placeholder images and text.',
    tags: ['Event hosting', 'Streaming', 'Live', 'Interview', 'Show'],
    difficulty: Difficulty.EASY,
    repo: 'https://github.com/decentraland-scenes/stream-studio-template',
    imageUrl: streamStudioImage,
    videoUrl: streamStudioVideo,
    createdAt: '2025-12-01T11:30:27.042Z',
  },
  {
    id: 'team-hub',
    title: 'Team Hub Template',
    description:
      'A scene built for group interaction, with surveys, anonymous questions, vote with your feet, and more! The scene mechanics are also available as a library.',
    tags: ['Game mechanics', 'Event hosting', 'Multiplayer', 'Community', 'Surveys', 'Q&A'],
    difficulty: Difficulty.HARD,
    repo: 'https://github.com/decentraland-scenes/teamhub-library',
    imageUrl: teamHubImage,
    videoUrl: teamHubVideo,
    createdAt: '2025-12-01T13:15:30.640Z',
  },
];
