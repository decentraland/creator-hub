import { describe, expect, it } from 'vitest';

import type { RecordedEvent, TranscriptWord } from '/shared/types/recording';

import {
  buildTimeline,
  condenseEvents,
  formatOffset,
  groupUtterances,
  pointingNote,
  renderContext,
  renderSessionMarkdown,
} from '../src/modules/recording/timeline';

const T0 = 1_700_000_000_000;

function words(...spec: [number, number, string][]): TranscriptWord[] {
  return spec.map(([start, end, text]) => ({ start, end, text }));
}

const barrel = { id: 520, name: 'Barrel_3' };
const crate = { id: 530, name: 'Crate_1' };

describe('when grouping transcript words into utterances', () => {
  it('should split on pauses longer than 800 ms', () => {
    const result = groupUtterances(
      words([0, 300, ' Okay'], [300, 400, ','], [2000, 2300, ' delete'], [2300, 2500, ' this']),
      T0,
    );
    expect(result.map(u => u.text)).toEqual(['Okay,', 'delete this']);
  });

  it('should anchor the utterance on its pointing word', () => {
    const [utterance] = groupUtterances(
      words([0, 200, ' delete'], [200, 400, ' this'], [400, 600, ' one']),
      T0,
    );
    expect(utterance.anchor).toBe(T0 + 200);
    expect(utterance.anchorWord).toBe('this');
  });

  it('should anchor on Spanish and Chinese pointing words', () => {
    const [es] = groupUtterances(words([0, 200, ' borra'], [200, 400, ' esa']), T0);
    const [zh] = groupUtterances(words([0, 200, '删除'], [200, 400, '这个']), T0);
    expect(es.anchorWord).toBe('esa');
    expect(zh.anchorWord).toBe('这个');
  });

  it('should drop non-speech markers like [BLANK_AUDIO]', () => {
    expect(groupUtterances(words([0, 1000, ' [BLANK_AUDIO]']), T0)).toEqual([]);
  });
});

describe('when condensing events', () => {
  it('should drop a hover the pointer only passed through', () => {
    const events: RecordedEvent[] = [
      { t: T0, kind: 'viewport-hover', text: 'over Crate_1', entity: crate },
      { t: T0 + 100, kind: 'viewport-hover', text: 'over Barrel_3', entity: barrel },
    ];
    expect(condenseEvents(events, []).map(e => e.text)).toEqual(['over Barrel_3']);
  });

  it('should keep a short hover while the user is talking', () => {
    const events: RecordedEvent[] = [
      { t: T0, kind: 'viewport-hover', text: 'over Crate_1', entity: crate },
      { t: T0 + 100, kind: 'viewport-hover', text: 'over Barrel_3', entity: barrel },
    ];
    const utterances = [{ start: T0, end: T0 + 500, text: 'this', anchor: T0 }];
    expect(condenseEvents(events, utterances)).toHaveLength(2);
  });

  it('should collapse consecutive identical lines', () => {
    const events: RecordedEvent[] = [
      { t: T0, kind: 'scroll', text: 'Scrolled down' },
      { t: T0 + 1000, kind: 'scroll', text: 'Scrolled down' },
    ];
    expect(condenseEvents(events, [])).toHaveLength(1);
  });
});

describe('when noting what the user pointed at', () => {
  it('should name the entity under the pointer when they said "this"', () => {
    const events: RecordedEvent[] = [
      { t: T0, kind: 'viewport-hover', text: 'Pointer over Barrel_3', entity: barrel },
    ];
    const note = pointingNote(
      { start: T0 + 4000, end: T0 + 5000, text: 'delete this one', anchor: T0 + 4300 },
      events,
    );
    expect(note).toBe('pointer on Barrel_3 (#520)');
  });

  it('should list every entity the pointer crossed around the word, in order', () => {
    const events: RecordedEvent[] = [
      { t: T0, kind: 'viewport-hover', text: 'over Crate_1', entity: crate },
      { t: T0 + 4500, kind: 'viewport-hover', text: 'over Barrel_3', entity: barrel },
    ];
    const note = pointingNote(
      { start: T0 + 4000, end: T0 + 5000, text: '', anchor: T0 + 4000 },
      events,
    );
    expect(note).toBe('pointer on Crate_1 (#530) then Barrel_3 (#520)');
  });

  it('should include the selection at that moment', () => {
    const events: RecordedEvent[] = [
      { t: T0, kind: 'select', text: 'Selected Crate_1 (#530)', entity: crate },
    ];
    const note = pointingNote(
      { start: T0 + 100, end: T0 + 900, text: '', anchor: T0 + 100 },
      events,
    );
    expect(note).toBe('selection: Selected Crate_1 (#530)');
  });

  it('should say nothing when the pointer was over nothing', () => {
    const events: RecordedEvent[] = [
      { t: T0, kind: 'viewport-hover', text: 'Pointer over nothing' },
    ];
    expect(
      pointingNote({ start: T0 + 4000, end: T0 + 5000, text: '', anchor: T0 + 4000 }, events),
    ).toBeUndefined();
  });
});

