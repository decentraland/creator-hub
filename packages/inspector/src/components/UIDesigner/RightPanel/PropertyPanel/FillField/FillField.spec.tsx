import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { Entity, TextureUnion } from '@dcl/ecs';

import type * as UiBarrel from '../../../../ui';
import { FillField } from './FillField';

vi.mock('../../../../../hooks/useAssetOptions', () => ({
  useAssetOptions: () => [],
}));

vi.mock('../../../../ui', async importOriginal => ({
  ...(await importOriginal<typeof UiBarrel>()),
  FileUploadField: ({ label }: { label?: string }) => <div>{label}</div>,
}));

const WHITE = { r: 1, g: 1, b: 1, a: 1 };

function renderField(props: { color?: typeof WHITE; texture?: TextureUnion }) {
  const onPatch = vi.fn();
  render(
    <FillField
      color={props.color}
      texture={props.texture}
      entity={1 as unknown as Entity}
      onPatch={onPatch}
    />,
  );
  return { onPatch };
}

const checked = (label: string) => screen.getByLabelText(label).getAttribute('aria-checked');

describe('when the node has a colour but no texture', () => {
  it('should read as Solid colour', () => {
    renderField({ color: WHITE });

    expect(checked('Solid colour')).toBe('true');
    expect(checked('Image file')).toBe('false');
  });

  it('should switch to Image file and stay there, since an image fill carries a colour too', () => {
    const { onPatch } = renderField({ color: WHITE });

    fireEvent.click(screen.getByLabelText('Image file'));

    expect(onPatch).toHaveBeenCalledWith({ texture: undefined });
    expect(checked('Image file')).toBe('true');
    expect(checked('Solid colour')).toBe('false');
  });
});

describe('when the source authors a texture', () => {
  it('should outrank an explicit pick, because the case is unambiguous', () => {
    renderField({
      color: WHITE,
      texture: { tex: { $case: 'texture', texture: { src: 'images/a.png' } } } as TextureUnion,
    });

    expect(checked('Image file')).toBe('true');

    fireEvent.click(screen.getByLabelText('Solid colour'));

    expect(checked('Image file')).toBe('true');
  });
});

describe('when nothing is authored', () => {
  it('should read as No fill', () => {
    renderField({});

    expect(checked('No fill')).toBe('true');
  });
});
