import React from 'react';
import { createRoot } from 'react-dom/client';
import { Provider as StoreProvider } from 'react-redux';
import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { dark } from 'decentraland-ui2/dist/theme';

import { store } from '#store';
import { TranslationProvider } from '/@/components/TranslationProvider';

import { HomePage } from './components/HomePage';
import { ScenesPage } from './components/ScenesPage';
import { EditorPage } from './components/EditorPage';
import { CollectionsPage } from './components/CollectionsPage';
import { ManagePage } from './components/ManagePage';
import { LearnPage } from './components/LearnPage';

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
                path="/editor"
                element={<EditorPage />}
              />
            </Routes>
            <Snackbar />
          </Router>
        </ThemeProvider>
      </TranslationProvider>
    </StoreProvider>
  </React.StrictMode>,
);
