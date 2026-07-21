import React, { useEffect, useRef } from 'react';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';

import { debounce } from '../../../lib/utils/debounce';
import { getSnapshot, loadAndParse, subscribe } from './store';

import './CodeEditorPanel.css';

// Monaco spawns language workers; under the inspector's esbuild/iframe build we
// don't ship worker bundles yet, so hand it a no-op worker. Syntax highlighting
// runs on the main thread; TS intellisense/validation are disabled for the PoC.
function installMonacoEnvironment() {
  const g = self as unknown as { MonacoEnvironment?: unknown };
  if (g.MonacoEnvironment) return;
  g.MonacoEnvironment = {
    getWorker() {
      const blob = new Blob(['self.onmessage=()=>{}'], { type: 'application/javascript' });
      return new Worker(URL.createObjectURL(blob));
    },
  };
}

// The live code editor. The store's source buffer is the single source of
// truth: typing here (debounced) reparses and updates the canvas; a canvas edit
// updates the buffer, which we reflect back into the editor. `applyingExternal`
// guards against the reflect-back re-triggering a parse (no feedback loop).
export const CodeEditorPanel: React.FC = () => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const applyingExternal = useRef(false);

  useEffect(() => {
    if (!hostRef.current) return;
    installMonacoEnvironment();

    const editor = monaco.editor.create(hostRef.current, {
      value: getSnapshot().source,
      language: 'typescript',
      theme: 'vs-dark',
      minimap: { enabled: false },
      automaticLayout: true,
      fontSize: 13,
      tabSize: 2,
      scrollBeyondLastLine: false,
    });
    editorRef.current = editor;

    const reparse = debounce((src: string) => {
      void loadAndParse(getSnapshot().filename ?? 'ui.tsx', src);
    }, 250);

    const changeSub = editor.onDidChangeModelContent(() => {
      if (applyingExternal.current) return;
      reparse(editor.getValue());
    });

    // Reflect canvas-driven source changes back into the editor.
    const unsubscribe = subscribe(() => {
      const next = getSnapshot().source;
      const ed = editorRef.current;
      if (!ed || ed.getValue() === next) return;
      applyingExternal.current = true;
      const pos = ed.getPosition();
      ed.setValue(next);
      if (pos) ed.setPosition(pos);
      applyingExternal.current = false;
    });

    return () => {
      changeSub.dispose();
      unsubscribe();
      editor.dispose();
      editorRef.current = null;
    };
  }, []);

  return (
    <div
      className="ui-designer-code-editor"
      ref={hostRef}
    />
  );
};
