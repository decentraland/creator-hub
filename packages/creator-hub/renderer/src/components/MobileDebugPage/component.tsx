import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Typography, Button, Box } from 'decentraland-ui2';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PhoneAndroidIcon from '@mui/icons-material/PhoneAndroid';

import { editor } from '#preload';
import type { MobileDebugSessionInfo } from '/shared/types/ipc';

import { Navbar, NavbarItem } from '../Navbar';
import { Footer } from '../Footer';
import { useEditor } from '/@/hooks/useEditor';

import './styles.css';

export function MobileDebugPage() {
  const navigate = useNavigate();
  const { version } = useEditor();
  const [deeplink, setDeeplink] = useState<{ url: string; qr: string; port: number } | null>(null);
  const [sessions, setSessions] = useState<MobileDebugSessionInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeRef = useRef(true);

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
          setError(err.message || 'Failed to start mobile debug server');
          setLoading(false);
        }
      });

    return () => {
      activeRef.current = false;
      void editor.stopMobileDebugServer().catch(err => {
        console.warn('[MobileDebugPage] stopMobileDebugServer failed:', err);
      });
    };
  }, []);

  useEffect(() => {
    if (!deeplink) return;

    let active = true;
    const poll = async () => {
      try {
        const result = await editor.getMobileDebugSessions();
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

  const [entryCount, setEntryCount] = useState(0);
  useEffect(() => {
    if (!deeplink) return;
    const unsubscribe = editor.onMobileDebugEntries(({ entries }) => {
      setEntryCount(prev => prev + entries.length);
    });
    return unsubscribe;
  }, [deeplink]);

  const handleBack = useCallback(() => {
    navigate('/');
  }, [navigate]);

  const handleCopyUrl = useCallback(() => {
    if (deeplink) {
      navigator.clipboard.writeText(deeplink.url).catch(err => {
        console.warn('[MobileDebugPage] clipboard write failed:', err);
      });
    }
  }, [deeplink]);

  return (
    <>
      <main className="MobileDebugPage">
        <Navbar active={NavbarItem.HOME} />
        <Container>
          <Box className="MobileDebugPage-header">
            <Button
              variant="text"
              color="secondary"
              startIcon={<ArrowBackIcon />}
              onClick={handleBack}
            >
              Back
            </Button>
            <Typography variant="h4">Mobile Debug Session</Typography>
            <Typography
              variant="body2"
              color="textSecondary"
            >
              Connect a mobile device to inspect a running Decentraland scene without opening a
              project.
            </Typography>
          </Box>

          {loading && (
            <Box className="MobileDebugPage-loading">
              <Typography variant="body1">Starting mobile debug server...</Typography>
            </Box>
          )}

          {error && (
            <Box className="MobileDebugPage-error">
              <Typography
                variant="body1"
                color="error"
              >
                {error}
              </Typography>
            </Box>
          )}

          {deeplink && (
            <Box className="MobileDebugPage-content">
              <Box className="MobileDebugPage-qrSection">
                <Box className="MobileDebugPage-qrContainer">
                  <img
                    src={deeplink.qr}
                    alt="QR Code"
                    className="MobileDebugPage-qrImage"
                  />
                </Box>
                <Typography
                  variant="body2"
                  className="MobileDebugPage-url"
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
                  Scan the QR code with your mobile device running the Decentraland app. The mobile
                  debug session will be established automatically.
                </Typography>
              </Box>

              <Box className="MobileDebugPage-sessionsSection">
                <Typography variant="h6">
                  <PhoneAndroidIcon fontSize="small" /> Connected Sessions
                </Typography>
                {sessions.length === 0 ? (
                  <Box className="MobileDebugPage-waiting">
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
                  <Box className="MobileDebugPage-sessionList">
                    {sessions.map(s => (
                      <Box
                        key={s.id}
                        className="MobileDebugPage-sessionItem"
                      >
                        <span className="MobileDebugPage-sessionBadge">Session #{s.id}</span>
                        <span className="MobileDebugPage-sessionMessages">
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
