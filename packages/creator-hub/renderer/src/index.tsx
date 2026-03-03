import React from 'react';
import { createRoot } from 'react-dom/client';
import { Provider as StoreProvider } from 'react-redux';

import { MemoryRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { init as reactInit } from '@sentry/react';
import {
  init as SentryInit,
  browserTracingIntegration,
  replayIntegration,
} from '@sentry/electron/renderer';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';
import { TranslationProvider } from '/@/components/TranslationProvider';

import { AuthProvider } from '/@/components/AuthProvider';

import { AppLayout } from '/@/components/AppLayout';
import { ScenesPage } from '/@/components/ScenesPage';
import { EditorPage } from '/@/components/EditorPage';
import { LearnPage } from '/@/components/LearnPage';
import { SignInPage } from '/@/components/SignInPage';
import { TemplatesPage } from '/@/components/TemplatesPage';
import { MorePage } from '/@/components/MorePage';
import { Snackbar } from '/@/components/Snackbar';

import { store } from '#store';

import '/@/themes';

const container = document.getElementById('app')!;
const root = createRoot(container);

if (import.meta.env.PROD) {
  SentryInit(
    {
      integrations: [browserTracingIntegration(), replayIntegration()],
      release: import.meta.env.VITE_APP_VERSION,
      tracesSampleRate: 0.001,
      replaysSessionSampleRate: 0.01,
      replaysOnErrorSampleRate: 0.01,
      enabled: import.meta.env.PROD,
    },
    reactInit as any,
  );
}

root.render(
  <React.StrictMode>
    <StoreProvider store={store}>
      <TranslationProvider>
        <ThemeProvider theme={dark}>
          <main className="Main">
            <Router>
              <AuthProvider>
                <Routes>
                  {/* Full-screen routes (no sidebar) */}
                  <Route
                    path="/editor"
                    element={<EditorPage />}
                  />
                  <Route
                    path="/sign-in"
                    element={<SignInPage />}
                  />

                  {/* Sidebar layout routes */}
                  <Route element={<AppLayout />}>
                    <Route
                      path="/scenes"
                      element={<ScenesPage />}
                    />
                    <Route
                      path="/templates"
                      element={<TemplatesPage />}
                    />
                    <Route
                      path="/learn"
                      element={<LearnPage />}
                    />
                    <Route
                      path="/learn/videos"
                      element={
                        <Navigate
                          to="/learn"
                          replace
                        />
                      }
                    />
                    <Route
                      path="/learn/docs"
                      element={
                        <Navigate
                          to="/learn"
                          replace
                        />
                      }
                    />
                    <Route
                      path="/more"
                      element={<MorePage />}
                    />
                    <Route
                      path="/resources"
                      element={<MorePage />}
                    />
                    {/* Default: redirect to Scenes */}
                    <Route
                      path="*"
                      element={
                        <Navigate
                          to="/scenes"
                          replace
                        />
                      }
                    />
                  </Route>
                </Routes>
                <Snackbar />
              </AuthProvider>
            </Router>
          </main>
        </ThemeProvider>
      </TranslationProvider>
    </StoreProvider>
  </React.StrictMode>,
);
