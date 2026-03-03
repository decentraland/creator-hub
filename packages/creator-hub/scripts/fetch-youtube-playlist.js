/**
 * Build-time script that fetches video metadata from YouTube playlist RSS feeds.
 * Outputs a JSON file that the renderer imports statically — no API key or runtime cost.
 *
 * Usage:
 *   node scripts/fetch-youtube-playlist.js
 */

const PLAYLISTS = [
  { key: 'creatorHub', id: 'PLAcRraQmr_GPrMmQekqbMWhyBxo3lXs8p' },
  { key: 'academyBeginners', id: 'PLAcRraQmr_GP8ayVOgkmL4rrJuB2T74bg' },
  { key: 'academyBlender', id: 'PLAcRraQmr_GPngczAiPczVht2nYejMOQv' },
  { key: 'communityAllHands', id: 'PLAcRraQmr_GNvJh8epKB4n8KJSg2hkfK4' },
];

const FEED_BASE = 'https://www.youtube.com/feeds/videos.xml?playlist_id=';
const OUTPUT_PATH = new URL('../renderer/src/modules/youtube/playlist-data.json', import.meta.url);

function parseEntries(xml) {
  const entries = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match;
  while ((match = entryRegex.exec(xml)) !== null) {
    const block = match[1];
    const videoId = block.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1];
    const title = block.match(/<media:title>([^<]+)<\/media:title>/)?.[1];
    const published = block.match(/<published>([^<]+)<\/published>/)?.[1];
    if (videoId && title) {
      entries.push({ id: videoId, title, ...(published ? { published } : {}) });
    }
  }
  return entries;
}

async function fetchPlaylist({ key, id }) {
  const url = `${FEED_BASE}${id}`;
  console.log(`  [${key}] Fetching ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${key}: ${res.status} ${res.statusText}`);
  const xml = await res.text();
  const entries = parseEntries(xml);
  console.log(`  [${key}] ${entries.length} videos`);
  return { key, id, videos: entries };
}

async function main() {
  console.log('Fetching playlist RSS feeds...');
  const results = await Promise.all(PLAYLISTS.map(fetchPlaylist));

  const data = {};
  for (const { key, id, videos } of results) {
    data[key] = { playlistId: id, videos };
  }

  const { writeFileSync } = await import('fs');
  const { fileURLToPath } = await import('url');
  const outPath = fileURLToPath(OUTPUT_PATH);

  writeFileSync(outPath, JSON.stringify(data, null, 2) + '\n');
  const total = results.reduce((s, r) => s + r.videos.length, 0);
  console.log(`Wrote ${total} total videos to ${outPath}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
