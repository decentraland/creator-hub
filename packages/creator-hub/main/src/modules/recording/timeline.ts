import type { RecordedEvent, TranscriptWord } from '/shared/types/recording';

// Builds the session timeline: what the user said (word-timestamped transcript) interleaved with
// what they did (recorded events), plus a per-utterance note of what they were pointing at and
// had selected — the part the assistant needs to resolve "delete this one".

// `anchor` is when the pointing word ("this", "esa", "这个"…) was said, or the utterance start
// when there is none; `anchorWord` is that word.
export type Utterance = {
  start: number;
  end: number;
  text: string;
  anchor: number;
  anchorWord?: string;
};

export type TimelineInput = {
  startedAt: number;
  endedAt: number;
  // Epoch ms of the first audio sample; word times are offsets from it.
  audioStartedAt: number | null;
  words: TranscriptWord[];
  events: RecordedEvent[];
};

export type Timeline = {
  utterances: Utterance[];
  lines: TimelineLine[];
  durationMs: number;
  actionCount: number;
};

export type TimelineLine = {
  t: number;
  text: string;
  speech: boolean;
  // Hover-type lines are the first to go when the context budget is tight.
  hover: boolean;
};

// A pause longer than this starts a new utterance.
const UTTERANCE_GAP_MS = 800;
// People point a little before or after the word ("delete… this one"): targets in this window
// around the anchor word count as candidates.
const POINT_BEFORE_MS = 1500;
const POINT_AFTER_MS = 1000;
// A hover the pointer left sooner than this was a pass-through, not a point — unless the user
// was talking at the time.
const MIN_HOVER_DWELL_MS = 300;
// Lines within this distance of speech are kept first when trimming to the context budget.
const NEAR_SPEECH_MS = 5000;

// Words that usually mean "the thing I'm pointing at". The utterance's anchor is the first of
// them; with none, its start. Covers the app's locales (en, es, zh).
const DEICTIC = new Set([
  'this',
  'that',
  'these',
  'those',
  'here',
  'there',
  'it',
  'one',
  'este',
  'esta',
  'esto',
  'estos',
  'estas',
  'ese',
  'esa',
  'eso',
  'aquí',
  'aqui',
  'ahí',
  'ahi',
  'allí',
  'alli',
  'aquel',
  'aquella',
]);
const DEICTIC_ZH = ['这个', '那个', '这些', '那些', '这里', '那里', '这', '那'];

const POINTER_KINDS = new Set(['viewport-hover', 'hover', 'scene-click']);
const HOVER_KINDS = new Set(['viewport-hover', 'hover', 'player']);
// What the running scene's code made appear or disappear: context, not something the user did.
const SCENE_KINDS = new Set(['scene-appear', 'scene-remove']);
// "Kill this one" said as a monster pops up refers to the monster even when the pointer is
// elsewhere: things that appeared shortly before the pointing word, and were still there when
// it was said, are candidates too.
const APPEARED_BEFORE_MS = 8000;
const APPEARED_AFTER_MS = 500;
const MAX_APPEARED = 3;

// Whisper writes these for silence/noise; they are not speech.
const NON_SPEECH = /^\s*[[(].*[\])]\s*$/;

function normalizeWord(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');
}

function isDeictic(text: string): boolean {
  const word = normalizeWord(text);
  if (DEICTIC.has(word)) return true;
  return DEICTIC_ZH.some(zh => text.includes(zh));
}

