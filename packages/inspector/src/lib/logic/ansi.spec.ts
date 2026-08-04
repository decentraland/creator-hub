import { parseAnsi } from './ansi';

const ESC = String.fromCharCode(27);
const RED = `${ESC}[31m`;
const RESET = `${ESC}[0m`;

describe('parseAnsi', () => {
  describe('when the line has no escape sequences', () => {
    it('should return a single unstyled segment', () => {
      expect(parseAnsi('plain output')).toEqual([{ text: 'plain output' }]);
    });

    it('should return nothing for an empty line', () => {
      expect(parseAnsi('')).toEqual([]);
    });
  });

  describe('when the line contains a colour sequence', () => {
    it('should style only the text inside it', () => {
      expect(parseAnsi(`before${RED}red${RESET}after`)).toEqual([
        { text: 'before' },
        { text: 'red', color: '#cd3131' },
        { text: 'after' },
      ]);
    });

    it('should apply bright foreground colours', () => {
      expect(parseAnsi(`${ESC}[91mbright`)).toEqual([{ text: 'bright', color: '#f14c4c' }]);
    });

    it('should apply background colours', () => {
      expect(parseAnsi(`${ESC}[41mbg`)).toEqual([{ text: 'bg', backgroundColor: '#cd3131' }]);
    });

    it('should combine styles from a multi-parameter sequence', () => {
      expect(parseAnsi(`${ESC}[1;4;32mok`)).toEqual([
        { text: 'ok', bold: true, underline: true, color: '#0dbc79' },
      ]);
    });

    it('should reset styles on an empty parameter list', () => {
      expect(parseAnsi(`${RED}red${ESC}[mplain`)).toEqual([
        { text: 'red', color: '#cd3131' },
        { text: 'plain' },
      ]);
    });

    it('should resolve 256-colour sequences', () => {
      expect(parseAnsi(`${ESC}[38;5;196mx`)).toEqual([{ text: 'x', color: '#ff0000' }]);
    });

    it('should resolve truecolor sequences', () => {
      expect(parseAnsi(`${ESC}[38;2;18;52;86mx`)).toEqual([{ text: 'x', color: '#123456' }]);
    });

    it('should drop a truncated extended-colour sequence rather than emit an invalid colour', () => {
      expect(parseAnsi(`${ESC}[38;2;18mx`)).toEqual([{ text: 'x', color: undefined }]);
    });
  });

  describe('when the line contains markup', () => {
    // A log line is free to contain angle brackets. The parser returns them as text, so
    // React renders them as characters rather than as elements.
    const markup = [
      '<img src=x onerror=alert(1)>',
      '<script>alert(1)</script>',
      '<a href="javascript:alert(1)">click</a>',
      '<span style="color:#0A0">styled</span>',
    ];

    it.each(markup)('should keep %s as literal text', sample => {
      expect(parseAnsi(sample)).toEqual([{ text: sample }]);
    });

    it('should keep markup literal even when wrapped in colour codes', () => {
      expect(parseAnsi(`${RED}<img src=x onerror=alert(1)>${RESET}`)).toEqual([
        { text: '<img src=x onerror=alert(1)>', color: '#cd3131' },
      ]);
    });

    it('should not treat a bare bracket sequence as an escape code', () => {
      // Without the ESC byte this is just text, e.g. a log line mentioning "[31m".
      expect(parseAnsi('log [31m literal')).toEqual([{ text: 'log [31m literal' }]);
    });
  });
});
