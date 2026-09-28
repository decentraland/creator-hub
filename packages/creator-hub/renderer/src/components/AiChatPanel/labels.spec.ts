import { describe, expect, it } from 'vitest';

import { toolChipLabel } from './labels';

describe('toolChipLabel', () => {
  it('renders a scene/Explorer MCP tool as its readable name', () => {
    expect(toolChipLabel('mcp__creator-hub__create_entity')).toBe('create entity');
    expect(toolChipLabel('mcp__creator-hub__explorer_screenshot')).toBe('explorer screenshot');
  });

  it('maps known CLI tools to a verb', () => {
    expect(toolChipLabel('Read')).toBe('Read');
    expect(toolChipLabel('Edit')).toBe('Edited');
    expect(toolChipLabel('Bash')).toBe('Ran');
  });

  it('falls back to the raw name for an unknown tool', () => {
    expect(toolChipLabel('SomethingElse')).toBe('SomethingElse');
  });
});
