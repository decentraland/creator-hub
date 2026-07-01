import type { EngineWindow } from './console';
import { consoleCommand, engineReady } from './console';

/**
 * The same-origin console seam to the bevy engine. Exercised with a fake engine
 * window (no wasm) — the transport is pure function dispatch, so this fully
 * covers ready-detection and the command-shape dispatch that the CRDT/gizmo
 * slices will build on.
 */
describe('bevy console transport', () => {
  describe('engineReady', () => {
    it('should be false for null/undefined windows', () => {
      expect(engineReady(null)).toBe(false);
      expect(engineReady(undefined)).toBe(false);
    });

    it('should be false before the console function is installed', () => {
      expect(engineReady({} as EngineWindow)).toBe(false);
    });

    it('should be true once engine_console_command_args exists', () => {
      const win = { engine_console_command_args: async () => '' } as unknown as EngineWindow;
      expect(engineReady(win)).toBe(true);
    });

    it('should be true with only the legacy single-string command', () => {
      const win = { engine_console_command: async () => '' } as unknown as EngineWindow;
      expect(engineReady(win)).toBe(true);
    });

    it('should be false (not throw) when accessing the window throws', () => {
      const win = {
        get engine_console_command_args(): never {
          throw new Error('cross-origin');
        },
      } as unknown as EngineWindow;
      expect(engineReady(win)).toBe(false);
    });
  });

  describe('consoleCommand', () => {
    it('should call engine_console_command_args with cmd + args and return the reply', async () => {
      const calls: Array<{ cmd: string; args: string[] }> = [];
      const win = {
        engine_console_command_args: async (cmd: string, args: string[]) => {
          calls.push({ cmd, args });
          return 'ok';
        },
      } as unknown as EngineWindow;

      const reply = await consoleCommand(win, 'crdt_snapshot');
      expect(reply).toBe('ok');
      expect(calls).toEqual([{ cmd: 'crdt_snapshot', args: [] }]);

      await consoleCommand(win, 'set_component', ['512', 'Transform', '{}']);
      expect(calls[1]).toEqual({ cmd: 'set_component', args: ['512', 'Transform', '{}'] });
    });

    it('should fall back to the single-string command, joining cmd + args', async () => {
      let received = '';
      const win = {
        engine_console_command: async (line: string) => {
          received = line;
          return 'done';
        },
      } as unknown as EngineWindow;

      const reply = await consoleCommand(win, 'reload', ['abc123']);
      expect(reply).toBe('done');
      expect(received).toBe('reload abc123');
    });

    it('should reject when no console API is available', async () => {
      await expect(consoleCommand({} as EngineWindow, 'crdt_snapshot')).rejects.toThrow(
        'console API not available',
      );
    });
  });
});
