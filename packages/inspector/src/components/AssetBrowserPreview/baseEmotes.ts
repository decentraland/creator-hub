import { PreviewEmote } from '@dcl/schemas';

/**
 * Built-in animations have no file in the catalog, but the avatar preview knows a few of them by
 * name. Keys are the names scene code uses (`triggerEmote({ predefinedEmote })`).
 */
const BUILT_IN_PREVIEW_EMOTES: Record<string, PreviewEmote> = {
  clap: PreviewEmote.CLAP,
  dab: PreviewEmote.DAB,
  money: PreviewEmote.MONEY,
  fistpump: PreviewEmote.FIST_PUMP,
  headexplode: PreviewEmote.HEAD_EXPLODE,
};

export function getBuiltInPreviewEmote(name?: string): PreviewEmote | undefined {
  return name ? BUILT_IN_PREVIEW_EMOTES[name] : undefined;
}

// The rest of the classic built-ins are published on the content server as off-chain "base
// emotes" (the explorers resolve them the same way), so their animation files can be fetched and
// played on the avatar. Newer scene-only emotes are not published; they keep their animated
// thumbnail.
const CONTENT_SERVER = 'https://peer.decentraland.org/content';
const BASE_EMOTE_URN = 'urn:decentraland:off-chain:base-emotes:';
const DEFAULT_BODY_SHAPE = 'urn:decentraland:off-chain:base-avatars:BaseMale';

type EmoteEntity = {
  content: { file: string; hash: string }[];
  metadata?: {
    emoteDataADR74?: { representations?: { mainFile: string; bodyShapes: string[] }[] };
  };
};

const cache = new Map<string, Promise<File | undefined>>();

async function resolve(name: string): Promise<File | undefined> {
  const response = await fetch(`${CONTENT_SERVER}/entities/active`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pointers: [`${BASE_EMOTE_URN}${name.toLowerCase()}`] }),
  });
  if (!response.ok) throw new Error(`Content server replied ${response.status}`);
  const [entity] = (await response.json()) as EmoteEntity[];
  const representations = entity?.metadata?.emoteDataADR74?.representations ?? [];
  const representation =
    representations.find(item => item.bodyShapes.includes(DEFAULT_BODY_SHAPE)) ??
    representations[0];
  const hash = entity?.content.find(item => item.file === representation?.mainFile)?.hash;
  if (!representation || !hash) return undefined;
  const file = await fetch(`${CONTENT_SERVER}/contents/${hash}`);
  if (!file.ok) throw new Error(`Could not fetch ${representation.mainFile} (${file.status})`);
  return new File([await file.arrayBuffer()], representation.mainFile);
}

/** The animation file of a built-in emote, or undefined when it is not published as a base emote. */
export function fetchBaseEmoteFile(name: string): Promise<File | undefined> {
  let result = cache.get(name);
  if (!result) {
    result = resolve(name).catch(error => {
      console.warn(`Could not load the built-in animation "${name}":`, error);
      cache.delete(name);
      return undefined;
    });
    cache.set(name, result);
  }
  return result;
}
