import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const preload = vi.hoisted(() => ({ sendEvents: vi.fn() }));
vi.mock('#preload', () => ({ recording: preload }));

import {
  describeHubElement,
  hubArea,
  setActiveRecordingSession,
  startHubDomRecorder,
} from './session';

describe('when labelling a clicked element in the Creator Hub window', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <header class="Header">
        <div data-testid="editor-page-back-button"><svg data-testid="ArrowBackIosIcon"><path id="glyph"/></svg></div>
        <button aria-label="Open the AI Assistant"><svg id="sparkle"></svg></button>
      </header>
      <section data-recording-area="AI assistant panel"><button id="send">Send</button></section>`;
  });

  it('should use the aria-label of the button around an icon', () => {
    const icon = document.getElementById('sparkle')!;
    expect(describeHubElement(icon)).toBe('Open the AI Assistant');
  });

  it('should fall back to the control test id, not the icon name', () => {
    const glyph = document.getElementById('glyph')!;
    expect(describeHubElement(glyph)).toBe('editor page back button');
    expect(hubArea(glyph)).toBe('Editor header');
  });

  it('should name tagged areas', () => {
    expect(hubArea(document.getElementById('send')!)).toBe('AI assistant panel');
  });
});

describe('when the Creator Hub window is clicked', () => {
  let stop: () => void;

  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML =
      '<button id="b">Play</button><button id="r" data-recording-ignore>Record</button>';
    stop = startHubDomRecorder();
  });

  afterEach(() => {
    stop();
    setActiveRecordingSession(null);
  });

  it('should record nothing while no recording runs', () => {
    document.getElementById('b')!.click();
    expect(preload.sendEvents).not.toHaveBeenCalled();
  });

  it('should send the click to the running session', () => {
    setActiveRecordingSession('s1');
    document.getElementById('b')!.click();
    expect(preload.sendEvents).toHaveBeenCalledWith('s1', [
      expect.objectContaining({ kind: 'click', text: 'Clicked "Play" in the Creator Hub' }),
    ]);
  });

  it('should skip the Record button itself', () => {
    setActiveRecordingSession('s1');
    document.getElementById('r')!.click();
    expect(preload.sendEvents).not.toHaveBeenCalled();
  });

  it('should stop listening once stopped', () => {
    setActiveRecordingSession('s1');
    stop();
    document.getElementById('b')!.click();
    expect(preload.sendEvents).not.toHaveBeenCalled();
  });
});
