import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Typography, Button, Box } from 'decentraland-ui2';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PhoneAndroidIcon from '@mui/icons-material/PhoneAndroid';

import { editor } from '#preload';

import { Navbar, NavbarItem } from '../Navbar';
import { Footer } from '../Footer';
import { useEditor } from '/@/hooks/useEditor';

import './styles.css';

interface SessionInfo {
  id: number;
  sessionId: string | null;
  connectedAt: string;
  messageCount: number;
}

export function SceneInspectorPage() {
  const navigate = useNavigate();
  const { version } = useEditor();
  const [deeplink, setDeeplink] = useState<{ url: string; qr: string; port: number } | null>(null);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeRef = useRef(true);

  // Start server and get deeplink on mount
  useEffect(() => {
    activeRef.current = true;
    setLoading(true);
    editor
      .getStandaloneDeeplink()
      .then(result => {
        if (activeRef.current) {
          setDeeplink(result);
          setLoading(false);
        }
      })
      .catch((err: Error) => {
        if (activeRef.current) {
          setError(err.message || 'Failed to start scene log server');
          setLoading(false);
        }
      });

    return () => {
      activeRef.current = false;
    };
  }, []);

  // Poll sessions
  useEffect(() => {
    if (!deeplink) return;

    let active = true;
    const poll = async () => {
      try {
        const result = await editor.getSceneLogSessions();
        if (active) setSessions(result);
      } catch {
        // ignore
      }
    };

    poll();
    const interval = setInterval(poll, 2000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [deeplink]);

  // Forward entries to console (push-based)
  const [entryCount, setEntryCount] = useState(0);
  useEffect(() => {
    if (!deeplink) return;
    const unsubscribe = editor.onSceneLogEntries(({ entries }) => {
      setEntryCount(prev => prev + entries.length);
    });
    return unsubscribe;
  }, [deeplink]);

  const handleBack = useCallback(() => {
    navigate('/');
  }, [navigate]);

  const handleCopyUrl = useCallback(() => {
    if (deeplink) {
      void editor.broadcastSceneLogCommand('get_status', {});
      navigator.clipboard.writeText(deeplink.url).catch(() => {});
    }
  }, [deeplink]);

  return (
    <>
      <main className="SceneInspectorPage">
        <Navbar active={NavbarItem.HOME} />
        <Container>
          <Box className="SceneInspectorPage-header">
            <Button
              variant="text"
              color="secondary"
              startIcon={<ArrowBackIcon />}
              onClick={handleBack}
            >
              Back
            </Button>
            <Typography variant="h4">Scene Inspector</Typography>
            <Typography
              variant="body2"
              color="textSecondary"
            >
              Connect a mobile device to inspect a running Decentraland scene without opening a
              project.
            </Typography>
          </Box>

          {loading && (
            <Box className="SceneInspectorPage-loading">
              <Typography variant="body1">Starting scene log server...</Typography>
            </Box>
          )}

          {error && (
            <Box className="SceneInspectorPage-error">
              <Typography
                variant="body1"
                color="error"
              >
                {error}
              </Typography>
            </Box>
          )}

          {deeplink && (
            <Box className="SceneInspectorPage-content">
              <Box className="SceneInspectorPage-qrSection">
                <Box className="SceneInspectorPage-qrContainer">
                  <img
                    src={deeplink.qr}
                    alt="QR Code"
                    className="SceneInspectorPage-qrImage"
                  />
                </Box>
                <Typography
                  variant="body2"
                  className="SceneInspectorPage-url"
                >
                  {deeplink.url}
                </Typography>
                <Button
                  variant="outlined"
                  color="secondary"
                  size="small"
                  onClick={handleCopyUrl}
                >
                  Copy URL
                </Button>
                <Typography
                  variant="caption"
                  color="textSecondary"
                >
                  Scan the QR code with your mobile device running the Decentraland app. The scene
                  logging connection will be established automatically.
                </Typography>
              </Box>

              <Box className="SceneInspectorPage-sessionsSection">
                <Typography variant="h6">
                  <PhoneAndroidIcon fontSize="small" /> Connected Sessions
                </Typography>
                {sessions.length === 0 ? (
                  <Box className="SceneInspectorPage-waiting">
                    <Typography
                      variant="body2"
                      color="textSecondary"
                    >
                      Waiting for mobile connection...
                    </Typography>
                    <Typography
                      variant="caption"
                      color="textSecondary"
                    >
                      WebSocket server running on port {deeplink.port}
                    </Typography>
                  </Box>
                ) : (
                  <Box className="SceneInspectorPage-sessionList">
                    {sessions.map(s => (
                      <Box
                        key={s.id}
                        className="SceneInspectorPage-sessionItem"
                      >
                        <span className="SceneInspectorPage-sessionBadge">Session #{s.id}</span>
                        <span className="SceneInspectorPage-sessionMessages">
                          {s.messageCount.toLocaleString()} entries
                        </span>
                      </Box>
                    ))}
                    <Typography
                      variant="body2"
                      color="textSecondary"
                      mt={1}
                    >
                      Total entries received: {entryCount.toLocaleString()}
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>
          )}
        </Container>
      </main>
      {version && <Footer version={version} />}
    </>
  );
}
