import type { IFuture } from 'fp-future';
import future from 'fp-future';
import * as BABYLON from '@babylonjs/core';
import * as GUI from '@babylonjs/gui';
import type { PBTextShape } from '@dcl/ecs';
import { Font } from '@dcl/ecs';
import { ComponentType } from '@dcl/ecs';

import type { ComponentOperation } from '../component-operations';
import type { EcsEntity } from '../EcsEntity';
import {
  TEXT_ALIGN_MODES,
  getBabylonGUIOffset,
  toBabylonGUIAlignment,
} from '../../../../components/EntityInspector/TextShapeInspector/utils';
import { toHex } from '../../../../components/ui/ColorField/utils';

export const TEXT_SHAPE_RATIO = 33;

export const putTextShapeComponent: ComponentOperation = async (entity, component) => {
  // load fonts used by TextShape
  await loadFonts();

  if (component.componentType === ComponentType.LastWriteWinElementSet) {
    const value = component.getOrNull(entity.entityId) as PBTextShape | null;

    // easier to always dispose text mesh for now...
    dispose(entity);

    if (value?.text) {
      // create a temp text block to measure the text size
      let tb = createTextBlock(value);
      const canvas = GUI.AdvancedDynamicTexture.CreateFullscreenUI('canvas');
      const ctx = canvas.getContext();
      ctx.font = `${tb.fontWeight || 'normal'} ${tb.fontSizeInPixels}px ${tb.fontFamily}`;
      canvas.dispose();
      const lines = tb.text.split('\n');
      const longest = lines.reduce((a, b) => (a.length > b.length ? a : b));
      const measure = ctx.measureText(longest);
      const paddingX =
        parseFloat(tb.paddingLeft.toString()) + parseFloat(tb.paddingRight.toString());
      const paddingY =
        parseFloat(tb.paddingTop.toString()) + parseFloat(tb.paddingBottom.toString());
      const width = measure.width + paddingX;
      const baseLineSpace = tb.fontSizeInPixels / 2;
      const lineSpace =
        (typeof tb.lineSpacing === 'string' ? parseInt(tb.lineSpacing) : tb.lineSpacing) +
        baseLineSpace;
      const spaceBetween = (lines.length - 1) * lineSpace;
      const height = tb.fontSizeInPixels * lines.length + spaceBetween + paddingY;

      // create actual text block usingt the right width and height
      tb = createTextBlock({ ...value, width, height });

      const mesh = BABYLON.MeshBuilder.CreatePlane(
        entity.entityId.toString(),
        { width: width / TEXT_SHAPE_RATIO, height: height / TEXT_SHAPE_RATIO },
        entity.getScene(),
      );

      const advancedTexture = GUI.AdvancedDynamicTexture.CreateForMesh(mesh, width, height);

      advancedTexture.addControl(tb);

      mesh.parent = entity;

      const [vertical, horizontal] = getBabylonGUIOffset(
        value.textAlign ?? TEXT_ALIGN_MODES[0].value,
        width,
        height,
      );
      mesh.position.x += horizontal / TEXT_SHAPE_RATIO;
      mesh.position.y -= vertical / TEXT_SHAPE_RATIO;
      entity.ecsComponentValues.textShape = value;
      entity.textShape = mesh;
    }
  }
};

function dispose(entity: EcsEntity) {
  if (entity.textShape) {
    entity.textShape.dispose(false, true);
    entity.textShape.parent = null;
    entity.ecsComponentValues.textShape = undefined;
    delete entity.textShape;
  }
}

