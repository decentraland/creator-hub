import { type Server as HttpServer } from 'node:http';
import * as path from 'path';

import type { Result } from 'ts-results-es';
import { Ok, Err } from 'ts-results-es';
import type { Express, NextFunction, Request, Response } from 'express';
import express from 'express';

import { getAvailablePort } from '../port';
import { type ServerPort } from './client';

export type ChromeDevToolsFrontendServer = {
  isRunning(): boolean;

  start(): Promise<Result<ServerPort, string>>;

  port(): Result<ServerPort, string>;
};

export function newChromeDevToolsFrontendServer(
  staticServerDirPath: string,
): ChromeDevToolsFrontendServer {
  const expressAppInstance: Express = express();

  let runningServerPort: ServerPort | null = null;
  let serverInstance: HttpServer | null = null;

  function port(): Result<ServerPort, string> {
    if (runningServerPort === null) {
      return new Err('Server is not running, cannot provide port');
    }
    return new Ok(runningServerPort);
  }

  function isRunning(): boolean {
    return serverInstance?.listening ?? false;
  }

  async function start(): Promise<Result<ServerPort, string>> {
    const running = isRunning();
    if (running) {
      return new Err('Server is already running');
    }

    expressAppInstance.use((_req: Request, res: Response, next: NextFunction) => {
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
      res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
      next();
    });

    expressAppInstance.use(
      express.static(staticServerDirPath, { immutable: true, maxAge: '1h', index: 'index.html' }),
    );

    // SPA fallback
    expressAppInstance.use((_req: Request, res: Response) =>
      res.sendFile(path.join(staticServerDirPath, 'index.html')),
    );

    const port = await getAvailablePort();
    serverInstance = expressAppInstance.listen(port, '127.0.0.1');
    const serverReferenceCapture = serverInstance;
    await new Promise<void>(r => serverReferenceCapture.once('listening', () => r()));
    runningServerPort = { port };
    return new Ok(runningServerPort);
  }

  return {
    isRunning,
    start,
    port,
  };
}
