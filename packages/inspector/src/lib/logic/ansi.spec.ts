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
        { text: 'ok', fontWeight: 'bold', textDecoration: 'underline', color: '#0dbc79' },
      ]);
    });

    // These are spread into a `style` prop, so they have to be CSS property names — a
    // `bold: true` would be dropped by the browser without any error.
    it.each([
      ['1', 'fontWeight', 'bold'],
      ['3', 'fontStyle', 'italic'],
      ['4', 'textDecoration', 'underline'],
    ])('should map code %s to the CSS property %s', (code, property, value) => {
      expect(parseAnsi(`${ESC}[${code}mx`)).toEqual([{ text: 'x', [property]: value }]);
    });

    it.each([
      ['1', '22', 'fontWeight'],
      ['3', '23', 'fontStyle'],
      ['4', '24', 'textDecoration'],
    ])('should let code %s be turned off by %s', (on, off, property) => {
      const segments = parseAnsi(`${ESC}[${on}mon${ESC}[${off}moff`);

      expect(segments[1]).toEqual({ text: 'off' });
      expect(segments[1]).not.toHaveProperty(property);
    });

    it('should reset styles on an empty parameter list', () => {
      expect(parseAnsi(`${RED}red${ESC}[mplain`)).toEqual([
        { text: 'red', color: '#cd3131' },
        { text: 'plain' },
      ]);
    });

    it.each([
      ['2', 'opacity', 0.6],
      ['9', 'textDecoration', 'line-through'],
    ])('should map code %s to the CSS property %s', (code, property, value) => {
      expect(parseAnsi(`${ESC}[${code}mx`)).toEqual([{ text: 'x', [property]: value }]);
    });

    // One CSS property carries two independent codes, so neither may clobber the other.
    it('should combine underline and strikethrough', () => {
      expect(parseAnsi(`${ESC}[4;9mx`)).toEqual([
        { text: 'x', textDecoration: 'underline line-through' },
      ]);
      expect(parseAnsi(`${ESC}[9;4mx`)).toEqual([
        { text: 'x', textDecoration: 'underline line-through' },
      ]);
    });

    it('should let 22 turn off dim as well as bold', () => {
      expect(parseAnsi(`${ESC}[1;2mon${ESC}[22moff`)[1]).toEqual({ text: 'off' });
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
