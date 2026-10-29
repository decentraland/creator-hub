import { describe, expect, it } from 'vitest';

import { encodeLandRedirect } from '/@/modules/store/ens/names';
import { ENSProvider, type ENS } from '/@/modules/store/ens/types';

import { getDomainState, validateDetails } from './details';

const SELF = '0xme';

const name = (subdomain: string, content = '', owner = SELF): ENS =>
  ({
    subdomain,
    name: subdomain.split('.')[0],
    provider: ENSProvider.DCL,
    nftOwnerAddress: owner,
    content,
  }) as ENS;

describe('validateDetails', () => {
  describe('when the fields are within their limits', () => {
    it('should be valid', () => {
      expect(validateDetails('Plaza', 'A square')).toEqual({ name: null, description: null });
    });
  });

  describe('when the name is empty', () => {
    it('should ask for one', () => {
      expect(validateDetails('  ', '').name).toEqual({ key: 'land_detail.details.name_required' });
    });
  });

  describe('when a field runs past its limit', () => {
    it('should name the limit, 50 for the name and 140 for the description', () => {
      expect(validateDetails('x'.repeat(51), 'y'.repeat(141))).toEqual({
        name: { key: 'land_detail.details.too_long', max: 50 },
        description: { key: 'land_detail.details.too_long', max: 140 },
      });
    });
  });
});

describe('getDomainState', () => {
  const context = {
    self: SELF,
    landId: '96,15',
    landIdByParcel: { '96,15': '96,15', '5,5': '7' },
    publishedWorlds: new Set(['fixtureone.dcl.eth']),
    landNameById: { '7': 'Plaza' },
  };

  describe('when the account owns no NAME', () => {
    it('should offer only to claim one', () => {
      expect(getDomainState([], context)).toEqual({ kind: 'empty' });
    });
  });

  describe('when it owns NAMEs and none points at this LAND', () => {
    it('should list them, marking the ones a World or another LAND uses', () => {
      expect(
        getDomainState(
          [
            name('fixtureone.dcl.eth'),
            name('fixturetwo.dcl.eth', encodeLandRedirect({ x: 5, y: 5 })),
            name('fixturethree.dcl.eth'),
          ],
          context,
        ),
      ).toEqual({
        kind: 'none',
        options: [
          { subdomain: 'fixtureone.dcl.eth', usedBy: 'fixtureone.dcl.eth' },
          { subdomain: 'fixturetwo.dcl.eth', usedBy: 'Plaza' },
          { subdomain: 'fixturethree.dcl.eth' },
        ],
      });
    });
  });

  describe('when one of its NAMEs points at this LAND', () => {
    it('should show it as set', () => {
      expect(
        getDomainState(
          [name('fixturethree.dcl.eth', encodeLandRedirect({ x: 96, y: 15 }))],
          context,
        ),
      ).toEqual({
        kind: 'set',
        name: 'fixturethree.dcl.eth',
        options: [{ subdomain: 'fixturethree.dcl.eth' }],
      });
    });
  });

  describe("when a NAME belongs to someone else or isn't a Decentraland NAME", () => {
    it('should leave it out', () => {
      expect(
        getDomainState(
          [
            name('theirs.dcl.eth', '', '0xother'),
            { ...name('ens.eth'), provider: ENSProvider.ENS },
          ],
          context,
        ),
      ).toEqual({ kind: 'empty' });
    });
  });
});
