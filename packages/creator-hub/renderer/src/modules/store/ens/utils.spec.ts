import { describe, expect, it } from 'vitest';

import { USER_PERMISSIONS, type ContributableDomain } from './types';
import { getStreamOnlyWorldNames } from './utils';

const domain = (name: string, permissions: USER_PERMISSIONS[]): ContributableDomain => ({
  name,
  user_permissions: permissions,
  owner: '0xowner',
  size: '0',
});

describe('getStreamOnlyWorldNames', () => {
  describe('when the wallet can stream to some Worlds and publish to others', () => {
    it('should keep only the Worlds it can stream to but not publish to, lower-cased', () => {
      expect(
        getStreamOnlyWorldNames([
          domain('Stream.dcl.eth', [USER_PERMISSIONS.STREAMING]),
          domain('deploy.dcl.eth', [USER_PERMISSIONS.DEPLOYMENT]),
          domain('both.dcl.eth', [USER_PERMISSIONS.DEPLOYMENT, USER_PERMISSIONS.STREAMING]),
        ]),
      ).toEqual(['stream.dcl.eth']);
    });
  });
});
