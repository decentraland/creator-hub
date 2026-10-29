import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AI_EXTERNAL_ACCESS_CHANGED, AI_EXTERNAL_ACCESS_REQUESTED } from '/shared/types/ipc';

const mocks = vi.hoisted(() => ({
  userData: '',
  exposeMcpServer: false,
  externalAccess: false,
  serverDown: false,
  setSceneMcpProject: vi.fn(),
  setExternalMcpAccess: vi.fn(),
  writeConfig: vi.fn(),
  send: vi.fn(),
}));

vi.mock('electron', () => ({ app: { getVersion: () => '9.9.9-test' } }));
vi.mock('electron-log/main', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../src/modules/electron', () => ({ getUserDataPath: () => mocks.userData }));
vi.mock('../src/mainWindow', () => ({ MAIN_WINDOW_ID: 'main' }));
vi.mock('../src/modules/window', () => ({
  getWindow: () => ({ isDestroyed: () => false, webContents: { send: mocks.send } }),
}));
vi.mock('../src/modules/config', () => ({
  getConfig: vi.fn(async () => ({ settings: { exposeMcpServer: mocks.exposeMcpServer } })),
  writeConfig: mocks.writeConfig,
}));
vi.mock('../src/modules/scene-mcp', () => ({
  setSceneMcpProject: mocks.setSceneMcpProject,
  setExternalMcpAccess: mocks.setExternalMcpAccess,
  getExternalMcpInfo: vi.fn(async () => {
    if (mocks.serverDown) throw new Error('port busy');
    if (!mocks.externalAccess) return null;
    // Like the real one: the server starts asynchronously, and access may be revoked meanwhile.
    await new Promise(r => setTimeout(r, 0));
    return mocks.externalAccess ? MCP : null;
  }),
}));

import type * as McpDiscoveryModule from '../src/modules/mcp-discovery';
import {
  MCP_DISCOVERY_FILE,
  accessRequestFilePath,
  discoveryFilePath,
  removeMcpDiscoveryFile,
  writeMcpDiscoveryFile,
} from '../src/modules/mcp-discovery';

type McpDiscovery = typeof McpDiscoveryModule;

const MCP = { url: 'http://127.0.0.1:65000/mcp', token: 'secret-token-xyz' };

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ch-mcp-discovery-'));
  mocks.userData = path.join(dir, 'userData');
  fs.mkdirSync(mocks.userData);
  mocks.exposeMcpServer = false;
  mocks.externalAccess = false;
  mocks.serverDown = false;
  mocks.setSceneMcpProject.mockReset();
  mocks.setExternalMcpAccess.mockReset().mockImplementation((enabled: boolean) => {
    mocks.externalAccess = enabled;
  });
  mocks.writeConfig
    .mockReset()
    .mockImplementation(async (config: { settings: { exposeMcpServer: boolean } }) => {
      mocks.exposeMcpServer = config.settings.exposeMcpServer;
    });
  mocks.send.mockReset();
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('the discovery file', () => {
  const info = { ...MCP, pid: 4242, startedAt: '2026-10-23T10:00:00.000Z', version: '1.2.3' };

  it('should live at <userData>/mcp-server.json', () => {
    expect(discoveryFilePath('/data')).toBe(path.join('/data', MCP_DISCOVERY_FILE));
    expect(discoveryFilePath()).toBe(path.join(mocks.userData, MCP_DISCOVERY_FILE));
  });

  describe('when written', () => {
    it('should hold url, token, pid, startedAt and version, owner-only', () => {
      const file = discoveryFilePath(mocks.userData);

      writeMcpDiscoveryFile(file, info);

      expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual(info);
      expect(fs.statSync(file).mode & 0o777).toBe(0o600);
      expect(fs.readdirSync(mocks.userData)).toEqual([MCP_DISCOVERY_FILE]); // no temp left
    });

    it('should overwrite a stale file from a previous run', () => {
      const file = discoveryFilePath(mocks.userData);
      writeMcpDiscoveryFile(file, { ...info, pid: 1, token: 'old' });

      writeMcpDiscoveryFile(file, info);

      expect(JSON.parse(fs.readFileSync(file, 'utf8')).token).toBe(MCP.token);
    });
  });

  describe('when removed', () => {
    it('should delete the file and tolerate it being absent', () => {
      const file = discoveryFilePath(mocks.userData);
      writeMcpDiscoveryFile(file, info);

      removeMcpDiscoveryFile(file);
      removeMcpDiscoveryFile(file);

      expect(fs.existsSync(file)).toBe(false);
    });
  });
});

describe('outside access to the MCP server', () => {
  let m: McpDiscovery;
  let scene: string;
  const discoveryFile = () => discoveryFilePath(mocks.userData);

  beforeEach(async () => {
    // The module keeps the open scene and pending request; start each test clean.
    vi.resetModules();
    m = await import('../src/modules/mcp-discovery');
    scene = path.join(dir, 'scene');
    fs.mkdirSync(scene);
  });
  afterEach(() => {
    m.stopWatchingAccessRequests();
  });

  describe('when the app starts with access on', () => {
    it('should write the discovery file with the outside token', async () => {
      mocks.exposeMcpServer = true;

      await m.initMcpDiscovery();

      const discovery = JSON.parse(fs.readFileSync(discoveryFile(), 'utf8'));
      expect(discovery).toMatchObject({ ...MCP, pid: process.pid, version: '9.9.9-test' });
      expect(Date.parse(discovery.startedAt)).not.toBeNaN();
    });
  });

  describe('when the app starts with access off', () => {
    it('should grant nothing and write nothing', async () => {
      await m.initMcpDiscovery();

      expect(mocks.setExternalMcpAccess).not.toHaveBeenCalledWith(true);
      expect(fs.existsSync(discoveryFile())).toBe(false);
    });
  });

  describe('when a scene is opened', () => {
    it('should point the server at it and write nothing into it', async () => {
      mocks.exposeMcpServer = true;
      await m.initMcpDiscovery();

      m.sceneOpened(scene);

      expect(mocks.setSceneMcpProject).toHaveBeenCalledWith(scene);
      expect(fs.readdirSync(scene)).toEqual([]);
    });
  });

  describe('when the scene closes', () => {
    it('should detach the server', () => {
      m.sceneOpened(scene);

      m.sceneClosed(scene);

      expect(mocks.setSceneMcpProject).toHaveBeenLastCalledWith(null);
    });

    it('should ignore a close for a scene that is no longer the open one', () => {
      const other = path.join(dir, 'other');
      m.sceneOpened(scene);
      m.sceneOpened(other);

      m.sceneClosed(scene);

      expect(mocks.setSceneMcpProject).toHaveBeenLastCalledWith(other);
    });
  });

  describe('when the server fails to start', () => {
    it('should log and write nothing', async () => {
      mocks.exposeMcpServer = true;
      mocks.serverDown = true;

      await expect(m.initMcpDiscovery()).resolves.toBeUndefined();

      expect(fs.existsSync(discoveryFile())).toBe(false);
    });
  });

  describe('when access is turned on', () => {
    it('should grant it, write the discovery file and tell the renderer', async () => {
      await m.syncExposeMcpServer(true);

      expect(mocks.setExternalMcpAccess).toHaveBeenCalledWith(true);
      expect(mocks.send).toHaveBeenCalledWith(AI_EXTERNAL_ACCESS_CHANGED);
      expect(fs.existsSync(discoveryFile())).toBe(true);
    });
  });

  describe('when access is turned off', () => {
    it('should revoke it, remove the discovery file and tell the renderer', async () => {
      mocks.exposeMcpServer = true;
      await m.initMcpDiscovery();

      await m.syncExposeMcpServer(false);

      expect(mocks.setExternalMcpAccess).toHaveBeenLastCalledWith(false);
      expect(mocks.send).toHaveBeenLastCalledWith(AI_EXTERNAL_ACCESS_CHANGED);
      expect(fs.existsSync(discoveryFile())).toBe(false);
    });

    it('should not leave a file behind when it is turned off while the server starts', async () => {
      const turningOn = m.syncExposeMcpServer(true);
      await m.syncExposeMcpServer(false);
      await turningOn;

      expect(fs.existsSync(discoveryFile())).toBe(false);
    });
  });

  describe('when the app quits', () => {
    it('should remove the discovery file', async () => {
      mocks.exposeMcpServer = true;
      await m.initMcpDiscovery();

      m.clearMcpDiscovery();

      expect(fs.existsSync(discoveryFile())).toBe(false);
    });
  });

  describe('when an agent asks for access', () => {
    const request = () => fs.writeFileSync(accessRequestFilePath(mocks.userData), '');

    describe('and access is off', () => {
      it('should ask the creator once, consume the request and grant nothing', async () => {
        await m.initMcpDiscovery();

        request();

        await vi.waitFor(() =>
          expect(mocks.send).toHaveBeenCalledWith(AI_EXTERNAL_ACCESS_REQUESTED),
        );
        expect(fs.existsSync(accessRequestFilePath(mocks.userData))).toBe(false);
        expect(mocks.writeConfig).not.toHaveBeenCalled();
        expect(mocks.setExternalMcpAccess).not.toHaveBeenCalledWith(true);
        expect(fs.existsSync(discoveryFile())).toBe(false);
        expect(m.takeExternalAccessRequest()).toBe(true);
        expect(m.takeExternalAccessRequest()).toBe(false);
      });

      it('should ask about a request made while the Hub was closed', async () => {
        request();

        await m.initMcpDiscovery();

        await vi.waitFor(() => expect(m.takeExternalAccessRequest()).toBe(true));
        expect(fs.existsSync(discoveryFile())).toBe(false);
      });
    });

    describe('and access is already on', () => {
      it('should refresh the discovery file without asking', async () => {
        mocks.exposeMcpServer = true;
        await m.initMcpDiscovery();
        removeMcpDiscoveryFile(discoveryFile());

        request();

        await vi.waitFor(() => expect(fs.existsSync(discoveryFile())).toBe(true));
        expect(m.takeExternalAccessRequest()).toBe(false);
      });
    });

    describe('and the creator turns access on from Settings before answering', () => {
      it('should drop the question', async () => {
        request();
        await m.initMcpDiscovery();
        await vi.waitFor(() =>
          expect(mocks.send).toHaveBeenCalledWith(AI_EXTERNAL_ACCESS_REQUESTED),
        );

        await m.syncExposeMcpServer(true);

        expect(m.takeExternalAccessRequest()).toBe(false);
      });
    });
  });
});
