import { beforeEach, describe, expect, it } from 'vitest';
import { createJsonlSplitter, parseJsonlLine } from '../src/modules/jsonl';

describe('createJsonlSplitter', () => {
  let lines: string[];
  let splitter: ReturnType<typeof createJsonlSplitter>;

  beforeEach(() => {
    lines = [];
    splitter = createJsonlSplitter(line => lines.push(line));
  });

  describe('when a chunk contains multiple LF-terminated records', () => {
    it('should emit one line per record', () => {
      splitter.feed('{"a":1}\n{"b":2}\n');
      expect(lines).toEqual(['{"a":1}', '{"b":2}']);
    });
  });

  describe('when a record is split across chunks', () => {
    it('should emit the line only once the LF arrives', () => {
      splitter.feed('{"a":');
      expect(lines).toEqual([]);
      splitter.feed('1}\n');
      expect(lines).toEqual(['{"a":1}']);
    });
  });

  describe('when records are CRLF-terminated', () => {
    it('should strip the trailing CR', () => {
      splitter.feed('{"a":1}\r\n');
      expect(lines).toEqual(['{"a":1}']);
    });
  });

  describe('when a JSON string contains U+2028/U+2029 separators', () => {
    it('should not split the record on them', () => {
      const record = '{"text":"line break here"}';
      splitter.feed(`${record}\n`);
      expect(lines).toEqual([record]);
      expect(JSON.parse(lines[0]).text).toBe('line break here');
    });
  });

  describe('when a multi-byte UTF-8 character is split across chunks', () => {
    it('should reassemble the character correctly', () => {
      const buffer = Buffer.from('{"text":"café"}\n', 'utf8');
      splitter.feed(buffer.subarray(0, 12));
      splitter.feed(buffer.subarray(12));
      expect(lines).toEqual(['{"text":"café"}']);
    });
  });

  describe('when the stream ends with an unterminated line', () => {
    it('should flush the remaining buffer on end', () => {
      splitter.feed('{"a":1}');
      splitter.end();
      expect(lines).toEqual(['{"a":1}']);
    });
  });
});

describe('parseJsonlLine', () => {
  describe('when the line is a valid JSON object', () => {
    it('should return the parsed object', () => {
      expect(parseJsonlLine('{"type":"agent_start"}')).toEqual({ type: 'agent_start' });
    });
  });

  describe('when the line is empty or whitespace', () => {
    it('should return null', () => {
      expect(parseJsonlLine('')).toBeNull();
      expect(parseJsonlLine('   ')).toBeNull();
    });
  });

  describe('when the line is not valid JSON', () => {
    it('should return null', () => {
      expect(parseJsonlLine('starting agent...')).toBeNull();
    });
  });

  describe('when the line is valid JSON but not an object', () => {
    it('should return null', () => {
      expect(parseJsonlLine('[1,2,3]')).toBeNull();
      expect(parseJsonlLine('"hello"')).toBeNull();
      expect(parseJsonlLine('42')).toBeNull();
    });
  });
});
