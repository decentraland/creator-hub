import type { Entity } from '@dcl/ecs';

export interface Props {
  entities: Entity[];
  initialOpen?: boolean;
}

export type TextShapeInput = {
  text: string;
  font: string;
  fontSize: string;
  fontAutoSize: boolean;
  textAlign: string;
  width: string;
  height: string;
  paddingTop: string;
  paddingRight: string;
  paddingBottom: string;
  paddingLeft: string;
  outlineWidth: string;
  lineSpacing: string;
  lineCount: string;
  textWrapping: boolean;
  shadowBlur: string;
  shadowOffsetX: string;
  shadowOffsetY: string;
  shadowColor: string;
  outlineColor: string;
  textColor: string;
  // hidden pass-through: the hex color picker is RGB-only, so the alpha channel
  // of textColor is carried here and reapplied when converting back
  textColorAlpha: string;
};