describe('when building the timeline', () => {
  const input = {
    startedAt: T0,
    endedAt: T0 + 42_000,
    audioStartedAt: T0 + 50,
    words: words([4000, 4200, ' delete'], [4200, 4400, ' this'], [4400, 4700, ' one']),
    events: [
      { t: T0 + 1000, kind: 'select', text: 'Selected Crate_1 (#530)', entity: crate },
      { t: T0 + 3000, kind: 'viewport-hover', text: 'Pointer over Barrel_3', entity: barrel },
    ],
  };

  it('should interleave speech with actions and note the pointer target', () => {
    const timeline = buildTimeline(input);
    expect(timeline.lines.map(l => l.text)).toEqual([
      'Selected Crate_1 (#530)',
      'Pointer over Barrel_3',
      'SAID: "delete this one"  ← at "this": pointer on Barrel_3 (#520); selection: Selected Crate_1 (#530)',
    ]);
    expect(timeline.actionCount).toBe(1);
    expect(timeline.durationMs).toBe(42_000);
  });

  it('should render a context that points to the full timeline', () => {
    const context = renderContext(buildTimeline(input), T0, '/tmp/s/SESSION.md');
    expect(context).toContain('Full, untrimmed timeline: /tmp/s/SESSION.md');
    expect(context).toContain('00:04.0  SAID: "delete this one"');
  });

  it('should drop far-away hovers first when over budget, and say so', () => {
    const many: RecordedEvent[] = Array.from({ length: 200 }, (_, i) => ({
      t: T0 + 60_000 + i * 1000,
      kind: 'viewport-hover',
      text: `Pointer over entity number ${i} somewhere far from any speech`,
    }));
    const timeline = buildTimeline({
      ...input,
      endedAt: T0 + 300_000,
      events: [...input.events, ...many],
    });
    const context = renderContext(timeline, T0, '/tmp/SESSION.md', 2000);
    expect(context.length).toBeLessThanOrEqual(2100);
    expect(context).toContain('SAID: "delete this one"');
    expect(context).toContain('Selected Crate_1 (#530)');
    expect(context).toMatch(/… \d+ more lines \(mostly hovers\) in the full timeline\./);
  });

  it('should write the session markdown with the timeline and transcript', () => {
    const md = renderSessionMarkdown(buildTimeline(input), {
      projectTitle: 'My scene',
      startedAt: T0,
    });
    expect(md).toContain('# Session recording: My scene');
    expect(md).toContain('## Timeline');
    expect(md).toContain('00:04.0  delete this one');
  });
});

describe('when formatting offsets', () => {
  it('should render mm:ss.s', () => {
    expect(formatOffset(0)).toBe('00:00.0');
    expect(formatOffset(65_430)).toBe('01:05.4');
  });
});

describe('when words come from separate stretches of speech', () => {
  it('should start a new utterance at each stretch even with no pause between the words', () => {
    const result = groupUtterances(
      [
        { start: 0, end: 300, text: ' delete', segment: 0 },
        { start: 300, end: 500, text: ' this', segment: 1 },
      ],
      T0,
    );
    expect(result.map(u => u.text)).toEqual(['delete', 'this']);
  });
});

describe('when something appeared in the running scene just before the user pointed with words', () => {
  const start = 1_000_000;
  const words: TranscriptWord[] = [
    { start: 5000, end: 5300, text: ' Kill', segment: 0 },
    { start: 5300, end: 5500, text: ' this', segment: 0 },
    { start: 5500, end: 5800, text: ' one', segment: 0 },
  ];
  const events: RecordedEvent[] = [
    {
      t: start + 1000,
      kind: 'scene-appear',
      text: 'While playing: A white sphere (#530) appeared',
      entity: { id: 530, name: 'white sphere' },
    },
    {
      t: start + 4100,
      kind: 'scene-appear',
      text: 'While playing: A large dark purple sphere (#600) appeared at (16, 2.6, 25)',
      entity: { id: 600, name: 'large dark purple sphere' },
    },
    {
      t: start + 2000,
      kind: 'scene-appear',
      text: 'While playing: A red box (#540) appeared',
      entity: { id: 540, name: 'red box' },
    },
    {
      t: start + 3000,
      kind: 'scene-remove',
      text: 'While playing: A red box (#540) disappeared',
      entity: { id: 540, name: 'red box' },
    },
    {
      t: start + 4200,
      kind: 'scene-appear',
      text: 'While playing: On-screen text "BOSS!" appeared',
    },
    {
      t: start + 5000,
      kind: 'scene-appear',
      text: 'While playing: On-screen text "BOSS!" appeared',
    },
    {
      t: start + 4500,
      kind: 'viewport-hover',
      text: 'While playing: Pointer over ArenaFloor (#512) in the viewport',
      entity: { id: 512, name: 'ArenaFloor' },
    },
  ];

  it('should list what is still there next to the pointer target, and not count it as an action', () => {
    const timeline = buildTimeline({
      startedAt: start,
      endedAt: start + 7000,
      audioStartedAt: start,
      words,
      events,
    });
    const said = timeline.lines.find(l => l.speech);
    expect(said?.text).toBe(
      'SAID: "Kill this one"  ← at "this": pointer on ArenaFloor (#512); just appeared: large dark purple sphere (#600) (1.2 s before), white sphere (#530) (4.3 s before), On-screen text "BOSS!" (0.3 s before)',
    );
    expect(timeline.actionCount).toBe(0);
  });
});