function createTextBlock(value: PBTextShape) {
  const tb = new GUI.TextBlock();
  const [horizontalAlignment, verticalAlignment] = toBabylonGUIAlignment(
    value.textAlign ?? TEXT_ALIGN_MODES[0].value,
  );

  const hair = String.fromCharCode(8202); // hair space
  tb.text = value.text
    // fix letter spacing
    .split('')
    .join(hair)
    // apply lineCount
    .split('\n')
    .map((line, index) =>
      typeof value.lineCount === 'number' ? (index < value.lineCount ? line : '') : line,
    ) // remove lines if lineCount is set
    .join('\n');
  const font = value.font ?? Font.F_SANS_SERIF;
  switch (font) {
    case Font.F_SERIF: {
      // Use an actual serif font (Unity screenshot shows clear serifs)
      tb.fontFamily = '"Liberation Serif", "Noto Serif", Georgia, "Times New Roman", Times, serif';
      tb.fontWeight = '600';
      break;
    }
    case Font.F_MONOSPACE: {
      // Prefer a real monospace font for MONOSPACE
      tb.fontFamily =
        '"Liberation Mono", "Roboto Mono", "SFMono-Regular", Menlo, Monaco, Consolas, "Courier New", monospace';
      tb.fontWeight = '400';
      break;
    }
    case Font.F_SANS_SERIF:
    default: {
      // Unity maps SANS_SERIF -> LiberationSans
      tb.fontFamily = '"Liberation Sans", Inter, "Noto Sans", Arial, sans-serif';
      tb.fontWeight = '400';
      break;
    }
  }
  tb.fontSize = (value.fontSize ?? 0) * 3;
  tb.width = `${value.width ?? 0}px`;
  tb.height = `${value.height ?? 0}px`;
  tb.textHorizontalAlignment = horizontalAlignment;
  tb.textVerticalAlignment = verticalAlignment;
  tb.textWrapping = true;
  tb.paddingTop = (value.paddingTop ?? 0) * TEXT_SHAPE_RATIO;
  tb.paddingRight = (value.paddingRight ?? 0) * TEXT_SHAPE_RATIO;
  tb.paddingBottom = (value.paddingBottom ?? 0) * TEXT_SHAPE_RATIO;
  tb.paddingLeft = (value.paddingLeft ?? 0) * TEXT_SHAPE_RATIO;
  tb.outlineWidth = (value.outlineWidth ?? 0) * 16;
  tb.lineSpacing = (value.lineSpacing ?? 0) / 4.5;
  tb.color = toHex(value.textColor);
  tb.outlineColor = toHex(value.outlineColor);

  return tb;
}

let fontFuture: IFuture<void> | null = null;
async function loadFonts() {
  if (!fontFuture) {
    fontFuture = future();
    try {
      // Load fonts for TextShape mappings:
      // - Sans Serif: Liberation Sans (Unity-like)
      // - Serif: Liberation Serif (actual serif)
      // - Monospace: Liberation Mono (actual monospace)
      // If a family fails to load for any reason, the renderer will fall back to the next family.
      const linkId = 'dcl-textshape-fonts';
      if (!document.getElementById(linkId)) {
        const link = document.createElement('link');
        link.id = linkId;
        link.rel = 'stylesheet';
        link.href =
          'https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=Liberation+Sans:wght@400;700&family=Liberation+Serif:wght@400;700&family=Liberation+Mono:wght@400;700&family=Roboto+Mono:wght@400&display=swap';
        document.head.appendChild(link);
      }

      // Also keep Noto Sans as a reliable fallback (already used historically in the Inspector).
      const notoSans = new FontFace(
        'Noto Sans',
        'url(https://fonts.gstatic.com/s/notosans/v36/o-0bIpQlx3QUlC5A4PNB6Ryti20_6n1iPHjc5a7du3mhPy0.woff2)', // latin
      );
      await notoSans.load();
      document.fonts.add(notoSans);

      // Ask the browser to resolve these faces (best-effort).
      await Promise.allSettled([
        document.fonts.load('400 16px Inter'),
        document.fonts.load('600 16px Inter'),
        document.fonts.load('400 16px "Liberation Sans"'),
        document.fonts.load('400 16px "Liberation Serif"'),
        document.fonts.load('400 16px "Liberation Mono"'),
        document.fonts.load('400 16px "Roboto Mono"'),
      ]);
    } finally {
      fontFuture.resolve();
    }
  }
  return fontFuture;
}
