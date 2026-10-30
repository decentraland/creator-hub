import React, { type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { createIconSet, type IconDrawing } from './icon-set.generated';
import * as inspectorIcons from './index';

// prettier-ignore
const NAMES = [
  'AiAgent', 'AlignToWorld', 'Apple', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'ArrowUp', 'AssetPack', 'Attach', 'AudioOff', 'AudioOn', 'Avatar',
  'AvatarAnimations', 'BrowseFolder', 'Bug', 'BuildMetaverse', 'Button', 'Camera',
  'CameraHierarchy', 'CheckCompleted', 'Checkmark', 'Cleanup', 'Close', 'Cloud',
  'Code', 'CodeAlt', 'CodeBash', 'CollapseExpandHorizontally', 'CollapseVertically', 'Container',
  'Copy', 'CreateEvent', 'Credits', 'Cube', 'CustomItem', 'CustomItemOutlined',
  'Cut', 'Delete', 'DeleteOutlined', 'Desktop', 'Details', 'DevWorkflow',
  'Documents', 'Dropdown', 'Duplicate', 'Edit', 'Expand', 'ExpandVertically',
  'ExportUpload', 'Favorite', 'Flow', 'FolderOpen', 'FullScreen', 'GUIRoot',
  'Grid', 'Help', 'Hexagon', 'Hexagons', 'HidePreview', 'Image',
  'ImageAlt', 'Images', 'ImportDownload', 'Info', 'Input', 'Joystick',
  'JumpIn', 'Kebab', 'Keyboard', 'Label', 'Layout', 'LayoutOutlined',
  'LayoutWarning', 'Learn', 'Leave', 'Likes', 'Link', 'LinkAlt',
  'ListAll', 'ListBullets', 'LocalAssets', 'Lock', 'LockOpen', 'Magnet',
  'MapPin', 'Minus', 'Mobile', 'MoreOptions', 'Move', 'NewChat',
  'NoConnection', 'None', 'Open', 'Optimize', 'Others', 'Paint',
  'PaintOutlined', 'Paste', 'Pause', 'Photo', 'Pin', 'Play',
  'Player', 'PlayerLocation', 'Plus', 'Podium', 'Prefab', 'Preview',
  'Private', 'Public', 'Redo', 'Reload', 'Rotate', 'SafeArea',
  'Save', 'Scale', 'SceneStats', 'Scenes', 'Search', 'SearchCloud',
  'Settings', 'ShowPreview', 'Smart', 'SmartItem', 'SmartOutlined', 'Snap',
  'Stop', 'Storage', 'Sync', 'Tag', 'Templates', 'Tip',
  'Transfer', 'Translation', 'Undo', 'Variable', 'Video', 'Videos',
  'Visibility', 'VisibilityOff', 'Warning', 'Windows', 'ZoomIn', 'ZoomOut',
];

type Call = { path: ReactNode; name: string; small?: IconDrawing };

const stub = vi.fn(
  (path: ReactNode, name: string, small?: IconDrawing): Call => ({
    path,
    name,
    small,
  }),
);
const set = createIconSet(stub);
const markup = (node: ReactNode) => renderToStaticMarkup(<>{node}</>);

describe('createIconSet', () => {
  it('should call the factory once per code name with that name', () => {
    expect(stub).toHaveBeenCalledTimes(NAMES.length);
    expect(Object.values(set).map(call => call.name)).toEqual(NAMES);
  });

  it('should hand a compact twin its 24-frame crop', () => {
    expect(set.Edit.small?.viewBox).toBe('4 4 16 16');
    expect(set.Scenes.small?.viewBox).toBe('4 4 16 16');
  });

  it('should hand a 16-frame small drawing its own frame', () => {
    expect(set.Mobile.small?.viewBox).toBe('0 0 16 16');
    expect(set.Cube.small?.viewBox).toBe('0 0 16 16');
    expect(set.LayoutOutlined.small?.viewBox).toBe('0 0 16 16');
  });

  it('should scale a 16-frame-only drawing into the 24 frame and give it no small drawing', () => {
    expect(set.Button.small).toBeUndefined();
    expect(markup(set.Button.path)).toContain('transform="scale(1.5)"');
  });

  it('should render small and base drawings that differ', () => {
    expect(markup(set.Edit.small?.path)).not.toBe(markup(set.Edit.path));
  });
});

describe('the generated set', () => {
  it('should hold exactly the 144 code names', () => {
    expect(Object.keys(set)).toEqual(NAMES);
    expect(NAMES).toHaveLength(144);
  });

  it('should follow MUI naming: no Icon suffix, no merged-away names', () => {
    const names = Object.keys(set);
    expect(names.filter(name => name.endsWith('Icon'))).toEqual([]);
    expect(names).not.toContain('Layers');
    expect(names).not.toContain('Models');
    expect(names).not.toContain('All');
  });

  it("should keep Leave's Primary arrow as drawn", () => {
    expect(markup(set.Leave.path)).toContain('fill="#FF2D55"');
    expect(markup(set.Leave.path)).toContain('fill="currentColor"');
  });
});

describe('the inspector binding', () => {
  it('should export the 144 icons plus its SvgIcon and factory', () => {
    expect(Object.keys(inspectorIcons).sort()).toEqual(
      [...NAMES, 'SvgIcon', 'createSvgIcon'].sort(),
    );
  });

  it.each(NAMES)('should render %s with the inspector SvgIcon', name => {
    const Icon = inspectorIcons[name as keyof typeof inspectorIcons] as React.ElementType;
    const svg = render(<Icon />).container.querySelector('svg')!;
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(svg.classList).toContain('SvgIcon--fontSizeMedium');
  });
});
