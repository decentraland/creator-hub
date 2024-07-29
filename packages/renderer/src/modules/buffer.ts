const decoder = new TextDecoder();

export function bufferToJson(buffer: Buffer) {
  return JSON.parse(decoder.decode(buffer));
}
