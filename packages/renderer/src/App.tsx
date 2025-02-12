import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';

import { WindowId } from '/shared/types/window';

import { AuthProvider } from '/@/components/AuthProvider';

import { HomePage } from '/@/components/HomePage';
import { ScenesPage } from '/@/components/ScenesPage';
import { EditorPage } from '/@/components/EditorPage';
import { CollectionsPage } from '/@/components/CollectionsPage';
import { ManagePage } from '/@/components/ManagePage';
import { LearnPage } from '/@/components/LearnPage';
import { SignInPage } from '/@/components/SignInPage';
import { TemplatesPage } from '/@/components/TemplatesPage';
import { MorePage } from '/@/components/MorePage';
import { VideosPage } from '/@/components/VideosPage';
import { DocsPage } from '/@/components/DocsPage';

import { Snackbar } from '/@/components/Snackbar';
import { Install } from '/@/components/Install';

function getWindowParam(): WindowId | null {
  const url = new URL(window.location.href);
  const windowId = url.searchParams.get('window');
  return windowId ? (windowId as WindowId) : null;
}

export function App() {
  const windowId = getWindowParam();

  switch (windowId) {
    case WindowId.Logs:
      return <Logs />;
    default:
      return <Main />;
  }
}

function Logs() {
  return (
    <main>
      Logs
    </main>
  );
}

function Main() {
  return (
    <main className="Main">
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
              path="/learn/videos"
              element={<VideosPage />}
            />
            <Route
              path="/learn/docs"
              element={<DocsPage />}
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
    </main>
  );
}
