import { describe, expect, it } from 'vitest';

import { parseCsv } from './csv';

const WALLET = '0x00000000000000000000000000000000000000A1';
const COMMUNITY = '6f9619ff-8b86-d011-b42d-00c04fc964ff';

describe('parseCsv', () => {
  describe('when every line is a wallet or a community', () => {
    it('should keep the file name and the distinct wallets (lower-cased) and communities', () => {
      expect(
        parseCsv('invites.csv', `${WALLET}\n${WALLET.toLowerCase()}\r\n${COMMUNITY}\n\n`),
      ).toEqual({
        fileName: 'invites.csv',
        addresses: [WALLET.toLowerCase()],
        communityIds: [COMMUNITY],
        invalidLines: [],
      });
    });
  });

  describe('when some lines are neither', () => {
    it('should list them as invalid', () => {
      expect(
        parseCsv('invites.csv', `${WALLET}\nnot-an-address\nfixture.dcl.eth`).invalidLines,
      ).toEqual(['not-an-address', 'fixture.dcl.eth']);
    });
  });
});
