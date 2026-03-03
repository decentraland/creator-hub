/**
 * Build-time script that fetches video metadata from YouTube playlists.
 * Scrapes the playlist HTML page to get all videos (RSS feeds miss some).
 * Also fetches video descriptions from individual video pages.
 * No API key needed.
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

const FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
};

const OUTPUT_PATH = new URL('../renderer/src/modules/youtube/playlist-data.json', import.meta.url);

/**
 * Scrapes the YouTube playlist page HTML and extracts video IDs + titles
 * from the embedded JSON (ytInitialData).
 */
async function scrapePlaylist(playlistId) {
  const url = `https://www.youtube.com/playlist?list=${playlistId}`;
  const res = await fetch(url, { headers: FETCH_HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const html = await res.text();

  const match = html.match(/var ytInitialData\s*=\s*(\{.+?\});\s*<\/script>/s);
  if (!match) throw new Error(`Could not find ytInitialData in playlist page for ${playlistId}`);

  const data = JSON.parse(match[1]);

  const contents =
    data?.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content
      ?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents?.[0]
      ?.playlistVideoListRenderer?.contents ?? [];

  const videos = [];
  for (const item of contents) {
    const renderer = item.playlistVideoRenderer;
    if (!renderer) continue;
    const videoId = renderer.videoId;
    const title = renderer.title?.runs?.[0]?.text;
    if (videoId && title) {
      videos.push({ id: videoId, title });
    }
  }

  return videos;
}

/** Fetch the description of a single video from its watch page meta tags. */
async function fetchVideoDescription(videoId) {
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  try {
    const res = await fetch(url, { headers: FETCH_HEADERS });
    if (!res.ok) return null;
    const html = await res.text();
    const metaMatch = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
    if (metaMatch) return decodeHtmlEntities(metaMatch[1]);
    return null;
  } catch {
    return null;
  }
}

function decodeHtmlEntities(str) {
  return str
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

/** Process items in batches to avoid hammering YouTube. */
async function batchFetchDescriptions(videos, concurrency = 3) {
  const results = new Map();
  for (let i = 0; i < videos.length; i += concurrency) {
    const batch = videos.slice(i, i + concurrency);
    const descs = await Promise.all(batch.map(v => fetchVideoDescription(v.id)));
    batch.forEach((v, j) => {
      if (descs[j]) results.set(v.id, descs[j]);
    });
  }
  return results;
}

async function fetchPlaylist({ key, id }) {
  console.log(`  [${key}] Scraping https://www.youtube.com/playlist?list=${id}`);
  const videos = await scrapePlaylist(id);
  console.log(`  [${key}] ${videos.length} videos`);

  console.log(`  [${key}] Fetching descriptions...`);
  const descriptions = await batchFetchDescriptions(videos);
  for (const video of videos) {
    const desc = descriptions.get(video.id);
    if (desc) video.description = desc;
  }
  console.log(`  [${key}] Got ${descriptions.size} descriptions`);

  return { key, id, videos };
}

async function main() {
  console.log('Fetching playlist data...');
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
