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
  paddingTop: string;
  paddingRight: string;
  paddingBottom: string;
  paddingLeft: string;
  outlineWidth: string;
  lineSpacing: string;
  lineCount: string;
  outlineColor: string;
  textColor: string;
};
