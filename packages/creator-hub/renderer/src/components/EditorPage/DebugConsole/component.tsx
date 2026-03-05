import { useCallback, useEffect, useRef, useState } from 'react';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import Convert from 'ansi-to-html';

import { createCircularBuffer } from '/shared/circular-buffer';

import { editor } from '#preload';

import {
  Container,
  Header,
  HeaderControls,
  HeaderTitle,
  IconButton,
  Logs,
  Placeholder,
} from './component.styled';

const MAX_LOGS = 1000;
const convert = new Convert({ escapeXML: true });
const PANEL_SIZES = [150, 250, 400];

type Props = {
  path: string;
  isPreviewRunning: boolean;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
};

export function DebugConsole({ path, isPreviewRunning, isCollapsed, onToggleCollapse }: Props) {
  const logsRef = useRef<HTMLDivElement>(null);
  const logsBuffer = useRef(createCircularBuffer<string>(MAX_LOGS));
  const [, forceUpdate] = useState(0);
  const [sizeIndex, setSizeIndex] = useState(0);

  const pendingScrollRef = useRef(false);

  const log = useCallback((messages: string[] | string) => {
    const items = Array.isArray(messages) ? messages : [messages];
    if (items.length === 0) return;

    for (const message of items) {
      logsBuffer.current.push(convert.toHtml(message));
    }
    forceUpdate(prev => prev + 1);

    if (!pendingScrollRef.current) {
      pendingScrollRef.current = true;
      requestAnimationFrame(() => {
        pendingScrollRef.current = false;
        if (logsRef.current) {
          logsRef.current.scrollTop = logsRef.current.scrollHeight;
        }
      });
    }
  }, []);

  const handleClear = useCallback(() => {
    logsBuffer.current.clear();
    forceUpdate(prev => prev + 1);
  }, []);

  const handleGrow = useCallback(() => {
    setSizeIndex(prev => Math.min(prev + 1, PANEL_SIZES.length - 1));
  }, []);

  const handleShrink = useCallback(() => {
    setSizeIndex(prev => Math.max(prev - 1, 0));
  }, []);

  // Attach to preview logs when preview is running
  useEffect(() => {
    if (!isPreviewRunning || !path) return;

    // Clear logs on new preview run
    logsBuffer.current.clear();
    forceUpdate(prev => prev + 1);

    let aborted = false;
    let cleanupFn: (() => void) | undefined;

    editor
      .attachSceneDebugger(path, log)
      .then(({ cleanup }) => {
        if (aborted) {
          cleanup();
        } else {
          cleanupFn = cleanup;
        }
      })
      .catch(() => {
        // Preview may have exited before we could attach
      });

    return () => {
      aborted = true;
      cleanupFn?.();
    };
  }, [isPreviewRunning, path, log]);

  const logs = logsBuffer.current.getAll();
  const panelHeight = isCollapsed ? 32 : PANEL_SIZES[sizeIndex];

  return (
    <Container style={{ height: panelHeight }}>
      <Header onDoubleClick={onToggleCollapse}>
        <HeaderTitle>Debug Console</HeaderTitle>
        <HeaderControls>
          {!isCollapsed && (
            <>
              <IconButton
                onClick={handleClear}
                title="Clear"
              >
                <DeleteOutlineIcon />
              </IconButton>
              <IconButton
                onClick={handleShrink}
                title="Shrink"
                disabled={sizeIndex === 0}
              >
                <KeyboardArrowDownIcon />
              </IconButton>
              <IconButton
                onClick={handleGrow}
                title="Grow"
                disabled={sizeIndex === PANEL_SIZES.length - 1}
              >
                <KeyboardArrowUpIcon />
              </IconButton>
            </>
          )}
          <IconButton
            onClick={onToggleCollapse}
            title={isCollapsed ? 'Expand' : 'Collapse'}
          >
            {isCollapsed ? <ExpandMoreIcon /> : <ExpandLessIcon />}
          </IconButton>
        </HeaderControls>
      </Header>
      {!isCollapsed &&
        (logs.length > 0 ? (
          <Logs ref={logsRef}>
            {logs.map((line, i) => (
              <span
                key={i}
                dangerouslySetInnerHTML={{ __html: line }}
              />
            ))}
          </Logs>
        ) : (
          <Placeholder>Run a scene to see debug output</Placeholder>
        ))}
    </Container>
  );
}
