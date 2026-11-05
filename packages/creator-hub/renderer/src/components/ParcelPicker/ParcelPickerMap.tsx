import { useCallback, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { dclColors } from 'decentraland-ui2';

import { coordsToId } from '/@/lib/land';
import { t } from '/@/modules/store/translation/utils';
import { getWorldDimensions, MAX_COORDINATE, MIN_COORDINATE } from '/@/modules/world';
import { WorldAtlas, WorldAtlasColors, type AtlasScene } from '/@/components/WorldAtlas';

import {
  type Allowed,
  type Coord,
  type Direction,
  isAllowed as allows,
  isDirection,
  nearestParcel,
  nextParcel,
  toCoord,
  toId,
} from './cursor';
import { MapFrame, VisuallyHidden } from './ParcelPicker.styled';

type Props = {
  label: string;
  scenes: AtlasScene[];
  allowed?: Allowed;
  selected: Set<string>;
  onChange: (selected: Set<string>) => void;
  height: number;
  floatingContent?: ReactNode;
};

type Drag = { isSelectingParcels: boolean; from: Coord | null; to: Coord | null };
type Viewport = { nw: Coord; se: Coord };

const RIGHT_MOUSE_BUTTON_CLICK = 2;
const RENDER_MARGIN = 2;

const isInside = ({ nw, se }: Viewport, { x, y }: Coord) =>
  x > nw.x + RENDER_MARGIN &&
  x < se.x - RENDER_MARGIN &&
  y > se.y + RENDER_MARGIN &&
  y < nw.y - RENDER_MARGIN;

/** A parcel atlas with controlled selection; keyboard picking needs `allowed`. */
export function ParcelPickerMap({
  label,
  scenes,
  allowed,
  selected,
  onChange,
  height,
  floatingContent,
}: Props) {
  const instructionsId = useId();
  const [drag, setDrag] = useState<Drag>({ isSelectingParcels: false, from: null, to: null });
  const [cursor, setCursor] = useState<Coord | null>(null);
  const [showCursor, setShowCursor] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [center, setCenter] = useState<Coord | null>(null);
  const pointerFocus = useRef(false);
  const viewport = useRef<Viewport | null>(null);

  const sceneParcels = useMemo(
    () => new Set(scenes.flatMap(scene => scene.parcels ?? [])),
    [scenes],
  );

  const isAllowed = useCallback(
    (x: number, y: number) =>
      allowed
        ? allows(allowed, { x, y })
        : x >= MIN_COORDINATE && x <= MAX_COORDINATE && y >= MIN_COORDINATE && y <= MAX_COORDINATE,
    [allowed],
  );

  const isDragged = useCallback(
    (x: number, y: number) =>
      drag.isSelectingParcels &&
      !!drag.from &&
      !!drag.to &&
      x >= Math.min(drag.from.x, drag.to.x) &&
      x <= Math.max(drag.from.x, drag.to.x) &&
      y >= Math.min(drag.from.y, drag.to.y) &&
      y <= Math.max(drag.from.y, drag.to.y),
    [drag],
  );

  const selectedLayer = useCallback(
    (x: number, y: number) =>
      selected.has(coordsToId(x, y)) || isDragged(x, y)
        ? { color: WorldAtlasColors.selectedParcel, scale: 1.0 }
        : null,
    [selected, isDragged],
  );

  const selectedStrokeLayer = useCallback(
    (x: number, y: number) =>
      selected.has(coordsToId(x, y)) || isDragged(x, y)
        ? { color: WorldAtlasColors.selectedStroke, scale: 1.3 }
        : null,
    [selected, isDragged],
  );

  const isCursor = (x: number, y: number) =>
    showCursor && !!cursor && cursor.x === x && cursor.y === y;

  const cursorLayer = (x: number, y: number) =>
    isCursor(x, y) ? { color: dclColors.neutral.softWhite, scale: 1.4 } : null;

  const cursorTileLayer = (x: number, y: number) =>
    isCursor(x, y)
      ? {
          color: sceneParcels.has(coordsToId(x, y))
            ? WorldAtlasColors.sceneParcel
            : WorldAtlasColors.worldParcel,
          scale: 1.0,
        }
      : null;

  const announce = (coord: Coord, isSelected: boolean) =>
    setAnnouncement(
      t(isSelected ? 'parcel_picker.cursor_selected' : 'parcel_picker.cursor_not_selected', coord),
    );

  const keepInView = (coord: Coord) => {
    if (viewport.current && !isInside(viewport.current, coord)) setCenter(coord);
  };

  const toggle = (x: number, y: number) => {
    if (!isAllowed(x, y)) return;
    const key = coordsToId(x, y);
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange(next);
    setCursor({ x, y });
    return next.has(key);
  };

  const startingCursor = (): Coord | null => {
    if (!allowed) return null;
    const firstSelected = [...selected].find(id => allows(allowed, toCoord(id)));
    if (firstSelected) return toCoord(firstSelected);
    const dimensions = getWorldDimensions(scenes);
    return nearestParcel(
      {
        x: Math.floor((dimensions.minX + dimensions.maxX) / 2),
        y: Math.floor((dimensions.minY + dimensions.maxY) / 2),
      },
      allowed,
    );
  };

  const moveCursor = (direction: Direction) => {
    const from = cursor ?? startingCursor();
    if (!from || !allowed) return;
    const to = nextParcel(from, direction, allowed) ?? from;
    setCursor(to);
    announce(to, selected.has(toId(to)));
    keepInView(to);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (isDirection(event.key)) {
      event.preventDefault();
      setShowCursor(true);
      moveCursor(event.key);
    } else if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      setShowCursor(true);
      const at = cursor ?? startingCursor();
      if (!at) return;
      announce(at, !!toggle(at.x, at.y));
    }
  };

  const handleFocus = () => {
    const fromKeyboard = !pointerFocus.current;
    pointerFocus.current = false;
    setShowCursor(fromKeyboard);
    if (!fromKeyboard) return;
    const at = cursor ?? startingCursor();
    if (!at) return;
    setCursor(at);
    announce(at, selected.has(toId(at)));
    keepInView(at);
  };

  const handleMouseUp = () => {
    if (drag.isSelectingParcels && drag.from && drag.to) {
      const { from, to } = drag;
      if (from.x !== to.x || from.y !== to.y) {
        const next = new Set(selected);
        for (let px = Math.min(from.x, to.x); px <= Math.max(from.x, to.x); px++) {
          for (let py = Math.min(from.y, to.y); py <= Math.max(from.y, to.y); py++) {
            if (isAllowed(px, py)) next.add(coordsToId(px, py));
          }
        }
        onChange(next);
      }
    }
    setDrag({ isSelectingParcels: false, from: null, to: null });
  };

  const atlas = (
    <WorldAtlas
      height={height}
      worldScenes={scenes}
      showWorldSize={false}
      floatingContent={floatingContent}
      isDraggable={!drag.isSelectingParcels}
      layers={[cursorLayer, cursorTileLayer, selectedStrokeLayer, selectedLayer]}
      x={center?.x}
      y={center?.y}
      onChange={({ nw, se }: Viewport) => {
        viewport.current = { nw, se };
      }}
      onClick={(x: number, y: number) => void toggle(x, y)}
      onHover={(x: number, y: number) => {
        if (drag.isSelectingParcels && drag.from && isAllowed(x, y)) {
          setDrag(previous => ({ ...previous, to: { x, y } }));
        }
      }}
      onMouseDownEvent={event => {
        if (event.button !== RIGHT_MOUSE_BUTTON_CLICK) {
          setDrag(previous => ({ ...previous, isSelectingParcels: true }));
        }
      }}
      onMouseDown={(x: number, y: number) =>
        setDrag(previous => ({ ...previous, from: { x, y }, to: { x, y } }))
      }
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    />
  );

  if (!allowed) return <MapFrame>{atlas}</MapFrame>;

  return (
    <>
      <MapFrame
        tabIndex={0}
        role="application"
        aria-roledescription={t('parcel_picker.map_role')}
        aria-label={label}
        aria-describedby={instructionsId}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={() => {
          pointerFocus.current = false;
          setShowCursor(false);
        }}
        onMouseDown={() => {
          pointerFocus.current = true;
        }}
      >
        {atlas}
      </MapFrame>
      <VisuallyHidden id={instructionsId}>{t('parcel_picker.map_instructions')}</VisuallyHidden>
      <VisuallyHidden
        role="status"
        aria-live="polite"
      >
        {announcement}
      </VisuallyHidden>
    </>
  );
}
