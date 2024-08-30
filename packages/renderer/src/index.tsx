import React from 'react';
import { createRoot } from 'react-dom/client';
import { Provider as StoreProvider } from 'react-redux';
import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { dark } from 'decentraland-ui2/dist/theme';

import { store } from '#store';
import { TranslationProvider } from '/@/components/TranslationProvider';
import { AuthProvider } from '/@/components/AuthProvider';

import { HomePage } from './components/HomePage';
import { ScenesPage } from './components/ScenesPage';
import { EditorPage } from './components/EditorPage';
import { CollectionsPage } from './components/CollectionsPage';
import { ManagePage } from './components/ManagePage';
import { LearnPage } from './components/LearnPage';
import { SignInPage } from './components/SignInPage';
import { TemplatesPage } from './components/TemplatesPage';
import { MorePage } from './components/MorePage';

import { Snackbar } from './components/Snackbar';
import { Install } from './components/Install';

import '/@/themes';

const container = document.getElementById('app')!;
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <StoreProvider store={store}>
      <TranslationProvider>
        <ThemeProvider theme={dark}>
          <Router>
            <AuthProvider>
              <Routes>
                <Route
                  path="/"
                  element={<Install />}
                />
                <Route
                  path="/home"
                  element={<HomePage />}
                />
                <Route
                  path="/scenes"
                  element={<ScenesPage />}
                />
                <Route
                  path="/templates"
                  element={<TemplatesPage />}
                />
                <Route
                  path="/collections"
                  element={<CollectionsPage />}
                />
                <Route
                  path="/manage"
                  element={<ManagePage />}
                />
                <Route
                  path="/learn"
                  element={<LearnPage />}
                />
                <Route
                  path="/more"
                  element={<MorePage />}
                />
                <Route
                  path="/editor"
                  element={<EditorPage />}
                />
                <Route
                  path="/sign-in"
                  element={<SignInPage />}
                />
              </Routes>
              <Snackbar />
            </AuthProvider>
          </Router>
        </ThemeProvider>
      </TranslationProvider>
    </StoreProvider>
  </React.StrictMode>,
);
