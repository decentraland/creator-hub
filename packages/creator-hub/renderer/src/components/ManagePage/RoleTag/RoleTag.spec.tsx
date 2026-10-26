import { cleanup, render, screen } from '@testing-library/react';
import { flatten } from 'flat';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import { RoleType } from '/@/lib/land';
import { WorldRoleType } from '/@/lib/worlds';
import { en } from '/@/modules/store/translation/locales';
import { setCurrentLocale } from '/@/modules/store/translation/utils';

import { getRoleTag, RoleTag } from '.';

describe('getRoleTag', () => {
  describe('when the account owns the place, or rents it out', () => {
    it('should give no tag', () => {
      expect(getRoleTag(RoleType.OWNER)).toBeUndefined();
      expect(getRoleTag(RoleType.LESSOR)).toBeUndefined();
      expect(getRoleTag(WorldRoleType.OWNER)).toBeUndefined();
    });
  });

  describe('when the account is a token update operator or a World collaborator', () => {
    it('should tag it Collaborator', () => {
      expect(getRoleTag(RoleType.OPERATOR)).toBe('collaborator');
      expect(getRoleTag(WorldRoleType.COLLABORATOR)).toBe('collaborator');
    });
  });

  describe('when the account is an UpdateManager', () => {
    it('should tag it Manager', () => {
      expect(getRoleTag(RoleType.MANAGER)).toBe('manager');
    });
  });

  describe('when the account rents the LAND', () => {
    it('should tag it Tenant', () => {
      expect(getRoleTag(RoleType.TENANT)).toBe('tenant');
    });
  });
});

describe('RoleTag', () => {
  beforeAll(() => {
    setCurrentLocale('en', flatten(en));
  });

  afterEach(cleanup);

  describe('when rendered as a manager', () => {
    it('should read as plain text, with no role of its own', () => {
      const { container } = render(
        <ThemeProvider theme={dark}>
          <RoleTag variant="manager" />
        </ThemeProvider>,
      );

      expect(screen.getByText('Manager').tagName).toBe('SPAN');
      expect(container.querySelector('[role]')).toBeNull();
    });
  });
});
