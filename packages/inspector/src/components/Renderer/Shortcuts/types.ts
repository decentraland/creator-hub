export interface Props {
  canvas: React.RefObject<HTMLCanvasElement>;
  onZoomIn: () => void;
  onZoomOut: () => void;
}
