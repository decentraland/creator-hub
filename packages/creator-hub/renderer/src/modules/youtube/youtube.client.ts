import playlistData from './playlist-data.json';
import type { YouTubePlaylistItem } from './youtube.types';

export type PlaylistSection = {
  playlistId: string;
  videos: YouTubePlaylistItem[];
};

type PlaylistData = Record<string, PlaylistSection>;

const data = playlistData as PlaylistData;

export function getPlaylistSection(key: string): PlaylistSection | null {
  const section = data[key];
  if (!section?.videos?.length) return null;
  return section;
}

export function getAllPlaylists(): PlaylistData {
  return data;
}
