import { RECORDING_SAMPLE_RATE } from '/shared/types/recording';

// Microphone capture for the session recorder: the system's default input device, resampled by
// the AudioContext to 16 kHz mono and converted to 16-bit PCM in an AudioWorklet, delivered in
// ~100 ms chunks. Kept in the renderer because that's where getUserMedia lives; the chunks go
// straight to main, which writes them to disk (nothing is held here).

const CHUNK_SAMPLES = RECORDING_SAMPLE_RATE / 10;

// Inline so it needs no bundler asset handling; the renderer's CSP allows blob: scripts.
const WORKLET_SOURCE = `
class PcmCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Int16Array(${CHUNK_SAMPLES});
    this.length = 0;
  }
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (!channel) return true;
    for (let i = 0; i < channel.length; i++) {
      const s = Math.max(-1, Math.min(1, channel[i]));
      this.buffer[this.length++] = s < 0 ? s * 0x8000 : s * 0x7fff;
      if (this.length === this.buffer.length) {
        this.port.postMessage(this.buffer.buffer, [this.buffer.buffer]);
        this.buffer = new Int16Array(${CHUNK_SAMPLES});
        this.length = 0;
      }
    }
    return true;
  }
}
registerProcessor('pcm-capture', PcmCapture);
`;

export type Microphone = {
  // The device the OS gave us, e.g. "MacBook Pro Microphone" — shown so the user knows which.
  label: string;
  stop: () => void;
};

export async function startMicrophone(
  onChunk: (pcm: Uint8Array, firstSampleAt?: number) => void,
): Promise<Microphone> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    video: false,
  });
  const context = new AudioContext({ sampleRate: RECORDING_SAMPLE_RATE });
  const workletUrl = URL.createObjectURL(
    new Blob([WORKLET_SOURCE], { type: 'application/javascript' }),
  );
  try {
    await context.audioWorklet.addModule(workletUrl);
  } catch (error) {
    stream.getTracks().forEach(track => track.stop());
    void context.close();
    throw error;
  } finally {
    URL.revokeObjectURL(workletUrl);
  }

  const source = context.createMediaStreamSource(stream);
  // No outputs: a sink, processed while it has input without being wired to the speakers.
  // channelCount 1 + explicit downmixes a stereo device to mono.
  const node = new AudioWorkletNode(context, 'pcm-capture', {
    numberOfInputs: 1,
    numberOfOutputs: 0,
    channelCount: 1,
    channelCountMode: 'explicit',
  });
  let first = true;
  node.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
    const pcm = new Uint8Array(event.data);
    if (first) {
      first = false;
      // When the first sample of this chunk was heard: now, minus the chunk and the output
      // latency the context reports. Close enough for ±0.5 s alignment.
      const chunkMs = (pcm.byteLength / 2 / RECORDING_SAMPLE_RATE) * 1000;
      onChunk(pcm, Date.now() - chunkMs - (context.baseLatency || 0) * 1000);
    } else {
      onChunk(pcm);
    }
  };
  source.connect(node);

  let stopped = false;
  return {
    label: stream.getAudioTracks()[0]?.label ?? '',
    stop: () => {
      if (stopped) return;
      stopped = true;
      node.port.onmessage = null;
      source.disconnect();
      node.disconnect();
      stream.getTracks().forEach(track => track.stop());
      void context.close();
    },
  };
}
