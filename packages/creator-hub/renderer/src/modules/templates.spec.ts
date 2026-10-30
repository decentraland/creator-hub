import { describe, expect, it } from 'vitest';

import { TEMPLATES } from './templates';

describe('TEMPLATES', () => {
  it('should give every template a unique id', () => {
    const ids = TEMPLATES.map($ => $.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('should give every template a GitHub repo to clone from', () => {
    for (const template of TEMPLATES) {
      expect(template.repo, template.id).toMatch(/^https:\/\/github\.com\/[^/]+\/[^/]+$/);
    }
  });

  it('should bundle artwork for every template so no card renders blank', () => {
    for (const template of TEMPLATES) {
      expect(template.imageUrl || template.videoUrl, template.id).toBeTruthy();
    }
  });

  it('should carry a parseable creation date so the Newest sort works', () => {
    for (const template of TEMPLATES) {
      expect(Number.isNaN(Date.parse(template.createdAt)), template.id).toBe(false);
    }
  });
});
