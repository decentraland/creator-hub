import path from 'node:path';
import { type Server as HttpServer } from 'node:http';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { app as electronApp, shell } from 'electron';
import { getAvailablePort } from '../port';
import { waitReadyForServerPath } from './download-daemon';

type ServerPort = number;

let runningServerPort: ServerPort | null = null;

async function startDevToolsFrontendStaticServerIfNot(): Promise<ServerPort> {
  // Nothing terminates server in normal flow
  // Lifetime of the server aligns to lifetime of the electron app when it's created
  if (runningServerPort !== null) return runningServerPort;

  const serverPath = await waitReadyForServerPath();
  const port = await startExpressStaticServer(serverPath);
  runningServerPort = port;
  return runningServerPort;
}

export async function startExpressStaticServer(root?: string): Promise<ServerPort> {
  const app = express();
  const staticRoot =
    root ??
    (electronApp.isPackaged
      ? path.join(process.resourcesPath, 'static')
      : path.resolve(__dirname, '..', 'static'));

  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    next();
  });

  app.use(express.static(staticRoot, { immutable: true, maxAge: '1h', index: 'index.html' }));

  // SPA fallback
  app.use((_req: Request, res: Response) => res.sendFile(path.join(staticRoot, 'index.html')));

  const port = await getAvailablePort();
  const server: HttpServer = app.listen(port, '127.0.0.1');
  await new Promise<void>(r => server.once('listening', () => r()));
  return port;
}

export async function openDevToolsTab(port: number) {
  const frontendServerPort: ServerPort = await startDevToolsFrontendStaticServerIfNot();
  const url = `http://localhost:${frontendServerPort}/inspector.html?ws=127.0.0.1:${port}`;
  await shell.openExternal(url);
}
