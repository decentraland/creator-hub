import { StringDecoder } from 'node:string_decoder';

/**
 * Creates a JSONL splitter compliant with pi's RPC framing: records are split
 * on LF only (a trailing CR is stripped). Node's readline is NOT suitable here
 * because it also splits on U+2028/U+2029, which are valid inside JSON strings.
 */
export function createJsonlSplitter(onLine: (line: string) => void) {
  const decoder = new StringDecoder('utf8');
  let buffer = '';

  const feed = (chunk: Buffer | string) => {
    buffer += typeof chunk === 'string' ? chunk : decoder.write(chunk);

    let newlineIndex = buffer.indexOf('\n');
    while (newlineIndex !== -1) {
      let line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);
      if (line.endsWith('\r')) line = line.slice(0, -1);
      onLine(line);
      newlineIndex = buffer.indexOf('\n');
    }
  };

  const end = () => {
    buffer += decoder.end();
    if (buffer.length > 0) {
      const line = buffer.endsWith('\r') ? buffer.slice(0, -1) : buffer;
      buffer = '';
      onLine(line);
    }
  };

  return { feed, end };
}

/**
 * Parses a single JSONL line into an object. Returns null for empty lines or
 * lines that are not valid JSON objects (pi may print stray non-JSON output
 * on startup).
 */
export function parseJsonlLine(line: string): Record<string, unknown> | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}
