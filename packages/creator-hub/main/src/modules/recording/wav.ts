export const WAV_HEADER_BYTES = 44;

// A canonical 44-byte header for 16-bit mono PCM. Written once with size 0 when a recording
// starts and rewritten in place with the real size when it ends, so the file on disk is always a
// WAV that players and whisper.cpp can open.
export function wavHeader(dataBytes: number, sampleRate: number): Buffer {
  const header = Buffer.alloc(WAV_HEADER_BYTES);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + dataBytes, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(dataBytes, 40);
  return header;
}

// Loudest absolute sample in a chunk of little-endian 16-bit PCM.
export function pcmPeak(pcm: Uint8Array): number {
  const view = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  let peak = 0;
  for (let i = 0; i + 1 < pcm.byteLength; i += 2) {
    const sample = Math.abs(view.getInt16(i, true));
    if (sample > peak) peak = sample;
  }
  return peak;
}