function joinWords(words: TranscriptWord[]): string {
  return words
    .map(w => w.text)
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

export function groupUtterances(words: TranscriptWord[], audioStartedAt: number): Utterance[] {
  const spoken = words.filter(w => w.text.trim() !== '' && !NON_SPEECH.test(w.text));
  const groups: TranscriptWord[][] = [];
  for (const word of spoken) {
    const current = groups[groups.length - 1];
    const previous = current?.[current.length - 1];
    const sameStretch = previous?.segment === word.segment;
    if (current && previous && sameStretch && word.start - previous.end <= UTTERANCE_GAP_MS) {
      current.push(word);
    } else groups.push([word]);
  }
  return groups
    .map(group => {
      const deictic = group.find(w => isDeictic(w.text));
      return {
        start: audioStartedAt + group[0].start,
        end: audioStartedAt + group[group.length - 1].end,
        text: joinWords(group),
        anchor: audioStartedAt + (deictic ?? group[0]).start,
        anchorWord: deictic?.text.trim(),
      };
    })
    .filter(u => /[\p{L}\p{N}]/u.test(u.text));
}

function entityLabel(entity: NonNullable<RecordedEvent['entity']>): string {
  return entity.name ? `${entity.name} (#${entity.id})` : `#${entity.id}`;
}

function speakingAt(t: number, utterances: Utterance[]): boolean {
  return utterances.some(u => t >= u.start - POINT_BEFORE_MS && t <= u.end + POINT_AFTER_MS);
}

// Drop hovers the pointer only passed through, and repeats of the same line.
export function condenseEvents(events: RecordedEvent[], utterances: Utterance[]): RecordedEvent[] {
  const sorted = [...events].sort((a, b) => a.t - b.t);
  const kept: RecordedEvent[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const event = sorted[i];
    if (HOVER_KINDS.has(event.kind) && event.kind !== 'player') {
      const next = sorted.slice(i + 1).find(e => e.kind === event.kind);
      const dwell = next ? next.t - event.t : Infinity;
      if (dwell < MIN_HOVER_DWELL_MS && !speakingAt(event.t, utterances)) continue;
    }
    const last = kept[kept.length - 1];
    if (last && last.kind === event.kind && last.text === event.text) continue;
    kept.push(event);
  }
  return kept;
}

// What the user was pointing at and had selected around an utterance's anchor word.
export function pointingNote(utterance: Utterance, events: RecordedEvent[]): string | undefined {
  const sorted = [...events].sort((a, b) => a.t - b.t);
  const pointer = sorted.filter(e => POINTER_KINDS.has(e.kind));

  const candidates: string[] = [];
  const add = (label: string) => {
    if (!candidates.includes(label)) candidates.push(label);
  };
  // The target under the pointer when the anchor word started (pointer state, not just events
  // in the window: the user may have parked the pointer on it long before speaking).
  const before = pointer.filter(e => e.t <= utterance.anchor && e.kind !== 'scene-click');
  const current = before[before.length - 1];
  if (current?.entity) add(entityLabel(current.entity));
  for (const e of pointer) {
    if (e.t < utterance.anchor - POINT_BEFORE_MS || e.t > utterance.anchor + POINT_AFTER_MS) {
      continue;
    }
    if (e.entity) add(entityLabel(e.entity));
  }

  const selections = sorted.filter(e => e.kind === 'select' && e.t <= utterance.anchor + 300);
  const selection = selections[selections.length - 1];

  const goneBefore = (id: number) =>
    sorted.some(e => e.kind === 'scene-remove' && e.entity?.id === id && e.t < utterance.anchor);
  const appeared = sorted
    .filter(
      e =>
        e.kind === 'scene-appear' &&
        e.t >= utterance.anchor - APPEARED_BEFORE_MS &&
        e.t <= utterance.anchor + APPEARED_AFTER_MS &&
        !(e.entity && goneBefore(e.entity.id)),
    )
    .reverse()
    // Objects before on-screen text (a banner is context, rarely what "this" means), newest first.
    .sort((a, b) => Number(!a.entity) - Number(!b.entity))
    .map(e => {
      const what = e.entity
        ? entityLabel(e.entity)
        : e.text.replace(/^While playing: /, '').replace(/ appeared$/, '');
      const offset = (Math.abs(utterance.anchor - e.t) / 1000).toFixed(1);
      return {
        what,
        label: `${what} (${offset} s ${e.t <= utterance.anchor ? 'before' : 'after'})`,
      };
    })
    .filter((item, i, all) => all.findIndex(other => other.what === item.what) === i)
    .slice(0, MAX_APPEARED)
    .map(item => item.label);

  const parts: string[] = [];
  if (candidates.length > 0) parts.push(`pointer on ${candidates.join(' then ')}`);
  if (appeared.length > 0) parts.push(`just appeared: ${appeared.join(', ')}`);
  if (selection) parts.push(`selection: ${selection.text}`);
  return parts.length > 0 ? parts.join('; ') : undefined;
}

export function buildTimeline(input: TimelineInput): Timeline {
  const audioStart = input.audioStartedAt ?? input.startedAt;
  const utterances = groupUtterances(input.words, audioStart);
  const events = condenseEvents(input.events, utterances);

  const lines: TimelineLine[] = [
    ...events.map(e => ({
      t: e.t,
      text: e.text,
      speech: false,
      hover: HOVER_KINDS.has(e.kind) || SCENE_KINDS.has(e.kind),
    })),
    ...utterances.map(u => {
      const note = pointingNote(u, input.events);
      return {
        t: u.start,
        text: `SAID: "${u.text}"${note ? `  ← ${u.anchorWord ? `at "${u.anchorWord}": ` : ''}${note}` : ''}`,
        speech: true,
        hover: false,
      };
    }),
  ].sort((a, b) => a.t - b.t || Number(a.speech) - Number(b.speech));

  return {
    utterances,
    lines,
    durationMs: Math.max(0, input.endedAt - input.startedAt),
    actionCount: input.events.filter(e => !HOVER_KINDS.has(e.kind) && !SCENE_KINDS.has(e.kind))
      .length,
  };
}

export function formatOffset(ms: number): string {
  const clamped = Math.max(0, ms);
  const minutes = Math.floor(clamped / 60_000);
  const seconds = (clamped % 60_000) / 1000;
  return `${String(minutes).padStart(2, '0')}:${seconds.toFixed(1).padStart(4, '0')}`;
}

export function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function renderLine(line: TimelineLine, startedAt: number): string {
  return `${formatOffset(line.t - startedAt)}  ${line.text}`;
}

// The condensed timeline sent with the next message. Claude and Codex take the prompt on stdin
// but Gemini and Cursor take it as an argv entry, so it stays well under Windows' 32 KB command
// line; the full timeline is in SESSION.md, which the context points to.
export function renderContext(
  timeline: Timeline,
  startedAt: number,
  sessionFile: string,
  budget = 6000,
): string {
  const header = [
    '[Session recording] The user pressed Record and worked in the editor while talking. Below is',
    'what they said (transcribed locally; timing is approximate, about ±0.5 s) interleaved with what',
    'they did, each line stamped mm:ss from the start. Resolve "this", "that one", "here" etc. from',
    'what they were pointing at or had selected at that moment (the ← notes); while playing, what',
    'the scene had just made appear is a candidate too ("just appeared"). Make your best guess',
    'and say which entity you understood; only ask first if the action is destructive or hard to',
    'undo AND two or more candidates are equally likely, or there is no candidate at all.',
    `Full, untrimmed timeline: ${sessionFile}`,
    `Duration ${formatDuration(timeline.durationMs)} · ${timeline.actionCount} actions · ${timeline.utterances.length} things said.`,
    '',
  ].join('\n');

  const speechTimes = timeline.lines.filter(l => l.speech).map(l => l.t);
  const nearSpeech = (t: number) => speechTimes.some(s => Math.abs(s - t) <= NEAR_SPEECH_MS);
  // Priority: speech, then actions, then hovers near speech, then far hovers.
  const priority = (line: TimelineLine) =>
    line.speech ? 0 : !line.hover ? 1 : nearSpeech(line.t) ? 2 : 3;

  const rendered = timeline.lines.map(line => renderLine(line, startedAt));
  const order = timeline.lines
    .map((line, i) => ({ i, p: priority(line) }))
    .sort((a, b) => a.p - b.p || a.i - b.i);

  let used = header.length;
  const keep = new Set<number>();
  for (const { i } of order) {
    const cost = rendered[i].length + 1;
    if (used + cost > budget) continue;
    keep.add(i);
    used += cost;
  }
  const omitted = rendered.length - keep.size;
  const body = rendered.filter((_, i) => keep.has(i));
  if (omitted > 0) body.push(`… ${omitted} more lines (mostly hovers) in the full timeline.`);
  return `${header}${body.join('\n')}`;
}

export function renderSessionMarkdown(
  timeline: Timeline,
  info: { projectTitle: string; startedAt: number; transcriptionError?: string },
): string {
  const started = new Date(info.startedAt).toISOString().replace('T', ' ').slice(0, 19);
  const parts = [
    `# Session recording: ${info.projectTitle}`,
    '',
    `Started: ${started} UTC`,
    `Duration ${formatDuration(timeline.durationMs)} · ${timeline.actionCount} actions · ${timeline.utterances.length} things said`,
    'Files: audio.wav (16 kHz mono), events.jsonl (raw actions), transcript.json (word timings)',
  ];
  if (info.transcriptionError) {
    parts.push('', `Transcription: ${info.transcriptionError}`);
  }
  parts.push('', '## Timeline', '');
  parts.push(...timeline.lines.map(line => renderLine(line, info.startedAt)));
  parts.push('', '## What was said', '');
  parts.push(
    ...(timeline.utterances.length > 0
      ? timeline.utterances.map(u => `${formatOffset(u.start - info.startedAt)}  ${u.text}`)
      : ['(nothing)']),
  );
  return `${parts.join('\n')}\n`;
}
